// ===== utils/notifications.ts =====
// نقطة الدخول الموحّدة لكل إشعارات التطبيق: الأذان + تذكيرات الأذكار (أوقات
// الصلاة، الجمعة، كميل، أدعية اليوم، تسبيح اليوم) + آية بعد كل صلاة +
// المناسبات الهجرية/الأيام البيض. كل شي هسه عبر محرك واحد (notifee). باقي
// المنطق التفصيلي يضل بملفاته المتخصصة (notificationScheduler.ts,
// verseNotifications.ts, hijriNotifications.ts, notifeeAzan.ts) - هذا الملف
// بس "يلمّهم" بنداء وحيد بدل ما كل شاشة تنادي كل نظام لحاله.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';

import { ensureBatteryOptimizationExemption } from './batteryOptimization';
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
// ⚠️ إضافة سيرفر الدفع (noor-server، Cloudflare Worker + FCM): يرسل توكن
// الجهاز + إحداثياته + تفعيل/تعطيل كل صلاة، حتى يوصل أذان حقيقي عبر Push
// حتى لو التطبيق مقفول تماماً من أيام - يعمل كطبقة إضافية فوق الجدولة
// المحلية الموجودة (notifeeAzan.ts)، ما يلغيها ولا يعتمد عليها.
import { requestNotificationPermission } from './permissions';
import { registerForPushNotifications } from './pushRegistration';
import { scheduleVerseNotifications } from './verseNotifications';

// نفس المفتاح بالضبط المستخدم بـ app/settings/prayer-times.tsx لحفظ تفعيل/تعطيل
// أذان كل صلاة لحالها (NOTIF_SETTINGS_KEY هناك) - لازم يضلون متطابقين حرفياً
const PRAYER_NOTIF_SETTINGS_KEY = 'noor_prayerNotifSettings';

// نفس المفتاح بالضبط المصدّر كـONBOARDING_DONE_KEY من
// components/OnboardingPermissions.tsx - لازم يضلون متطابقين حرفياً. مكرر
// هنا بدل ما نستورد الكومبوننت نفسه (نفس أسلوب PRAYER_NOTIF_SETTINGS_KEY
// فوگ) حتى ما نجر كومبوننت React كامل جوه ملف utils.
const ONBOARDING_DONE_KEY = '@onboarding_permissions_done_v1';

// نفس أسلوب باقي ملفات notifee بالمشروع - استيراد ديناميكي حتى الملف ما يكسر
// شي قبل تنصيب @notifee/react-native
function getNotifee() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@notifee/react-native').default as typeof import('@notifee/react-native').default;
}
function getNotifeeTypes() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@notifee/react-native') as typeof import('@notifee/react-native');
}

// مفتاح يخلينا نعرض رسالة التنبيه مرة وحدة بس بكل جلسة تطبيق (مو كل فتح
// شاشة) - حتى ما نزعج المستخدم برسالة متكررة لو اختار يتجاهلها
const ALARM_PERMISSION_PROMPTED_KEY = '@alarm_permission_prompted_v1';

// ⚠️ إصلاح ("الأذان ما يوصل إطلاقاً - ولا حتى متأخر"): جدولة الأذان كلها
// كانت محصورة جوه `if (coords)` بدون أي احتياط - لو طلب الموقع الطازج فشل
// لأي سبب عابر (GPS مطفي لحظياً، مشكلة شبكة مؤقتة، النظام رفض الطلب هذي
// المرة بالذات)، coords تضل فاضية والأسبوع كامل ينجدول بصفر تنبيهات أذان
// بصمت - حتى لو الموقع كان شغال زين بفتحات سابقة. هسه نخزن آخر إحداثيات
// نجحت فعلاً، ونستخدمها كاحتياط أخير لو الطلب الطازج فشل - أفضل بكثير من
// صفر جدولة بالكامل (فرق دقايق بسيط بالإحداثيات ما يأثر عملياً على أوقات
// الصلاة المحسوبة).
const LAST_KNOWN_COORDS_KEY = '@noor_lastKnownCoords_v1';

async function saveLastKnownCoords(coords: Coordinates): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_KNOWN_COORDS_KEY, JSON.stringify(coords));
  } catch {
    // تجاهل - أسوأ حالة ما يتوفر احتياط بفتحة جاية
  }
}

async function loadLastKnownCoords(): Promise<Coordinates | undefined> {
  try {
    const raw = await AsyncStorage.getItem(LAST_KNOWN_COORDS_KEY);
    return raw ? (JSON.parse(raw) as Coordinates) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * ⚠️ إصلاح جوهري (ثبات الإشعارات بكل الهواتف، جزء ٢): من أندرويد ١٢ فما فوق،
 * صلاحية "التنبيهات والمنبهات الدقيقة" (Alarms & reminders) منفصلة كلياً عن
 * صلاحية الإشعارات العادية، ولازم المستخدم يفعّلها يدوياً من إعدادات النظام
 * (ماكو نافذة طلب صلاحية عادية تطلع تلقائياً). لو مو مفعّلة، alarmManager
 * (المضاف الآن بكل ملفات الجدولة) يرجع تلقائياً لتنبيه "غير دقيق" بصمت -
 * وهذا بالضبط سبب تفاوت دقة/ثبات التوقيت بين جهاز وجهاز.
 *
 * هذي الدالة تتحقق من حالة الصلاحية، ولو مو مفعّلة (ومو سبق عرضنا الرسالة
 * بهذي الجلسة)، تعرض تنبيه يشرح للمستخدم بالعربي وتوديه مباشرة لصفحة
 * الإعدادات الصحيحة بالنظام لتفعيلها.
 */
export async function ensureExactAlarmPermission(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const notifee = getNotifee();
    const { AndroidNotificationSetting } = getNotifeeTypes();
    const settings = await notifee.getNotificationSettings();

    if (settings.android.alarm === AndroidNotificationSetting.ENABLED) return;

    const alreadyPrompted = await AsyncStorage.getItem(ALARM_PERMISSION_PROMPTED_KEY);
    if (alreadyPrompted === 'true') return;
    await AsyncStorage.setItem(ALARM_PERMISSION_PROMPTED_KEY, 'true');

    Alert.alert(
      'صلاحية مهمة لضبط توقيت الإشعارات',
      'حتى توصلك إشعارات الأذان والأذكار بالضبط بوقتها المحدد (مو متأخرة)، يحتاج التطبيق صلاحية "التنبيهات والمنبهات الدقيقة" من إعدادات هاتفك. اضغط "فتح الإعدادات" وفعّلها للتطبيق.',
      [
        { text: 'لاحقاً', style: 'cancel' },
        {
          text: 'فتح الإعدادات',
          onPress: () => {
            notifee.openAlarmPermissionSettings().catch(() => {});
          },
        },
      ]
    );
  } catch {
    // notifee قديم ما يدعم هذا الفحص بعد، أو فشل غير متوقع - نتجاهل بصمت
    // (باقي جدولة الإشعارات تكمل عادي، بس ممكن تصير غير دقيقة على هذا الجهاز)
  }
}

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
  // ⚠️ إعادة تصميم onboarding (طلب صريح): صلاحية الإشعارات كانت بطاقة منفصلة
  // بشاشة onboarding تُطلب دفعة وحدة مع باقي الصلاحيات بدون سياق واضح. هسه
  // تُطلب هنا مباشرة - أول لحظة فعلية نحتاجها فيها (قبل أي جدولة إشعار)،
  // وهذا بالضبط "لحظتها الطبيعية" بما إنها مطلوبة لكل أنواع الإشعارات بالتطبيق.
  // notifee.requestPermission() ما يطلع نافذة نظام مكررة لو الحالة محسومة
  // (ممنوحة أو مرفوضة نهائياً) من قبل - آمن ننادها بكل فتحة تطبيق.
  await requestNotificationPermission();

  // ⚠️ إصلاح ("قائمة/تنبيه صلاحية يطلع أول فتحة تطبيق بدون فائدة"): هذي
  // الدالة تنادى تلقائياً بـ_layout.tsx بـuseEffect مستقل تماماً عن حالة
  // onboarding - يعني كانت تشتغل حتى قبل ما يوصل المستخدم لشاشة
  // OnboardingPermissions.tsx نفسها. النتيجة: ensureExactAlarmPermission
  // وensureBatteryOptimizationExemption يطلعون Alert (وممكن يودون المستخدم
  // لشاشة/قائمة إعدادات نظام كاملة عبر requestIgnoreBatteryOptimizations)
  // بأول ثانية بالتطبيق، بدون أي سياق أو فائدة واضحة للمستخدم - وبعدين
  // يتكرر نفس الطلب بشكل صحيح ومتحكم فيه (خطوتين تأكيد) بشاشة onboarding
  // نفسها. هذا تكرار/تعارض واجهة حقيقي، مو مجرد إزعاج.
  //
  // الحل: هذولا الاثنين (المنبه الدقيق + توفير الطاقة) صار onboarding
  // مسؤول عنهم حصرياً بأول تجربة استخدام. النداء هنا يضل موجود بس كـ"تذكير
  // دوري" للمستخدمين اللي خلصوا onboarding من زمان (شوف تعليق
  // BATTERY_REPROMPT_DAYS بـbatteryOptimization.ts - أندرويد ممكن يرجع
  // يقيّد التطبيق بصمت لاحقاً حتى بعد موافقة سابقة) - ما نناديهم إطلاقاً
  // قبل ما يكمل المستخدم شاشة onboarding أول مرة.
  const onboardingDone = await AsyncStorage.getItem(ONBOARDING_DONE_KEY);
  if (onboardingDone === 'true') {
    // ⚠️ جزء ٢ من إصلاح ثبات الإشعارات - نتحقق/نطلب صلاحية المنبهات الدقيقة
    // قبل أي جدولة، حتى alarmManager يشتغل فعلياً على هذا الجهاز
    await ensureExactAlarmPermission();
    // ⚠️ تذكير دوري بغض النظر متى المستخدم خلّص onboarding - شوف الشرح الكامل
    // بملف batteryOptimization.ts (نفس مبدأ ensureExactAlarmPermission فوگ)
    await ensureBatteryOptimizationExemption();
  }

  let coords = settings.coords;

  // ⚠️ إصلاح جوهري: كان هنا getForegroundPermissionsAsync (يتحقق بس، ما يطلب).
  // بأول فتحة تطبيق (قبل ما يزور المستخدم شاشة أوقات الصلاة اللي تطلب الموقع
  // بنفسها بشكل منفصل)، الصلاحية تكون "غير محددة" فيرجع status != 'granted'،
  // فـ coords يضل فاضي، وكل الكتلة تحت (أذكار + الصلاة القادمة + آية بعد
  // الصلاة) تنتخطى بالكامل بصمت - وهذا بالضبط سبب "بس الأذان يشتغل والباقي لا"
  // (الأذان إله مسار منفصل تماماً بشاشة أوقات الصلاة تطلب الموقع لحالها).
  // الحل: نستخدم requestForegroundPermissionsAsync اللي يطلب الصلاحية فعلياً
  // (يطلع نافذة النظام) لو مو ممنوحة بعد، بدل ما يكتفي بالتحقق الصامت
  if (!coords) {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        // ⚠️ إصلاح ("تنبيه الأذان متوقف يطلع كل يومين رغم إن الصلاحية مفعّلة"):
        // getCurrentPositionAsync يطلب إشارة GPS طازجة - يفشل/يتأخر بسهولة
        // بمكان مغلق أو تغطية ضعيفة، حتى مع صلاحية سليمة ١٠٠٪. قبل هذا
        // الطلب البطيء، نجرب أول آخر موقع معروف عند نظام أندرويد نفسه
        // (getLastKnownPositionAsync) - فوري، بدون انتظار GPS - ونستخدمه لو
        // موجود ومو قديم كثير (أقل من ٦ ساعات كافي لدقة أوقات الصلاة).
        try {
          const lastKnown = await Location.getLastKnownPositionAsync({
            maxAge: 6 * 60 * 60 * 1000,
          });
          if (lastKnown) {
            coords = { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude };
          }
        } catch {
          // نكمل ونجرب الموقع الطازج بالأسفل
        }
        if (!coords) {
          const pos = await Location.getCurrentPositionAsync({});
          coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        }
        await saveLastKnownCoords(coords);
      }
    } catch {
      // ماكو موقع متاح هذي المرة - نتجاهل هنا ونجرب الاحتياط بالأسفل
    }
    // ⚠️ الاحتياط: لو الطلب الطازج فوگ فشل (استثناء أو status != 'granted')،
    // نجرب آخر إحداثيات نجحت سابقاً بدل ما نسيب الأسبوع كامل بلا أذان
    if (!coords) {
      coords = await loadLastKnownCoords();
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
      const resolvedAzanEnabled = azanEnabled ?? { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };
      azanCount = await scheduleAzanNotifications(times, resolvedAzanEnabled, coords);
      await scheduleNextPrayerNotifications(times);

      // ⚠️ تسجيل الجهاز بسيرفر الدفع (noor-server) - يرسل توكن FCM +
      // الإحداثيات + تفعيل كل صلاة، حتى يقدر السيرفر يرسل أذان Push حقيقي
      // بالضبط بوقته حتى لو التطبيق مقفول تماماً. لا يوقف باقي الجدولة
      // المحلية لو فشل (شبكة، إلخ) - مصمم يفشل بصمت ويعيد المحاولة بفتحة
      // تطبيق جاية.
      registerForPushNotifications({
        latitude: coords.latitude,
        longitude: coords.longitude,
        azanEnabled: resolvedAzanEnabled,
      }).catch(() => {});

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

  // ⚠️ إصلاح ("الأذان ما يوصل - ولا أي تنبيه إطلاقاً"): قبل، فشل جدولة
  // الأذان (سواء بسبب فقدان الموقع أو أي خطأ آخر) كان يمر بصمت تام - المستخدم
  // يكتشف بس لما يفوته وقت صلاة فعلي، بدون أي فكرة ليش. هسه لو أندرويد وazanCount
  // انتهت صفر (يعني ماكو ولا تنبيه أذان واحد انحجز للأسبوع الجاي)، نطلع تنبيه
  // مرئي حقيقي يوضح السبب ويودي المستخدم مباشرة لإعدادات الموقع - بدل صمت
  // يكتشفه بس بعد ما يفوته الأذان فعلياً.
  //
  // ⚠️ إصلاح ٢ ("التنبيه يطلع كل يومين رغم إن الصلاحية فعلاً مفعّلة"): فشل
  // وحيد وعابر بتحديد الموقع (هفوة GPS مؤقتة، مو مشكلة صلاحية حقيقية) كان
  // كافي يطلع التنبيه فوراً - مزعج وغير دقيق. هسه نطلب ٣ حالات فشل متتالية
  // (مو مرة وحدة عابرة) قبل ما ننبّه، ونصفّر العداد فوراً أول ما الجدولة
  // تنجح - يفلتر الهفوات المؤقتة ويحتفظ بالتنبيه بس للفشل الحقيقي المستمر.
  const failureStreakKey = '@azan_schedule_failure_streak_v1';
  if (Platform.OS === 'android' && azanCount === 0) {
    try {
      const streakRaw = await AsyncStorage.getItem(failureStreakKey);
      const streak = (streakRaw ? parseInt(streakRaw, 10) : 0) + 1;
      await AsyncStorage.setItem(failureStreakKey, String(streak));

      const key = '@azan_schedule_failure_prompted_at_v1';
      const lastRaw = await AsyncStorage.getItem(key);
      const hoursSince = lastRaw ? (Date.now() - new Date(lastRaw).getTime()) / (1000 * 60 * 60) : Infinity;
      if (streak >= 3 && hoursSince >= 12) {
        await AsyncStorage.setItem(key, new Date().toISOString());
        const reason = !coords
          ? 'التطبيق ما يقدر يحدد موقعك - صلاحية "الموقع" غير مفعّلة أو مرفوضة.'
          : 'صار خطأ بحساب مواقيت الصلاة لموقعك الحالي.';
        Alert.alert(
          '⚠️ الأذان متوقف تماماً!',
          `${reason}\n\nبدون هذا، ما راح توصلك أي إشعارات أذان أو صلاة إطلاقاً. افتح إعدادات الجهاز > التطبيقات > نور الذاكرين > الأذونات، وفعّل "الموقع" (اختر "السماح دائماً" أو على الأقل "أثناء استخدام التطبيق").`,
          [
            { text: 'لاحقاً', style: 'cancel' },
            { text: 'فتح إعدادات التطبيق', onPress: () => Linking.openSettings().catch(() => {}) },
          ]
        );
      }
    } catch {
      // تجاهل - أسوأ حالة ما يشوف المستخدم التنبيه هذي المرة
    }
  } else if (Platform.OS === 'android' && azanCount > 0) {
    // نجحت الجدولة - نصفّر عداد الفشل المتتالي فوراً
    try {
      await AsyncStorage.setItem(failureStreakKey, '0');
    } catch {
      // تجاهل
    }
  }

return {
  athkarCount,
  azanCount,
  verseCount,
};
}