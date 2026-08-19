import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { type ReactElement, useEffect, useRef } from 'react';
import {
  Animated,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
// ⚠️ SafeAreaView من react-native نفسها ما تشتغل بالاندرويد (بس بالآيفون) — لازم من هذي المكتبة
import { SafeAreaView } from 'react-native-safe-area-context';

import PhoneFrameWrapper from '@/components/PhoneFrameWrapper';
import { useThemeContext } from '@/contexts/theme-contexts';
import { getSelectedBackground } from '@/utils/backgroundSettings';

// ===== باليت مطابقة لشاشة التسبيح =====
const C = {
  neonBlue: '#57C8F2',
  white: '#FFFFFF',
  glass: 'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(255,255,255,0.22)',
  muted: 'rgba(255,255,255,0.55)',
};

type SettingItem = {
  id: string;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route?: string;
};

const SETTINGS: SettingItem[] = [
  { id: 'prayer-times',     title: 'أوقات الصلاة',        desc: 'المواقيت، التنبيهات، وصوت المؤذن',      icon: 'time',                 color: '#16a34a', route: '/settings/prayer-times' },
  { id: 'qibla',            title: 'اتجاه القبلة',         desc: 'بوصلة لتحديد اتجاه القبلة',              icon: 'compass',              color: '#0d9488', route: '/settings/qibla' },
  { id: 'marja',            title: 'المرجع الديني',        desc: 'اختر مرجعك الفقهي',                      icon: 'book',                 color: '#c8a84b', route: '/settings/marja' },
  { id: 'calendar',         title: 'التقويم',              desc: 'هجري وميلادي والمناسبات الدينية',        icon: 'calendar',             color: '#9333ea', route: '/settings/calendar' },
  { id: 'background',       title: 'الخلفيات',             desc: 'خلفية التطبيق',                          icon: 'image',                color: '#7c3aed', route: '/settings/background' },
  { id: 'phone-wallpapers', title: 'خلفيات الهاتف',        desc: 'صور إسلامية لتحميلها كخلفية هاتفك',      icon: 'phone-portrait',       color: '#2563eb', route: '/settings/phone-wallpapers' },
  { id: 'app-settings',     title: 'إعدادات التطبيق',      desc: 'الصوت والإشعارات واللغة والخصوصية',      icon: 'settings',             color: '#0891b2', route: '/settings/app-settings' },
  { id: 'rate',             title: 'التقييم والمشاركة',    desc: 'قيّم التطبيق وشاركه مع أصدقائك',         icon: 'star',                 color: '#d97706', route: '/settings/rate' },
  { id: 'contact',          title: 'تواصل معنا',           desc: 'إنستغرام وتيليغرام',                     icon: 'chatbubble-ellipses',  color: '#db2777', route: '/settings/contact' },
  { id: 'support',          title: 'ادعمنا',                desc: 'زين كاش وماستر كارد',                    icon: 'heart',                color: '#10b981', route: '/settings/support' },
  { id: 'privacy',          title: 'سياسة الخصوصية',       desc: 'اطلع على سياسة الخصوصية',                icon: 'shield-checkmark',     color: '#64748b', route: '/settings/privacy-policy' },
  { id: 'about',            title: 'حول التطبيق',          desc: 'الإصدار والمطور',                        icon: 'information-circle',   color: '#3b82f6', route: '/settings/about' },
];

export default function SettingsIndexScreen() {
  const router = useRouter();
  const { backgroundId } = useThemeContext();
  const bgOption = getSelectedBackground(backgroundId);
  const { width: screenWidth } = useWindowDimensions();

  // ===== أنيميشن دخول الصفحة: تنزلق من اليمين (نفس جهة زر ☰) لليسار، وكأنها طلعت من الزر =====
  // ⚠️ تعديل: بدّلنا Animated.timing (سرعة ثابتة طول الحركة) لـ Animated.spring
  // (تسارع طبيعي: تبدأ سريعة وتتباطأ تدريجياً قرب النهاية، بدون أي ارتداد
  // محسوس بفضل friction/tension المضبوطين) - هذا يحس أنعم وأقرب لحركة
  // فيزيائية حقيقية بدل الحركة الآلية المتساوية السرعة لـ timing. زائد،
  // Stack بملف settings/_layout.tsx صار يعطّل انتقاله الأصلي لهذي الشاشة
  // تحديداً، فهذي الحركة صارت الوحيدة الشغالة بدون تضارب/ارتجاج.
  const slideAnim = useRef(new Animated.Value(screenWidth)).current;
  const scrimAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scrimAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 26,
        tension: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const screenContent = (
    <Animated.View
      style={[
        styles.sheet,
        { transform: [{ translateX: slideAnim }] },
      ]}
    >
      <SafeAreaView style={[styles.container, !bgOption.image && { backgroundColor: bgOption.color }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          <View style={styles.header}>
            {/* رجوع لمكان ثابت (شاشة التسبيح) دايماً، بدل الاعتماد على تاريخ التنقل */}
            <TouchableOpacity onPress={() => router.replace('/tasbih')} style={styles.backBtn}>
              <Ionicons name="chevron-forward" size={22} color={C.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>الإعدادات</Text>
            <View style={{ width: 34 }} />
          </View>

          <View style={styles.glassCard}>
            {SETTINGS.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.row, index < SETTINGS.length - 1 && styles.rowBorder]}
                onPress={() => item.route && router.push(item.route as any)}
                activeOpacity={0.75}
              >
                <View style={[styles.iconBox, { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon} size={19} color="#fff" />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowDesc}>{item.desc}</Text>
                </View>
                <Ionicons name="chevron-back" size={16} color={C.muted} />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.version}>نور الذاكرين • الإصدار 1.0.0</Text>

        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );

  const wrapInPhoneFrame = (node: ReactElement) => <PhoneFrameWrapper>{node}</PhoneFrameWrapper>;

  if (bgOption.image) {
    return wrapInPhoneFrame(
      <View style={[styles.bgFill, { backgroundColor: bgOption.color }]}>
        <ImageBackground
          source={bgOption.image}
          style={styles.bgImage}
          resizeMode="cover"
          imageStyle={styles.bgImageFull}
        >
          <View style={[styles.bgOverlay, { opacity: bgOption.overlayOpacity }]} />
          <Animated.View style={[styles.scrim, { opacity: scrimAnim }]} pointerEvents="none" />
          {screenContent}
        </ImageBackground>
      </View>
    );
  }

  return wrapInPhoneFrame(
    <View style={styles.bgFill}>
      <Animated.View style={[styles.scrim, { opacity: scrimAnim }]} pointerEvents="none" />
      {screenContent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgFill: { flex: 1 },
  bgImage: { flex: 1, width: '100%', height: '100%' },
  bgImageFull: { width: '100%', height: '100%' },
  bgOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },

  // الورقة المنزلقة - تحمل ظل خفيف وزوايا يسارية مدورة تعطي إحساس "طلعت من الزر"
  sheet: {
    flex: 1,
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 14,
  },

  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    marginBottom: 8,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    color: C.white, fontSize: 20, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: C.glass,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  iconBox: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  rowContent: { flex: 1 },
  rowTitle: {
    color: C.white, fontSize: 15, fontWeight: '700', marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  rowDesc: { color: C.muted, fontSize: 12, textAlign: 'right',},

  version: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 24 },
});