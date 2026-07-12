// src/components/PhoneFrameWrapper.tsx
import { type ReactElement } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

// ===== مصدر واحد لحساب حجم إطار الهاتف بالويب =====
// كل الشاشات (تسبيح، أدعية، أذكار...) تستخدم هذا المكوّن بدل ما توّحد حسابها بكل ملف لحالها
// هذا يضمن نفس الحجم بالضبط بكل الشاشات دايماً

const OUTER_PADDING = 16; // paddingVertical لكل جهة
const MAX_FRAME_HEIGHT = 890;
const MAX_FRAME_WIDTH  = 412;
const SAFETY_MARGIN    = 12;

export function usePhoneFrameSize() {
  const { width, height } = useWindowDimensions();
  const isWideScreen = Platform.OS === 'web' && width > 800;

  const framePadding = OUTER_PADDING * 2 + SAFETY_MARGIN;
  const frameHeight = Math.max(420, Math.min(MAX_FRAME_HEIGHT, height - framePadding));
  const frameWidth  = Math.min(MAX_FRAME_WIDTH, frameHeight * 0.46);

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
