// ===== utils/pushRegistration.ts =====
// يسجّل الجهاز بسيرفر الدفع (noor-server، Cloudflare Worker) — يرسل توكن
// FCM + إحداثيات الموقع + تفعيل/تعطيل كل صلاة، حتى يقدر السيرفر يرسل Push
// حقيقي بالضبط بوقت كل صلاة، حتى لو التطبيق مقفول تماماً من أيام.
//
// هذا منفصل تماماً عن notifeeAzan.ts (الجدولة المحلية) - نبقيها الاثنتين
// شغالتين مع بعض كخطي دفاع: لو الـ Push فشل لأي سبب (ماكو نت، مشكلة FCM)،
// الجدولة المحلية تبقى تغطي (أقل دقة، بس أفضل من ولا شي).

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

// ⚠️ عدّل هذا لو غيّرت رابط الـ Worker مستقبلاً
const SERVER_URL = 'https://noor-server.montazr-noor-zakireen.workers.dev';

const DEVICE_ID_KEY = 'noor_pushDeviceId';
const LAST_REGISTERED_KEY = 'noor_pushLastRegistered'; // يمنع إعادة إرسال نفس البيانات كل فتحة تطبيق

type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

// يولّد معرّف فريد ثابت للجهاز (مرة وحدة، يبقى نفسه كل فتحة تطبيق)
async function getOrCreateDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// استيراد ديناميكي - نفس أسلوب notifee بالمشروع، حتى الملف ما يكسر شي قبل
// تنصيب @react-native-firebase/messaging + rebuild
function getMessaging() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@react-native-firebase/messaging').default;
}

async function getFcmToken(): Promise<string | null> {
  if (Platform.OS !== 'android') return null; // الأذان بالخلفية Android فقط بالتصميم الحالي
  try {
    const messaging = getMessaging();
    // يطلب صلاحية الإشعارات (لو مو ممنوحة بعد) - أندرويد 13+ يحتاجها صراحة
    await messaging().requestPermission();
    const token = await messaging().getToken();
    return token || null;
  } catch (e) {
    console.error('[pushRegistration] فشل جلب توكن FCM:', e);
    return null;
  }
}

export type PushRegistrationInput = {
  latitude: number;
  longitude: number;
  azanEnabled?: Partial<Record<PrayerKey, boolean>>;
};

/**
 * يسجّل/يحدّث بيانات الجهاز بسيرفر الدفع. آمن يتنادى كل فتحة تطبيق -
 * يقارن أول شي مع آخر تسجيل ناجح (بصمة بسيطة) وما يرسل طلب شبكة إذا
 * ماكو تغيير حقيقي (يوفر بطارية/بيانات).
 */
export async function registerForPushNotifications(input: PushRegistrationInput): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const [deviceId, fcmToken] = await Promise.all([getOrCreateDeviceId(), getFcmToken()]);
    if (!fcmToken) return false;

    const azan = input.azanEnabled ?? {};
    const fingerprint = JSON.stringify({
      fcmToken,
      lat: Math.round(input.latitude * 1000), // دقة ~100م تكفي، تمنع تسجيل زايد بسبب تذبذب GPS بسيط
      lon: Math.round(input.longitude * 1000),
      azan,
    });

    const lastFingerprint = await AsyncStorage.getItem(LAST_REGISTERED_KEY);
    if (lastFingerprint === fingerprint) return true; // ماكو تغيير - نتخطى الطلب

    const res = await fetch(`${SERVER_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        fcm_token: fcmToken,
        latitude: input.latitude,
        longitude: input.longitude,
        azan,
      }),
    });

    if (!res.ok) {
      console.error('[pushRegistration] السيرفر رفض التسجيل:', await res.text().catch(() => ''));
      return false;
    }

    await AsyncStorage.setItem(LAST_REGISTERED_KEY, fingerprint);
    return true;
  } catch (e) {
    // فشل الشبكة (ماكو نت، السيرفر واقع مؤقتاً) - نتجاهل بصمت، الجدولة
    // المحلية تبقى تغطي كخط دفاع، ونعيد المحاولة تلقائياً بفتحة تطبيق جاية
    console.error('[pushRegistration] فشل التسجيل:', e);
    return false;
  }
}

/**
 * يستدعى مرة وحدة بأعلى مستوى بالتطبيق (نفس مكان registerAzanForegroundService) -
 * يستمع لتحديث توكن FCM (يصير أحياناً، نادر) ويعيد التسجيل تلقائياً بأحدث توكن
 */
export function listenForFcmTokenRefresh(onRefresh: (token: string) => void) {
  if (Platform.OS !== 'android') return () => {};
  try {
    const messaging = getMessaging();
    return messaging().onTokenRefresh(onRefresh);
  } catch {
    return () => {};
  }
}