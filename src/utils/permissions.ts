// ===== src/utils/permissions.ts =====
// ⚠️ إعادة تصميم شاشة onboarding (طلب صريح، "الصلاحيات تاخذ وقت طويل"):
// بدل ما الصلاحيات الثلاث هذي (الموقع، الإشعارات، المايكروفون) تنطلب كلها
// دفعة وحدة بأول فتحة تطبيق بدون سياق، هسه كل وحدة تنطلب "بلحظتها الطبيعية"
// - أول ما المستخدم يستخدم الميزة اللي تحتاجها فعلياً (يفتح شاشة أوقات
// الصلاة، يضغط زر المايك بالتسبيح، إلخ) - نسبة الموافقة أعلى بكثير لما
// المستخدم يفهم "ليش" بالضبط بنفس اللحظة. هذا الملف يلمّ منطق الطلب الفعلي
// بمكان وحيد، حتى كل شاشة تحتاجه تستورده بدل ما تكرر نفس الكود.
//
// شاشة onboarding (OnboardingPermissions.tsx) صارت مقتصرة بس على الصلاحيات
// اللي ماكو لها "لحظة طبيعية" بالتطبيق (فايدتها كلها بالخلفية): المنبه
// الدقيق، توفير الطاقة، الظهور فوق التطبيقات، والتشغيل التلقائي لبعض
// الشركات المصنّعة.

import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type PermissionRequestStatus = 'granted' | 'denied' | 'unsupported';

export async function requestLocationPermission(): Promise<PermissionRequestStatus> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export async function requestNotificationPermission(): Promise<PermissionRequestStatus> {
  if (Platform.OS !== 'android') return 'unsupported';
  try {
    // نفس مصدر الصلاحية الحقيقي اللي يتحكم بكل إشعارات notifee بالتطبيق -
    // مو expo-notifications (نظامين الصلاحية طلعوا مو متطابقين دايماً، نفس
    // الملاحظة الموثقة بملفات notificationScheduler.ts/hijriNotifications.ts)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const notifee = require('@notifee/react-native').default;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AuthorizationStatus } = require('@notifee/react-native');
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

// ⚠️ ملاحظة: ماكو دالة requestMicrophonePermission هنا - المايكروفون أصلاً
// يُطلب مباشرة جوه startListening() بـtasbih.tsx (عبر
// ExpoSpeechRecognitionModule.requestPermissionsAsync() مباشرة) بلحظة أول
// ضغطة على زر المايك - هذا صحيح ومطلوب، ما يحتاج تمريره عبر هذا الملف.