// ===== utils/notifeeAzan.ts =====
// الأذان الكامل بالخلفية على أندرويد - عبر @notifee/react-native.
//
// ⚠️ هذا الملف كتبته وأنا ما أكدر أختبره فعلياً على جهاز حقيقي (ماكو عندي
// وصول لهاتف أندرويد). المنطق العام صحيح ومطابق للطريقة الموثقة رسمياً من
// notifee لهذا النوع بالضبط من الميزات (نفس أسلوب تطبيقات الأذان المعروفة)،
// بس يحتاج تجربة حقيقية بجهازك وتيقة بسيطة بعد أول تشغيل - هذا متوقع مع أي
// ميزة foreground service جديدة، مو علامة على إنه الكود غلط بالضرورة.
//
// آيفون: ما ينطبق عليه هذا الملف إطلاقاً (notifee ما يقدر يسوي هذا الشي على
// آيفون أصلاً - قيد حقيقي من أبل، مو تقصير بالمكتبة). آيفون يبقى على تنبيه
// نصي عادي + تشغيل الأذان الكامل فور فتح التطبيق أو لمس التنبيه (بملف
// prayer-times.tsx نفسه، منطق منفصل).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

import {
  CUSTOM_VOICE_FILES_KEY,
  CUSTOM_VOICES_LIST_KEY,
  DEFAULT_VOICE_ID,
  resolveVoiceSource,
  SELECTED_VOICE_KEY,
  type CustomVoice,
} from './muezzinVoices';

// notifee مكتبة native بالكامل - نستوردها ديناميكياً حتى الملف ما يكسر
// شي لو الشخص يفتح المشروع قبل لا يسوي `npx expo install @notifee/react-native`
// + rebuild (نفس أسلوب expo-audio بملف التسبيح). بعد التنصيب هذا الاستيراد
// يشتغل عادي.
function getNotifee() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@notifee/react-native').default as typeof import('@notifee/react-native').default;
}
function getNotifeeTypes() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@notifee/react-native') as typeof import('@notifee/react-native');
}

const AZAN_CHANNEL_ID = 'azan-full';
const AZAN_NOTIF_IDS_KEY = 'noor_azanNotifIds';
const STOP_ACTION_ID = 'stop-azan';

let activePlayer: AudioPlayer | null = null;
// يخزن دالة "خلص التشغيل" حتى نقدر نوقف الـforeground service لما الصوت يخلص
// طبيعياً (مو بس لما يدوس المستخدم على زر الإيقاف)
let resolveForegroundService: (() => void) | null = null;

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  const notifee = getNotifee();
  const { AndroidImportance } = getNotifeeTypes();
  await notifee.createChannel({
    id: AZAN_CHANNEL_ID,
    name: 'الأذان',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
}

// ===== فحص صلاحية "التنبيهات والمنبهات الدقيقة" (Exact Alarm) =====
// هذي صلاحية منفصلة تماماً عن صلاحية الإشعارات العادية (اللي تطلب من
// prayer-times.tsx). من أندرويد 12 وطالع، alarmManager:{allowWhileIdle:true}
// (اللي نستخدمه بالجدولة تحت) يحتاجها حتى يوصل الأذان بالضبط بوقته - وبدونها
// أندرويد يرجع الجدولة "غير دقيقة" بصمت (بدون أي خطأ بالكود) ويأجل التنبيه
// حسب مزاجه (وضع توفير البطارية، Doze، ...). هذا سبب شائع لِـ"يوصل أحياناً
// بوقته وأحياناً متأخر بدقايق" حتى لو باقي الكود صحيح 100%.
// ملاحظة: التصريح موجود بـ app.json (SCHEDULE_EXACT_ALARM/USE_EXACT_ALARM)
// وهذا شرط لازم بس مو كافي - أندرويد 13+ يحتاج المستخدم يفعّلها يدوياً من
// شاشة نظام منفصلة، هذا اللي تتحقق منه وتفتحه هذي الدالة.
export async function getExactAlarmPermissionStatus(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (Platform.OS !== 'android') return 'unsupported';
  try {
    const notifee = getNotifee();
    const { AndroidNotificationSetting } = getNotifeeTypes();
    const settings = await notifee.getNotificationSettings();
    const alarmSetting = (settings as any)?.android?.alarm;
    if (alarmSetting === AndroidNotificationSetting.ENABLED) return 'granted';
    if (alarmSetting === AndroidNotificationSetting.NOT_SUPPORTED) return 'unsupported'; // أندرويد أقدم من 12 - ما يحتاجها أصلاً
    return 'denied';
  } catch {
    // لو فشل الفحص لأي سبب (نسخة قديمة من notifee مثلاً)، ما نوقف التطبيق
    // ونفترض إنها متاحة حتى ما نزعج المستخدم بتحذير غير مؤكد
    return 'granted';
  }
}

// يفتح شاشة النظام المخصصة لهذي الصلاحية تحديداً (مو إعدادات التطبيق العامة)
export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await getNotifee().openAlarmPermissionSettings();
  } catch {
    // تجاهل - بعض الأجهزة/النسخ ما تدعم فتحها مباشرة
  }
}

// ===== صلاحية "الظهور فوق التطبيقات الأخرى" (Display over other apps /
// SYSTEM_ALERT_WINDOW) =====
// هذي صلاحية "خاصة" بأندرويد (Special App Access) - نفس فئة صلاحية المنبه
// الدقيق: معلنة بـ app.json (SYSTEM_ALERT_WINDOW)، بس ما تنطلب بمربع حوار
// عادي وقت التشغيل، ولازم المستخدم يفعّلها يدوياً من شاشة نظام مخصصة.
// ⚠️ محدودية حقيقية: أندرويد ما يعطي أي طريقة برمجية (بدون كتابة كود Native
// إضافي خارج Expo) نتحقق فيها هل الصلاحية ممنوحة فعلاً أو لا (بعكس صلاحية
// المنبه الدقيق اللي notifee توفر لها فحص جاهز). لهذا هذي الدالة تفتح شاشة
// التفعيل مباشرة بس، بدون فحص مسبق - التأكيد الفعلي صار مسؤولية المستخدم
// نفسه من واجهة OnboardingPermissions.tsx (ضغطة ثانية صريحة).
//
// ⚠️ ملاحظة مهمة إذا هذي الدالة تفشل دايماً وتفتح إعدادات التطبيق العامة
// بدل شاشة الصلاحية الحقيقية: السبب الأشيع هو أن مكتبة expo-intent-launcher
// مو مركبة فعلياً بمشروعك (npx expo install expo-intent-launcher)، أو
// مركبة بس التطبيق ما انبنى (rebuild) من جديد بعدها - هذي مكتبة native،
// تحديثها بالكود وحده ما يكفي، لازم بلد جديد (EAS build) يشملها.
const ANDROID_PACKAGE_ID = 'com.anonymous.nooralzakireen'; // ⚠️ لازم يطابق app.json → expo.android.package بالضبط

export async function openOverlayPermissionSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const IntentLauncher = require('expo-intent-launcher');
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.MANAGE_OVERLAY_PERMISSION_SETTINGS,
      { data: `package:${ANDROID_PACKAGE_ID}` }
    );
  } catch (e) {
    // ⚠️ كان الفشل هنا يطبع بـ console.log بس - بنسخة APK منصّبة عادي،
    // المستخدم ما يشوف الكونسول إطلاقاً، فيدوس الزر ويحس "ماكو شي صار" بدون
    // أي تفسير. أشيع سبب: مكتبة expo-intent-launcher مو مثبتة فعلاً بالمشروع
    // (أو مو مبنية ضمن آخر EAS build) رغم إن الكود يستخدمها - نطلع تنبيه
    // مرئي حقيقي بدل ما نخفي الفشل بصمت
    console.log('[notifeeAzan] فشل فتح شاشة صلاحية الظهور فوق التطبيقات (تأكد expo-intent-launcher مركّبة ومبنية ضمن آخر build):', e);
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Alert, Linking } = require('react-native');
      Alert.alert(
        'ما گدرنا نفتح الإعدادات تلقائياً',
        'افتح إعدادات الجهاز يدوياً > التطبيقات > نور الذاكرين > الظهور فوق التطبيقات الأخرى، وفعّلها من هناك.',
        [
          { text: 'حسناً', style: 'cancel' },
          { text: 'فتح إعدادات التطبيق', onPress: () => Linking.openSettings().catch(() => {}) },
        ]
      );
    } catch {
      // تجاهل - آخر خط دفاع، ما نگدر نسوي شي أكثر من هذا
    }
  }
}

// ===== دالة الـforeground service - هذا هو المكان اللي فعلياً يشغل الصوت =====
// notifee يستدعيها تلقائياً كل ما يطلع تنبيه بخاصية asForegroundService: true.
// المهم: نرجع Promise ما ينحل إلا بعد ما الصوت يخلص أو يوصل أمر إيقاف - طول
// ما الـPromise معلق، الخدمة تضل شغالة بالخلفية حتى لو التطبيق مقفول تماماً.
export function registerAzanForegroundService() {
  if (Platform.OS !== 'android') return;
  const notifee = getNotifee();

  notifee.registerForegroundService(() => {
    return new Promise<void>((resolve) => {
      resolveForegroundService = resolve;
      startAzanPlayback().catch(() => resolve());
    });
  });
}

async function startAzanPlayback() {
  try {
    const [voiceId, rawAdditional, rawCustom] = await Promise.all([
      AsyncStorage.getItem(SELECTED_VOICE_KEY),
      AsyncStorage.getItem(CUSTOM_VOICE_FILES_KEY),
      AsyncStorage.getItem(CUSTOM_VOICES_LIST_KEY),
    ]);

    const additionalVoiceFiles: Record<string, string> = rawAdditional ? JSON.parse(rawAdditional) : {};
    const customVoices: CustomVoice[] = rawCustom ? JSON.parse(rawCustom) : [];
    let source = resolveVoiceSource(voiceId ?? DEFAULT_VOICE_ID, additionalVoiceFiles, customVoices);

    // ⚠️ إصلاح (٢٠٢٦-٠٩-٠٢، "الأذان يوصل بصمت بدون صوت أحياناً"): لو الصوت
    // المختار (خصوصاً صوت مستورد/مخصص) ما انلقى ملفه لأي سبب (حذف يدوي،
    // مسار كاش انمسح، إلخ)، كان الكود يوقف الخدمة فوراً بصمت تام - يطلع
    // تنبيه الأذان بدون أي صوت إطلاقاً وبدون أي أثر واضح يفسر السبب. هسه
    // نرجع تلقائياً لصوت المؤذن الافتراضي (مرفوع فعلياً جوة التطبيق، ما
    // يعتمد على ملف مستورد ممكن يفقد) بدل الاستسلام - الأذان يوصل بصوت
    // حتى لو الصوت المخصص المختار صار فيه مشكلة.
    if (!source) {
      console.log('[notifeeAzan] الصوت المختار غير متاح، نرجع للصوت الافتراضي');
      source = resolveVoiceSource(DEFAULT_VOICE_ID, {}, []);
    }

    if (!source) {
      // حتى الصوت الافتراضي ما انلقى (حالة غير متوقعة جداً) - نوقف الخدمة
      // بدل ما تضل معلقة بدون فايدة
      resolveForegroundService?.();
      resolveForegroundService = null;
      return;
    }

    const player = createAudioPlayer(source);
    activePlayer = player;

    // لما الصوت يخلص طبيعياً، نوقف الخدمة والتنبيه تلقائياً
    player.addListener('playbackStatusUpdate', (status: any) => {
      if (status?.didJustFinish) {
        stopAzanPlayback();
      }
    });

    player.play();
  } catch {
    resolveForegroundService?.();
    resolveForegroundService = null;
  }
}

// يوقف الصوت الحالي وينهي الـforeground service - يستدعى إما لما الصوت يخلص
// لحاله، أو لما المستخدم يدوس زر "إيقاف" جوه التنبيه نفسه
export function stopAzanPlayback() {
  try {
    activePlayer?.pause();
    activePlayer?.remove();
  } catch {
    // تجاهل
  }
  activePlayer = null;
  resolveForegroundService?.();
  resolveForegroundService = null;

  // استدعاء صريح موثّق رسمياً لإنهاء الخدمة وإزالة الإشعار فوراً - الاعتماد
  // على حل الـPromise لحاله ممكن يترك الإشعار عالق لو الخدمة أصلاً ما بدأت
  // صح (أو صار تأخير بسيط)، فهذا احتياط إضافي يضمن إزالته دايماً
  if (Platform.OS === 'android') {
    try {
      getNotifee().stopForegroundService().catch(() => {});
    } catch {
      // تجاهل - يمكن الخدمة أصلاً مو شغالة
    }
  }
}

// ===== معالجة الحدث - دالة نقية بدون أي تسجيل ذاتي بـ notifee =====
// السبب: notifee.onForegroundEvent/onBackgroundEvent لازم تنسجل *مرة وحدة
// بس بكل التطبيق* (موثّق رسمياً) - لو انسجلت أكثر من مرة من ملفات مختلفة،
// بس آخر تسجيل يشتغل فعلياً والباقي ينمسحون بصمت. لهذا هذا الملف يصدّر بس
// دالة "شنو أسوي لو الحدث يخصني" - التسجيل الفعلي الوحيد صار بملف
// notificationEvents.ts المركزي.
import { router } from 'expo-router';

export function handleAzanEvent(type: any, detail: any, EventType: any): boolean {
  const channelId = detail?.notification?.android?.channelId;
  if (channelId !== AZAN_CHANNEL_ID) return false; // مو من اختصاصي - نرجع false حتى المعالج المركزي يجرب ملف ثاني

  const actionId = detail?.pressAction?.id;

  if (type === EventType.ACTION_PRESS && actionId === STOP_ACTION_ID) {
    stopAzanPlayback();
    getNotifee().cancelNotification(detail.notification?.id).catch(() => {});
    return true;
  }

  if (type === EventType.PRESS) {
    // ضغطة عادية على جسم إشعار الأذان (مو زر الإيقاف) - نوديه للصفحة
    // الرئيسية (التسبيح)، مو للتقويم
    router.push('/tasbih' as any);
    return true;
  }

  return true; // الحدث يخصني حتى لو ما عملت شي (نوع غير متوقع) - نوقف السلسلة هنا
}

// ===== الجدولة - تنبيه "مستمر" بالضبط بوقت كل صلاة =====
// ⚠️ إصلاح (طلب صريح: الأذان يوصل بوقته حتى لو ما فتحت التطبيق كم يوم):
// قبل، الدالة تجدول ليوم وحد بس (اليوم، أو باچر إذا فات وقت اليوم) - يعني
// لازم تفتح التطبيق يومياً حتى تنجدد الجدولة. هسه لو انعطت `coords`، نحسب
// أوقات الصلاة الفعلية لكل يوم من ٧ أيام قدام (عبر getPrayerTimes بملف
// prayerCalc.ts، نفس الحساب المستخدم بكل التطبيق) ونجدول كل صلاة بكل يوم -
// فيضل الأذان يوصل بوقته الصحيح أسبوع كامل بدون فتح التطبيق. إذا ما انعطت
// coords (استدعاء قديم)، ترجع لنفس السلوك السابق (يوم وحد) حتى ما ينكسر أي
// استدعاء موجود.
const AZAN_DAYS_AHEAD = 7;

export async function scheduleAzanNotifications(
  prayerTimes: Record<'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', string>,
  enabled: Record<'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', boolean>,
  coords?: { latitude: number; longitude: number }
): Promise<number> {
  if (Platform.OS !== 'android') return 0; // آيفون: يبقى على المنطق المنفصل بملف الشاشة

  const notifee = getNotifee();
  const { TriggerType, AndroidVisibility, AndroidCategory } = getNotifeeTypes();

  await ensureChannel();

  // نلغي كل تنبيهات الأذان القديمة المجدولة قبل - نفس مبدأ نظام الأذكار
  try {
    const raw = await AsyncStorage.getItem(AZAN_NOTIF_IDS_KEY);
    const oldIds: string[] = raw ? JSON.parse(raw) : [];
    await Promise.all(oldIds.map((id) => notifee.cancelTriggerNotification(id).catch(() => {})));
  } catch {
    // تجاهل
  }

  const PRAYER_TITLES: Record<string, string> = {
    fajr: 'أذان الفجر', dhuhr: 'أذان الظهر', asr: 'أذان العصر', maghrib: 'أذان المغرب', isha: 'أذان العشاء',
  };

  const ids: string[] = [];
  const now = Date.now();

  // ===== نبني قائمة "أيام" نجدول عليها: يوم وحد (اليوم، بأوقات prayerTimes
  // المرسلة) إذا ماكو coords، أو ٧ أيام (اليوم + ٦ قدام، بأوقات محسوبة فعلياً
  // لكل يوم) إذا انعطت coords =====
  type DayTimes = { timesForKey: Record<string, string>; dateBase: Date };
  const days: DayTimes[] = [];

  if (coords) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getPrayerTimes } = require('./prayerCalc');
    for (let i = 0; i < AZAN_DAYS_AHEAD; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const t = getPrayerTimes(coords.latitude, coords.longitude, d);
      days.push({
        timesForKey: { fajr: t.fajr, dhuhr: t.dhuhr, asr: t.asr, maghrib: t.maghrib, isha: t.isha },
        dateBase: d,
      });
    }
  } else {
    days.push({ timesForKey: prayerTimes as any, dateBase: new Date() });
  }

  for (const day of days) {
    for (const key of Object.keys(PRAYER_TITLES) as (keyof typeof PRAYER_TITLES)[]) {
      if (!enabled[key as keyof typeof enabled]) continue;
      const timeStr = day.timesForKey[key as keyof typeof prayerTimes];
      if (!timeStr) continue;

      const [h, m] = timeStr.split(':').map(Number);
      const fireDate = new Date(day.dateBase);
      fireDate.setHours(h, m, 0, 0);
      if (fireDate.getTime() <= now) {
        if (coords) continue; // بوضع الأسبوع: يوم فات كامل يتخطى (يوم ثاني بالقائمة بيغطيه)
        // ⚠️ إصلاح (وضع اليوم الواحد القديم، بدون coords): بدل الإلغاء
        // النهائي، نجدولها بكرة بنفس الوقت
        fireDate.setDate(fireDate.getDate() + 1);
      }

      try {
        const id = await notifee.createTriggerNotification(
          {
            title: PRAYER_TITLES[key],
            body: 'حان وقت الصلاة',
            android: {
              channelId: AZAN_CHANNEL_ID,
              asForegroundService: true,
              ongoing: true,
              visibility: AndroidVisibility.PUBLIC,
              category: AndroidCategory.ALARM,
              smallIcon: 'ic_notification',
              largeIcon: 'ic_notification_large',
              pressAction: { id: 'default' },
              actions: [{ title: 'إيقاف الأذان', pressAction: { id: STOP_ACTION_ID } }],
            },
          },
          {
            type: TriggerType.TIMESTAMP,
            timestamp: fireDate.getTime(),
            // ⚠️ إصلاح جوهري (توحيد ثبات الإشعارات بكل الهواتف): بدون alarmManager
            // صريح، notifee يجدول التنبيه كـ"غير دقيق" على أندرويد - يعني النظام
            // (خصوصاً هواوي/شاومي وبدرجة أقل سامسونج) يأجله أو يجمعه حسب وضع توفير
            // البطارية (Doze)، وهذا بالضبط سبب "يشتغل بهاتف وما يشتغل بهاتف ثاني".
            // allowWhileIdle:true يجبر النظام يوصل التنبيه بالضبط بوقته حتى لو
            // الجهاز بوضع نوم عميق - هذا الأهم إشعار بالتطبيق (الأذان نفسه).
            alarmManager: { allowWhileIdle: true },
          }
        );
        ids.push(id);
      } catch {
        // نتجاوز صلاة وحدة ونكمل الباقي
      }
    }
  }

  await AsyncStorage.setItem(AZAN_NOTIF_IDS_KEY, JSON.stringify(ids));
  return ids.length;
}
