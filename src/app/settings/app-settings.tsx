import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactElement } from 'react';
import { ImageBackground, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

import PhoneFrameWrapper from '@/components/PhoneFrameWrapper';
import { useThemeContext } from '@/contexts/theme-contexts';
import { getSelectedBackground } from '@/utils/backgroundSettings';

// ===== باليت مطابقة لشاشة التسبيح =====
const C = {
  navy: '#1C2B39',
  cream: '#EFE3C8',
  blue: '#3FA9D9',
  blueDim: 'rgba(63,169,217,0.18)',
  neonBlue: '#57C8F2',
  white: '#FFFFFF',
  glass: 'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(255,255,255,0.22)',
  muted: 'rgba(255,255,255,0.5)',
};

const KEY = '@app_settings_v2';

export default function AppSettingsScreen() {
  const router = useRouter();
  const { backgroundId } = useThemeContext();
  const bgOption = getSelectedBackground(backgroundId);

  const [sound, setSound] = useState(true);
  const [vibration, setVibration] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [autoQuran, setAutoQuran] = useState(false);
  const [tajweed, setTajweed] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const saved = await AsyncStorage.getItem(KEY);
      if (saved) {
        const d = JSON.parse(saved);
        setSound(d.sound ?? true);
        setVibration(d.vibration ?? true);
        setNotifications(d.notifications ?? true);
        setAutoQuran(d.autoQuran ?? false);
        setTajweed(d.tajweed ?? true);
      }
    } catch (_) {}
  };

  const save = async (patch: object) => {
    try {
      const saved = await AsyncStorage.getItem(KEY);
      const current = saved ? JSON.parse(saved) : {};
      await AsyncStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
    } catch (_) {}
  };

  const clearData = async () => {
    await AsyncStorage.clear();
    router.replace('/');
  };

  const screenContent = (
    <SafeAreaView style={[styles.container, !bgOption.image && { backgroundColor: bgOption.color }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          {/* رجوع لمكان ثابت (قائمة الإعدادات) دايماً، بدل الاعتماد على تاريخ التنقل */}
          <TouchableOpacity onPress={() => router.replace('/settings')} style={styles.backBtn}>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>إعدادات التطبيق</Text>
          <View style={{ width: 32 }} />
        </View>

{/* الصوت والاهتزاز */}
        <Text style={styles.sectionLabel}>الصوت والاهتزاز</Text>
        <View style={styles.glassCard}>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(217,119,6,0.25)' }]}>
              <Ionicons name="volume-high" size={18} color="#f0b659" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>صوت التسبيح</Text>
              <Text style={styles.rowDesc}>تشغيل صوت عند كل عدة</Text>
            </View>
            <Switch value={sound} onValueChange={(v) => { setSound(v); save({ sound: v }); }}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: C.blue }} thumbColor={sound ? '#10b981' : '#94a3b8'} />
          </View>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(217,119,6,0.25)' }]}>
              <Ionicons name="phone-portrait" size={18} color="#f0b659" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>الاهتزاز</Text>
              <Text style={styles.rowDesc}>اهتزاز عند اكتمال الدورة</Text>
            </View>
            <Switch value={vibration} onValueChange={(v) => { setVibration(v); save({ vibration: v }); }}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: C.blue }} thumbColor={vibration ? '#10b981' : '#94a3b8'} />
          </View>
        </View>

        {/* الإشعارات */}
        <Text style={styles.sectionLabel}>الإشعارات</Text>
        <View style={styles.glassCard}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(220,38,38,0.25)' }]}>
              <Ionicons name="notifications" size={18} color="#f87171" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>تفعيل الإشعارات</Text>
              <Text style={styles.rowDesc}>تنبيهات يومية للأذكار والأدعية</Text>
            </View>
            <Switch value={notifications} onValueChange={(v) => { setNotifications(v); save({ notifications: v }); }}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: C.blue }} thumbColor={notifications ? '#10b981' : '#94a3b8'} />
          </View>
        </View>

        {/* القرآن الكريم */}
        <Text style={styles.sectionLabel}>القرآن الكريم</Text>
        <View style={styles.glassCard}>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(5,150,105,0.2)' }]}>
              <Ionicons name="color-palette" size={18} color="#6ee7b7" />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.titleRow}>
                <Text style={styles.rowTitle}>تلوين التجويد</Text>
                <View style={styles.soonBadge}><Text style={styles.soonText}>قريباً</Text></View>
              </View>
              <Text style={styles.rowDesc}>إظهار ألوان أحكام التجويد</Text>
            </View>
            <Switch value={tajweed} disabled
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(87,200,242,0.3)' }}
              thumbColor={'#5d7385'} />
          </View>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(5,150,105,0.2)' }]}>
              <Ionicons name="play-circle" size={18} color="#6ee7b7" />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.titleRow}>
                <Text style={styles.rowTitle}>تشغيل تلقائي</Text>
                <View style={styles.soonBadge}><Text style={styles.soonText}>قريباً</Text></View>
              </View>
              <Text style={styles.rowDesc}>تشغيل الصوت عند فتح السورة</Text>
            </View>
            <Switch value={autoQuran} disabled
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(87,200,242,0.3)' }}
              thumbColor={'#5d7385'} />
          </View>
        </View>

{/* الخصوصية */}
        <Text style={styles.sectionLabel}>الخصوصية والبيانات</Text>
        <View style={styles.glassCard}>
          <TouchableOpacity style={styles.row} onPress={clearData} activeOpacity={0.75}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(220,38,38,0.25)' }]}>
              <Ionicons name="trash" size={18} color="#f87171" />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: '#ef4444' }]}>مسح كل البيانات</Text>
              <Text style={styles.rowDesc}>يعيد التطبيق لإعداداته الافتراضية</Text>
            </View>
            <Ionicons name="chevron-back" size={18} color={C.muted} />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );

  // ===== إطار شكل الهاتف الموحّد =====
  const wrapInPhoneFrame = (node: ReactElement) => <PhoneFrameWrapper>{node}</PhoneFrameWrapper>;

  // ===== نفس منطق خلفية الصورة المستخدم بشاشة التسبيح =====
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
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
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
  iconBox: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  rowContent: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 2, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  rowDesc: { color: C.muted, fontSize: 12 },
  soonBadge: {
    backgroundColor: 'rgba(87,200,242,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(87,200,242,0.4)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  soonText: { color: C.neonBlue, fontSize: 10, fontWeight: '700' },
});
