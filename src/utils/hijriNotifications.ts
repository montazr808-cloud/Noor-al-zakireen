// src/utils/hijriNotifications.ts
// جدولة إشعارات محلية للمناسبات الهجرية والأيام البيض (رجب/شعبان مميزة)
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import {
  arabicDigitsToNumber,
  getHijriParts,
  getOccasion,
  WHITE_DAY_NUMS,
  WHITE_DAY_SPECIAL_MONTHS,
} from './hijriOccasions';

const PREFS_KEY         = '@hijri_notif_prefs';
const SCHEDULED_IDS_KEY = '@hijri_notif_scheduled_ids';
const SCHEDULED_AT_KEY  = '@hijri_notif_scheduled_at';

// نجدول ١٨٠ يوم قدام بس (مو سنة كاملة) عشان ما نتجاوز حد iOS
// للإشعارات المحلية المجدولة بنفس الوقت (٦٤ إشعار كحد أقصى).
// refreshHijriNotificationsIfNeeded تجدد الجدولة تلقائياً كل ٦٠ يوم.
const DAYS_AHEAD  = 180;
const NOTIF_HOUR   = 8;
const NOTIF_MINUTE = 0;

export interface HijriNotifPrefs {
  occasions: boolean;
  whiteDays: boolean;
}

interface HijriEvent {
  date: Date;
  title: string;
  body: string;
  kind: 'occasion' | 'whiteday';
}

export async function getHijriNotifPrefs(): Promise<HijriNotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // تجاهل، نرجع القيم الافتراضية
  }
  return { occasions: false, whiteDays: false };
}

export async function setHijriNotifPrefs(prefs: HijriNotifPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export async function requestHijriNotificationPermissions(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

function buildEventsList(daysAhead: number): HijriEvent[] {
  const events: HijriEvent[] = [];
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const hijri = getHijriParts(d);
    if (!hijri.month || !hijri.day) continue;

    const notifDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), NOTIF_HOUR, NOTIF_MINUTE, 0);
    if (notifDate.getTime() <= Date.now()) continue;

    const occ = getOccasion(hijri.month, hijri.day);
    if (occ) {
      events.push({
        date: notifDate,
        title: occ.type === 'sorrow' ? '🕯️ ذكرى دينية' : '🌙 مناسبة دينية',
        body: occ.name,
        kind: 'occasion',
      });
      continue;
    }

    const dayNum = arabicDigitsToNumber(hijri.day);
    if (WHITE_DAY_NUMS.includes(dayNum)) {
      const isSpecial = WHITE_DAY_SPECIAL_MONTHS.includes(hijri.month);
      let body = 'اليوم من الأيام البيض - يستحب صيامه';
      if (isSpecial) {
        body = hijri.month === 'شعبان'
          ? 'اليوم من الأيام البيض بشهر شعبان المعظم - فضل عظيم لصيامه وقرباً من شهر رمضان'
          : 'اليوم من الأيام البيض بشهر رجب الأصب - من أفضل أيام الصيام المستحب';
      }
      events.push({
        date: notifDate,
        title: isSpecial ? `✨ أيام بيض ${hijri.month}` : '🌕 أيام بيض',
        body,
        kind: 'whiteday',
      });
    }
  }
  return events;
}

export async function cancelHijriNotifications(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULED_IDS_KEY);
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      for (const id of ids) {
        try { await Notifications.cancelScheduledNotificationAsync(id); } catch {
          // إشعار قد يكون انطلق أو انحذف مسبقاً، تجاهل
        }
      }
    }
  } catch {
    // تجاهل أخطاء القراءة
  }
  await AsyncStorage.removeItem(SCHEDULED_IDS_KEY);
  await AsyncStorage.removeItem(SCHEDULED_AT_KEY);
}

export async function scheduleHijriNotifications(prefs: HijriNotifPrefs): Promise<{ success: boolean; count: number }> {
  const granted = await requestHijriNotificationPermissions();
  if (!granted) return { success: false, count: 0 };

  await cancelHijriNotifications();

  if (!prefs.occasions && !prefs.whiteDays) {
    return { success: true, count: 0 };
  }

  const events = buildEventsList(DAYS_AHEAD).filter(
    (e) => (e.kind === 'occasion' && prefs.occasions) || (e.kind === 'whiteday' && prefs.whiteDays)
  );

  const ids: string[] = [];
  for (const ev of events) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: ev.title, body: ev.body, sound: true },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: ev.date,
        },
      });
      ids.push(id);
    } catch {
      // تجاهل فشل جدولة إشعار منفرد وكمل الباقي
    }
  }

  await AsyncStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(ids));
  await AsyncStorage.setItem(SCHEDULED_AT_KEY, new Date().toISOString());
  return { success: true, count: ids.length };
}

// تستدعى عند فتح شاشة التقويم: تجدد الجدولة تلقائياً كل ٦٠ يوم تقريباً
// حتى تبقى نافذة الـ ١٨٠ يوم مغطاة للمستقبل بدون تدخل يدوي من المستخدم
export async function refreshHijriNotificationsIfNeeded(prefs: HijriNotifPrefs): Promise<void> {
  if (!prefs.occasions && !prefs.whiteDays) return;
  try {
    const rawAt = await AsyncStorage.getItem(SCHEDULED_AT_KEY);
    if (!rawAt) {
      await scheduleHijriNotifications(prefs);
      return;
    }
    const lastScheduled = new Date(rawAt).getTime();
    const daysSince = (Date.now() - lastScheduled) / (1000 * 60 * 60 * 24);
    if (daysSince >= 60) {
      await scheduleHijriNotifications(prefs);
    }
  } catch {
    await scheduleHijriNotifications(prefs);
  }
}
