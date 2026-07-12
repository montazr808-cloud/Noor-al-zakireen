import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { type ReactElement, useEffect, useState } from 'react';
import {
  Image,
  ImageBackground,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import PhoneFrameWrapper from '@/components/PhoneFrameWrapper';
import { useThemeContext } from '@/contexts/theme-contexts';
import { getSelectedBackground } from '@/utils/backgroundSettings';
import { getSelectedMarja, Marja, MARJA_INFO, setSelectedMarja } from '../api/askSheikh';

// ===== باليت مطابقة لشاشة التسبيح =====
const C = {
  neonBlue: '#57C8F2',
  white: '#FFFFFF',
  glass: 'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(255,255,255,0.22)',
  muted: 'rgba(255,255,255,0.55)',
};

const MARJA_ORDER: Marja[] = ['sistani', 'khamenei', 'najafi', 'sadr', 'yaqoubi', 'general'];

export default function MarjaScreen() {
  const router = useRouter();
  const { backgroundId } = useThemeContext();
  const bgOption = getSelectedBackground(backgroundId);
  const [selectedMarja, setSelectedMarjaState] = useState<Marja>('general');

  useEffect(() => {
    getSelectedMarja().then((m) => { if (m) setSelectedMarjaState(m); });
  }, []);

  const handleSelect = async (marja: Marja) => {
    setSelectedMarjaState(marja);
    await setSelectedMarja(marja);
  };

  const currentMarja = MARJA_INFO[selectedMarja];

  const screenContent = (
    <SafeAreaView style={[styles.container, !bgOption.image && { backgroundColor: bgOption.color }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/settings')} style={styles.backBtn}>
            <Ionicons name="chevron-forward" size={22} color={C.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>المرجع الديني</Text>
          <View style={{ width: 34 }} />
        </View>

        <Text style={styles.desc}>
          اختياره يحدد مصدر فتاوى "المجيب" بإجاباته على أسئلتك
        </Text>

        {/* البطاقة المختارة حالياً */}
        <View style={[styles.currentBox, { borderColor: currentMarja.color }]}>
          <Image source={currentMarja.image} style={styles.avatarLarge} resizeMode="cover" />
          <View style={styles.currentInfo}>
            <Text style={styles.currentName}>{currentMarja.name}</Text>
            <Text style={[styles.currentStatus, { color: currentMarja.color }]}>
              المرجع المختار حالياً
            </Text>
          </View>
          <Ionicons name="checkmark-circle" size={26} color={currentMarja.color} />
        </View>

        {/* قائمة المراجع */}
        <Text style={styles.sectionLabel}>اختر مرجعاً</Text>
        <View style={styles.glassCard}>
          {MARJA_ORDER.map((id, index) => {
            const info = MARJA_INFO[id];
            const active = selectedMarja === id;
            return (
              <TouchableOpacity
                key={id}
                style={[
                  styles.row,
                  index < MARJA_ORDER.length - 1 && styles.rowBorder,
                  active && styles.rowActive,
                ]}
                onPress={() => handleSelect(id)}
                activeOpacity={0.8}
              >
                <Image source={info.image} style={styles.avatarSmall} resizeMode="cover" />
                <View style={styles.rowContent}>
                  <Text style={[styles.rowTitle, active && { color: C.white }]}>{info.name}</Text>
                  <Text style={styles.rowDesc}>{info.location}</Text>
                </View>
                {active
                  ? <Ionicons name="checkmark-circle" size={22} color={info.color} />
                  : <Ionicons name="chevron-back" size={16} color={C.muted} />
                }
              </TouchableOpacity>
            );
          })}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, marginBottom: 4 },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    color: C.white, fontSize: 20, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  desc: { color: C.muted, fontSize: 13, marginBottom: 20, lineHeight: 20 },

  currentBox: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.glass, borderRadius: 20, padding: 16, borderWidth: 2, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6,
  },
  avatarLarge: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.2)' },
  currentInfo: { flex: 1 },
  currentName: {
    color: C.white, fontSize: 16, fontWeight: '700', marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  currentStatus: { fontSize: 12, fontWeight: '600' },
  sectionLabel: { color: C.muted, fontSize: 12, fontWeight: '600', marginBottom: 8, marginRight: 4 },

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
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  rowActive: { backgroundColor: 'rgba(87,200,242,0.14)' },
  avatarSmall: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.2)' },
  rowContent: { flex: 1 },
  rowTitle: { color: C.muted, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  rowDesc: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
});
