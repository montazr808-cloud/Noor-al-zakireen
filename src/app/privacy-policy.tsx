import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type ReactElement } from 'react';
import { ImageBackground, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import PhoneFrameWrapper from '@/components/PhoneFrameWrapper';
import { useThemeContext } from '@/contexts/theme-contexts';
import { getSelectedBackground } from '@/utils/backgroundSettings';

// ===== باليت مطابقة لشاشة التسبيح =====
const C = {
  neonBlue: '#57C8F2',
  white: '#FFFFFF',
  glass: 'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(255,255,255,0.22)',
  muted: 'rgba(255,255,255,0.6)',
};

// كل قسم عنده أيقونة ولون مميز - يسهّل تصفح النص الطويل بسرعة
const SECTIONS = [
  {
    title: '1. مقدمة',
    icon: 'information-circle',
    color: '#3b82f6',
    body:
      'يحترم تطبيق "نور الذاكرين" خصوصية مستخدميه. توضح هذه السياسة طبيعة البيانات التي يتعامل معها التطبيق وكيفية استخدامها. استخدامك للتطبيق يعني موافقتك على بنود هذه السياسة.',
  },
  {
    title: '2. البيانات المخزّنة محلياً',
    icon: 'save',
    color: '#7c3aed',
    body:
      'يحفظ التطبيق بيانات استخدامك (مثل عدّاد التسبيح، تقدّمك بالأذكار، المرجع الديني المختار، وتفضيلات المظهر) بشكل محلي على جهازك فقط، باستخدام مساحة تخزين الجهاز. نحن لا نجمع هذه البيانات على خوادمنا ولا نشاركها مع أي طرف ثالث.',
  },
  {
    title: '3. صلاحيات الجهاز',
    icon: 'options',
    color: '#0ea5e9',
    body:
      'قد يطلب التطبيق صلاحية الوصول للمايكروفون (لميزة التسبيح الصوتي) وصلاحية تحديد الموقع (لحساب أوقات الصلاة واتجاه القبلة بدقة). تُستخدم هذه الصلاحيات فقط لتشغيل الميزة المرتبطة بها داخل جهازك، ولا تُرسل أو تُخزَّن خارجه. يمكنك رفض أو سحب أي صلاحية بأي وقت من إعدادات جهازك دون التأثير على باقي ميزات التطبيق.',
  },
  {
    title: '4. حذف بياناتك',
    icon: 'trash',
    color: '#dc2626',
    body:
      'تقدر تمسح كل بياناتك المحفوظة محلياً بأي وقت من مسار: الإعدادات ← إعدادات التطبيق ← مسح كل البيانات. هذا الإجراء يعيد التطبيق لإعداداته الافتراضية بشكل كامل ونهائي.',
  },
  {
    title: '5. ميزة "المجيب" (الذكاء الاصطناعي)',
    icon: 'chatbubble-ellipses',
    color: '#0d9488',
    body:
      'عند استخدامك لميزة "المجيب" للأسئلة الدينية، يتم إرسال نص سؤالك إلى مزوّد خدمة ذكاء اصطناعي خارجي لمعالجته وتوليد الإجابة. لا يتم إرسال أي معلومات تعريفية شخصية عنك (مثل اسمك أو رقمك) مع السؤال. ننصح بعدم كتابة معلومات حساسة أو شخصية ضمن نص سؤالك.',
  },
  {
    title: '6. إخلاء مسؤولية ديني',
    icon: 'book',
    color: '#c8a84b',
    body:
      'إجابات "المجيب" مولّدة بواسطة الذكاء الاصطناعي بالاستناد إلى فتاوى المرجع المختار، وهي وسيلة مساعدة واسترشاد فقط، ولا تُعتبر بديلاً عن الرجوع المباشر لمكتب المرجع الديني المعتمد في المسائل الدقيقة أو المصيرية. يقع على المستخدم التحقق من المسائل المهمة مباشرة من مصادرها الرسمية.',
  },
  {
    title: '7. الإشعارات',
    icon: 'notifications',
    color: '#db2777',
    body:
      'إذا فعّلت الإشعارات، يستخدمها التطبيق فقط لتذكيرك بالأذكار أو الأدعية، ولا تُستخدم لأي غرض تسويقي أو لجمع بيانات.',
  },
  {
    title: '8. عدم وجود إعلانات أو تتبّع',
    icon: 'shield-checkmark',
    color: '#64748b',
    body:
      'لا يحتوي هذا التطبيق على إعلانات، ولا يقوم بتتبّع نشاطك لغرض التسويق أو بيع البيانات لأي طرف ثالث.',
  },
  {
    title: '9. خصوصية الأطفال',
    icon: 'happy',
    color: '#10b981',
    body:
      'لا يستهدف هذا التطبيق جمع بيانات من الأطفال عمداً. المحتوى ديني تعليمي عام مناسب لجميع الأعمار.',
  },
  {
    title: '10. التغييرات على السياسة',
    icon: 'time',
    color: '#9333ea',
    body:
      'قد تُحدَّث هذه السياسة من وقت لآخر لمواكبة أي تطوير بميزات التطبيق. يُنصح بمراجعتها بشكل دوري.',
  },
  {
    title: '11. التواصل',
    icon: 'mail',
    color: '#2563eb',
    body:
      'لأي استفسار يخص هذه السياسة أو خصوصيتك، يمكنك التواصل معنا عبر صفحتنا على إنستغرام من قسم "تواصل معنا" بالتطبيق.',
  },
];

export default function PrivacyPolicyScreen() {
  const { backgroundId } = useThemeContext();
  const bgOption = getSelectedBackground(backgroundId);

  const screenContent = (
    <SafeAreaView style={[styles.container, !bgOption.image && { backgroundColor: bgOption.color }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/settings')} style={styles.backBtn}>
            <Ionicons name="chevron-forward" size={22} color={C.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>سياسة الخصوصية</Text>
          <View style={{ width: 34 }} />
        </View>

        <Text style={styles.updatedAt}>آخر تحديث: 2026</Text>

        {SECTIONS.map((s, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: s.color }]}>
                <Ionicons name={s.icon as any} size={17} color="#fff" />
              </View>
              <Text style={styles.sectionTitle}>{s.title}</Text>
            </View>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}

        <Text style={styles.footer}>نور الذاكرين © 2026</Text>

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
          {/* تعتيم أقوى من باقي الشاشات - هذا نص طويل يحتاج راحة أكبر للعين وقت القراءة */}
          <View style={[styles.bgOverlay, { opacity: Math.min(bgOption.overlayOpacity + 0.25, 0.85) }]} />
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

  updatedAt: { color: C.muted, fontSize: 12, textAlign: 'center', marginBottom: 16 },

  // كارد أغمق وأعلى تباين من باقي شاشات الإعدادات - عمداً، لأن هذا نص طويل يحتاج راحة قراءة
  card: {
    backgroundColor: 'rgba(8,16,26,0.62)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  iconBox: { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: {
    color: C.white, fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  sectionBody: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 24, textAlign: 'right' },

  footer: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 16 },
});
