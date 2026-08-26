// ===== utils/notificationScheduler.ts =====
// جدولة أذكار الصلوات الخمس + يوم الجمعة (الكهف) + ليلة الجمعة (كميل) +
// أدعية اليوم + تسبيح اليوم — كل شي هنا صار عبر notifee (نفس محرك الأذان
// والمناسبات الهجرية بالضبط)، بعد ما كان هذا الملف وحيداً يستخدم
// expo-notifications بمحرك منفصل كلياً عن باقي التطبيق.
//
// ⚠️ تعديل جوهري (توحيد المحرك): سابقاً كان عندنا محركين إشعارات يشتغلون
// بنفس الوقت - notifee (الأذان، المناسبات الهجرية، الصلاة القادمة) و
// expo-notifications (هذا الملف بس). هذا كان يعني قناتين منفصلتين، وأهم من
// هذا: نقطتين تسجيل أحداث منفصلتين لمعالجة ضغطة المستخدم على الإشعار (واحدة
// بـ notificationEvents.ts للنوع الأول، وواحدة بـ app/_layout.tsx مباشرة
// عبر Notifications.addNotificationResponseReceivedListener للنوع الثاني).
// هسه توحد الكل تحت notifee ونقطة تسجيل الأحداث المركزية الوحيدة
// (notificationEvents.ts).
//
// ⚠️ إصلاح إضافي (٢٠٢٦-٠٨-٢١): طلب الصلاحية نفسه كان لسه عبر
// expo-notifications (getPermissionsAsync/requestPermissionsAsync) بافتراض
// إنها نفس صلاحية أندرويد المشتركة مع notifee. عملياً طلع هذا يفسر بالضبط
// ليش الأذان والصلاة القادمة (يستخدمون notifee مباشرة بدون هذا الفحص)
// يوصلون طبيعي، بينما تذكيرات الأذكار/الأدعية (المقيدة بهذا الفحص) تنقطع
// كلياً وترجع 0 بصمت - نظامي الصلاحية انطلع مو متطابقين دايماً على كل
// الأجهزة رغم افتراض المشاركة. صار الفحص الآن عبر notifee.requestPermission()
// مباشرة - نفس النظام المُثبت نجاحه بباقي أنواع الإشعارات.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import adiyahDataRaw from '@/data/adiyah-data.json';
import athkarDataRaw from '@/data/athkar-data.json';
import { getPrayerTimes, type PrayerTimesResult } from './prayerCalc';

const NOTIF_IDS_KEY = '@athkar_notification_ids_v2'; // v2: تغيّر شكل الـid بعد الانتقال لـ notifee
const ENABLED_KEY = '@athkar_notifications_enabled_v1';
const OFFSETS_KEY = '@athkar_notif_offsets_v1';
const CHANNEL_ID = 'athkar-reminders';

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
  try {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'تذكيرات الأذكار والأدعية',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  } catch (e) {
    console.error('[athkar] فشل إنشاء قناة إشعارات الأذكار:', e);
  }
}

// نفس آلية صلاحية hijriNotifications.ts - عبر expo-notifications (نفس
// الصلاحية على مستوى نظام أندرويد، ما داعي نطلبها مرتين بطريقتين)
async function requestNotifPermission(): Promise<boolean> {
  try {
    // ⚠️ إصلاح: كان هذا يتحقق عبر Notifications.getPermissionsAsync/
    // requestPermissionsAsync من مكتبة expo-notifications - نظام صلاحيات
    // منفصل تماماً عن notifee (اللي فعلياً يجدول كل الإشعارات هسه). خلط
    // نظامين صلاحية مختلفين ممكن يصير بينهم تعارض/عدم تزامن على بعض
    // الأجهزة (النظام الأول يرجع "مو ممنوح" رغم إن notifee فعلياً عنده
    // صلاحية شغالة - وهذا بالضبط يفسر ليش الأذان والصلاة القادمة يوصلون
    // طبيعي (notifee مباشرة، بدون هذا الفحص) بينما الأذكار/الأدعية تنقطع
    // كلياً هنا وترجع 0 بصمت). التوحيد على صلاحية notifee نفسها يخلي كل
    // أنواع الإشعارات تتحقق بنفس الطريقة بالضبط.
    const notifee = getNotifee();
    const { AuthorizationStatus } = getNotifeeTypes();
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
  } catch (e) {
    console.error('[athkar] فشل فحص/طلب صلاحية الإشعارات:', e);
    return false;
  }
}

export type Coordinates = { latitude: number; longitude: number };

// الفرق بالدقائق عن وقت الصلاة المرتبط (موجب = بعده، سالب = قبله) - قابل
// للتعديل من المستخدم بدل ثابت بالكود.
export type AthkarNotifOffsets = {
  fajr: number; dhuhr: number; asr: number; maghrib: number; isha: number;
  friday: number; // فرق عن وقت الفجر
  kumayl: number; // فرق عن وقت المغرب
};

export const DEFAULT_ATHKAR_OFFSETS: AthkarNotifOffsets = {
  fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0,
  friday: 30,
  kumayl: 20,
};

export async function getAthkarOffsets(): Promise<AthkarNotifOffsets> {
  try {
    const raw = await AsyncStorage.getItem(OFFSETS_KEY);
    if (raw) return { ...DEFAULT_ATHKAR_OFFSETS, ...JSON.parse(raw) };
  } catch {
    // نتجاهل ونرجع الافتراضي
  }
  return DEFAULT_ATHKAR_OFFSETS;
}

export async function saveAthkarOffsets(offsets: AthkarNotifOffsets): Promise<void> {
  await AsyncStorage.setItem(OFFSETS_KEY, JSON.stringify(offsets));
}

export type AthkarNotificationSettings = {
  fajr: boolean; dhuhr: boolean; asr: boolean; maghrib: boolean; isha: boolean;
  friday: boolean; // تذكير سورة الكهف يوم الجمعة
  kumayl: boolean; // دعاء كميل ليلة الجمعة (مساء الخميس)
  occasions: boolean; // المناسبات الهجرية (مجدولة فعلياً بملف hijriNotifications.ts)
  adiyahDay: boolean; // دعاء اليوم (جديد)
  tasbihDay: boolean; // تسبيح اليوم (جديد)
};

export const DEFAULT_ATHKAR_NOTIFICATION_SETTINGS: AthkarNotificationSettings = {
  fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true,
  friday: true,
  kumayl: true,
  occasions: true,
  adiyahDay: true,
  tasbihDay: true,
};

// ===== جرد أعمال اليوم =====
// كل إشعار (تعقيب، يوم جمعة، ليلة جمعة، دعاء/تسبيح اليوم) يحمل dayId بحقل
// data. من يدوس المستخدم على الإشعار، athkar.tsx يقرا هذا الـdayId ويفتح
// له "جرد" — قائمة بعناوين أعمال هذا اليوم، يدوس على أي عنصر يوديه لصفحته.
export type DayAmalRef =
  | { type: 'dhikr'; section: string; item: string } // مرجع بملف athkar-data.json
  | { type: 'dua'; section: string; category?: string; item: string } // مرجع بملف adiyah-data.json
  | { type: 'quran'; surah: number; surahName: string } // فتح شاشة القرآن مباشرة
  | { type: 'info' }; // بند تذكيري بس، بدون صفحة

export type DayAmalItem = { label: string; ref: DayAmalRef };
export type DayAmalManifestEntry = { title: string; items: DayAmalItem[] };

// أدعية اليوم وتسبيح اليوم - مرجعهم بملف adiyah-data.json نفسه: أدعية اليوم
// بقسم "days" (day_sat..day_fri)، وتسبيح اليوم بقسم "sahifa" تصنيف "weekday"
// (w_sunday..w_saturday) - نفس المرجع اللي تستخدمه بطاقات تسبيح الأيام
// بشاشة الأذكار حالياً.
const WEEKDAY_ADIYAH_ITEMS: Record<number, { dayId: string; itemId: string; label: string }> = {
  0: { dayId: 'adiyah-sun', itemId: 'day_sun', label: 'دعاء يوم الأحد' },
  1: { dayId: 'adiyah-mon', itemId: 'day_mon', label: 'دعاء يوم الإثنين' },
  2: { dayId: 'adiyah-tue', itemId: 'day_tue', label: 'دعاء يوم الثلاثاء' },
  3: { dayId: 'adiyah-wed', itemId: 'day_wed', label: 'دعاء يوم الأربعاء' },
  4: { dayId: 'adiyah-thu', itemId: 'day_thu', label: 'دعاء يوم الخميس' },
  5: { dayId: 'adiyah-fri', itemId: 'day_fri', label: 'دعاء يوم الجمعة' },
  6: { dayId: 'adiyah-sat', itemId: 'day_sat', label: 'دعاء يوم السبت' },
};
const WEEKDAY_TASBIH_ITEMS: Record<number, { dayId: string; itemId: string; label: string }> = {
  0: { dayId: 'tasbih-sun', itemId: 'w_sunday', label: 'تسبيح يوم الأحد' },
  1: { dayId: 'tasbih-mon', itemId: 'w_monday', label: 'تسبيح يوم الإثنين' },
  2: { dayId: 'tasbih-tue', itemId: 'w_tuesday', label: 'تسبيح يوم الثلاثاء' },
  3: { dayId: 'tasbih-wed', itemId: 'w_wednesday', label: 'تسبيح يوم الأربعاء' },
  4: { dayId: 'tasbih-thu', itemId: 'w_thursday', label: 'تسبيح يوم الخميس' },
  5: { dayId: 'tasbih-fri', itemId: 'w_friday', label: 'تسبيح يوم الجمعة' },
  6: { dayId: 'tasbih-sat', itemId: 'w_saturday', label: 'تسبيح يوم السبت' },
};

export const DAY_AMAL_MANIFEST: Record<string, DayAmalManifestEntry> = {
  friday: {
    title: 'أعمال يوم الجمعة',
    items: [
      { label: 'سورة الكهف', ref: { type: 'quran', surah: 18, surahName: 'الكهف' } },
      { label: 'سورة الجمعة', ref: { type: 'quran', surah: 62, surahName: 'الجمعة' } },
      { label: 'دعاء الندبة', ref: { type: 'dua', section: 'major', item: 'maj_nudba' } },
      { label: 'الإكثار من الصلاة على محمد وآل محمد', ref: { type: 'info' } },
      { label: 'زيارة عاشوراء', ref: { type: 'dua', section: 'ziyarat', category: 'general', item: 'z_ashura' } },
      { label: 'زيارة الإمام الحسين ع (زيارة وارث)', ref: { type: 'dua', section: 'ziyarat', category: 'general', item: 'z_hussain' } },
      { label: 'صلاة ركعتين للإمام الحسين ع', ref: { type: 'info' } },
    ],
  },
  'taqibat-dhuhr': { title: 'تعقيب الظهر', items: [{ label: 'الظهر ونافلتها', ref: { type: 'dhikr', section: 'salah', item: 'dhuhr' } }] },
  'taqibat-asr': { title: 'تعقيب العصر', items: [{ label: 'العصر ونافلتها', ref: { type: 'dhikr', section: 'salah', item: 'asr' } }] },
  'taqibat-isha': { title: 'تعقيب العشاء', items: [{ label: 'العشاء والوتيرة', ref: { type: 'dhikr', section: 'salah', item: 'isha' } }] },
  morning: { title: 'أذكار الصباح', items: [{ label: 'أذكار الصباح', ref: { type: 'dhikr', section: 'today', item: 'morning' } }] },
  evening: { title: 'أذكار المساء', items: [{ label: 'أذكار المساء', ref: { type: 'dhikr', section: 'today', item: 'evening' } }] },
  kumayl: { title: 'ليلة الجمعة', items: [{ label: 'دعاء كميل', ref: { type: 'dua', section: 'general', item: 'gen_kumayl' } }] },
  // ===== جديد: أدعية اليوم وتسبيح اليوم (٧ + ٧ إدخالات) =====
  ...Object.fromEntries(
    Object.values(WEEKDAY_ADIYAH_ITEMS).map((d) => [
      d.dayId,
      { title: d.label, items: [{ label: d.label, ref: { type: 'dua', section: 'days', item: d.itemId } as DayAmalRef }] },
    ])
  ),
  ...Object.fromEntries(
    Object.values(WEEKDAY_TASBIH_ITEMS).map((d) => [
      d.dayId,
      { title: d.label, items: [{ label: d.label, ref: { type: 'dua', section: 'sahifa', category: 'weekday', item: d.itemId } as DayAmalRef }] },
    ])
  ),
};

const PRAYER_ATHKAR_LABELS: { key: keyof PrayerTimesResult; settingKey: 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'; title: string; dayId: string }[] = [
  { key: 'fajr', settingKey: 'fajr', title: 'أذكار الصباح', dayId: 'morning' },
  { key: 'dhuhr', settingKey: 'dhuhr', title: 'تعقيب الظهر', dayId: 'taqibat-dhuhr' },
  { key: 'asr', settingKey: 'asr', title: 'تعقيب العصر', dayId: 'taqibat-asr' },
  { key: 'maghrib', settingKey: 'maghrib', title: 'أذكار المساء', dayId: 'evening' },
  { key: 'isha', settingKey: 'isha', title: 'تعقيب العشاء', dayId: 'taqibat-isha' },
];

// ===== توقيت كل نوع إشعار عن وقت صلاته المرجعية - متباعد عمداً حتى ما توصل
// كل الإشعارات دفعة وحدة بنفس اللحظة =====
const FRIDAY_KAHF_OFFSET_FALLBACK = 30; // دقيقة بعد الفجر (افتراضي، قابل للتعديل)
const KUMAYL_OFFSET_FALLBACK = 20; // دقيقة بعد المغرب (افتراضي، قابل للتعديل)
const ADIYAH_DAY_OFFSET = 25; // دقيقة بعد المغرب - ثابت (بعد كميل بفارق ٥ دقايق يوم الخميس)
const TASBIH_DAY_OFFSET = 30; // دقيقة بعد المغرب - ثابت (بعد دعاء اليوم بفارق ٥ دقايق)

// ===== حفظ/قراءة تفعيل الاشعارات =====
export async function getAthkarNotificationSettings(): Promise<AthkarNotificationSettings> {
  try {
    const raw = await AsyncStorage.getItem(ENABLED_KEY);
    if (raw) return { ...DEFAULT_ATHKAR_NOTIFICATION_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // نتجاهل ونرجع الافتراضي
  }
  return DEFAULT_ATHKAR_NOTIFICATION_SETTINGS;
}

export async function saveAthkarNotificationSettings(settings: AthkarNotificationSettings): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, JSON.stringify(settings));
}

async function cancelAllAthkarNotifications(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_IDS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    const notifee = getNotifee();
    await Promise.all(ids.map((id) => notifee.cancelTriggerNotification(id).catch(() => {})));
  } catch {
    // نتجاهل
  }
}

function addMinutes(hour: number, minute: number, delta: number): { hour: number; minute: number } {
  let total = hour * 60 + minute + delta;
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

async function scheduleOne(
  notifee: ReturnType<typeof getNotifee>,
  TriggerType: any,
  title: string,
  dayId: string,
  fireDate: Date
): Promise<string | null> {
  try {
    return await notifee.createTriggerNotification(
      {
        title,
        data: { dayId },
        android: {
          channelId: CHANNEL_ID,
          smallIcon: 'ic_notification',
          largeIcon: 'ic_notification_large',
          pressAction: { id: 'default' },
        },
        ios: { sound: 'default' },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: fireDate.getTime(),
        // ⚠️ إصلاح ثبات الإشعارات بكل الهواتف: بدون alarmManager صريح، أندرويد
        // يعامل هذا كتنبيه "غير دقيق" ويأجله حسب وضع توفير البطارية (خصوصاً
        // هواوي/شاومي) - هذا بالضبط سبب "يشتغل بهاتف وما ينطبق بهاتف ثاني".
        alarmManager: { allowWhileIdle: true },
      }
    );
  } catch (e) {
    console.error(`[athkar] فشلت جدولة "${title}":`, e);
    return null;
  }
}

/**
 * يجدول كل اشعارات الأذكار (الصلوات الخمس + الجمعة/الكهف + كميل + أدعية
 * اليوم + تسبيح اليوم) حسب موقع المستخدم واعداداته، عبر notifee. يلغي كل
 * الاشعارات المجدولة سابقاً أول عشان ما تتكرر.
 *
 * كل عنصر (عدا الصلوات الخمس) يُحسب بأقرب تاريخ فعلي قادم له خلال الأسبوع
 * الجاي (بدل الاعتماد على تكرار أسبوعي ثابت بوقت اليوم الحالي فقط) - يعني
 * حتى الجمعة القادمة تاخذ وقت فجرها الحقيقي، مو وقت فجر اليوم مكرر. لازم
 * تنعاد هذي الدالة كل ما ينفتح التطبيق حتى تبقى النافذة مغطاة ووقت كل صلاة
 * محدث مع تغيره اليومي الطبيعي.
 */
export async function scheduleAthkarNotifications(
  coords: Coordinates,
  settings: AthkarNotificationSettings = DEFAULT_ATHKAR_NOTIFICATION_SETTINGS,
  offsets?: AthkarNotifOffsets
): Promise<number> {
  const granted = await requestNotifPermission();
  if (!granted) return 0;

  await ensureChannel();
  await cancelAllAthkarNotifications();

  const notifee = getNotifee();
  const { TriggerType } = getNotifeeTypes();
  const resolvedOffsets = offsets ?? (await getAthkarOffsets());
  const ids: string[] = [];
  const now = Date.now();
  const todayTimes = getPrayerTimes(coords.latitude, coords.longitude);

  // ١) اذكار مرتبطة بالصلوات الخمس اليوم - بعنوان بس، حقل data.dayId يودي
  // المستخدم لصفحة "جرد" هذا التعقيب لما يدوس على الإشعار.
  for (const p of PRAYER_ATHKAR_LABELS) {
    if (!settings[p.settingKey]) continue;
    const [h0, m0] = todayTimes[p.key].split(':').map(Number);
    const { hour, minute } = addMinutes(h0, m0, resolvedOffsets[p.settingKey]);
    const fireDate = new Date();
    fireDate.setHours(hour, minute, 0, 0);
    if (fireDate.getTime() <= now) {
      // ⚠️ إصلاح: نفس بگ notifeeAzan.ts/nextPrayerNotification.ts بالضبط - كان
      // "continue" يلغي تعقيب هذي الصلاة نهائياً من الجدولة لليوم بدل ما
      // يأجله لبكرة كما يقول التعليق القديم. لو عادة المستخدم فتح التطبيق
      // بعد صلاة معينة يومياً، تعقيبها كان ينحذف كل يوم بنفس الطريقة وما
      // يوصل أبداً. الحل: نجدوله بكرة بدل الإلغاء
      fireDate.setDate(fireDate.getDate() + 1);
    }
    const id = await scheduleOne(notifee, TriggerType, p.title, p.dayId, fireDate);
    if (id) ids.push(id);
  }

  // ٢-٥) العناصر الأسبوعية: نفحص الأيام السبعة الجاية، ولكل نوع ناخذ أقرب
  // مطابقة قادمة بوقتها الحقيقي (مو تكرار وقت اليوم الحالي)
  for (let i = 0; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const weekday = d.getDay(); // ٠=الأحد ... ٦=السبت
    const dTimes: PrayerTimesResult = i === 0 ? todayTimes : getPrayerTimes(coords.latitude, coords.longitude, d);

    // الجمعة - سورة الكهف (weekday === 5)
    if (settings.friday && weekday === 5) {
      const [h0, m0] = dTimes.fajr.split(':').map(Number);
      const { hour, minute } = addMinutes(h0, m0, resolvedOffsets.friday ?? FRIDAY_KAHF_OFFSET_FALLBACK);
      const fireDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute, 0);
      if (fireDate.getTime() > now) {
        const id = await scheduleOne(notifee, TriggerType, 'يوم الجمعة', 'friday', fireDate);
        if (id) ids.push(id);
      }
    }

    // ليلة الجمعة - دعاء كميل (مساء الخميس، weekday === 4)
    if (settings.kumayl && weekday === 4) {
      const [h0, m0] = dTimes.maghrib.split(':').map(Number);
      const { hour, minute } = addMinutes(h0, m0, resolvedOffsets.kumayl ?? KUMAYL_OFFSET_FALLBACK);
      const fireDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute, 0);
      if (fireDate.getTime() > now) {
        const id = await scheduleOne(notifee, TriggerType, 'ليلة الجمعة — دعاء كميل', 'kumayl', fireDate);
        if (id) ids.push(id);
      }
    }

    // دعاء اليوم (كل الأيام السبعة، بعد المغرب بـ٢٥ دقيقة)
    if (settings.adiyahDay) {
      const entry = WEEKDAY_ADIYAH_ITEMS[weekday];
      const [h0, m0] = dTimes.maghrib.split(':').map(Number);
      const { hour, minute } = addMinutes(h0, m0, ADIYAH_DAY_OFFSET);
      const fireDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute, 0);
      if (fireDate.getTime() > now) {
        const id = await scheduleOne(notifee, TriggerType, entry.label, entry.dayId, fireDate);
        if (id) ids.push(id);
      }
    }

    // تسبيح اليوم (كل الأيام السبعة، بعد المغرب بـ٣٠ دقيقة)
    if (settings.tasbihDay) {
      const entry = WEEKDAY_TASBIH_ITEMS[weekday];
      const [h0, m0] = dTimes.maghrib.split(':').map(Number);
      const { hour, minute } = addMinutes(h0, m0, TASBIH_DAY_OFFSET);
      const fireDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute, 0);
      if (fireDate.getTime() > now) {
        const id = await scheduleOne(notifee, TriggerType, entry.label, entry.dayId, fireDate);
        if (id) ids.push(id);
      }
    }
  }

  await AsyncStorage.setItem(NOTIF_IDS_KEY, JSON.stringify(ids));

  // تحذير تطويري: نفس ملاحظة hijriNotifications.ts - آيفون يحدد ٦٤ إشعار
  // محلي مجدول لكل التطبيق مجتمعاً. هذا الملف وحده صار يجدول حتى ~٢٥+ إشعار
  // (٥ صلوات + جمعة + كميل + ٧ أدعية + ٧ تسبيح خلال أسبوع). لازم يُجمع مع
  // عدد verseNotifications.ts وnotifeeAzan.ts وhijriNotifications.ts بنفس
  // اللحظة لمعرفة القرب الحقيقي من حد آيفون - لسه غير محلول بدالة مركزية.
  if (__DEV__ && ids.length > 25) {
    console.warn(`[athkar] عدد كبير من إشعارات هذا الملف وحده: ${ids.length} - تذكر جمعه مع باقي أنواع الإشعارات لمعرفة القرب من حد آيفون (64)`);
  }

  return ids.length;
}

export async function disableAthkarNotifications(): Promise<void> {
  await cancelAllAthkarNotifications();
  await AsyncStorage.setItem(NOTIF_IDS_KEY, JSON.stringify([]));
}

// ===== تحقق تلقائي (وضع التطوير بس) - يفحص كل مرجع بـDAY_AMAL_MANIFEST مقابل
// الملفات الحقيقية (athkar-data.json / adiyah-data.json) ويطلع تحذير واضح
// بالكونسول لأي مرجع "معلّق" (item id ما موجود بالمكان المتوقع) - عشان نكتشف
// هالنوع من الكسر فوراً وقت فتح التطبيق، مو بالصدفة لما يوصل إشعار ويطلع فارغ.
// ⚠️ ما تأثر إطلاقاً على نسخة الإنتاج (__DEV__ بس) وما توقف التطبيق - بس تطبع
// تحذير بالكونسول.
type AdiyahItemRaw = { id: string };
type AdiyahCategoryRaw = { id: string; items: AdiyahItemRaw[] };
type AdiyahSectionRaw = { id: string; items?: AdiyahItemRaw[]; categories?: AdiyahCategoryRaw[] };
type AdiyahDataRoot = { sections: AdiyahSectionRaw[] };

type AthkarSubRaw = { id: string };
type AthkarGroupRaw = { id: string; subs?: AthkarSubRaw[] };
type AthkarDataRoot = { athkar: { groups: AthkarGroupRaw[] } };

function checkRefResolves(ref: DayAmalRef): string | null {
  if (ref.type === 'info' || ref.type === 'quran') return null; // ما تحتاج بيانات خارجية

  if (ref.type === 'dhikr') {
    const data = athkarDataRaw as unknown as AthkarDataRoot;
    const group = data.athkar.groups.find((g) => g.id === ref.section);
    if (!group) return `قسم "${ref.section}" مو موجود بـ athkar-data.json`;
    const sub = group.subs?.find((s) => s.id === ref.item);
    if (!sub) return `"${ref.item}" مو موجود بـ subs قسم "${ref.section}" (athkar-data.json)`;
    return null;
  }

  if (ref.type === 'dua') {
    const data = adiyahDataRaw as unknown as AdiyahDataRoot;
    const section = data.sections.find((s) => s.id === ref.section);
    if (!section) return `قسم "${ref.section}" مو موجود بـ adiyah-data.json`;
    if (ref.category) {
      const cat = section.categories?.find((c) => c.id === ref.category);
      if (!cat) return `تصنيف "${ref.category}" مو موجود بقسم "${ref.section}" (adiyah-data.json)`;
      if (!cat.items.find((i) => i.id === ref.item)) {
        return `"${ref.item}" مو موجود بتصنيف "${ref.category}" قسم "${ref.section}" (adiyah-data.json)`;
      }
      return null;
    }
    if (!section.items?.find((i) => i.id === ref.item)) {
      return `"${ref.item}" مو موجود بقسم "${ref.section}" (adiyah-data.json)`;
    }
    return null;
  }

  return null;
}

/**
 * يفحص كل مرجع بـDAY_AMAL_MANIFEST ويطبع تحذير واضح لأي وحدة مكسورة. استدعيها
 * مرة وحدة بس، بوضع التطوير، وقت بداية التطبيق (مثلاً بـ_layout.tsx أو
 * notifications.ts، داخل if (__DEV__)).
 */
export function validateDayAmalManifest(): void {
  let brokenCount = 0;
  for (const [dayId, entry] of Object.entries(DAY_AMAL_MANIFEST)) {
    for (const item of entry.items) {
      const problem = checkRefResolves(item.ref);
      if (problem) {
        brokenCount++;
        console.warn(`[DAY_AMAL_MANIFEST] مرجع مكسور بـ"${dayId}" ← "${item.label}": ${problem}`);
      }
    }
  }
  if (brokenCount === 0) {
    console.log('[DAY_AMAL_MANIFEST] كل المراجع سليمة ✓');
  } else {
    console.warn(`[DAY_AMAL_MANIFEST] عدد المراجع المكسورة: ${brokenCount} - إشعارات هذولة راح تفتح صفحة فارغة`);
  }
}

// ===== معالجة الحدث - دالة نقية (نفس مبدأ باقي ملفات notifee بالمشروع؛
// التسجيل الفعلي الوحيد صار مركزي بملف notificationEvents.ts) =====
export function handleAthkarEvent(type: any, detail: any, EventType: any): boolean {
  const channelId = detail?.notification?.android?.channelId;
  if (channelId !== CHANNEL_ID) return false; // مو من اختصاصي

  if (type === EventType.PRESS) {
    const dayId = detail?.notification?.data?.dayId as string | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { router } = require('expo-router');
      if (dayId) {
        router.push({ pathname: '/athkar', params: { dayId } } as any);
      } else {
        router.push('/athkar' as any);
      }
    } catch {
      // تجاهل إذا التوجيه فشل
    }
  }
  return true;
}