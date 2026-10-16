// ===== src/utils/updateCheck.ts =====
// ⚠️ إضافة (طلب صريح): مستخدمي نسخة الـAPK الموزّعة مباشرة (قبل الرفع لكوكل
// بلاي، أو بعده لمن لسا ما حدّث) ما يوصلهم أي إشعار تحديث تلقائي - هذا حصراً
// لمن نزّل من كوكل بلاي. هذي الدالة تتحقق من نسخة أحدث عبر ملف version.json
// بمستودع GitHub نفسه (بدون أي حاجة لتعديل السيرفر)، وتوديهم مباشرة لصفحة
// التطبيق بكوكل بلاي لو موجودة نسخة أجدد.
//
// عند كل إصدار جديد بكوكل بلاي: عدّل "latestVersion" بملف version.json
// بجذر المستودع (رفعة/commit عادية، بدون أي بناء APK جديد مطلوب لهذا وحده).

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Alert, Linking, Platform } from 'react-native';

// ⚠️ لازم يطابق المستودع الحقيقي بالضبط - غيّره لو اسم المستخدم/المستودع تغيّر
const VERSION_CHECK_URL =
  'https://raw.githubusercontent.com/montazr808-cloud/Noor-al-zakireen/main/version.json';

const LAST_DISMISSED_VERSION_KEY = '@update_check_dismissed_version_v1';

// مقارنة بسيطة لأرقام إصدار بصيغة "1.2.3" - يرجع رقم موجب لو a أحدث من b
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function checkForUpdate(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const res = await fetch(VERSION_CHECK_URL, { cache: 'no-store' } as RequestInit);
    if (!res.ok) return;
    const data = (await res.json()) as {
      latestVersion?: string;
      playStoreUrl?: string;
      message?: string;
    };
    const latest = data.latestVersion;
    const playStoreUrl = data.playStoreUrl;
    if (!latest || !playStoreUrl) return;

    const current = Constants.expoConfig?.version ?? '0.0.0';
    if (compareVersions(latest, current) <= 0) return; // نفس النسخة أو أقدم - ماكو تحديث

    // ⚠️ ما ننبّه مرتين لنفس رقم الإصدار - لو المستخدم ضغط "لاحقاً" مرة،
    // ما نزعجه بنفس التنبيه كل فتحة تطبيق لحد ما تطلع نسخة أحدث فعلاً
    const dismissedVersion = await AsyncStorage.getItem(LAST_DISMISSED_VERSION_KEY);
    if (dismissedVersion === latest) return;

    Alert.alert(
      '🎉 نسخة جديدة متوفرة',
      data.message || 'نسخة جديدة من نور الذاكرين متوفرة الآن - حمّلها واحصل على آخر التحسينات.',
      [
        {
          text: 'لاحقاً',
          style: 'cancel',
          onPress: () => {
            AsyncStorage.setItem(LAST_DISMISSED_VERSION_KEY, latest).catch(() => {});
          },
        },
        {
          text: 'التحديث الآن',
          onPress: () => {
            Linking.openURL(playStoreUrl).catch(() => {});
          },
        },
      ]
    );
  } catch {
    // تجاهل - فشل الشبكة أو الملف مو موجود، فحص التحديث مو حرج لعمل التطبيق
  }
}