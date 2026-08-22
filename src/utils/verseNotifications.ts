// ===== utils/verseNotifications.ts =====
// إشعار "آية بعد كل صلاة" — لكل صلاة مخزن ٢٥ آية مرتبطة بمعناها (بملف
// prayerVerses.json، مراجع فقط: رقم السورة + رقم الآية)، تتدور بالترتيب
// (٠→٢٤ وبعدها ترجع للأول) حتى ما تتكرر نفس الآية يومين ورا بعض.
//
// النص الفعلي للآية ما مكتوب هنا ولا بملف prayerVerses.json - نجيبه وقت
// الجدولة مباشرة من assets/quran-full.json (نفس المصدر الموثوق اللي تعتمد
// عليه شاشة المصحف نفسها)، حتى نضمن تطابق ١٠٠٪ بين نص الإشعار ونص المصحف
// وما نخاطر بأي خطأ إملائي لو انكتبت الآية يدوياً بملفين مختلفين.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import prayerVersesRefs from '@/data/prayerVerses.json';
import type { PrayerTimesResult } from './prayerCalc';

type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

type VerseRef = { id: string; surahNum: number; ayahStart: number; ayahEnd: number };

const VERSE_REFS: Record<PrayerKey, VerseRef[]> = prayerVersesRefs as any;

const ROTATION_INDEX_KEY = '@verse_notif_rotation_v1';
const NOTIF_IDS_KEY = '@verse_notif_ids_v1';
const CHANNEL_ID = 'prayer-verses';

// فرق الدقائق عن وقت كل صلاة - بعد إشعار الأذان والأذكار بفارق كافي حتى ما
// توصل كل الإشعارات دفعة وحدة بنفس اللحظة (طلب صريح: كل إشعار بوقت مناسب،
// مو الكل سوة)
const VERSE_OFFSET_MINUTES = 5;

const PRAYER_ORDER: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const PRAYER_TITLES: Record<PrayerKey, string> = {
  fajr: 'آية بعد الفجر', dhuhr: 'آية بعد الظهر', asr: 'آية بعد العصر',
  maghrib: 'آية بعد المغرب', isha: 'آية بعد العشاء',
};

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
    name: 'آية بعد الصلاة',
    importance: AndroidImportance.DEFAULT,
  });
}

// ===== قراءة نص الآية الحقيقي من quran-full.json (نفس بيانات شاشة المصحف) =====
type QuranVerse = { id: number; text: string };
type QuranSurah = { id: number; name: string; verses: QuranVerse[] };

let cachedQuran: QuranSurah[] | null = null;
let quranLoadFailed = false;
function loadQuranData(): QuranSurah[] | null {
  if (cachedQuran) return cachedQuran;
  if (quranLoadFailed) return null; // جربنا قبل وفشل - ما نعيد نفس المحاولة كل آية
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedQuran = require('../assets/quran-full.json') as QuranSurah[];
    return cachedQuran;
  } catch (e) {
    // ⚠️ إصلاح جوهري: هذا require كان بدون try/catch - لو صار أي خطأ هنا
    // (مسار غلط، ملف تالف، إلخ)، الخطأ كان يهرب لأعلى من scheduleVerseNotifications
    // بالكامل، يوصل لـ initializeAppNotifications بملف notifications.ts، ويقع
    // بالـ catch الصامت هناك - يعني كل إشعارات الآيات تنقطع كلياً بدون أي أثر
    // بالكونسول يوضح السبب. هسه أي فشل هنا يطبع بالكونسول بالضبط شنو صار.
    quranLoadFailed = true;
    console.error('[verseNotifications] فشل تحميل assets/quran-full.json:', e);
    return null;
  }
}

function resolveVerseText(ref: VerseRef): { surahName: string; text: string } | null {
  const data = loadQuranData();
  if (!data) return null;
  const surah = data.find((s) => s.id === ref.surahNum);
  if (!surah) return null;
  const parts: string[] = [];
  for (let v = ref.ayahStart; v <= ref.ayahEnd; v++) {
    const verse = surah.verses.find((x) => x.id === v);
    if (verse) parts.push(verse.text);
  }
  if (parts.length === 0) return null;
  return { surahName: surah.name, text: parts.join(' ') };
}

// ===== التدوير المتسلسل - index محفوظ لكل صلاة لحالها بـ AsyncStorage =====
async function getRotationIndexes(): Promise<Record<PrayerKey, number>> {
  try {
    const raw = await AsyncStorage.getItem(ROTATION_INDEX_KEY);
    if (raw) return { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, ...JSON.parse(raw) };
  } catch {
    // نتجاهل ونرجع الصفر لكل الصلوات
  }
  return { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
}

async function saveRotationIndexes(indexes: Record<PrayerKey, number>): Promise<void> {
  await AsyncStorage.setItem(ROTATION_INDEX_KEY, JSON.stringify(indexes));
}

function addMinutes(hour: number, minute: number, delta: number): { hour: number; minute: number } {
  let total = hour * 60 + minute + delta;
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

/**
 * يجدول إشعار آية واحد بعد كل صلاة من صلوات اليوم المتبقية (بفارق ٥ دقايق
 * عن وقت الصلاة). كل استدعاء يسحب "الآية الجاية بالدور" لكل صلاة ويقدّم
 * المؤشر خطوة وحدة (يرجع للأول تلقائياً بعد ٢٥). لازم تنعاد هذي الدالة كل
 * ما يفتح التطبيق (نفس مبدأ باقي جداول الصلاة) عشان الوقت يبقى محدث.
 */
export async function scheduleVerseNotifications(times: PrayerTimesResult): Promise<number> {
  const notifee = getNotifee();
  const { TriggerType } = getNotifeeTypes();

  await ensureChannel();

  try {
    const raw = await AsyncStorage.getItem(NOTIF_IDS_KEY);
    const oldIds: string[] = raw ? JSON.parse(raw) : [];
    await Promise.all(oldIds.map((id) => notifee.cancelTriggerNotification(id).catch(() => {})));
  } catch {
    // تجاهل
  }

  const indexes = await getRotationIndexes();
  const ids: string[] = [];
  const now = Date.now();

  for (const prayer of PRAYER_ORDER) {
    const refs = VERSE_REFS[prayer];
    if (!refs || refs.length === 0) continue;

    const [h0, m0] = times[prayer].split(':').map(Number);
    const { hour, minute } = addMinutes(h0, m0, VERSE_OFFSET_MINUTES);
    const fireDate = new Date();
    fireDate.setHours(hour, minute, 0, 0);
    if (fireDate.getTime() <= now) continue; // فاتت اليوم - تنجدول بكرة بالتحديث الجاي

    const idx = indexes[prayer] % refs.length;
    const ref = refs[idx];
    const resolved = resolveVerseText(ref);
    if (!resolved) continue; // مرجع ما انلقى بملف المصحف - نتخطاه بدل ما نرمي إشعار فاضي

    try {
      const id = await notifee.createTriggerNotification(
        {
          title: PRAYER_TITLES[prayer],
          body: `${resolved.text} ﴿${ref.ayahEnd}﴾ - سورة ${resolved.surahName}`,
          data: {
            screen: 'quran',
            surah: String(ref.surahNum),
            ayah: String(ref.ayahStart),
          },
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
          // ⚠️ إصلاح ثبات الإشعارات بكل الهواتف - نفس السبب بباقي ملفات الجدولة
          alarmManager: { allowWhileIdle: true },
        }
      );
      ids.push(id);
      indexes[prayer] = (idx + 1) % refs.length; // نقدّم الدور بس لو الجدولة نجحت فعلاً
    } catch {
      // نتجاوز صلاة وحدة ونكمل الباقي
    }
  }

  await AsyncStorage.setItem(NOTIF_IDS_KEY, JSON.stringify(ids));
  await saveRotationIndexes(indexes);
  return ids.length;
}

// ===== معالجة الحدث - دالة نقية (نفس مبدأ باقي ملفات notifee بالمشروع؛
// التسجيل الفعلي الوحيد صار مركزي بملف notificationEvents.ts) =====
export function handleVerseEvent(type: any, detail: any, EventType: any): boolean {
  const channelId = detail?.notification?.android?.channelId;
  if (channelId !== CHANNEL_ID) return false; // مو من اختصاصي

  if (type === EventType.PRESS) {
    const data = detail?.notification?.data;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { router } = require('expo-router');
      if (data?.surah) {
        router.push({ pathname: '/quran', params: { surah: data.surah, ayah: data.ayah } } as any);
      } else {
        router.push('/quran' as any);
      }
    } catch {
      // تجاهل إذا التوجيه فشل
    }
  }
  return true;
}