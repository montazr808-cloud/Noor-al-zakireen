// ===== utils/batteryOptimization.ts =====
// هذا هو "المفقود" اللي يفرّق بين إشعار يوصل دايماً (حقيبة المؤمن) وإشعار
// يوصل بس لما تفتح التطبيق: صلاحية "المنبهات الدقيقة" (notifeeAzan.ts)
// تضمن التوقيت الصحيح للتنبيه، لكن ماكو أي ضمان إن أندرويد يخلي جافاسكربت
// التطبيق يشتغل فعلياً لحظة التنبيه إذا كان التطبيق "بوضع توفير طاقة" -
// هذا نظام منفصل تماماً (Battery Optimization / Doze)، وفوقه نظام ثالث
// خاص بكل شركة مصنّعة (شاومي/هواوي/أوبو/سامسونج) اسمه عادة "Autostart" أو
// "Protected Apps"، يقتل أي تطبيق ما يفتحه المستخدم يدوياً بانتظام، بغض
// النظر شنو صلاحيات أندرويد القياسية الممنوحة له.
//
// هذا الملف يعالج الاثنين:
// 1. استثناء رسمي من Battery Optimization (نافذة نظام Android قياسية،
//    تشتغل على أي هاتف أندرويد بغض النظر عن الشركة المصنّعة)
// 2. فتح شاشة الإعدادات الخاصة بالشركة المصنّعة (best-effort - ماكو API
//    رسمي موحّد من Google لهذا، فهذي intents معروفة ومجرّبة من مجتمع
//    المطورين لكل شركة، بس مو مضمونة 100% تشتغل على كل نسخة/جهاز)

import * as Device from 'expo-device';
import { Alert, Linking, Platform } from 'react-native';

const ANDROID_PACKAGE_ID = 'com.anonymous.nooralzakireen'; // ⚠️ لازم يطابق app.json → expo.android.package بالضبط

// ===== 1. استثناء Battery Optimization الرسمي (قياسي بكل أندرويد) =====
// يفتح نافذة نظام مباشرة تسأل "السماح لنور الذاكرين بالعمل بالخلفية بدون
// قيود؟" - أقوى إجراء منفرد ممكن نسويه، لأنه غير مرتبط بأي شركة مصنّعة.
// يحتاج صلاحية REQUEST_IGNORE_BATTERY_OPTIMIZATIONS معلنة بـ app.json.
export async function requestIgnoreBatteryOptimizations(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const IntentLauncher = require('expo-intent-launcher');
    await IntentLauncher.startActivityAsync(
      'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      { data: `package:${ANDROID_PACKAGE_ID}` }
    );
  } catch (e) {
    console.log('[batteryOptimization] فشل فتح نافذة استثناء البطارية المباشرة، نجرب فتح شاشة القائمة العامة:', e);
    try {
      // بديل: بعض الأجهزة ترفض النافذة المباشرة (تحتاج المستخدم يدوّر
      // التطبيق يدوياً بقائمة كل التطبيقات) - هذا احتياط ثاني قبل ما نستسلم
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const IntentLauncher = require('expo-intent-launcher');
      await IntentLauncher.startActivityAsync('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
    } catch {
      Alert.alert(
        'ما گدرنا نفتح الإعدادات تلقائياً',
        'افتح إعدادات الجهاز يدوياً > البطارية > تحسين البطارية، ودوّر "نور الذاكرين" وفعّل "بدون قيود".',
        [
          { text: 'حسناً', style: 'cancel' },
          { text: 'فتح إعدادات التطبيق', onPress: () => Linking.openSettings().catch(() => {}) },
        ]
      );
    }
  }
}

// ===== 2. تعليمات + intent خاص بالشركة المصنّعة (Autostart/Protected Apps) =====
type ManufacturerKey = 'xiaomi' | 'huawei' | 'oppo' | 'vivo' | 'samsung' | 'oneplus' | 'other';

// أسماء intents معروفة من مجتمع المطورين (مجرّبة بمشاريع مفتوحة المصدر
// مشابهة) - كل وحدة نجرّبها بترتيب، وأول وحدة تنجح نوقف عندها
const AUTOSTART_INTENTS: Record<Exclude<ManufacturerKey, 'other'>, { pkg: string; cls: string }[]> = {
  xiaomi: [
    { pkg: 'com.miui.securitycenter', cls: 'com.miui.permcenter.autostart.AutoStartManagementActivity' },
  ],
  huawei: [
    { pkg: 'com.huawei.systemmanager', cls: 'com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity' },
    { pkg: 'com.huawei.systemmanager', cls: 'com.huawei.systemmanager.optimize.process.ProtectActivity' },
  ],
  oppo: [
    { pkg: 'com.coloros.safecenter', cls: 'com.coloros.safecenter.permission.startup.StartupAppListActivity' },
    { pkg: 'com.oppo.safe', cls: 'com.oppo.safe.permission.startup.StartupAppListActivity' },
  ],
  vivo: [
    { pkg: 'com.vivo.permissionmanager', cls: 'com.vivo.permissionmanager.activity.BgStartUpManagerActivity' },
  ],
  oneplus: [
    { pkg: 'com.oneplus.security', cls: 'com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity' },
  ],
  samsung: [], // سامسونج تعتمد على نافذة Battery Optimization القياسية فوگ، ماكو شاشة إضافية منفصلة عادة
};

const MANUFACTURER_INSTRUCTIONS: Record<ManufacturerKey, string> = {
  xiaomi: 'بعد فتح الشاشة: فعّل "التشغيل التلقائي" (Autostart) لتطبيق نور الذاكرين',
  huawei: 'بعد فتح الشاشة: فعّل "الإدارة اليدوية" وفعّل "التشغيل التلقائي" و"التشغيل بالخلفية"',
  oppo: 'بعد فتح الشاشة: فعّل "التشغيل التلقائي" (Auto-startup) لتطبيق نور الذاكرين',
  vivo: 'بعد فتح الشاشة: فعّل السماح للتطبيق بالعمل بالخلفية',
  oneplus: 'بعد فتح الشاشة: فعّل السماح للتطبيق بالتشغيل التلقائي',
  samsung: 'اذهب لإعدادات الجهاز > العناية بالبطارية > حدود الخلفية > استثنِ نور الذاكرين من "إسبات التطبيقات غير المستخدمة"',
  other: 'ابحث بإعدادات هاتفك عن "التشغيل التلقائي" أو "Autostart" أو "Battery" وفعّل السماح لنور الذاكرين بالعمل بالخلفية بدون قيود',
};

function detectManufacturer(): ManufacturerKey {
  const brand = (Device.brand ?? '').toLowerCase();
  const manufacturer = (Device.manufacturer ?? '').toLowerCase();
  const combined = `${brand} ${manufacturer}`;

  if (combined.includes('xiaomi') || combined.includes('redmi') || combined.includes('poco')) return 'xiaomi';
  if (combined.includes('huawei') || combined.includes('honor')) return 'huawei';
  if (combined.includes('oppo') || combined.includes('realme')) return 'oppo';
  if (combined.includes('vivo')) return 'vivo';
  if (combined.includes('oneplus')) return 'oneplus';
  if (combined.includes('samsung')) return 'samsung';
  return 'other';
}

// يرجع نص التعليمات المناسب لهاتف المستخدم الحالي - يستخدم بواجهة شاشة
// الأذونات حتى يشوف المستخدم إرشاد واضح بالضبط لجهازه، مو نص عام مبهم
export function getManufacturerInstructions(): { manufacturer: ManufacturerKey; text: string } {
  const manufacturer = detectManufacturer();
  return { manufacturer, text: MANUFACTURER_INSTRUCTIONS[manufacturer] };
}

// ===== 3. تذكير للمستخدمين الحاليين اللي خلّصوا onboarding قبل هذا التحديث =====
// ⚠️ مهم: OnboardingPermissions.tsx تطلع مرة وحدة بس بعمر التطبيق (مفتاح
// ONBOARDING_DONE_KEY دائم). يعني أي مستخدم ثبّت نسخة سابقة وخلّص منها،
// ما راح يشوف بطاقة "توفير الطاقة" الجديدة إطلاقاً حتى لو حدّثنا الكود -
// هذا بالضبط نفس مبدأ ensureExactAlarmPermission بملف notifications.ts
// (مفتاح تنبيه منفصل خاص فيها، يشتغل لكل المستخدمين بغض النظر متى نصبوا
// التطبيق أو أكملوا onboarding)
import AsyncStorage from '@react-native-async-storage/async-storage';

const BATTERY_PROMPTED_KEY = '@battery_optimization_prompted_v1';

export async function ensureBatteryOptimizationExemption(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const alreadyPrompted = await AsyncStorage.getItem(BATTERY_PROMPTED_KEY);
    if (alreadyPrompted === 'true') return;
    await AsyncStorage.setItem(BATTERY_PROMPTED_KEY, 'true');

    const { text } = getManufacturerInstructions();
    Alert.alert(
      'صلاحية أساسية ليوصلك الأذان دايماً',
      `حتى يوصلك الأذان بوقته حتى لو التطبيق مقفول أياماً، يحتاج التطبيق استثناء من "توفير الطاقة" بهاتفك.\n\n${text}`,
      [
        { text: 'لاحقاً', style: 'cancel' },
        { text: 'فتح الإعدادات', onPress: () => requestIgnoreBatteryOptimizations() },
      ]
    );
  } catch {
    // تجاهل - أسوأ حالة المستخدم ما يشوف التذكير، بس ما نكسر باقي الجدولة
  }
}

// يحاول يفتح شاشة "Autostart"/"Protected Apps" الخاصة بالشركة المصنّعة
// مباشرة. لو ماكو intent معروف لهذا الجهاز (أو فشلت كل المحاولات)، يرجع
// false حتى تعرض الواجهة تعليمات نصية بديلة بدل ما يحس المستخدم "ماكو شي
// صار" بصمت.
export async function openManufacturerAutostartSettings(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const manufacturer = detectManufacturer();
  if (manufacturer === 'other' || manufacturer === 'samsung') return false;

  const candidates = AUTOSTART_INTENTS[manufacturer];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const IntentLauncher = require('expo-intent-launcher');

  for (const { pkg, cls } of candidates) {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
        packageName: pkg,
        className: cls,
      });
      return true;
    } catch {
      // نجرب الاحتمال الجاي بنفس القائمة
      continue;
    }
  }
  console.log(`[batteryOptimization] ماكو intent اشتغل لشركة ${manufacturer} - نرجع للتعليمات النصية`);
  return false;
}