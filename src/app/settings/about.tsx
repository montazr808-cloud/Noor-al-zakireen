import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { type ReactElement } from 'react';
import { Image, ImageBackground, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

export default function AboutScreen() {
  const router = useRouter();
  const { backgroundId } = useThemeContext();
  const bgOption = getSelectedBackground(backgroundId);

  const screenContent = (
    <SafeAreaView style={[styles.container, !bgOption.image && { backgroundColor: bgOption.color }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/settings')} style={styles.backBtn}>
            <Ionicons name="chevron-forward" size={22} color={C.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>حول التطبيق</Text>
          <View style={{ width: 34 }} />
        </View>

        {/* لوغو + اسم - توهج نيوني حقيقي (حلقة شفافة) بدل الظل، لأن خاصية
            elevation بأندرويد تتجاهل shadowColor وتطلع ظل أسود دايماً */}
        <View style={styles.logoBox}>
          <View style={styles.logoGlowRing}>
            <View style={styles.logoCircle}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>
          <Text style={styles.appName}>نور الذاكرين</Text>
          <Text style={styles.appSlogan}>رفيقك في الذكر والدعاء</Text>
        </View>

        {/* معلومات */}
        <View style={styles.glassCard}>
          {[
            { label: 'الإصدار', value: '1.0.0' },
            { label: 'المطور', value: 'Noor Al-Zakireen' },
            { label: 'السنة', value: '2026' },
            { label: 'المنصة', value: 'Android & iOS' },
            { label: 'تصميم وتطوير', value: 'منتظر صبحي الخزرجي' },
          ].map((item, index, arr) => (
            <View key={item.label} style={[styles.row, index < arr.length - 1 && styles.rowBorder]}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* روابط */}
        <View style={[styles.glassCard, { marginTop: 16 }]}>
          <TouchableOpacity
            style={[styles.row, styles.rowBorder]}
            onPress={() => Linking.openURL('https://www.instagram.com/noor_alzakireen')}
            activeOpacity={0.75}
          >
            <View style={[styles.iconBox, { backgroundColor: '#db2777' }]}>
              <Ionicons name="logo-instagram" size={18} color="#fff" />
            </View>
            <Text style={styles.linkText}>تابعنا على إنستغرام</Text>
            <Ionicons name="chevron-back" size={16} color={C.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.row, styles.rowBorder]}
            onPress={() => Linking.openURL('https://t.me/noor_alzakireen')}
            activeOpacity={0.75}
          >
            <View style={[styles.iconBox, { backgroundColor: '#0088cc' }]}>
              <Ionicons name="paper-plane" size={18} color="#fff" />
            </View>
            <Text style={styles.linkText}>قناتنا على تيليغرام</Text>
            <Ionicons name="chevron-back" size={16} color={C.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.row, styles.rowBorder]}
            onPress={() => Linking.openURL('mailto:montazr808@gmail.com')}
            activeOpacity={0.75}
          >
            <View style={[styles.iconBox, { backgroundColor: '#ea4335' }]}>
              <Ionicons name="mail" size={18} color="#fff" />
            </View>
            <Text style={styles.linkText}>راسلنا عبر الإيميل</Text>
            <Ionicons name="chevron-back" size={16} color={C.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/settings/privacy-policy')}
            activeOpacity={0.75}
          >
            <View style={[styles.iconBox, { backgroundColor: '#64748b' }]}>
              <Ionicons name="shield-checkmark" size={18} color="#fff" />
            </View>
            <Text style={styles.linkText}>سياسة الخصوصية</Text>
            <Ionicons name="chevron-back" size={16} color={C.muted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>صُنع بحب لخدمة الإسلام والمسلمين 🤍</Text>

      </ScrollView>
    </SafeAreaView>
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
          {screenContent}
        </ImageBackground>
      </View>
    );
  }

  return wrapInPhoneFrame(screenContent);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgFill: { flex: 1 },
  bgImage: { flex: 1, width: '100%', height: '100%' },
  bgImageFull: { width: '100%', height: '100%' },
  bgOverlay: { ...StyleSheet.absoluteFill, backgroundColor: '#000' },

  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, marginBottom: 8 },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    color: C.white, fontSize: 20, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  logoBox: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  // حلقة توهج نيوني حقيقية (خلفية شفافة بلون نيوني + دائرة أكبر شوي من اللوغو
  // نفسه) - تشتغل بنفس الشكل بالضبط على أندرويد وآيفون، بعكس shadow/elevation
  logoGlowRing: {
    width: 92, height: 92, borderRadius: 46,
    backgroundColor: 'rgba(87,200,242,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  logoCircle: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: C.glass, borderWidth: 1.5, borderColor: 'rgba(87,200,242,0.65)',
    justifyContent: 'center', alignItems: 'center',
  },
  logoImage: {
    width: 56, height: 56,
  },
  appName: {
    color: C.white, fontSize: 21, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  appSlogan: { color: C.muted, fontSize: 13 },

  glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: C.glass,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  rowLabel: { color: C.muted, fontSize: 13, flex: 1, textAlign: 'right',},
  rowValue: { color: C.white, fontSize: 13, fontWeight: '600', textAlign: 'right',},
  iconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  linkText: { color: C.white, fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right',},
  footer: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 28 },
});