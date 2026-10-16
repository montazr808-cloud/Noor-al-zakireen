// ===== src/components/OnboardingPermissions.tsx =====
// ⚠️ إعادة تصميم (طلب صريح: "الصلاحيات تاخذ وقت طويل"): هذي الشاشة كانت
// تطلب ٦ صلاحيات دفعة وحدة (موقع، إشعارات، مايكروفون، منبه دقيق، توفير
// طاقة، ظهور فوق التطبيقات) - قائمة طويلة بأول تجربة استخدام، أغلب
// المستخدمين غير التقنيين يملّون قبل ما يخلصون. هسه الشاشة مقتصرة بس على
// الصلاحيات اللي *ماكو لها لحظة طبيعية بالتطبيق* (فايدتها كلها بالخلفية:
// وصول الأذان حتى والتطبيق مقفول) - المنبه الدقيق، توفير الطاقة، الظهور
// فوق التطبيقات، والتشغيل التلقائي (لبعض الشركات المصنّعة بس).
//
// الموقع والإشعارات والمايكروفون صاروا يُطلبون "بلحظتهم الطبيعية" بمكان
// استخدامهم الفعلي بالتطبيق (شوف utils/permissions.ts للدوال المشتركة):
// - الموقع: أصلاً مطلوب بشاشة أوقات الصلاة (prayer-times.tsx) لحالها
// - المايكروفون: يُطلب أول ضغطة على زر المايك بشاشة التسبيح (tasbih.tsx)
// - الإشعارات: تُطلب داخل utils/notifications.ts قبل أول جدولة فعلية
//
// النتيجة: شاشة أقصر بكثير (٣-٤ خطوات بدل ٦)، وموافقة أعلى على كل صلاحية
// لأنها تُطلب بلحظة يفهم فيها المستخدم "ليش" بالضبط.
//
// نفس هوية التطبيق البصرية بالضبط: خلفية داكنة، بطاقات زجاجية (glassmorphism)،
// توهج نيوني سماوي (#00E5FF).

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getManufacturerInstructions,
  openManufacturerAutostartSettings,
  requestIgnoreBatteryOptimizations,
} from '@/utils/batteryOptimization';
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

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const toArabicDigits = (n: number): string => String(n).replace(/[0-9]/g, (d) => AR_DIGITS[parseInt(d, 10)]);

type PermStatus = 'idle' | 'granted' | 'denied' | 'unsupported';

type PermKey = 'alarm' | 'overlay' | 'battery';

type PermDef = {
  key: PermKey;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  actionLabel: string; // نص الزر وقت idle/denied
};

// ⚠️ وصف كل صلاحية صار سطر وحيد قصير (بدل فقرة كاملة) - يكفي يشرح "ليش"
// بدون ما يثقّل الشاشة بصرياً
const PERMISSIONS: PermDef[] = [
  {
    key: 'battery',
    icon: 'battery-charging-outline',
    title: 'توفير الطاقة',
    desc: 'أهم خطوة - يبقيك موصول حتى والتطبيق مقفول',
    actionLabel: 'سماح',
  },
  {
    key: 'alarm',
    icon: 'alarm-outline',
    title: 'المنبهات الدقيقة',
    desc: 'ليصلك الأذان بوقته بالضبط، دون تأخير',
    actionLabel: 'فتح الإعدادات',
  },
  {
    key: 'overlay',
    icon: 'layers-outline',
    title: 'الظهور فوق التطبيقات',
    desc: 'يظهر تنبيه الأذان حتى فوق تطبيق ثاني تكون فاتحه',
    actionLabel: 'فتح الإعدادات',
  },
];

async function checkAlarm(): Promise<PermStatus> {
  const status = await getExactAlarmPermissionStatus();
  return status; // 'granted' | 'denied' | 'unsupported' - نفس الأسماء بالضبط
}

export default function OnboardingPermissions({ onDone }: { onDone: () => void }) {
  const [statuses, setStatuses] = useState<Record<PermKey, PermStatus>>({
    alarm: 'idle',
    overlay: 'idle',
    battery: 'idle',
  });
  const [busyKey, setBusyKey] = useState<PermKey | null>(null);
  // ⚠️ إصلاح (طلب صريح: بطاقة "الظهور فوق التطبيقات" كانت تنعلّم "تم" فوراً
  // بمجرد الضغط، بدون أي تحقق حقيقي - أندرويد ما يعطي طريقة برمجية نتأكد
  // فيها من هذي الصلاحية تحديداً). هسه أول ضغطة تفتح شاشة الإعدادات بس (زر
  // "فتح الإعدادات")، وتتحول لزر "تم التفعيل ✓" - وبس بضغطة ثانية صريحة من
  // المستخدم نفسه (بعد ما يرجع من الإعدادات ويتأكد بعينه) تنعلّم "تم" فعلاً.
  const [overlayOpened, setOverlayOpened] = useState(false);
  // ⚠️ إصلاح ("شاشة الأذونات تكذب" - صلاحية توفير الطاقة كانت تنعلّم "مفعّلة ✅"
  // فوراً بمجرد الضغط، حتى لو المستخدم ضغط "إلغاء" أو رجع بدون تفعيل شي
  // فعلياً بنافذة النظام). نفس أسلوب overlayOpened بالضبط.
  const [batteryOpened, setBatteryOpened] = useState(false);
  // ⚠️ إضافة (شكوى صريحة: "هواوي/هونر عندها مشكلة وية تطبيقي" - أذان متأخر/
  // ناقص، مواقيت ما تتحدث إلا لما تفتح التطبيق يدوياً، إشعارات توصل أحياناً
  // وأحياناً لا). هواوي (وهونر) عندها طبقة تقييد خلفية إضافية *منفصلة تماماً*
  // عن Battery Optimization القياسي ("إدارة تشغيل التطبيق" / Protected Apps) -
  // ثلاث مفاتيح: تشغيل تلقائي + تشغيل ثانوي + تشغيل بالخلفية. نفس نمط
  // التأكيد بضغطتين المستخدم بـoverlay/battery ينطبق عليها هنا.
  const [autostartOpened, setAutostartOpened] = useState(false);
  const [autostartConfirmed, setAutostartConfirmed] = useState(false);
  // تعليمات نصية مخصصة حسب الشركة المصنّعة لهاتف المستخدم - محسوبة مرة
  // وحدة عند فتح الشاشة (Device.brand/manufacturer ثابتة طول الجلسة)
  const [manufacturerInfo] = useState(() => getManufacturerInstructions());
  const hasAutostartScreen =
    manufacturerInfo.manufacturer !== 'other' && manufacturerInfo.manufacturer !== 'samsung';

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
      if (key === 'alarm') {
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
        if (!overlayOpened) {
          // الضغطة الأولى: نفتح شاشة الإعدادات الحقيقية بس - ما نعلّم "تم"
          // إطلاقاً هنا (هذا بالضبط الإصلاح المطلوب)
          await openOverlayPermissionSettings();
          setOverlayOpened(true);
        } else {
          // الضغطة الثانية (بعد ما رجع من الإعدادات وأكد بعينه إنه فعّلها) -
          // هذا التأكيد الوحيد المتاح تقنياً لهذي الصلاحية بالذات
          setStatuses((prev) => ({ ...prev, overlay: 'granted' }));
        }
      } else if (key === 'battery') {
        // أهم صلاحية للهدف الحالي (وصول الأذان حتى لو التطبيق مقفول أياماً) -
        // نافذة النظام القياسية لاستثناء تحسين البطارية. ماكو فحص برمجي
        // موثوق متاح بدون native module إضافي، فنطبّق نفس أسلوب "overlay"
        // بالأعلى: أول ضغطة تفتح النافذة بس، الضغطة الثانية (بعد رجوع
        // المستخدم وتأكده بعينه) هي اللي تعلّم "مفعّلة" فعلاً
        if (!batteryOpened) {
          await requestIgnoreBatteryOptimizations();
          setBatteryOpened(true);
        } else {
          setStatuses((prev) => ({ ...prev, battery: 'granted' }));
        }
      }
    } finally {
      setBusyKey(null);
    }
  };

  // نفس مبدأ overlay/battery بالضبط - ضغطة أولى تفتح شاشة النظام بس، ضغطة
  // ثانية (بعد ما يرجع المستخدم ويأكد بعينه إنه فعّل المفاتيح الثلاثة
  // بالشاشة) هي اللي تسجّل "تم" فعلاً
  const handleAutostartPress = async () => {
    if (!autostartOpened) {
      await openManufacturerAutostartSettings();
      setAutostartOpened(true);
    } else {
      setAutostartConfirmed(true);
      try {
        await AsyncStorage.setItem('@autostart_permission_confirmed_v1', 'true');
      } catch {
        // تجاهل - أسوأ حالة ما ينحفظ التأكيد، بدون أثر وظيفي حقيقي (تتبع بس)
      }
    }
  };

  const finish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
      // ⚠️ إصلاح ("صلاحية توفير الطاقة/المنبه الدقيق تطلع مرة ثانية فوراً بعد
      // onboarding"): notifications.ts (ensureExactAlarmPermission /
      // ensureBatteryOptimizationExemption) عندها نظام "تذكير دوري" مستقل
      // بمفاتيحه الخاصة - نسجّل هذي اللحظة (إكمال onboarding) كـ"آخر مرة
      // انسأل فيها" لكلا المفتاحين، حتى ما يتكرر نفس السؤال فوراً.
      await AsyncStorage.setItem('@alarm_permission_prompted_v1', 'true');
      await AsyncStorage.setItem('@battery_optimization_prompted_at_v1', new Date().toISOString());
    } catch {
      // تجاهل - أسوأ حالة الشاشة تطلع مرة ثانية بفتحة تطبيق جاية
    }
    // ⚠️ إصلاح: initializeAppNotifications() كانت تنادى مرة وحدة بس بفتح
    // التطبيق (_layout.tsx). هسه ننادي الجدولة فوراً لحظة إكمال هذي الشاشة،
    // حتى تشتغل الإشعارات مباشرة بدون انتظار فتحة تطبيق جديدة. صلاحية
    // الإشعارات نفسها تُطلب جوه initializeAppNotifications الآن (أول نداء
    // فعلي يحتاجها)، مو هنا.
    try {
      const { initializeAppNotifications } = await import('@/utils/notifications');
      await initializeAppNotifications();
    } catch {
      // تجاهل - آخر خط دفاع يبقى نداء _layout.tsx بفتحة التطبيق التالية
    }
    onDone();
  };

  const totalSteps = PERMISSIONS.length + (hasAutostartScreen ? 1 : 0);
  const completedSteps =
    PERMISSIONS.filter((p) => statuses[p.key] === 'granted' || statuses[p.key] === 'unsupported').length +
    (hasAutostartScreen && autostartConfirmed ? 1 : 0);
  const progressRatio = totalSteps > 0 ? completedSteps / totalSteps : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* ⚠️ إصلاح ("زر متابعة يضيع تحت أزرار التنقل"): الهيدر + البطاقات داخل
          ScrollView (يسكرل لو طال المحتوى)، وزر "متابعة" ثابت بالأسفل خارج
          السكرول - بمتناول اليد دائماً بغض النظر عن طول القائمة أو حجم الشاشة. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.header, { opacity: fadeIn }]}>
          <View style={styles.logoRing}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>خطوة أخيرة قبل البداية</Text>
          <Text style={styles.subtitle}>
            هذي الإعدادات تضمن وصول الأذان بدقة، حتى لو سكّرت التطبيق أو مرت أيام
          </Text>

          {/* ⚠️ إضافة (تصميم): مؤشر تقدّم بسيط يعطي إحساس واضح "كم بقى" - تحفيز
              نفسي لإكمال القائمة القصيرة بدل ما تحس وكأنها بلا نهاية */}
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progressRatio * 100)}%` }]} />
            </View>
            <Text style={styles.progressLabel}>
              {toArabicDigits(completedSteps)} / {toArabicDigits(totalSteps)}
            </Text>
          </View>
        </Animated.View>

        <View style={styles.list}>
          {PERMISSIONS.map((p) => {
            const status = statuses[p.key];
            const isBusy = busyKey === p.key;
            const isGranted = status === 'granted';
            const isUnsupported = status === 'unsupported';
            const isOverlayAwaitingConfirm = p.key === 'overlay' && overlayOpened && !isGranted;
            const isBatteryAwaitingConfirm = p.key === 'battery' && batteryOpened && !isGranted;
            const isAwaitingConfirm = isOverlayAwaitingConfirm || isBatteryAwaitingConfirm;

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
                        {isBusy ? '...' : isAwaitingConfirm ? 'تم التفعيل ✓' : p.actionLabel}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {p.key === 'overlay' && !isGranted && !isUnsupported && overlayOpened && (
                  <Text style={styles.helpText}>
                    بعد ما تفعّل الخيار من شاشة الإعدادات، ارجع هنا واضغط "تم التفعيل"
                  </Text>
                )}

                {p.key === 'battery' && (
                  <>
                    {isBatteryAwaitingConfirm && (
                      <Text style={styles.helpText}>
                        بعد ما تفعّل "بدون قيود" بنافذة الإعدادات، ارجع هنا واضغط "تم التفعيل"
                      </Text>
                    )}
                    {hasAutostartScreen &&
                      (autostartConfirmed ? (
                        <View style={styles.autostartConfirmedRow}>
                          <Ionicons name="checkmark-circle" size={15} color={C.neon} />
                          <Text style={styles.autostartConfirmedText}>
                            تم تفعيل "التشغيل التلقائي" لهذا الجهاز
                          </Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={handleAutostartPress}
                          activeOpacity={0.75}
                          style={styles.autostartBtn}
                        >
                          <Text style={styles.autostartBtnText}>
                            {autostartOpened
                              ? 'تم فتح الإعدادات - اضغط هنا بعد ما تفعّل المفاتيح ✓'
                              : `خطوة إضافية لجهازك: فتح "التشغيل التلقائي"`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    {!autostartConfirmed && hasAutostartScreen && (
                      <Text style={styles.manufacturerHint}>{manufacturerInfo.text}</Text>
                    )}
                  </>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

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

  scrollContent: { paddingBottom: 8 },

  header: { alignItems: 'center', marginTop: 28, marginBottom: 22 },
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
    marginBottom: 18,
  },

  progressRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    paddingHorizontal: 4,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: C.neon,
  },
  progressLabel: {
    color: C.neon,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 34,
    textAlign: 'left',
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
  manufacturerHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10.5,
    textAlign: 'right',
    lineHeight: 15,
    paddingHorizontal: 6,
    marginTop: 2,
  },
  autostartBtn: {
    backgroundColor: `rgba(${NEON_RGB},0.14)`,
    borderWidth: 1,
    borderColor: C.neon,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
    marginHorizontal: 6,
  },
  autostartBtnText: {
    color: C.neon,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  autostartConfirmedRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginHorizontal: 6,
  },
  autostartConfirmedText: {
    color: C.neon,
    fontSize: 11.5,
    fontWeight: '700',
  },

  footer: { paddingBottom: 18, paddingTop: 14 },
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