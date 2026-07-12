import { useThemeContext } from '@/contexts/theme-contexts';
import { getSelectedBackground } from '@/utils/backgroundSettings';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { type ReactElement } from 'react';
import { ImageBackground, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import PhoneFrameWrapper from '@/components/PhoneFrameWrapper';

// ===== باليت مطابقة لشاشة التسبيح =====
const C = {
  neonBlue: '#57C8F2',
  white: '#FFFFFF',
  glass: 'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(255,255,255,0.22)',
  muted: 'rgba(255,255,255,0.55)',
};

export default function AppearanceScreen() {
  const router = useRouter();
  const { fontSize, setFontSize, backgroundId } = useThemeContext();
  const bgOption = getSelectedBackground(backgroundId);

  const screenContent = (
    <SafeAreaView style={[styles.container, !bgOption.image && { backgroundColor: bgOption.color }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/settings')} style={styles.backBtn}>
            <Ionicons name="chevron-forward" size={22} color={C.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>المظهر</Text>
          <View style={{ width: 34 }} />
        </View>

        {/* حجم الخط */}
        <Text style={styles.sectionLabel}>حجم الخط</Text>
        <View style={styles.glassCard}>
          {[
            { key: 'small', label: 'صغير', desc: 'مناسب للشاشات الصغيرة' },
            { key: 'normal', label: 'عادي', desc: 'الحجم الافتراضي' },
            { key: 'large', label: 'كبير', desc: 'أوضح للقراءة' },
          ].map((item, index, arr) => {
            const isSelected = fontSize === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.row,
                  index < arr.length - 1 && styles.rowBorder,
                  isSelected && styles.rowSelected,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFontSize(item.key as any);
                }}
                activeOpacity={0.75}
              >
                <View style={[styles.iconBox, { backgroundColor: '#7c3aed' }]}>
                  <Ionicons name="text" size={18} color="#fff" />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>{item.label}</Text>
                  <Text style={styles.rowDesc}>{item.desc}</Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={22} color={C.neonBlue} />
                )}
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
  sectionLabel: { color: C.muted, fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 20, marginRight: 4 },

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
  rowSelected: { backgroundColor: 'rgba(87,200,242,0.08)' },
  iconBox: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  rowContent: { flex: 1 },
  rowTitle: {
    color: C.white, fontSize: 16, fontWeight: '700', marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  rowDesc: { color: C.muted, fontSize: 13 },
});
