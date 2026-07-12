import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { type ReactElement } from 'react';
import { Alert, Clipboard, ImageBackground, Linking, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

export default function SupportScreen() {
  const router = useRouter();
  const { backgroundId } = useThemeContext();
  const bgOption = getSelectedBackground(backgroundId);

  const openZain = () => Linking.openURL('zaincash://pay?msisdn=9647736146971').catch(() =>
    Alert.alert('تنبيه', 'يرجى تثبيت تطبيق زين كاش أولاً')
  );

  const copyMaster = () => {
    Clipboard.setString('1189506650');
    Alert.alert('✅ تم النسخ', 'تم نسخ رقم الحساب: 1189506650');
  };

  const screenContent = (
    <SafeAreaView style={[styles.container, !bgOption.image && { backgroundColor: bgOption.color }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-forward" size={22} color={C.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ادعمنا</Text>
          <View style={{ width: 34 }} />
        </View>

        <View style={styles.msgBox}>
          <Ionicons name="heart" size={34} color="#10b981" />
          <Text style={styles.msgTitle}>دعمك يُكمل المسيرة</Text>
          <Text style={styles.msgDesc}>
            تطبيق نور الذاكرين يُبنى بجهد وإخلاص — دعمك يساعدنا على الاستمرار وإضافة المزيد من المحتوى الإسلامي
          </Text>
        </View>

        <Text style={styles.sectionLabel}>طرق الدعم</Text>
        <View style={styles.glassCard}>
          <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={openZain} activeOpacity={0.75}>
            <View style={[styles.iconBox, { backgroundColor: '#7c3aed' }]}>
              <Ionicons name="phone-portrait" size={20} color="#fff" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>زين كاش</Text>
              <Text style={styles.rowDesc}>اضغط للتحويل مباشرة عبر التطبيق</Text>
            </View>
            <Ionicons name="chevron-back" size={16} color={C.muted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={copyMaster} activeOpacity={0.75}>
            <View style={[styles.iconBox, { backgroundColor: '#dc2626' }]}>
              <Ionicons name="card" size={20} color="#fff" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>ماستر كارد</Text>
              <Text style={styles.rowDesc}>اضغط لنسخ رقم الحساب: 1189506650</Text>
            </View>
            <Ionicons name="copy" size={16} color={C.muted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.thanks}>جزاكم الله خيراً على كل دعم ❤️</Text>

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
  msgBox: {
    backgroundColor: C.glass, borderRadius: 20, padding: 24, alignItems: 'center', marginTop: 16,
    borderWidth: 1, borderColor: C.glassBorder, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6,
  },
  msgTitle: {
    color: C.white, fontSize: 18, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  msgDesc: { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 22 },
  sectionLabel: { color: C.muted, fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 24, marginRight: 4 },
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
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  iconBox: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  rowContent: { flex: 1 },
  rowTitle: {
    color: C.white, fontSize: 15, fontWeight: '700', marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  rowDesc: { color: C.muted, fontSize: 12 },
  thanks: { color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 24 },
});
