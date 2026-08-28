// ===== utils/nextPrayerNotification.ts =====
// إشعار "الصلاة القادمة" — منفصل تماماً عن أذان notifeeAzan.ts (ذاك يشغل
// صوت الأذان الكامل بالضبط بوقت الصلاة). هذا الملف بس معلوماتي: يبين اسم
// الصلاة الجاية ووقتها، بخلفية زرقاء (colorized)، وتحته زرين إجراء (نفس
// مبدأ واتساب: "رد"/"تمييز كمقروءة" لكنه هنا "أوقات الصلاة"/"التسبيح").
//
// آلية "الوقت المتبقي" الحية (تعد ثانية بثانية) غير ممكنة بإشعار عادي بدون
// خدمة أمامية مستمرة (استنزاف بطارية غير مبرر لميزة تجميلية). البديل العملي
// المعتمد هنا: نجدول إشعار جديد بالضبط لحظة دخول كل صلاة، يعرض اسم الصلاة
// "التالية" لها ووقتها الثابت (مثال: يدخل وقت الظهر → يطلع إشعار "العصر -
// ٤:١٥ م"). يعني الإشعار يتحدث تلقائياً ٥ مرات باليوم عند كل تبديل صلاة،
// بدون حاجة لخدمة خلفية دائمة.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { getAllOccasions, getHijriParts } from './hijriOccasions';

type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
type PrayerTimesInput = Record<PrayerKey, string>;

const PRAYER_ORDER: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const PRAYER_TITLES: Record<PrayerKey, string> = {
  fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء',
};

const CHANNEL_ID = 'next-prayer-status';
const NOTIF_IDS_KEY = 'noor_nextPrayerNotifIds';
// معرّف ثابت لإشعار "الحالة الحالية" (displayCurrentPrayerNotification) -
// يضمن التحديث بمكانه بدل تكرار نسخ جديدة بكل فتحة تطبيق
const CURRENT_STATUS_NOTIF_ID = 'next-prayer-current-status';
const OPEN_PRAYER_TIMES_ACTION = 'open-prayer-times';
const OPEN_TASBIH_ACTION = 'open-tasbih';

// نفس أسلوب notifeeAzan.ts - استيراد ديناميكي حتى الملف ما يكسر شي قبل تنصيب
// @notifee/react-native + rebuild
function getNotifee() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@notifee/react-native').default as typeof import('@notifee/react-native').default;
}
function getNotifeeTypes() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@notifee/react-native') as typeof import('@notifee/react-native');
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  const notifee = getNotifee();
  const { AndroidImportance } = getNotifeeTypes();
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'الصلاة القادمة',
    importance: AndroidImportance.DEFAULT,
  });
}

// يرجع سطر مختصر بمناسبة اليوم الهجري إذا موجودة، أو null إذا اليوم عادي.
// يستخدم فقط بأول مناسبة باليوم (لو فيه أكثر من وحدة نادراً) حتى ما يطول
// الإشعار.
function getTodayOccasionLine(): string | null {
  const hijri = getHijriParts(new Date());
  if (!hijri.month || !hijri.day) return null;
  const occs = getAllOccasions(hijri.month, hijri.day);
  if (occs.length === 0) return null;
  const first = occs[0];
  const icon = first.type === 'sorrow' ? '🕯️' : '🌙';
  return `${icon} ${first.name}`;
}

// ===== يبني محتوى الإشعار (عنوان + جسم) لصلاة معيّنة "تالية" =====
function buildNotificationContent(nextKey: PrayerKey, nextTimeLabel: string) {
  const nextTitle = PRAYER_TITLES[nextKey];
  const occasionLine = getTodayOccasionLine();
  const body = occasionLine
    ? `الساعة ${nextTimeLabel}\n${occasionLine}`
    : `الساعة ${nextTimeLabel}`;
  return { title: `صلاة ${nextTitle}`, body };
}

// ===== عرض فوري للحالة الحالية - يظهر مباشرة لحظة فتح التطبيق =====
// ⚠️ إضافة: قبل هذا، الإشعار الثابت ما كان يبين إلا بلحظة دخول أول صلاة
// *مستقبلية* بعد الجدولة (يعني لو المستخدم فتح التطبيق بمنتصف اليوم، ما
// يشوف إشعار "الصلاة القادمة" إلا لما توصل الصلاة الجاية فعلياً - أحياناً
// بعد ساعات). هذا يخالف توقع المستخدم (إشعار ثابت من لحظة فتح التطبيق،
// نفس تطبيقات المنافسين زي "حقيبة المؤمن"). الحل: نحسب الصلاة "التالية"
// الحالية (بناءً على الوقت الحالي، مو انتظار جدولة مستقبلية) ونعرضها فوراً
// عبر notifee.displayNotification - بنفس تنسيق الإشعارات المجدولة بالضبط.
export async function displayCurrentPrayerNotification(times: PrayerTimesInput): Promise<void> {
  if (Platform.OS !== 'android') return;

  const notifee = getNotifee();
  const { AndroidVisibility, AndroidCategory } = getNotifeeTypes();
  await ensureChannel();

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // نلگي أقرب صلاة "قادمة" (لسا ما وصل وقتها اليوم)؛ لو كل صلوات اليوم فاتت،
  // نرجع لفجر باچر (أول صلاة باليوم الجاي)
  let nextKey: PrayerKey = 'fajr';
  let found = false;
  for (const key of PRAYER_ORDER) {
    const [h, m] = times[key].split(':').map(Number);
    if (h * 60 + m > nowMinutes) {
      nextKey = key;
      found = true;
      break;
    }
  }
  if (!found) nextKey = 'fajr'; // كل الصلوات فاتت اليوم -> نعرض فجر باچر كـ"القادمة"

  const { title, body } = buildNotificationContent(nextKey, times[nextKey]);

  try {
    await notifee.displayNotification({
      // ⚠️ إصلاح: بدون id ثابت، notifee يسوي إشعار جديد كل استدعاء (يعني
      // كل فتحة تطبيق = نسخة جديدة تتكدس فوق القديمة بدل ما تحدّثها) - هذا
      // بالضبط سبب "صلاة العصر" تطلع 3 مرات مكررة. id ثابت يخلي notifee
      // يحدّث نفس الإشعار مكانه دايماً، بغض النظر عن عدد مرات الاستدعاء
      id: CURRENT_STATUS_NOTIF_ID,
      title,
      body,
      data: { screen: 'home' },
      android: {
        channelId: CHANNEL_ID,
        colorized: true,
        color: '#2E6DA4',
        smallIcon: 'ic_notification',
        largeIcon: 'ic_notification_large',
        ongoing: true,
        autoCancel: false,
        visibility: AndroidVisibility.PUBLIC,
        category: AndroidCategory.ALARM,
        pressAction: { id: 'default' },
        actions: [
          { title: 'أوقات الصلاة', pressAction: { id: OPEN_PRAYER_TIMES_ACTION } },
          { title: 'التسبيح', pressAction: { id: OPEN_TASBIH_ACTION } },
        ],
      },
    });
  } catch {
    // فشل العرض الفوري (نادر) - الجدولة المستقبلية (scheduleNextPrayerNotifications)
    // تبقى تشتغل عادي كخط دفاع ثاني
  }
}

// ===== الجدولة: إشعار واحد لكل صلاة، يطلع بالضبط لحظة دخولها ويعرض بيانات
// "الصلاة التالية لها" (لف دائري: بعد العشاء ترجع للفجر) =====
export async function scheduleNextPrayerNotifications(times: PrayerTimesInput): Promise<number> {
  if (Platform.OS !== 'android') return 0; // آيفون: notifee ما يدعم هذا النوع من التحديث بالخلفية

  const notifee = getNotifee();
  const { TriggerType, AndroidColor } = getNotifeeTypes();

  await ensureChannel();

  // ===== نعرض الحالة الحالية فوراً - قبل حتى ما نكمل الجدولة المستقبلية،
  // حتى يشوف المستخدم الإشعار الثابت من أول لحظة يفتح فيها التطبيق =====
  await displayCurrentPrayerNotification(times);

  try {
    const raw = await AsyncStorage.getItem(NOTIF_IDS_KEY);
    const oldIds: string[] = raw ? JSON.parse(raw) : [];
    await Promise.all(oldIds.map((id) => notifee.cancelTriggerNotification(id).catch(() => {})));
  } catch {
    // تجاهل
  }

  const ids: string[] = [];
  const now = Date.now();

  for (let i = 0; i < PRAYER_ORDER.length; i++) {
    const currentKey = PRAYER_ORDER[i];
    const nextKey = PRAYER_ORDER[(i + 1) % PRAYER_ORDER.length];

    const [h, m] = times[currentKey].split(':').map(Number);
    const fireDate = new Date();
    fireDate.setHours(h, m, 0, 0);
    if (fireDate.getTime() <= now) {
      // ⚠️ نفس إصلاح notifeeAzan.ts: نجدول بكرة بدل ما نلغي هالانتقال كلياً.
      // ملاحظة: النص المعروض (وقت "الصلاة التالية") بهذي الحالة يضل يعتمد
      // على times المرسلة اليوم، يعني ممكن يبين وقت أقدم بدقيقة/دقيقتين عن
      // الوقت الفلكي الحقيقي لبكرة - فرق بسيط ينصحح لحاله بأول فتحة تطبيق
      // جاية (لما تنجدد times ويعاد استدعاء هذي الدالة من جديد)
      fireDate.setDate(fireDate.getDate() + 1);
    }

    const { title, body } = buildNotificationContent(nextKey, times[nextKey]);

    try {
      const id = await notifee.createTriggerNotification(
        {
          title,
          body,
          data: { screen: 'home' },
          android: {
            channelId: CHANNEL_ID,
            colorized: true,
            color: '#2E6DA4',
            smallIcon: 'ic_notification',
            largeIcon: 'ic_notification_large',
            ongoing: true,
            autoCancel: false,
            pressAction: { id: 'default' },
            actions: [
              { title: 'أوقات الصلاة', pressAction: { id: OPEN_PRAYER_TIMES_ACTION } },
              { title: 'التسبيح', pressAction: { id: OPEN_TASBIH_ACTION } },
            ],
          },
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp: fireDate.getTime(),
          // ⚠️ إصلاح ثبات الإشعارات بكل الهواتف - نفس السبب بباقي ملفات الجدولة
          alarmManager: { allowWhileIdle: true },
        }
      );
      ids.push(id);
    } catch {
      // نتجاوز صلاة وحدة ونكمل الباقي
    }
  }

  await AsyncStorage.setItem(NOTIF_IDS_KEY, JSON.stringify(ids));
  return ids.length;
}

// ===== التوجيه: يفتح المكان الصحيح حسب الزر/الجسم اللي ضغط عليه المستخدم =====
function handlePress(actionId: string | undefined) {
  if (actionId === OPEN_PRAYER_TIMES_ACTION) {
    router.push('/settings/prayer-times' as any);
  } else if (actionId === OPEN_TASBIH_ACTION) {
    router.push('/tasbih' as any);
  } else {
    router.push('/' as any); // ضغطة الجسم العادية -> الرئيسية
  }
}

// ===== معالجة الحدث - دالة نقية بدون تسجيل ذاتي (شوف نفس الملاحظة بملف
// notifeeAzan.ts - التسجيل الفعلي الوحيد صار مركزي بـ notificationEvents.ts) =====
export function handleNextPrayerEvent(type: any, detail: any, EventType: any): boolean {
  const channelId = detail?.notification?.android?.channelId;
  if (channelId !== CHANNEL_ID) return false; // مو من اختصاصي

  if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
    handlePress(detail?.pressAction?.id);
  }
  return true;
}