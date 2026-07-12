import { ThemeProvider } from '@/contexts/theme-contexts';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { LogBox, Platform, StyleSheet, View } from 'react-native';

LogBox.ignoreAllLogs(true);

// خلفية شريط التابات - زجاجية شبه شفافة (هدف ١)
// تخلي الشريط يبدو جزءاً من نفس خلفية الشاشة مب طبقة منفصلة فوقها
function GlassTabBarBackground() {
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          // نفس درجة الزجاج المستخدمة بدائرة التسبيح بالضبط
          backgroundColor: 'rgba(255,255,255,0.10)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.22)',
        },
      ]}
    />
  );
}

export default function Layout() {
  return (
    <ThemeProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          // الشريط يصير عائم وشفاف فوق خلفية الشاشة نفسها بدل ما يكون شريط منفصل (هدف ١)
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: 'transparent',
            borderTopColor: 'transparent',
            borderTopWidth: 0,
            height: 65,
            paddingBottom: 8,
            paddingTop: 5,
            elevation: 0,
            ...(Platform.OS === 'web' ? { backdropFilter: 'blur(14px)' } as any : {}),
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
        {/* ===== التابز الظاهرة ===== */}
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
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="shield-checkmark-outline" size={size} color={color} />
            ),
          }}
        />

        {/* ===== مخفية من التاب بار ===== */}
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="calendar" options={{ href: null }} />
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="surah/[id]" options={{ href: null }} />
        <Tabs.Screen name="api/more" options={{ href: null }} />
        <Tabs.Screen name="privacy-policy" options={{ href: null }} />
        <Tabs.Screen name="styles" options={{ href: null }} />
        <Tabs.Screen name="more" options={{ href: null }} />
<Tabs.Screen name="api/askSheikh" options={{ href: null }} />
      </Tabs>
    </ThemeProvider>
  );
}
