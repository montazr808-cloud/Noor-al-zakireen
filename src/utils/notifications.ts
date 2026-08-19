// ===== utils/notifications.ts =====
// نقطة الدخول الموحّدة لكل إشعارات التطبيق: الأذان + تذكيرات الأذكار (أوقات
// الصلاة، الجمعة، كميل، أدعية اليوم، تسبيح اليوم) + آية بعد كل صلاة +
// المناسبات الهجرية/الأيام البيض. كل شي هسه عبر محرك واحد (notifee). باقي
// المنطق التفصيلي يضل بملفاته المتخصصة (notificationScheduler.ts,
// verseNotifications.ts, hijriNotifications.ts, notifeeAzan.ts) - هذا الملف
// بس "يلمّهم" بنداء وحيد بدل ما كل شاشة تنادي كل نظام لحاله.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import {
  getHijriNotifPrefs,
  refreshHijriNotificationsIfNeeded,
} from './hijriNotifications';
import { scheduleNextPrayerNotifications } from './nextPrayerNotification';
import { registerAzanForegroundService, scheduleAzanNotifications } from './notifeeAzan';
import { registerAllNotificationEventListeners } from './notificationEvents';
import {
  DEFAULT_ATHKAR_NOTIFICATION_SETTINGS,
  getAthkarNotificationSettings,
  getAthkarOffsets,
  scheduleAthkarNotifications,
  type AthkarNotificationSettings,
  type Coordinates,
} from './notificationScheduler';
import { getPrayerTimes } from './prayerCalc';
import { scheduleVerseNotifications } from './verseNotifications';

// نفس المفتاح بالضبط المستخدم بـ app/settings/prayer-times.tsx لحفظ تفعيل/تعطيل
// أذان كل صلاة لحالها (NOTIF_SETTINGS_KEY هناك) - لازم يضلون متطابقين حرفياً
const PRAYER_NOTIF_SETTINGS_KEY = 'noor_prayerNotifSettings';

// ===== تسجيل الأذان بالخلفية (أندرويد) =====
// لازم تنعاد هذي مرة وحدة بس، بأعلى مستوى بالتطبيق (app/_layout.tsx) - قبل
// أي شي ثاني، حتى لو التطبيق ينفتح من إشعار أو بالخلفية.
export function registerBackgroundNotificationHandlers() {
  registerAzanForegroundService();
  registerAllNotificationEventListeners();
}

// ===== الجدولة الشاملة - تنادى كل ما يفتح التطبيق أو يتغير موقع/إعدادات المستخدم =====
export type FullNotificationSettings = {
  coords: Coordinates;
  athkar: AthkarNotificationSettings;
  azanEnabled: Record<'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', boolean>;
};

export async function initializeAppNotifications(settings: Partial<FullNotificationSettings> = {}): Promise<{
  athkarCount: number;
  azanCount: number;
  verseCount: number;
}> {
  let coords = settings.coords;

  // لو ما انعطت إحداثيات، نجرب نجيبها من موقع الجهاز (نفس صلاحية القبلة/أوقات الصلاة)
  if (!coords) {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({});
        coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      }
    } catch {
      // ماكو موقع متاح - نكمل بدونه، جدولة الأذكار المرتبطة بأوقات الصلاة بس تنتخطى
    }
  }

  let athkarCount = 0;
  let azanCount = 0;
  let verseCount = 0;

  if (coords) {
    // نحمّل إعداداتك الفعلية المحفوظة (لو محد عطاها بالمعطيات) بدل ما نستخدم
    // الافتراضي دايماً - وإلا كل فتح تطبيق يرجع يلغي أي تخصيص سويته سابقاً
    const athkarSettings = settings.athkar ?? (await getAthkarNotificationSettings().catch(() => DEFAULT_ATHKAR_NOTIFICATION_SETTINGS));
    const athkarOffsets = await getAthkarOffsets().catch(() => undefined);
    athkarCount = await scheduleAthkarNotifications(coords, athkarSettings, athkarOffsets);

    try {
      const times = getPrayerTimes(coords.latitude, coords.longitude);
      let azanEnabled = settings.azanEnabled;
      if (!azanEnabled) {
        try {
          const raw = await AsyncStorage.getItem(PRAYER_NOTIF_SETTINGS_KEY);
          azanEnabled = raw ? JSON.parse(raw) : undefined;
        } catch {
          // تجاهل، نرجع للافتراضي بالأسفل
        }
      }
      azanCount = await scheduleAzanNotifications(
        times,
        azanEnabled ?? { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true }
      );
      await scheduleNextPrayerNotifications(times);
      verseCount = await scheduleVerseNotifications(times);
    } catch {
      // فشل حساب أوقات الصلاة - نتجاوز جدولة الأذان والآيات بس ونكمل الباقي
    }
  }

  // المناسبات الهجرية/الأيام البيض - ما تحتاج إحداثيات
  try {
    const hijriPrefs = await getHijriNotifPrefs();
    await refreshHijriNotificationsIfNeeded(hijriPrefs);
  } catch {
    // تجاهل
  }

return {
  athkarCount,
  azanCount,
  verseCount,
};
}