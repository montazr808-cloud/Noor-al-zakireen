import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      {/*
        ⚠️ تعديل: "index" (قائمة الإعدادات الرئيسية) عندها حركة دخول مخصصة
        بالملف نفسه (Animated.timing يسحب الورقة من جهة زر ☰ لإحساس "طلعت
        من الزر"). بدون animation:'none' هنا، الـ Stack الأصلي من expo-router
        يسوي بنفس الوقت انتقال أصلي (native slide) فوگ الحركة المخصصة -
        الاثنين يشتغلون سوا ويتضاربون، وهذا بالضبط سبب الإحساس بعدم السلاسة/
        الارتجاج. نعطّل الانتقال الأصلي بس لهذي الشاشة تحديداً (باقي شاشات
        الإعدادات الفرعية - قبلة، مرجع، تقويم... - تحتفظ بانتقالها الأصلي
        العادي زي ما هو، لأنها ما عندها حركة مخصصة خاصة فيها).
      */}
      <Stack.Screen name="index" options={{ animation: 'none' }} />
    </Stack>
  );
}