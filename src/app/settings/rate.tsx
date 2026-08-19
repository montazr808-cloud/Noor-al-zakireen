import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { type ReactElement } from 'react';
import { ImageBackground, Linking, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

const APP_STORE_URL = 'https://apps.apple.com/app/id000000000'; // placeholder
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.nooralzakireen'; // placeholder

export default function RateScreen() {
  const router = useRouter();
  const { backgroundId } = useThemeContext();
  const bgOption = getSelectedBackground(backgroundId);

  const openStore = () => {
    const url = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
    Linking.openURL(url);
  };

  const shareApp = async () => {
    await Share.share({
      message: 'تطبيق نور الذاكرين — رفيقك في الذكر والدعاء 🤍\nhttps://t.me/noor_alzakireen',
      title: 'نور الذاكرين',
    });
  };

  const screenContent = (
    <SafeAreaView style={[styles.container, !bgOption.image && { backgroundColor: bgOption.color }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/settings')} style={styles.backBtn}>
            <Ionicons name="chevron-forward" size={22} color={C.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>التقييم والمشاركة</Text>
          <View style={{ width: 34 }} />
        </View>

        <View style={styles.msgBox}>
          <Ionicons name="star" size={34} color="#d97706" />
          <Text style={styles.msgTitle}>أعجبك التطبيق؟</Text>
          <Text style={styles.msgDesc}>تقييمك يساعدنا على الوصول لأكثر المسلمين وتحسين التطبيق</Text>
        </View>

        <View style={[styles.glassCard, { marginTop: 20 }]}>
          <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={openStore} activeOpacity={0.75}>
            <View style={[styles.iconBox, { backgroundColor: '#d97706' }]}>
              <Ionicons name="star" size={20} color="#fff" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>قيّم التطبيق</Text>
              <Text style={styles.rowDesc}>افتح المتجر وأعطنا تقييمك</Text>
            </View>
            <Ionicons name="chevron-back" size={16} color={C.muted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={shareApp} activeOpacity={0.75}>
            <View style={[styles.iconBox, { backgroundColor: '#10b981' }]}>
              <Ionicons name="share-social" size={20} color="#fff" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>شارك التطبيق</Text>
              <Text style={styles.rowDesc}>أرسله لأصدقائك وعائلتك</Text>
            </View>
            <Ionicons name="chevron-back" size={16} color={C.muted} />
          </TouchableOpacity>
        </View>

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
  rowDesc: { color: C.muted, fontSize: 12, textAlign: 'right',},
});
