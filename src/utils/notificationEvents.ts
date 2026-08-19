// ===== utils/notificationEvents.ts =====
// نقطة التسجيل المركزية الوحيدة لأحداث notifee بكل التطبيق (ضغط على إشعار/زر).
//
// ⚠️ سبب وجود هذا الملف: notifee.onForegroundEvent و onBackgroundEvent لازم
// ينسجلوا *مرة وحدة بس* بكل التطبيق (موثّق رسمياً بـ notifee). كل ملف يصدّر
// بس دالة "handleXEvent(type, detail, EventType)" نقية بترجع true لو
// تعاملت مع الحدث (يوقف باقي المحاولات)، أو false لو الحدث مو من اختصاصها.
//
// ⚠️ تحديث (توحيد المحرك): أضفنا handleAthkarEvent وhandleVerseEvent بعد ما
// صارت أذكار الصلوات/الجمعة/كميل/أدعية اليوم/تسبيح اليوم + آية بعد الصلاة
// كلهم عبر notifee بدل expo-notifications. صار هذا الملف فعلياً نقطة
// التوجيه الوحيدة لكل إشعارات التطبيق بلا استثناء - ما بقى عندنا أي معالج
// إشعارات منفصل بملف app/_layout.tsx.

import { handleHijriEvent } from './hijriNotifications';
import { handleNextPrayerEvent } from './nextPrayerNotification';
import { handleAzanEvent } from './notifeeAzan';
import { handleAthkarEvent } from './notificationScheduler';
import { handleVerseEvent } from './verseNotifications';

function getNotifee() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@notifee/react-native').default as typeof import('@notifee/react-native').default;
}
function getNotifeeTypes() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@notifee/react-native') as typeof import('@notifee/react-native');
}

function dispatch(type: any, detail: any, EventType: any) {
  // نجرب كل معالج بالترتيب - أول وحدة ترجع true توقف السلسلة
  if (handleAzanEvent(type, detail, EventType)) return;
  if (handleAthkarEvent(type, detail, EventType)) return;
  if (handleVerseEvent(type, detail, EventType)) return;
  if (handleNextPrayerEvent(type, detail, EventType)) return;
  if (handleHijriEvent(type, detail, EventType)) return;
}

// ===== التسجيل الوحيد لكل التطبيق - تنادى مرة وحدة بس بأعلى مستوى
// (app/_layout.tsx وindex.js)، بدل ما كل ملف يسجل نفسه لحاله =====
export function registerAllNotificationEventListeners() {
  // ⚠️ ملاحظة إصلاح: هذا كان مقفول على أندرويد بس سابقاً. كان هذا مقبول
  // طالما أذكار الصلوات تشتغل عبر expo-notifications على آيفون (إلها معالج
  // ضغط منفصل بـ_layout.tsx). هسه بعد ما توحد كل شي تحت notifee، إبقاء هذا
  // القفل كان راح يكسر التنقل عند الضغط على أي إشعار (أذكار/أدعية/تسبيح/آية/
  // مناسبات هجرية) لمستخدمي آيفون بالكامل. notifee يدعم onForegroundEvent/
  // onBackgroundEvent على آيفون عادي - المقيد بأندرويد فقط هو خدمة الأذان
  // بالخلفية نفسها (asForegroundService)، وهذا معالج بملف notifeeAzan.ts
  // لحاله، مو هنا.
  const notifee = getNotifee();
  const { EventType } = getNotifeeTypes();

  notifee.onForegroundEvent(({ type, detail }: any) => {
    dispatch(type, detail, EventType);
  });

  notifee.onBackgroundEvent(async ({ type, detail }: any) => {
    dispatch(type, detail, EventType);
  });
}