// ===== app/settings/notification-diagnostics.tsx =====
// شاشة تشخيص مؤقتة: تشغّل كل فحوصات نظام الإشعارات مباشرة على الجهاز وتعرض
// النتائج كنص عادي بالشاشة - بدون أي حاجة لـ adb أو Metro. الهدف: نوقف
// التخمين ونشوف بالضبط وين يفشل (صلاحية؟ جدولة؟ استثناء صريح؟).
//
// استخدمها: افتح هذي الشاشة، دوس "شغّل كل الفحوصات"، انتظر لين تخلص، صوّر
// الشاشة كاملة وابعثها.

import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotificationDiagnosticsScreen() {
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const addLine = (line: string) => setLog((prev) => [...prev, line]);

  const runDiagnostics = async () => {
    setLog([]);
    setRunning(true);
    addLine(`بدأ الفحص - ${new Date().toLocaleTimeString('ar')}`);

    // ===== ١. صلاحية الموقع =====
    try {
      const Location = await import('expo-location');
      const loc = await Location.getForegroundPermissionsAsync();
      addLine(`📍 صلاحية الموقع: ${loc.status}`);
    } catch (e: any) {
      addLine(`📍 خطأ بفحص صلاحية الموقع: ${e?.message ?? String(e)}`);
    }

    // ===== ٢. صلاحية الإشعارات =====
    try {
      const Notifications = await import('expo-notifications');
      const n = await Notifications.getPermissionsAsync();
      addLine(`🔔 صلاحية الإشعارات: ${n.status}`);
    } catch (e: any) {
      addLine(`🔔 خطأ بفحص صلاحية الإشعارات: ${e?.message ?? String(e)}`);
    }

    // ===== ٣. هل notifee مركبة وتشتغل =====
    let notifee: any = null;
    try {
      notifee = (await import('@notifee/react-native')).default;
      addLine(`✅ notifee متوفرة`);
      try {
        const settings = await notifee.getNotificationSettings();
        addLine(`   حالة إشعارات notifee: ${JSON.stringify(settings)}`);
      } catch (e: any) {
        addLine(`   ⚠️ فشل getNotificationSettings: ${e?.message ?? String(e)}`);
      }
    } catch (e: any) {
      addLine(`❌ notifee غير متوفرة أو فشل تحميلها: ${e?.message ?? String(e)}`);
    }

    // ===== ٤. الموقع الفعلي (نحتاجه لحساب أوقات الصلاة) =====
    let coords: { latitude: number; longitude: number } | null = null;
    try {
      const Location = await import('expo-location');
      const status = await Location.getForegroundPermissionsAsync();
      if (status.status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({});
        coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        addLine(`📍 الموقع الفعلي: ${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`);
      } else {
        addLine(`📍 ما أقدر أجيب الموقع - الصلاحية مو ممنوحة`);
      }
    } catch (e: any) {
      addLine(`📍 خطأ بجلب الموقع: ${e?.message ?? String(e)}`);
    }

    // ===== ٥. حساب أوقات الصلاة =====
    let times: any = null;
    if (coords) {
      try {
        const { getPrayerTimes } = await import('@/utils/prayerCalc');
        times = getPrayerTimes(coords.latitude, coords.longitude);
        addLine(`🕌 أوقات الصلاة: ${JSON.stringify(times)}`);
      } catch (e: any) {
        addLine(`🕌 ❌ فشل حساب أوقات الصلاة: ${e?.message ?? String(e)}`);
      }
    }

    // ===== ٦. تشغيل initializeAppNotifications فعلياً ونشوف النتيجة =====
    try {
      const { initializeAppNotifications } = await import('@/utils/notifications');
      const result = await initializeAppNotifications();
      addLine(`📊 نتيجة الجدولة الكاملة: ${JSON.stringify(result)}`);
    } catch (e: any) {
      addLine(`❌ initializeAppNotifications رمت استثناء: ${e?.message ?? String(e)}`);
      addLine(`   التفاصيل: ${e?.stack ?? 'ماكو stack'}`);
    }

    // ===== ٧. كم إشعار notifee مجدول فعلياً هسة =====
    if (notifee) {
      try {
        const triggers = await notifee.getTriggerNotificationIds();
        addLine(`📋 عدد الإشعارات المجدولة فعلياً بـnotifee: ${triggers.length}`);
        if (triggers.length > 0) {
          addLine(`   المعرفات: ${triggers.slice(0, 10).join(', ')}${triggers.length > 10 ? '...' : ''}`);
        }
      } catch (e: any) {
        addLine(`❌ فشل getTriggerNotificationIds: ${e?.message ?? String(e)}`);
      }

      try {
        const channels = await notifee.getChannels();
        addLine(`📡 القنوات المسجلة: ${channels.map((c: any) => c.id).join(', ')}`);
      } catch (e: any) {
        addLine(`❌ فشل getChannels: ${e?.message ?? String(e)}`);
      }
    }

    addLine(`انتهى الفحص - ${new Date().toLocaleTimeString('ar')}`);
    setRunning(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>تشخيص الإشعارات</Text>
        <View style={{ width: 50 }} />
      </View>

      <TouchableOpacity
        style={[styles.runButton, running && { opacity: 0.5 }]}
        onPress={runDiagnostics}
        disabled={running}
      >
        <Text style={styles.runButtonText}>{running ? 'جاري الفحص...' : 'شغّل كل الفحوصات'}</Text>
      </TouchableOpacity>

      <ScrollView style={styles.logBox} contentContainerStyle={{ padding: 12 }}>
        {log.length === 0 ? (
          <Text style={styles.placeholder}>دوس "شغّل كل الفحوصات" واصبر لين تخلص، وبعدها صوّر الشاشة كاملة</Text>
        ) : (
          log.map((line, i) => (
            <Text key={i} style={styles.logLine} selectable>
              {line}
            </Text>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a2540' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backText: { color: '#4da8da', fontSize: 15 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  runButton: {
    backgroundColor: '#4da8da',
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  runButtonText: { color: '#0a2540', fontWeight: '700', fontSize: 15 },
  logBox: {
    flex: 1,
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  placeholder: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', marginTop: 20 },
  logLine: {
    color: '#fff',
    fontSize: 12,
    marginBottom: 8,
    fontFamily: Platform_select(),
  },
});

function Platform_select() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Platform } = require('react-native');
  return Platform.OS === 'android' ? 'monospace' : 'Menlo';
}
