import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity } from 'react-native';

// ملاحظة مهمة: هذا الزر ما يفتح قائمة مدمجة جواه أبداً - يودّي مباشرة لصفحة
// /settings الحقيقية (app/settings/index.tsx). هذا مقصود: كان عندنا نسخة قديمة
// فيها قائمة كاملة مبنية هنا بستايل مختلف عن صفحة الإعدادات الحقيقية، وهذا كان
// يسبب إحساس "لغط" (تفتح قائمة، ترجع، تطلع على قائمة ثانية شكلها مختلف).
// هسه مصدر وحيد بس - هذا الزر وصفحة settings/index.tsx.
export default function GlassHamburgerMenu() {
  const router = useRouter();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/settings');
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.triggerBtn} activeOpacity={0.7}>
      <Ionicons name="menu" size={26} color="#fff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  triggerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ملاحظة مهمة: هذا الزر ما يفتح قائمة مدمجة جواه أبداً - يودّي مباشرة لصفحة
// /settings الحقيقية (app/settings/index.tsx). هذا مقصود: كان عندنا نسخة قديمة
// فيها قائمة كاملة مبنية هنا بستايل مختلف عن صفحة الإعدادات الحقيقية، وهذا كان
// يسبب إحساس "لغط" (تفتح قائمة، ترجع، تطلع على قائمة ثانية شكلها مختلف).
// هسه مصدر وحيد بس - هذا الزر وصفحة settings/index.tsx.