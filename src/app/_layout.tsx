import { ThemeProvider } from '@/contexts/theme-contexts';
import { registerAzanForegroundService } from '@/utils/notifeeAzan';
import { registerBackgroundNotificationHandlers } from '@/utils/notifications';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { ColorValue, LogBox, Platform, StyleSheet } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

LogBox.ignoreAllLogs(true);

registerBackgroundNotificationHandlers();

// ⚠️ الإصلاح الجوهري لبگ "الأذان ميوصل": notifee.registerForegroundService
// لازم ينسجل هنا - بمستوى الملف مباشرة، خارج أي مكوّن/useEffect - حتى يشتغل
// حتى لو التطبيق انفتح من حالة مقفولة تماماً بسبب تنبيه الأذان نفسه (Android
// يشغّل جافاسكربت التطبيق من الصفر بهاي الحالة، فلازم التسجيل يصير أول شي
// وقت تحميل الملف، مو بعد أول render). كانت هذي الدالة معرّفة بـ
// notifeeAzan.ts من قبل بس ما كانت تنجذب من وين - عشان هيك أندرويد كان يطلع
// إشعاره العام الافتراضي ("قيد التشغيل") بدل تنبيه الأذان الفعلي (صوت + زر
// إيقاف)، لأن notifee ما كان يعرف شنو يشغّل لما توصل لحظة تشغيل الخدمة
registerAzanForegroundService();

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

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const dayId = response.notification.request.content.data?.dayId as string | undefined;

      if (dayId) {
        router.push({
          pathname: '/athkar',
          params: { dayId },
        } as any);
      }
    });

    return () => sub.remove();
  }, []);

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

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <TabsNavigator />
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