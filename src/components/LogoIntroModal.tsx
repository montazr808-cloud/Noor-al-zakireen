// src/components/LogoIntroModal.tsx
// يفتح لما المستخدم يضغط على شعار التطبيق بالهيدر: يشغّل فيديو قصير (٥ ثواني)
// وبعدها ينتقل بتلاشي ناعم (fade) لواجهة "حول التطبيق" بنفس تصميم الزجاج
// (glassmorphism) المستخدم بباقي التطبيق - تحتوي اسم التطبيق، وصف قصير،
// وأزرار التواصل الاجتماعي.
//
// ملاحظة مهمة: نستخدم expo-video (المكتبة الحديثة المعتمدة من Expo) وليس
// expo-av (قديمة ومهملة، وكانت سبب كراش فوري بالتطبيق سابقاً وانحذفت لهذا
// السبب بالضبط - راجع VideoSplash.tsx القديم المحذوف).

import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    Linking,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// نفس ألوان الثيم المستخدمة بباقي التطبيق (tasbih.tsx) - منسوخة هنا محلياً
// حتى يضل هذا المكوّن مستقل وقابل لإعادة الاستخدام بأي مكان
const C = {
  navy: '#1C2B39',
  cream: '#EFE3C8',
  neonBlue: '#57C8F2',
  neonGlow: 'rgba(87,200,242,0.55)',
  white: '#FFFFFF',
  glass: 'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(255,255,255,0.22)',
};

// ===== عدّل هذا القسم بمعلومات التطبيق الفعلية =====
const APP_NAME = 'نور الذاكرين';
const APP_DESCRIPTION =
  'رفيقك اليومي بالأذكار والأدعية وأوقات الصلاة - نور يضيء لحظاتك مع الله';

const SOCIAL_LINKS = [
  {
    key: 'instagram',
    label: 'انستغرام',
    icon: 'logo-instagram' as const,
    url: 'https://instagram.com/noor_alzakireen',
    color: '#E1306C',
  },
  {
    key: 'telegram',
    label: 'تيليگرام',
    icon: 'paper-plane' as const,
    url: 'https://t.me/noor_alzakireen',
    color: '#29A9EA',
  },
];

const VIDEO_DURATION_MS = 5000;

interface LogoIntroModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function LogoIntroModal({ visible, onClose }: LogoIntroModalProps) {
  const [stage, setStage] = useState<'video' | 'about'>('video');
  const videoOpacity = useRef(new Animated.Value(1)).current;
  const aboutOpacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // مصدر الفيديو - حط ملفك بهذا المسار بالضبط: src/assets/logo-intro.mp4
  const player = useVideoPlayer(require('../assets/logo-intro.mp4'), (p) => {
    p.loop = false;
    p.muted = false;
  });

  useEffect(() => {
    if (!visible) return;

    // نرجع لمرحلة الفيديو من الأول كل مرة تنفتح الواجهة
    setStage('video');
    videoOpacity.setValue(1);
    aboutOpacity.setValue(0);

    try {
      player.currentTime = 0;
      player.play();
    } catch {
      // تجاهل بهدوء لو الفيديو لسا ما تحمّل
    }

    timerRef.current = setTimeout(() => {
      // تلاشي متزامن: الفيديو يختفي وواجهة "حول التطبيق" تظهر بنفس اللحظة
      Animated.parallel([
        Animated.timing(videoOpacity, { toValue: 0, duration: 450, useNativeDriver: true }),
        Animated.timing(aboutOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]).start(() => {
        setStage('about');
        try { player.pause(); } catch {}
      });
    }, VIDEO_DURATION_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  const handleClose = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    try { player.pause(); } catch {}
    onClose();
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        {/* ===== طبقة الفيديو ===== */}
        <Animated.View
          pointerEvents={stage === 'video' ? 'auto' : 'none'}
          style={[StyleSheet.absoluteFill, { opacity: videoOpacity }]}
        >
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            nativeControls={false}
          />
        </Animated.View>

        {/* ===== طبقة "حول التطبيق" (تظهر بعد الفيديو) ===== */}
        <Animated.View
          pointerEvents={stage === 'about' ? 'auto' : 'none'}
          style={[StyleSheet.absoluteFill, { opacity: aboutOpacity }]}
        >
          <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.aboutContainer}>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={C.white} />
            </TouchableOpacity>

            <View style={styles.logoRing}>
              <Image
                source={require('../assets/logo.png')}
                style={styles.aboutLogoImage}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.appName}>{APP_NAME}</Text>
            <Text style={styles.appDescription}>{APP_DESCRIPTION}</Text>

            <View style={styles.socialRow}>
              {SOCIAL_LINKS.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => openLink(s.url)}
                  style={[styles.socialBtn, { borderColor: s.color }]}
                  activeOpacity={0.8}
                >
                  <Ionicons name={s.icon} size={20} color={s.color} />
                  <Text style={styles.socialLabel}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: C.navy,
  },
  aboutContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: C.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2.5,
    borderColor: C.neonBlue,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(87,200,242,0.10)',
    shadowColor: C.neonBlue,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    marginBottom: 22,
  },
  aboutLogoImage: {
    width: 60,
    height: 60,
  },
  appName: {
    fontSize: 26,
    fontWeight: '700',
    color: C.cream,
    marginBottom: 10,
    textAlign: 'center',
  },
  appDescription: {
    fontSize: 15,
    lineHeight: 24,
    color: 'rgba(239,227,200,0.75)',
    textAlign: 'center',
    marginBottom: 34,
    maxWidth: 300,
  },
  socialRow: {
    flexDirection: 'row-reverse',
    gap: 14,
  },
  socialBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: C.glass,
  },
  socialLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: C.white,
  },
});