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
const OPEN_PRAYER_TIMES_ACTION = 'open-prayer-times';
const OPEN_TASBIH_ACTION = 'open-tasbih';
const OPEN_ATHKAR_ACTION = 'open-athkar';

// رمز نصي مميز لكل صلاة - بديل عملي لـ"أيقونة مختلفة لكل صلاة" بدون الحاجة
// لخمس صور PNG منفصلة تحتاج تبنى بأصول أندرويد الأصلية (drawable resources)
// وrebuild كامل. الرمز يُدمج بعنوان الإشعار نفسه، فيبين فوراً بدون أي أصل جديد.
const PRAYER_GLYPH: Record<PrayerKey, string> = {
  fajr: '🌅', dhuhr: '☀️', asr: '🌤️', maghrib: '🌇', isha: '🌙',
};

// ⚠️ إصلاح جوهري (٢٠٢٦-٠٩-٠٣، "الإشعار ما يتحدث تلقائياً، يبقى متأخر
// ساعات"): كان عندنا معرّف ثابت واحد (CURRENT_STATUS_NOTIF_ID) تستخدمه كل
// الإشعارات الخمسة المجدولة (فجر/ظهر/عصر/مغرب/عشاء) بالحلقة تحت. المشكلة:
// notifee يستخدم هذا المعرّف مو بس لعرض الإشعار، بل أيضاً كمفتاح لتخزين
// المنبّه نفسه (Alarm) بنظام أندرويد - فكل استدعاء createTriggerNotification
// جديد بنفس المعرّف يلغي ويستبدل المنبّه السابق كلياً، مو بس شكله المرئي.
// النتيجة الفعلية: من أصل ٥ منبهات، بس آخر وحد بالحلقة (العشاء) يبقى مجدول
// فعلياً، والباقي ينمحون لحظة الجدولة نفسها قبل حتى ما توصل الصلاة.
//
// الحل: معرّف منفصل ومستقل لكل صلاة (حتى ما تلغي منبهات بعض)، + دالة تنظيف
// تلقائية تمسح أي إشعار صلاة ثانية ظاهر بلحظة ظهور إشعار جديد - فيبقى دايماً
// إشعار واحد بس مرئي، بدون تكدس، وبدون إلغاء المنبهات الأربعة الثانية.
const STATUS_ID_PREFIX = 'next-prayer-status-';
const statusIdFor = (key: PrayerKey): string => `${STATUS_ID_PREFIX}${key}`;

function getNotifeeForCleanup() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@notifee/react-native').default as typeof import('@notifee/react-native').default;
}

// تمسح أي إشعار صلاة ظاهر حالياً غير الصلاة المحددة - تستدعى فوراً بعد أي
// عرض/تحديث جديد (فتح تطبيق أو منبّه مجدول اشتغل) حتى يبقى إشعار واحد بس
async function cancelOtherPrayerNotifications(exceptKey: PrayerKey): Promise<void> {
  const notifee = getNotifeeForCleanup();
  await Promise.all(
    PRAYER_ORDER.filter((k) => k !== exceptKey).map((k) =>
      notifee.cancelNotification(statusIdFor(k)).catch(() => {})
    )
  );
}

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

// يرجع التاريخ الهجري لليوم كسطر مختصر ("٢ ربيع الأول ١٤٤٨هـ")
function getTodayHijriLine(): string {
  const hijri = getHijriParts(new Date());
  return `${hijri.day} ${hijri.month} ${hijri.year}هـ`;
}

// يحول عدد الدقائق المتبقية لنص عربي مقروء ("ساعة و٢٠ دقيقة" / "٤٥ دقيقة")
function formatRemaining(totalMinutes: number): string {
  if (totalMinutes <= 0) return 'الآن';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins} دقيقة`;
  const hoursLabel = hours === 1 ? 'ساعة' : `${hours} ساعات`;
  if (mins === 0) return hoursLabel;
  return `${hoursLabel} و${mins} دقيقة`;
}

// ===== يبني محتوى الإشعار (عنوان + جسم) لصلاة معيّنة "تالية" =====
// remainingMinutes: الوقت المتبقي للصلاة القادمة بالدقائق - ثابت وقت البناء
// (سواء عند العرض الفوري أو وقت الجدولة)، مو حي/متحدث لحظياً (يحتاج خدمة
// خلفية مستمرة غير مبررة لميزة تجميلية - نفس القيد الموضح بأعلى الملف)
function buildNotificationContent(nextKey: PrayerKey, nextTimeLabel: string, remainingMinutes: number) {
  const nextTitle = PRAYER_TITLES[nextKey];
  const glyph = PRAYER_GLYPH[nextKey];
  const occasionLine = getTodayOccasionLine();
  const hijriLine = getTodayHijriLine();

  const lines = [`الساعة ${nextTimeLabel} - متبقي ${formatRemaining(remainingMinutes)}`];
  if (occasionLine) lines.push(occasionLine);
  lines.push(hijriLine);

  return { title: `${glyph} صلاة ${nextTitle}`, body: lines.join('\n') };
}

// ⚠️ إصلاح جوهري (٢٠٢٦-٠٩-٠٢، "زرين أوقات الصلاة/التسبيح بالإشعار ما
// يشتغلون"): notifee.Android.PressAction يدعم خاصية launchActivity - بدونها،
// ضغط زر فعل مخصص جوة الإشعار (بعكس ضغط جسم الإشعار نفسه) ما يفتح/يطلع
// التطبيق تلقائياً على أندرويد (هذا سلوك نظام موثّق، مو تقصير بكودنا). يعني
// handleNextPrayerEvent بالأسفل كان يشتغل فعلاً (router.push + تخزين احتياطي)
// بس بسياق JS "ميت" بدون أي واجهة تنعرض للمستخدم - فيحس الزرين "ما يسوون
// شي". إضافة launchActivity:'default' هنا تخلي أندرويد يفتح نشاط التطبيق
// فعلياً أول ما يدوس المستخدم أي وحدة من الزرين، قبل حتى ما توصل معالجة
// notifee للحدث.
const pressActionWithLaunch = (id: string) => ({ id, launchActivity: 'default' as const });

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

  const [nh, nm] = times[nextKey].split(':').map(Number);
  let remainingMinutes = nh * 60 + nm - nowMinutes;
  if (remainingMinutes < 0) remainingMinutes += 24 * 60; // عبرت منتصف الليل (فجر باچر)

  const { title, body } = buildNotificationContent(nextKey, times[nextKey], remainingMinutes);

  try {
    await notifee.displayNotification({
      // معرّف مستقل خاص بهذي الصلاة تحديداً (مو معرّف مشترك بين كل الصلوات) -
      // يمنع تعارض المنبهات مع بعض؛ التنظيف بالأسفل (cancelOtherPrayerNotifications)
      // هو اللي يضمن ظهور إشعار واحد بس بأي لحظة
      id: statusIdFor(nextKey),
      title,
      body,
      data: { screen: 'home' },
      android: {
        channelId: CHANNEL_ID,
        colorized: true,
        color: '#0E3B4D',
        smallIcon: 'ic_notification',
        largeIcon: 'ic_notification_large',
        ongoing: true,
        autoCancel: false,
        visibility: AndroidVisibility.PUBLIC,
        category: AndroidCategory.ALARM,
        pressAction: { id: 'default' },
        actions: [
          { title: 'أوقات الصلاة', pressAction: pressActionWithLaunch(OPEN_PRAYER_TIMES_ACTION) },
          { title: 'التسبيح', pressAction: pressActionWithLaunch(OPEN_TASBIH_ACTION) },
          { title: 'الأذكار', pressAction: pressActionWithLaunch(OPEN_ATHKAR_ACTION) },
        ],
      },
    });
    await cancelOtherPrayerNotifications(nextKey);
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

    // الوقت المتبقي من دخول currentKey لدخول nextKey - فرق ثابت ومعروف مسبقاً
    // (نفس الفرق يتكرر يومياً)، يُحسب مرة وحدة وقت الجدولة نفسها
    const [nh, nm] = times[nextKey].split(':').map(Number);
    let remainingBetween = nh * 60 + nm - (h * 60 + m);
    if (remainingBetween < 0) remainingBetween += 24 * 60; // العشاء -> الفجر (يعبر منتصف الليل)

    const { title, body } = buildNotificationContent(nextKey, times[nextKey], remainingBetween);

    try {
      const id = await notifee.createTriggerNotification(
        {
          // معرّف مستقل باسم الصلاة نفسها (nextKey = الصلاة اللي هذا
          // الإشعار يعرض بياناتها) - يمنع تعارض/إلغاء المنبهات مع بعض؛
          // نفس المعرّف يتكرر كل يوم لنفس الصلاة (وهذا مقصود ومفيد: تلقائياً
          // يستبدل جدولة اليوم السابق لنفس الصلاة بدل ما يتراكم)
          id: statusIdFor(nextKey),
          title,
          body,
          data: { screen: 'home' },
          android: {
            channelId: CHANNEL_ID,
            colorized: true,
            color: '#0E3B4D',
            smallIcon: 'ic_notification',
            largeIcon: 'ic_notification_large',
            ongoing: true,
            autoCancel: false,
            pressAction: { id: 'default' },
            actions: [
              { title: 'أوقات الصلاة', pressAction: pressActionWithLaunch(OPEN_PRAYER_TIMES_ACTION) },
              { title: 'التسبيح', pressAction: pressActionWithLaunch(OPEN_TASBIH_ACTION) },
              { title: 'الأذكار', pressAction: pressActionWithLaunch(OPEN_ATHKAR_ACTION) },
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
//
// ⚠️ إصلاح جوهري ("الزرين ما يشتغلون، التطبيق يبقى صافن"): لما التطبيق مقفول
// أو بالخلفية والمستخدم يضغط أحد زرين الإشعار (أوقات الصلاة/التسبيح - مو
// جسم الإشعار نفسه)، notifee يعالج الحدث بسياق JavaScript منفصل تماماً
// (Headless) عن التطبيق الفعلي - فـ router.push() هنا يشتغل "بالفراغ" وما
// يوصل لأي واجهة حقيقية. (جسم الإشعار يشتغل "صدفة" لأن أندرويد نفسه يفتح
// التطبيق تلقائياً بأي ضغطة عادية، بغض النظر هل كودنا نجح أو لا - هذا سلوك
// نظام، مو نجاح فعلي من التنقل). launchActivity المضافة فوگ بزرين الفعل
// تحل هذا الجزء (تجبر أندرويد يفتح التطبيق فعلياً)، لكن نبقي الحل الثاني
// تحت (AsyncStorage) كخط دفاع إضافي لأي حالة توقيت نادرة.
//
// الحل: نخزن الوجهة المطلوبة بمكان دائم (AsyncStorage) بدل الاعتماد على
// router مباشرة، وبعد ما يفتح التطبيق فعلياً ويكتمل تحميله (بـ_layout.tsx)،
// نتحقق من هذا المخزن وننفذ التنقل حينها - نفس مبدأ "رسالة بالبريد" بدل
// محاولة اتصال مباشر بسياق ميت.
const PENDING_NAV_KEY = 'noor_pendingNextPrayerNav';

async function setPendingNavigation(path: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_NAV_KEY, path);
  } catch {
    // تجاهل - أسوأ حالة الزر ما يودي لمكان، بس التطبيق يفتح عادي
  }
}

/**
 * تستدعى من app/_layout.tsx بعد اكتمال تحميل التطبيق - تتحقق هل فيه تنقل
 * معلّق من ضغطة زر إشعار سابقة، تنفذه، وتمسحه حتى ما يتكرر بفتحات لاحقة.
 */
export async function consumePendingNextPrayerNavigation(): Promise<string | null> {
  try {
    const path = await AsyncStorage.getItem(PENDING_NAV_KEY);
    if (path) await AsyncStorage.removeItem(PENDING_NAV_KEY);
    return path;
  } catch {
    return null;
  }
}

function handlePress(actionId: string | undefined) {
  let path = '/';
  if (actionId === OPEN_PRAYER_TIMES_ACTION) {
    path = '/settings/prayer-times';
  } else if (actionId === OPEN_TASBIH_ACTION) {
    path = '/tasbih';
  } else if (actionId === OPEN_ATHKAR_ACTION) {
    path = '/athkar';
  }

  // نحاول التنقل المباشر فوراً (يشتغل صح لو التطبيق أصلاً بالمقدمة/الواجهة
  // شغالة) + نخزنه احتياطياً بكل الأحوال (يغطي حالة السياق المنفصل فوگ)
  try {
    router.push(path as any);
  } catch {
    // تجاهل - التخزين بالأسفل يبقى خط الدفاع الأكيد
  }
  setPendingNavigation(path).catch(() => {});
}

// ===== معالجة الحدث - دالة نقية بدون تسجيل ذاتي (شوف نفس الملاحظة بملف
// notifeeAzan.ts - التسجيل الفعلي الوحيد صار مركزي بـ notificationEvents.ts) =====
export function handleNextPrayerEvent(type: any, detail: any, EventType: any): boolean {
  const channelId = detail?.notification?.android?.channelId;
  if (channelId !== CHANNEL_ID) return false; // مو من اختصاصي

  if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
    handlePress(detail?.pressAction?.id);
  } else if (type === EventType.DELIVERED) {
    // ⚠️ جزء أساسي من إصلاح التحديث التلقائي: لما منبّه صلاة معينة يوصل
    // فعلياً (تحديداً بالخلفية، بدون فتح التطبيق)، نمسح أي إشعار صلاة ثانية
    // ضل ظاهر من قبل - هذا يضمن إشعار واحد بس دايماً، حتى مع المعرّفات
    // المستقلة الجديدة لكل صلاة
    const firedId: string | undefined = detail?.notification?.id;
    const firedKey = PRAYER_ORDER.find((k) => statusIdFor(k) === firedId);
    if (firedKey) cancelOtherPrayerNotifications(firedKey).catch(() => {});
  }
  return true;
}