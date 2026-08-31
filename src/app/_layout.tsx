import OnboardingPermissions, { ONBOARDING_DONE_KEY } from '@/components/OnboardingPermissions';
import { ThemeProvider } from '@/contexts/theme-contexts';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { useFonts } from 'expo-font';
import { router, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { ColorValue, LogBox, Platform, StyleSheet } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

LogBox.ignoreAllLogs(true);

// ⚠️ إصلاح (٢٠٢٦-٠٨-٢٩): registerAzanForegroundService() و
// registerBackgroundNotificationHandlers() (اللي تنادي نفس الدالة زائد
// registerAllNotificationEventListeners()) كانوا يتسجلون هنا بمستوى الملف
// *بالإضافة* لتسجيلهم أصلاً بـindex.js. notifee موثّق رسمياً إن تسجيل
// onForegroundEvent/onBackgroundEvent أكثر من مرة بكل التطبيق يخلي بس آخر
// تسجيل يشتغل فعلياً والباقي ينمسح بصمت - يعني كان عندنا تسجيلين يتصارعون
// على نفس الدور بدون أي خطأ واضح بالكونسول يفسر السبب. الحل: التسجيل يصير
// بمكان وحيد بس (index.js، نقطة الدخول الحقيقية وأول ملف ينفذ، حتى قبل
// _layout.tsx - هذا مطابق تماماً لتوثيق notifee نفسه لمتطلب الـforeground
// service). ما نحتاج نكرره هنا إطلاقاً.

// ⚠️ تم حذف السبلاش سكرين عمداً (طلب صريح): ما نستدعي preventAutoHideAsync
// ولا نتحكم يدوياً بإخفاء الشاشة الأصلية - نتركها تختفي تلقائياً بأسرع وقت
// ممكن (افتراضي Expo/React Navigation) بمجرد ما أول إطار يترسم، بدل ما ننتظر
// تحميل الخطوط. يعني التطبيق يفتح مباشرة بدون أي شاشة انتقالية مخصصة.

function GlassTabBarBackground() {
  return (
    <BlurView
      intensity={Platform.OS === 'ios' ? 80 : 100}
      tint="dark"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.22)',
          overflow: 'hidden',
        },
      ]}
    />
  );
}

function GuideIcon({
  size,
  color,
  focused,
}: {
  size: number;
  color: ColorValue;
  focused: boolean;
}) {
  return (
    <Ionicons
      name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'}
      size={size}
      color={color as string}
    />
  );
}

export default function Layout() {
  const [, fontError] = useFonts({
    'Amiri-Regular': require('../assets/fonts/Amiri-Regular.ttf'),
    'Amiri-Bold': require('../assets/fonts/Amiri-Bold.ttf'),
    UthmanicHafs: require('../assets/fonts/UthmanicHafs.ttf'),
  });

  useEffect(() => {
    if (fontError) {
      console.error('[Layout] فشل تحميل الخطوط:', fontError);
    }
  }, [fontError]);

  // ⚠️ إصلاح (٢٠٢٦-٠٨-٢٩): كان هنا معالج ضغطة إشعار عبر
  // Notifications.addNotificationResponseReceivedListener من مكتبة
  // expo-notifications القديمة - نظام مهجور بالكامل من زمان، كل الإشعارات
  // الحالية (أذكار/أذان/آيات/مناسبات) تمر عبر notifee ونقطة التسجيل
  // المركزية notificationEvents.ts (المسجّلة بـindex.js). هذا المعالج هنا
  // ما كان ينادى إطلاقاً لأي إشعار حقيقي بالتطبيق - كود ميت يسبب لبس بس،
  // انحذف بالكامل.

  useEffect(() => {
    import('@/utils/notifications').then(({ initializeAppNotifications }) => {
      initializeAppNotifications().catch(() => {});
    });
  }, []);

  useEffect(() => {
    import('@/utils/hijriSync').then(({ loadCachedOffset, syncNajafOffset }) => {
      loadCachedOffset().then(() => {
        syncNajafOffset().catch(() => {});
      });
    });
  }, []);

  // ⚠️ إصلاح ("الزرين يبقون صافنين"): لما المستخدم يضغط زر بإشعار "الصلاة
  // القادمة" (أوقات الصلاة/التسبيح) والتطبيق مقفول أو بالخلفية، notifee
  // يعالج الحدث بسياق JavaScript منفصل (Headless) عن التطبيق الفعلي، فأي
  // router.push() هناك يروح بالفراغ. الحل: nextPrayerNotification.ts يخزن
  // الوجهة المطلوبة بـAsyncStorage وقت الضغطة، وهنا - بعد ما يكتمل تحميل
  // التطبيق فعلياً - نتحقق من هذا المخزن وننفذ التنقل الحقيقي.
  useEffect(() => {
    import('@/utils/nextPrayerNotification').then(({ consumePendingNextPrayerNavigation }) => {
      consumePendingNextPrayerNavigation().then((path) => {
        if (path) router.push(path as any);
      });
    });
  }, []);

  // ===== شاشة الترحيب/الصلاحيات - تطلع مرة وحدة بس بأول فتحة تطبيق =====
  // null = لسا نتحقق من AsyncStorage (نتجنب "ومضة" نعرض فيها التبويبات
  // لحظة وحدة قبل ما نعرف الحالة الحقيقية)؛ false = لازم تطلع؛ true = خلص
  // منها قبل، نروح مباشرة للتطبيق
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_DONE_KEY)
      .then((v) => setOnboardingDone(v === 'true'))
      .catch(() => setOnboardingDone(true)); // فشل القراءة - ما نحبس المستخدم، نكمل عادي
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {onboardingDone === false ? (
          <OnboardingPermissions onDone={() => setOnboardingDone(true)} />
        ) : onboardingDone === null ? null : (
          <TabsNavigator />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function TabsNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopColor: 'transparent',
          borderTopWidth: 0,
          height: 65 + Math.max(insets.bottom, 12),
          paddingBottom: 8 + Math.max(insets.bottom, 12),
          paddingTop: 5,
          elevation: 0,
          ...(Platform.OS === 'web'
            ? { backdropFilter: 'blur(14px)' } as any
            : {}),
        },
        tabBarBackground: () => <GlassTabBarBackground />,
        tabBarActiveTintColor: '#4da8da',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.55)',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="tasbih"
        options={{
          title: 'التسبيح',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="filter-circle-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="adiyah"
        options={{
          title: 'الأدعية',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="athkar"
        options={{
          title: 'الأذكار',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="moon-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="quran"
        options={{
          title: 'المصحف',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="dalil-almutaqeen"
        options={{
          title: 'دليل المتقين',
          tabBarIcon: ({ color, size, focused }) => (
            <GuideIcon size={size} color={color} focused={focused} />
          ),
        }}
      />

      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="more" options={{ href: null }} />
    </Tabs>
  );
}