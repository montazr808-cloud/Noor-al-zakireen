// src/utils/hijriNotifications.ts
// جدولة إشعارات محلية للمناسبات الهجرية والأيام البيض (رجب/شعبان مميزة)
// نسخة notifee: نفس المنطق السابق بالكامل، بس البناء والجدولة الفعلية صارت
// عبر notifee حتى نگدر نتحكم بالشكل (لون، أيقونة كبيرة، colorized) بدل
// الشكل الافتراضي المحدود لـ expo-notifications. الدوال المصدّرة وتوقيعاتها
// نفسها بالضبط عشان ما ينكسر أي استدعاء بملفات ثانية.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  arabicDigitsToNumber,
  getAllOccasions,
  getHijriParts,
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
// توقيت الأيام البيض: إشعار واحد بصبيحة اليوم السابق ("غداً هو اليوم الأول...")
const WHITEDAY_NOTIF_HOUR   = 8;
const WHITEDAY_NOTIF_MINUTE = 0;

// توقيت المناسبات: إشعار واحد بنفس يوم المناسبة - الساعة ٩ص، بمسافة ساعة
// عن إشعار الآية اليومية وإشعار الأيام البيض (كلاهما ٨ص) حتى ما يتزاحمون
const OCCASION_NOTIF_HOUR   = 9;
const OCCASION_NOTIF_MINUTE = 0;

// ترتيب لفظي للأيام البيض حسب موقعها بمصفوفة WHITE_DAY_NUMS (عادة ١٣/١٤/١٥)
const WHITE_DAY_ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'];

// نفس أسلوب notifeeAzan.ts / nextPrayerNotification.ts - استيراد ديناميكي
// حتى الملف ما يكسر شي قبل تنصيب @notifee/react-native + rebuild
function getNotifee() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@notifee/react-native').default as typeof import('@notifee/react-native').default;
}
function getNotifeeTypes() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@notifee/react-native') as typeof import('@notifee/react-native');
}

const CHANNEL_ID = 'hijri-occasions';

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  const notifee = getNotifee();
  const { AndroidImportance } = getNotifeeTypes();
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'المناسبات الهجرية والأيام البيض',
    importance: AndroidImportance.DEFAULT,
  });
}

export interface HijriNotifPrefs {
  occasions: boolean;
  whiteDays: boolean;
}

type HijriEventKind = 'occasion-joy' | 'occasion-sorrow' | 'whiteday' | 'whiteday-special';

interface HijriEvent {
  date: Date;
  title: string;
  body: string;
  kind: 'occasion' | 'whiteday'; // نفس التصنيف القديم، يستخدم بفلترة prefs
  visualKind: HijriEventKind;    // تصنيف أدق يحدد اللون/الأيقونة
}

// ألوان مخصصة لكل نوع حدث (نفس مبدأ colorized بـ nextPrayerNotification.ts)
const EVENT_COLORS: Record<HijriEventKind, string> = {
  'occasion-sorrow':  '#5B3E8E', // بنفسجي غامق - ذكرى حزينة
  'occasion-joy':     '#1E8A5F', // أخضر ذهبي - مناسبة فرح
  'whiteday-special':  '#B8860B', // ذهبي - أيام بيض رجب/شعبان
  'whiteday':          '#2E6DA4', // أزرق فاتح - أيام بيض عادية
};

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

    // ===== المناسبات: إشعار واحد بنفس يوم المناسبة =====
    // نجيب كل مناسبات هذا اليوم (يمديها تكون أكثر من وحدة، مثل ٧ صفر اللي فيه
    // مولد الإمام الكاظم + رواية وفاة الإمام الحسن بنفس اليوم) - إشعار منفصل
    // لكل مناسبة حتى ما تضيع ولا وحدة منهن
    const occs = getAllOccasions(hijri.month, hijri.day);
    if (occs.length > 0) {
      for (const occ of occs) {
        const isSorrow = occ.type === 'sorrow';
        const visualKind: HijriEventKind = isSorrow ? 'occasion-sorrow' : 'occasion-joy';
        const label = isSorrow ? 'ذكرى دينية' : 'مناسبة دينية';

        const notifDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), OCCASION_NOTIF_HOUR, OCCASION_NOTIF_MINUTE, 0);
        if (notifDate.getTime() <= Date.now()) continue;

        events.push({
          date: notifDate,
          title: occ.name,
          body: label,
          kind: 'occasion',
          visualKind,
        });
      }
      continue;
    }

    // ===== الأيام البيض: إشعار واحد بصبيحة اليوم السابق =====
    const dayNum = arabicDigitsToNumber(hijri.day);
    const whiteIdx = WHITE_DAY_NUMS.indexOf(dayNum);
    if (whiteIdx !== -1) {
      const isSpecial = WHITE_DAY_SPECIAL_MONTHS.includes(hijri.month);
      const ordinal = WHITE_DAY_ORDINALS[whiteIdx] ?? `${whiteIdx + 1}`;

      let body = `غداً هو اليوم ${ordinal} من الأيام البيض - يستحب صيامه`;
      if (isSpecial) {
        body = hijri.month === 'شعبان'
          ? `غداً هو اليوم ${ordinal} من الأيام البيض بشهر شعبان المعظم - فضل عظيم لصيامه وقرباً من شهر رمضان`
          : `غداً هو اليوم ${ordinal} من الأيام البيض بشهر رجب الأصب - من أفضل أيام الصيام المستحب`;
      }

      // اليوم السابق ليوم الحدث، بنفس توقيت الإشعار المحدد
      const dayBefore = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, WHITEDAY_NOTIF_HOUR, WHITEDAY_NOTIF_MINUTE, 0);
      if (dayBefore.getTime() <= Date.now()) continue;

      events.push({
        date: dayBefore,
        title: isSpecial ? `✨ أيام بيض ${hijri.month}` : '🌕 أيام بيض',
        body,
        kind: 'whiteday',
        visualKind: isSpecial ? 'whiteday-special' : 'whiteday',
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
      const notifee = getNotifee();
      await Promise.all(
        ids.map((id) => notifee.cancelTriggerNotification(id).catch(() => {}))
      );
    }
  } catch {
    // تجاهل أخطاء القراءة/الإلغاء
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

  const notifee = getNotifee();
  const { TriggerType } = getNotifeeTypes();
  await ensureChannel();

  const events = buildEventsList(DAYS_AHEAD).filter(
    (e) => (e.kind === 'occasion' && prefs.occasions) || (e.kind === 'whiteday' && prefs.whiteDays)
  );

  const ids: string[] = [];
  for (const ev of events) {
    try {
      const id = await notifee.createTriggerNotification(
        {
          title: ev.title,
          body: ev.body,
          data: { screen: 'calendar', kind: ev.visualKind },
          android: {
            channelId: CHANNEL_ID,
            colorized: true,
            color: EVENT_COLORS[ev.visualKind],
            smallIcon: 'ic_notification',
            largeIcon: 'ic_notification_large',
            pressAction: { id: 'default' },
          },
          ios: {
            sound: 'default',
          },
        },
        { type: TriggerType.TIMESTAMP, timestamp: ev.date.getTime() }
      );
      ids.push(id);
    } catch {
      // تجاهل فشل جدولة إشعار منفرد وكمل الباقي
    }
  }

  await AsyncStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(ids));
  await AsyncStorage.setItem(SCHEDULED_AT_KEY, new Date().toISOString());

  // تحذير تطويري: هذا العدد يخص إشعارات هذا الملف فقط (مناسبات + أيام بيض).
  // آيفون يحدد ٦٤ إشعار محلي مجدول لكل التطبيق مجتمعاً - يعني لازم يُجمع
  // مع عدد إشعارات notifeeAzan.ts (الأذان) وnotificationScheduler.ts (الأذكار)
  // بنفس اللحظة حتى تعرف المجموع الحقيقي. هذا التحذير وحده ما يكفي كحماية
  // فعلية من تجاوز الحد - يحتاج مستقبلاً دالة مركزية تجمع العدد من الملفات
  // الثلاثة قبل الجدولة. لسه غير محلول بالكامل.
  if (__DEV__ && ids.length > 45) {
    console.warn(`[hijriNotifications] عدد كبير من إشعارات هذا الملف وحده: ${ids.length} - تذكر جمعه مع عدد إشعارات الأذان والأذكار لمعرفة القرب الحقيقي من حد iOS (64)`);
  }

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

// ===== معالجة الحدث - دالة نقية بدون تسجيل ذاتي (شوف نفس الملاحظة بملف
// notifeeAzan.ts - التسجيل الفعلي الوحيد بكل التطبيق صار مركزي بملف
// notificationEvents.ts، حتى ما تنمسح معالجات ملفات ثانية بصمت) =====
export function handleHijriEvent(type: any, detail: any, EventType: any): boolean {
  const channelId = detail?.notification?.android?.channelId;
  if (channelId !== CHANNEL_ID) return false; // مو من اختصاصي

  if (type === EventType.PRESS) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { router } = require('expo-router');
      router.push('/settings/calendar' as any);
    } catch {
      // تجاهل إذا التوجيه فشل (مثلاً التطبيق مو جاهز بعد)
    }
  }
  return true;
}