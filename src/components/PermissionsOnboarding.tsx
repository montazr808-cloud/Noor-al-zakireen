// ===== components/PermissionsOnboarding.tsx =====
// شاشة ترحيب أول دخول للتطبيق: تجمع كل صلاحيات التطبيق (الموقع، الإشعارات،
// الميكروفون/التعرف الصوتي) بخطوات متتالية، كل وحدة توضح للمستخدم *ليش*
// نحتاجها قبل لا نطلبها فعلياً - بدل ما تطلع نوافذ صلاحية النظام فجأة وهو
// ماكو عنده سياق ليش.
//
// تظهر مرة وحدة بس (أول تشغيل حقيقي) - بعدها تنحفظ علامة بـ AsyncStorage
// وما تطلع ثانية. المستخدم يگدر يتخطى أي خطوة (زر "تخطي") بدون ما يوقف
// تقدمه بالتطبيق - الصلاحيات المتروكة تنطلب لاحقاً بشكل طبيعي من الشاشة
// اللي تحتاجها فعلياً (نفس السلوك الحالي بالضبط، هذا بس يقدمها بشكل مرتب).

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ONBOARDING_DONE_KEY = '@noor_permissionsOnboardingDone_v1';

export async function hasCompletedPermissionsOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_DONE_KEY)) === '1';
  } catch {
    return true; // بحال فشل القراءة، ما نعلّق المستخدم بشاشة ترحيب لا تنتهي
  }
}

async function markOnboardingDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_DONE_KEY, '1');
  } catch {
    // تجاهل - أسوأ حالة تطلع الشاشة مرة ثانية بتشغيلة جاية
  }
}

type StepStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'opened_settings';
type StepResult = 'granted' | 'denied' | 'opened_settings';

type Step = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  request: () => Promise<StepResult>;
};

// ===== التعرف الصوتي (التسبيح) - استيراد ديناميكي حتى الشاشة ما تكسر لو
// الحزمة مو مركبة أو الاسم مختلف شوي عن اللي بشاشة التسبيح - لو صار خلل
// نتجاوز هذي الخطوة بهدوء بدل ما نوقف كل شاشة الترحيب =====
async function requestSpeechRecognitionPermission(): Promise<StepResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-speech-recognition');
    const result = await mod.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return result?.granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

// ===== المنبهات الدقيقة (Exact Alarms) - أندرويد ١٢/١٣+ ما يعطي هذا الإذن
// بنافذة عادية زي باقي الصلاحيات؛ لازم المستخدم يفعّله يدوياً من صفحة إعدادات
// خاصة. notifee يوفر فحص الحالة الحالية + فتح تلك الصفحة مباشرة. لو الإذن
// ناقص على جهاز معين، الإشعارات المجدولة بدقة (الأذان بالضبط بوقته) تتأخر أو
// ما توصل - هذا سبب حقيقي محتمل وراء "بعض الأجهزة توصلها الإشعارات وبعضها لا".
async function requestExactAlarmPermission(): Promise<StepResult> {
  if (Platform.OS !== 'android') return 'granted'; // آيفون ما يحتاج هذا الإذن إطلاقاً
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const notifee = require('@notifee/react-native').default;
    const settings = await notifee.getNotificationSettings();
    if (settings?.android?.alarm === 1) return 'granted'; // AndroidNotificationSetting.ENABLED
    await notifee.openAlarmPermissionSettings();
    return 'opened_settings'; // ما نگدر نعرف النتيجة فوراً - المستخدم يفعّلها ويرجع
  } catch {
    return 'denied';
  }
}

// ===== استثناء توفير البطارية (Battery Optimization) - السبب الأكبر وراء
// "الأذان ما يشتغل بالخلفية" على أجهزة زي شاومي/هواوي/بعض سامسونگ. هذا
// الإذن الوحيد اللي أندرويد يسمح تطلبه بنافذة نظام مباشرة (Intent) بدون ما
// تودي المستخدم لصفحة إعدادات منفصلة - المستخدم يشوف "سماح" بنافذة النظام
// نفسها ويضغطها بضغطة وحدة =====
async function requestBatteryOptimizationExemption(): Promise<StepResult> {
  if (Platform.OS !== 'android') return 'granted';
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Linking } = require('react-native');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants').default;
    const packageName: string = Constants.expoConfig?.android?.package ?? 'host.exp.exponent';
    await Linking.sendIntent('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', [
      { key: 'package', value: packageName },
    ]);
    return 'opened_settings'; // نافذة نظام مباشرة، بس برا شاشتنا فما نگدر نأكد النتيجة فوراً
  } catch (err) {
    console.error('[PermissionsOnboarding] فشل طلب استثناء توفير البطارية:', err);
    return 'denied';
  }
}

const STEPS: Step[] = [
  {
    key: 'location',
    icon: 'location-outline',
    title: 'موقعك',
    description: 'نحتاج موقعك حتى نحسب أوقات الصلاة واتجاه القبلة بدقة لمنطقتك.',
    request: async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted' ? 'granted' : 'denied';
    },
  },
  {
    key: 'notifications',
    icon: 'notifications-outline',
    title: 'الإشعارات',
    description: 'حتى نذكّرك بوقت الأذان، الأذكار، وأدعية وتسبيح كل يوم بوقته المناسب.',
    request: async () => {
      const current = await Notifications.getPermissionsAsync();
      if (current.status === 'granted') return 'granted';
      const requested = await Notifications.requestPermissionsAsync();
      return requested.status === 'granted' ? 'granted' : 'denied';
    },
  },
  {
    key: 'exactAlarm',
    icon: 'alarm-outline',
    title: 'دقة التوقيت',
    description: 'حتى الأذان والتذكيرات توصلك بالضبط بوقتها المحدد، بعض الأجهزة تحتاج تفعيل هذا الإذن يدوياً من الإعدادات.',
    request: requestExactAlarmPermission,
  },
  {
    key: 'batteryOptimization',
    icon: 'battery-charging-outline',
    title: 'الأذان بالخلفية',
    description: 'حتى صوت الأذان يشتغل حتى لو التطبيق مقفول، لازم نستثنيه من توفير البطارية - وإلا بعض الأجهزة توقفه بالخلفية.',
    request: requestBatteryOptimizationExemption,
  },
  {
    key: 'microphone',
    icon: 'mic-outline',
    title: 'الميكروفون',
    description: 'تحتاجه ميزة التسبيح الصوتي حتى تگدر تسبح بصوتك والتطبيق يعد لك تلقائياً.',
    request: requestSpeechRecognitionPermission,
  },
];

export default function PermissionsOnboarding({ onDone }: { onDone: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState<StepStatus>('idle');
  const opacity = useRef(new Animated.Value(1)).current;
  // ⚠️ إضافة: انتقال أنعم بين الخطوات - نضيف حركة scale خفيفة (0.97 → 1) مع
  // الـ fade بدل fade وحدها. هذا يعطي إحساس "دخول" ناعم بدل ظهور/اختفاء فجائي،
  // بنفس مبدأ سلاسة قائمة الإعدادات اللي حسّناها سابقاً
  const scale = useRef(new Animated.Value(1)).current;

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  const fadeTo = (toValue: number, cb?: () => void) => {
    Animated.parallel([
      Animated.timing(opacity, { toValue, duration: 180, useNativeDriver: true }),
      Animated.timing(scale, { toValue: toValue === 0 ? 0.97 : 1, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) cb?.();
    });
  };

  const advance = () => {
    if (isLastStep) {
      markOnboardingDone().finally(onDone);
      return;
    }
    fadeTo(0, () => {
      setStepIndex((i) => i + 1);
      setStatus('idle');
      fadeTo(1);
    });
  };

  // ⚠️ إصلاح حرج: step.request() ما كان محاط بمهلة زمنية - لو أي طلب صلاحية
  // علّق لأي سبب (خصوصاً الميكروفون: ExpoSpeechRecognitionModule.requestPermissionsAsync
  // ممكن تتعثر على بعض الأجهزة وما ترجع نتيجة أبداً، مو حتى استثناء)، الشاشة
  // تضل واقفة للأبد و onDone ما ينادى إطلاقاً - يعني initializeAppNotifications()
  // بـ_layout.tsx ما تشتغل نهائياً وما يوصل ولا إشعار واحد بكل التطبيق، بصمت
  // تام بدون أي خطأ يدلك عليه. هذا الـtimeout يضمن الشاشة تتقدم دايماً خلال ٨
  // ثواني كحد أقصى مهما صار بالطلب نفسه.
  function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          console.warn(`[PermissionsOnboarding] "${step.key}" تجاوزت ${ms}ms بدون رد - نتابع تلقائياً`);
          resolve(fallback);
        }
      }, ms);
      promise.then((v) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(v);
        }
      }).catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      });
    });
  }

  const handleAllow = async () => {
    if (status === 'opened_settings') {
      advance(); // رجع من الإعدادات - يتابع يدوياً
      return;
    }
    setStatus('requesting');
    const result = await withTimeout(step.request(), 8000, 'denied' as StepResult);
    setStatus(result);
    if (result === 'opened_settings') return; // ننتظره يرجع من الإعدادات بنفسه، ما نتقدم تلقائياً
    // نعطي المستخدم لحظة يشوف نتيجة الطلب (✓ أو نص "تگدر تفعلها لاحقاً")
    // قبل لا ننتقل تلقائياً للخطوة الجاية
    setTimeout(advance, 700);
  };

  const handleSkip = () => advance();

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.dotsRow}>
          {STEPS.map((s, i) => (
            <View
              key={s.key}
              style={[
                styles.dot,
                i === stepIndex && styles.dotActive,
                i < stepIndex && styles.dotDone,
              ]}
            />
          ))}
        </View>

        <Animated.View style={[styles.card, { opacity }]}>
          <View style={styles.iconCircle}>
            <Ionicons name={step.icon} size={34} color="#4da8da" />
          </View>

          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>

          {status === 'granted' && (
            <View style={styles.statusRow}>
              <Ionicons name="checkmark-circle" size={18} color="#3ddc84" />
              <Text style={styles.statusTextGranted}>تم السماح</Text>
            </View>
          )}
          {status === 'denied' && (
            <Text style={styles.statusTextDenied}>مافي مشكلة، تگدر تفعلها لاحقاً من الإعدادات</Text>
          )}
          {status === 'opened_settings' && (
            <Text style={styles.statusTextDenied}>فعّلها من الصفحة اللي فتحناها لك، وارجع اضغط "التالي"</Text>
          )}
        </Animated.View>

        <View style={styles.buttonsWrap}>
          <TouchableOpacity
            style={styles.allowButton}
            activeOpacity={0.85}
            disabled={status === 'requesting'}
            onPress={handleAllow}
          >
            <Text style={styles.allowButtonText}>
              {status === 'requesting' ? 'جاري الطلب...' : status === 'opened_settings' ? 'التالي' : 'سماح'}
            </Text>
          </TouchableOpacity>

          {status !== 'opened_settings' && (
            <TouchableOpacity style={styles.skipButton} activeOpacity={0.6} onPress={handleSkip}>
              <Text style={styles.skipButtonText}>{isLastStep ? 'تخطي وإنهاء' : 'تخطي'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0a2540',
    zIndex: 998,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: Platform.OS === 'android' ? 24 : 12,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    backgroundColor: '#4da8da',
    width: 20,
  },
  dotDone: {
    backgroundColor: 'rgba(77,168,218,0.5)',
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(77,168,218,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(77,168,218,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 13.5,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  statusTextGranted: {
    color: '#3ddc84',
    fontSize: 13,
    fontWeight: '600',
  },
  statusTextDenied: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 12,
  },
  buttonsWrap: {
    gap: 10,
    marginBottom: 8,
  },
  allowButton: {
    backgroundColor: '#4da8da',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  allowButtonText: {
    color: '#0a2540',
    fontSize: 15,
    fontWeight: '700',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipButtonText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
});