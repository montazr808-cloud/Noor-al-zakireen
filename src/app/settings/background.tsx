import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { type ReactElement } from 'react';
import {
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
import {
  BACKGROUND_OPTIONS,
  BackgroundId,
  getSelectedBackground,
} from '../../utils/backgroundSettings';

// ===== باليت مطابقة لشاشة التسبيح =====
const C = {
  neonBlue: '#57C8F2',
  white: '#FFFFFF',
  glass: 'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(255,255,255,0.22)',
  muted: 'rgba(255,255,255,0.55)',
};

export default function BackgroundSettingsScreen() {
  const router = useRouter();
  const { backgroundId, setBackgroundId } = useThemeContext();
  const bgOption = getSelectedBackground(backgroundId);

  const handleSelect = (id: BackgroundId) => {
    setBackgroundId(id);
  };

  const screenContent = (
    <SafeAreaView style={[styles.container, !bgOption.image && { backgroundColor: bgOption.color }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/settings')} style={styles.backBtn}>
            <Ionicons name="chevron-forward" size={22} color={C.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>خلفية التطبيق</Text>
          <View style={{ width: 34 }} />
        </View>

        <Text style={styles.sectionLabel}>اختر خلفية مناسبة</Text>
        <View style={styles.glassCard}>
          {BACKGROUND_OPTIONS.map((option, index) => {
            const isSelected = backgroundId === option.id;
            const isLast = index === BACKGROUND_OPTIONS.length - 1;

            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.row, !isLast && styles.rowBorder]}
                onPress={() => handleSelect(option.id)}
                activeOpacity={0.75}
              >
                {option.image ? (
                  <ImageBackground
                    source={option.image}
                    style={styles.preview}
                    imageStyle={styles.previewImage}
                  >
                    <View
                      style={[
                        styles.previewOverlay,
                        { backgroundColor: option.color, opacity: option.overlayOpacity },
                      ]}
                    />
                  </ImageBackground>
                ) : (
                  <View style={[styles.preview, { backgroundColor: option.color }]} />
                )}

                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>{option.label}</Text>
                  <Text style={styles.rowDesc}>{option.labelEn}</Text>
                </View>

                {isSelected ? (
                  <Ionicons name="checkmark-circle" size={22} color={C.neonBlue} />
                ) : (
                  <View style={styles.uncheckedCircle} />
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
  sectionLabel: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 20,
    marginRight: 4,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  preview: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  previewImage: {
    borderRadius: 12,
  },
  previewOverlay: {
    flex: 1,
    width: '100%',
  },
  rowContent: { flex: 1 },
  rowTitle: {
    color: C.white, fontSize: 15, fontWeight: '700', marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  rowDesc: { color: C.muted, fontSize: 12 },
  uncheckedCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: C.muted,
  },
});
