// ===== src/components/OnboardingPermissions.tsx =====
// شاشة ترحيب تطلب الصلاحيات الخمس مرة وحدة بأول فتحة تطبيق - بدل ما كل
// شاشة تطلب صلاحيتها لحالها بلحظة تحتاجها (كان هذا يخلي المستخدم يشوف
// نوافذ صلاحيات متفرقة بأوقات مختلفة، تجربة مشتتة). بعد ما يكمل هذي الشاشة
// (أو يتخطاها)، ما تطلع مرة ثانية - مفتاح دائم بـ AsyncStorage.
//
// نفس هوية التطبيق البصرية بالضبط: خلفية داكنة، بطاقات زجاجية (glassmorphism)،
// توهج نيوني سماوي (#00E5FF) - مقتبسة من نفس القيم المستخدمة بـ
// prayer-times.tsx وtasbih.tsx حتى ما تحس الشاشة "غريبة" عن باقي التطبيق.

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getExactAlarmPermissionStatus, openExactAlarmSettings, openOverlayPermissionSettings } from '@/utils/notifeeAzan';

export const ONBOARDING_DONE_KEY = '@onboarding_permissions_done_v1';

const C = {
  bg: '#0A1420',
  neon: '#00E5FF',
  white: '#FFFFFF',
  glass: 'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(255,255,255,0.22)',
  muted: 'rgba(255,255,255,0.55)',
};
const NEON_RGB = '0,229,255';

type PermStatus = 'idle' | 'granted' | 'denied' | 'unsupported';

type PermKey = 'location' | 'notifications' | 'microphone' | 'alarm' | 'overlay';

type PermDef = {
  key: PermKey;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  actionLabel: string; // نص الزر وقت idle/denied
};

const PERMISSIONS: PermDef[] = [
  {
    key: 'location',
    icon: 'location-outline',
    title: 'الموقع',
    desc: 'لتحديد أوقات الصلاة واتجاه القبلة بدقة',
    actionLabel: 'سماح',
  },
  {
    key: 'notifications',
    icon: 'notifications-outline',
    title: 'الإشعارات',
    desc: 'لإرسال تذكير الأذان والأذكار اليومية',
    actionLabel: 'سماح',
  },
  {
    key: 'microphone',
    icon: 'mic-outline',
    title: 'المايكروفون',
    desc: 'لعدّ التسبيح صوتياً بشكل تلقائي',
    actionLabel: 'سماح',
  },
  {
    key: 'alarm',
    icon: 'alarm-outline',
    title: 'المنبهات الدقيقة',
    desc: 'ليصلك الأذان في وقته تماماً دون تأخير',
    actionLabel: 'فتح الإعدادات',
  },
  {
    key: 'overlay',
    icon: 'layers-outline',
    title: 'الظهور فوق التطبيقات',
    desc: 'ليظهر تنبيه الأذان حتى أثناء استخدام تطبيق آخر',
    actionLabel: 'فتح الإعدادات',
  },
];

// دوال الطلب الفعلية - كل وحدة ترجع الحالة بعد المحاولة
async function requestLocation(): Promise<PermStatus> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

async function requestNotifications(): Promise<PermStatus> {
  if (Platform.OS !== 'android') return 'unsupported';
  try {
    // نفس مصدر الصلاحية الحقيقي اللي يتحكم بكل إشعارات notifee بالتطبيق -
    // مو expo-notifications (نظامين الصلاحية طلعوا مو متطابقين دايماً، نفس
    // الملاحظة الموثقة بملفات notificationScheduler.ts/hijriNotifications.ts)
    const notifee = require('@notifee/react-native').default;
    const { AuthorizationStatus } = require('@notifee/react-native');
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

async function requestMicrophone(): Promise<PermStatus> {
  try {
    // ⚠️ ملاحظة: هذا يعتمد على API مكتبة expo-speech-recognition. لو تغيّر
    // اسم الدالة بنسخة أحدث من المكتبة، هذا المكان يحتاج تحديث - جرّبه فعلياً
    // بعد التركيب وتأكد الزر يطلع نافذة صلاحية المايكروفون الحقيقية
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ExpoSpeechRecognitionModule } = require('expo-speech-recognition');
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return result?.granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

async function checkAlarm(): Promise<PermStatus> {
  const status = await getExactAlarmPermissionStatus();
  return status; // 'granted' | 'denied' | 'unsupported' - نفس الأسماء بالضبط
}

export default function OnboardingPermissions({ onDone }: { onDone: () => void }) {
  const [statuses, setStatuses] = useState<Record<PermKey, PermStatus>>({
    location: 'idle',
    notifications: 'idle',
    microphone: 'idle',
    alarm: 'idle',
    overlay: 'idle',
  });
  const [busyKey, setBusyKey] = useState<PermKey | null>(null);

  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    // نتحقق من حالة صلاحية المنبه الدقيق فوراً (الوحيدة اللي عندها فحص حقيقي
    // بدون ما تحتاج طلب/تفاعل من المستخدم)
    checkAlarm().then((s) => setStatuses((prev) => ({ ...prev, alarm: s })));
  }, []);

  const handlePress = async (key: PermKey) => {
    if (busyKey) return;
    setBusyKey(key);
    try {
      if (key === 'location') {
        const result = await requestLocation();
        setStatuses((prev) => ({ ...prev, location: result }));
      } else if (key === 'notifications') {
        const result = await requestNotifications();
        setStatuses((prev) => ({ ...prev, notifications: result }));
      } else if (key === 'microphone') {
        const result = await requestMicrophone();
        setStatuses((prev) => ({ ...prev, microphone: result }));
      } else if (key === 'alarm') {
        // نسجل إنها انعرضت هنا بنفس المفتاح اللي تتحقق منه شاشة أوقات
        // الصلاة (@prayer_alarm_permission_prompted_v1) - حتى ما تطلع
        // رسالتها مرة ثانية هناك بعد ما خلصنا منها بشاشة الترحيب
        try {
          await AsyncStorage.setItem('@prayer_alarm_permission_prompted_v1', 'true');
        } catch {
          // تجاهل - أسوأ حالة تطلع رسالة شاشة أوقات الصلاة مرة زيادة
        }
        await openExactAlarmSettings();
        // نعيد الفحص بعد رجوع المستخدم من الإعدادات (تقريبي - ما نگدر نعرف
        // بالضبط لحظة الرجوع من غير AppState listener، فنعطي مهلة بسيطة)
        setTimeout(() => {
          checkAlarm().then((s) => setStatuses((prev) => ({ ...prev, alarm: s })));
        }, 800);
      } else if (key === 'overlay') {
        // نفس المبدأ فوگ - مفتاح شاشة أوقات الصلاة لصلاحية الظهور فوق التطبيقات
        try {
          await AsyncStorage.setItem('@prayer_overlay_permission_prompted_v1', 'true');
        } catch {
          // تجاهل
        }
        await openOverlayPermissionSettings();
        // ماكو فحص برمجي متاح لهذي الصلاحية (قيد حقيقي بأندرويد) - نعتبرها
        // "تفاعل معها" بس، مو نتحقق من نتيجتها فعلياً
        setStatuses((prev) => ({ ...prev, overlay: 'granted' }));
      }
    } finally {
      setBusyKey(null);
    }
  };

  const finish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
    } catch {
      // تجاهل - أسوأ حالة الشاشة تطلع مرة ثانية بفتحة تطبيق جاية
    }
    // ⚠️ إصلاح: initializeAppNotifications() كانت تنادى مرة وحدة بس بفتح
    // التطبيق (_layout.tsx)، وهذي اللحظة ممكن تكون قبل ما يوافق المستخدم
    // على صلاحية الإشعارات بهذي الشاشة بالضبط - فتفشل الجدولة بصمت وما
    // تنعاد إلا بفتحة تطبيق جديدة. هسه ننادي الجدولة فوراً لحظة إكمال
    // الصلاحيات، حتى تشتغل الإشعارات مباشرة بدون انتظار.
    try {
      const { initializeAppNotifications } = await import('@/utils/notifications');
      await initializeAppNotifications();
    } catch {
      // تجاهل - آخر خط دفاع يبقى نداء _layout.tsx بفتحة التطبيق التالية
    }
    onDone();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.header, { opacity: fadeIn }]}>
        <View style={styles.logoRing}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>أهلاً بك في نور الذاكرين</Text>
        <Text style={styles.subtitle}>
          يرجى تفعيل الصلاحيات التالية لضمان عمل التطبيق بأفضل صورة
        </Text>
      </Animated.View>

      <View style={styles.list}>
        {PERMISSIONS.map((p) => {
          const status = statuses[p.key];
          const isBusy = busyKey === p.key;
          const isGranted = status === 'granted';
          const isUnsupported = status === 'unsupported';

          return (
            <View key={p.key} style={styles.cardWrap}>
              <View style={styles.card}>
                <View style={styles.cardIconWrap}>
                  <Ionicons name={p.icon} size={20} color={C.neon} />
                </View>
                <View style={styles.cardTextWrap}>
                  <Text style={styles.cardTitle}>{p.title}</Text>
                  <Text style={styles.cardDesc}>{p.desc}</Text>
                </View>

                {isUnsupported ? (
                  <Text style={styles.unsupportedText}>غير مطلوبة</Text>
                ) : isGranted ? (
                  <View style={styles.grantedBadge}>
                    <Ionicons name="checkmark" size={16} color="#0d1f2d" />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handlePress(p.key)}
                    disabled={isBusy}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.actionBtnText}>
                      {isBusy ? '...' : p.actionLabel}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {p.key === 'overlay' && !isGranted && !isUnsupported && (
                <Text style={styles.helpText}>
                  بعد فتح الإعدادات: ابحث عن اسم التطبيق، ثم فعّل الخيار يدوياً من الشاشة
                </Text>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.continueBtn} onPress={finish} activeOpacity={0.85}>
          <Text style={styles.continueBtnText}>متابعة</Text>
        </TouchableOpacity>
        <Text style={styles.footerHint}>
          يمكنك تفعيل أي صلاحية لاحقاً من إعدادات الهاتف
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },

  header: { alignItems: 'center', marginTop: 28, marginBottom: 24 },
  logoRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: C.neon,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    backgroundColor: `rgba(${NEON_RGB},0.08)`,
    shadowColor: C.neon,
    shadowOpacity: 0.9,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
    overflow: 'hidden',
  },
  logoImage: {
    width: '72%',
    height: '72%',
  },
  title: {
    color: C.white,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
    textShadowColor: `rgba(${NEON_RGB},0.6)`,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    color: C.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },

  list: { gap: 10 },
  cardWrap: { gap: 6 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: C.glass,
    padding: 12,
    gap: 12,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `rgba(${NEON_RGB},0.12)`,
  },
  cardTextWrap: { flex: 1 },
  cardTitle: { color: C.white, fontSize: 14, fontWeight: '700', textAlign: 'right', marginBottom: 2 },
  cardDesc: { color: C.muted, fontSize: 11.5, textAlign: 'right', lineHeight: 16 },

  actionBtn: {
    borderWidth: 1,
    borderColor: C.neon,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  actionBtnText: { color: C.neon, fontSize: 12, fontWeight: '700' },
  grantedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.neon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unsupportedText: { color: C.muted, fontSize: 11 },
  helpText: {
    color: C.muted,
    fontSize: 11,
    textAlign: 'right',
    lineHeight: 16,
    paddingHorizontal: 6,
  },

  footer: { marginTop: 'auto', paddingBottom: 18, paddingTop: 20 },
  continueBtn: {
    backgroundColor: C.neon,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  continueBtnText: { color: '#0d1f2d', fontSize: 15, fontWeight: '800' },
  footerHint: { color: C.muted, fontSize: 11, textAlign: 'center' },
});