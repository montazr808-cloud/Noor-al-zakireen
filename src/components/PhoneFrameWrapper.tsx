// src/components/PhoneFrameWrapper.tsx
import { type ReactElement } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

// ===== مصدر واحد لحساب حجم إطار الهاتف بالويب =====
// كل الشاشات (تسبيح، أدعية، أذكار...) تستخدم هذا المكوّن بدل ما توّحد حسابها بكل ملف لحالها
// هذا يضمن نفس الحجم بالضبط بكل الشاشات دايماً

const OUTER_PADDING = 16; // paddingVertical لكل جهة
const SAFETY_MARGIN    = 12;

export function usePhoneFrameSize() {
  const { width, height } = useWindowDimensions();
  const isWideScreen = Platform.OS === 'web' && width > 800;

  // على الشاشات الكبيرة جداً (2K/4K) نكبّر الحد الأقصى تدريجياً
  // حتى لا يبين إطار الهاتف صغير زيادة وسط مساحة فاضية كبيرة
  const maxFrameHeight = width >= 1600 ? 1000 : width >= 1200 ? 940 : 890;
  const maxFrameWidth  = width >= 1600 ? 460  : width >= 1200 ? 430 : 412;

  const framePadding = OUTER_PADDING * 2 + SAFETY_MARGIN;
  const frameHeight = Math.max(420, Math.min(maxFrameHeight, height - framePadding));
  const frameWidth  = Math.min(maxFrameWidth, frameHeight * 0.46);

  return { isWideScreen, frameWidth, frameHeight };
}

export default function PhoneFrameWrapper({ children }: { children: ReactElement }) {
  const { isWideScreen, frameWidth, frameHeight } = usePhoneFrameSize();

  if (!isWideScreen) return children;

  return (
    <View style={styles.webOuter}>
      <View style={[styles.phoneFrame, { width: frameWidth, height: frameHeight }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webOuter: {
    flex: 1,
    backgroundColor: '#0b0f14',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: OUTER_PADDING,
  },
  phoneFrame: {
    borderRadius: 38,
    overflow: 'hidden',
    borderWidth: 6,
    borderColor: '#15191f',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 20,
  },
});
