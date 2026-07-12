import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type SettingItem = {
  id: string;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
};

const SETTINGS: SettingItem[] = [
  { id: 'marja',        title: 'المرجع الديني',    desc: 'اختر مرجعك الفقهي',              icon: 'book',                color: '#c8a84b', route: '/settings/marja' },
  { id: 'background',   title: 'الخلفيات',         desc: 'خلفية التطبيق',                  icon: 'image',               color: '#7c3aed', route: '/settings/background' },
  { id: 'appearance',   title: 'المظهر',           desc: 'الوضع الليلي وحجم الخط',        icon: 'moon',                color: '#2563eb', route: '/settings/appearance' },
  { id: 'app-settings', title: 'إعدادات التطبيق',  desc: 'الصوت والإشعارات واللغة',       icon: 'settings',            color: '#0891b2', route: '/settings/app-settings' },
  { id: 'rate',         title: 'التقييم والمشاركة',desc: 'قيّم التطبيق وشاركه مع أصدقائك',icon: 'star',                color: '#d97706', route: '/settings/rate' },
  { id: 'contact',      title: 'تواصل معنا',       desc: 'إنستغرام وتيليغرام',            icon: 'chatbubble-ellipses', color: '#db2777', route: '/settings/contact' },
  { id: 'support',      title: 'ادعمنا',           desc: 'زين كاش وماستر كارد',           icon: 'heart',               color: '#10b981', route: '/settings/support' },
  { id: 'privacy',      title: 'سياسة الخصوصية',   desc: 'اطلع على سياسة الخصوصية',      icon: 'shield-checkmark',    color: '#64748b', route: '/privacy-policy' },
  { id: 'about',        title: 'حول التطبيق',      desc: 'الإصدار والمطور',               icon: 'information-circle',  color: '#3b82f6', route: '/settings/about' },
];

export default function SettingsIndexScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* الهيدر */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>الإعدادات</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* البطاقة الزجاجية */}
        <View style={styles.glassCard}>
          <BlurView intensity={40} tint="dark" style={styles.blurFill}>
            <View style={styles.glassOverlay} />
            {SETTINGS.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.row, index < SETTINGS.length - 1 && styles.rowBorder]}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: item.color + '33' }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowDesc}>{item.desc}</Text>
                </View>
                <Ionicons name="chevron-back" size={17} color="rgba(255,255,255,0.28)" />
              </TouchableOpacity>
            ))}
          </BlurView>
        </View>

        <Text style={styles.version}>نور الذاكرين • الإصدار 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1f2d',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    marginBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '800',
  },
  glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  blurFill: {
    overflow: 'hidden',
  },
  glassOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10,22,38,0.52)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContent: { flex: 1 },
  rowTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 2,
  },
  rowDesc: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 11,
    textAlign: 'right',
  },
  version: {
    color: 'rgba(255,255,255,0.15)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 30,
  },
});
