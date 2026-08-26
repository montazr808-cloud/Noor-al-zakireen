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
// التفعيل مباشرة بس، بدون فحص مسبق - العرض يصير مرة وحدة بالجلسة بغض النظر
// عن الحالة الفعلية.
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
    console.log('[notifeeAzan] فشل فتح شاشة صلاحية الظهور فوق التطبيقات:', e);
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
    const source = resolveVoiceSource(voiceId ?? DEFAULT_VOICE_ID, additionalVoiceFiles, customVoices);

    if (!source) {
      // ماكو صوت صالح - نوقف الخدمة فوراً بدل ما تضل معلقة بدون فايدة
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
// بس آخر تسجيل يشتغل فعلياً والباقي ينمسحون بصمت. لهذا صار عندنا مشكلة:
// الضغط على إشعار الأذان كان يوديك للتقويم (لأن ملف hijriNotifications كان
// آخر وحدة مسجلة). الحل: هذا الملف يصدّر بس دالة "شنو أسوي لو الحدث يخصني"
// - التسجيل الفعلي الوحيد صار بملف notificationEvents.ts المركزي.
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
// ملاحظة: لازم تنعاد هذي الدالة يومياً (مثلاً كل ما يفتح التطبيق، بنفس مبدأ
// scheduleAthkarNotifications) لأن وقت الصلاة يتغير كل يوم شوي ولازم تحديث
// التوقيت المجدول باستمرار.
export async function scheduleAzanNotifications(
  prayerTimes: Record<'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', string>,
  enabled: Record<'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', boolean>
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

  for (const key of Object.keys(PRAYER_TITLES) as (keyof typeof PRAYER_TITLES)[]) {
    if (!enabled[key as keyof typeof enabled]) continue;
    const timeStr = prayerTimes[key as keyof typeof prayerTimes];
    if (!timeStr) continue;

    const [h, m] = timeStr.split(':').map(Number);
    const fireDate = new Date();
    fireDate.setHours(h, m, 0, 0);
    if (fireDate.getTime() <= now) {
      // ⚠️ إصلاح: قبل، هذا السطر كان "continue" (يلغي الصلاة نهائياً من الجدولة
      // إذا فات وقتها اليوم) - وبما إن هذي الدالة تنعاد بس لما يفتح المستخدم
      // التطبيق، أي صلاة عادةً يفتح التطبيق بعدها (مثلاً الظهر) كانت تنحذف من
      // الجدولة كل يوم بنفس الطريقة، فما توصل أبداً. الحل: نجدولها بكرة
      // بنفس الوقت بدل الإلغاء - وبما إن الدالة تنعاد وتحدّث الوقت كل ما
      // يفتح التطبيق، الفرق البسيط (دقيقة/دقيقتين) بين وقت اليوم ووقت بكرة
      // الفلكي الفعلي ينصحح لحاله بأول فتحة جاية للتطبيق
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
            // ⚠️ إصلاح: هذا الاشعار كان الوحيد اللي ما محدد له smallIcon/largeIcon
            // بشكل صريح، فـnotifee كان يرجع تلقائياً لأيقونة التطبيق الملونة
            // الكبيرة كصورة الاشعار (مختلفة عن شكل باقي الاشعارات النظيف)
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

  await AsyncStorage.setItem(AZAN_NOTIF_IDS_KEY, JSON.stringify(ids));
  return ids.length;
}