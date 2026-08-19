// src/utils/hijriSync.ts
// مزامنة التقويم الهجري المحلي (islamic-civil الحسابي بـ hijriOccasions.ts) مع
// تقويم النجف الأشرف الرسمي (نفس مصدر حقيبة المؤمن - شبكة الكفيل). الحساب المحلي
// فلكي جدولي بحت (بدون رصد هلال فعلي) فيمكن يختلف يوم أو يومين عن الإعلان الرسمي،
// خصوصاً بأوائل الأشهر. هذا الملف يجيب "فرق الأيام" (offset) من API الكفيل مرة
// وحدة باليوم، يخزنه محلياً بـ AsyncStorage، ويطبق فوق الحساب المحلي - لو فشل
// الجلب (ماكو نت مثلاً) يبقى offset = آخر قيمة محفوظة (أو صفر أول تشغيل) والتطبيق
// يستمر بالحساب المحلي البحت بدون أي كسر أو تعليق بالواجهة.
//
// ملاحظة تصميم: الدوال الرياضية (gregorianToJDN, islamicCivilToJDN, أسماء
// الأشهر) مكررة هنا عمداً بدل استيرادها من hijriOccasions.ts، لأن ذاك الملف
// سيستورد getCachedOffset من هذا الملف (لتطبيق الأوفست بـ getHijriParts) - فلو
// استوردنا بالاتجاهين نطلع بـ circular import. التكرار هنا بسيط (رياضيات صرفة
// بلا حالة) وما يستاهل التعقيد البديل.

import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFSET_KEY = '@hijri_najaf_offset';
const OFFSET_DATE_KEY = '@hijri_najaf_offset_date'; // آخر يوم (yyyy-m-d محلي) صارت فيه مزامنة ناجحة

// إحداثيات النجف الأشرف - نفس القيم الموثقة بمثال API الكفيل الرسمي
const NAJAF_LAT = 32.6143;
const NAJAF_LONG = 44.0228;
const TIMEZONE = '+3';

const HIJRI_MONTH_NAMES = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];

function gregorianToJDN(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * m2 + 2) / 5) +
    365 * y2 +
    Math.floor(y2 / 4) -
    Math.floor(y2 / 100) +
    Math.floor(y2 / 400) -
    32045
  );
}

// معكوس jdnToIslamicCivil بـ hijriOccasions.ts - نفس epoch بالضبط (1948439) حتى
// يطابق الحساب المحلي تماماً بدون أي انزياح غير مقصود؛ تم التحقق يدوياً إن
// islamicCivilToJDN(jdnToIslamicCivil(jdn)) === jdn لأكثر من تاريخ مرجعي
function islamicCivilToJDN(year: number, month: number, day: number): number {
  const epoch = 1948439;
  return (
    day +
    Math.ceil((month - 1) * 29.5) +
    (year - 1) * 354 +
    Math.floor((3 + 11 * year) / 30) +
    epoch -
    1
  );
}

// يفكك نص التاريخ الهجري الراجع من API الكفيل، الشكل المتوقع مثل "٢٧ صفر ١٤٣٨ هـ"
// أو "27 صفر 1438 هـ" - يتعامل مع أرقام عربية وإنكليزية
function parseNajafDateString(raw: string): { year: number; month: number; day: number } | null {
  const arToEn = (s: string) => {
    const map: Record<string, string> = {
      '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
      '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    };
    return s.replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => map[d]);
  };

  const cleaned = arToEn(raw).replace(/هـ/g, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 3) return null;

  const day = parseInt(parts[0], 10);
  const year = parseInt(parts[parts.length - 1], 10);
  const monthName = parts.slice(1, parts.length - 1).join(' ');
  const monthIdx = HIJRI_MONTH_NAMES.indexOf(monthName);

  if (isNaN(day) || isNaN(year) || monthIdx === -1) return null;
  return { year, month: monthIdx + 1, day };
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// آخر offset معروف - يبقى صفر افتراضياً لحد ما تصير أول مزامنة ناجحة (يعني
// getHijriParts يشتغل بالحساب المحلي البحت لحد هسه، بدون أي تأخير أو انتظار)
let cachedOffset = 0;
let loadedFromStorage = false;

// يحمّل آخر offset محفوظ من AsyncStorage - يستدعى مرة وحدة عند بداية التطبيق
// (قبل أول render إذا ممكن) حتى ما تظهر الشاشة أول شي بالحساب المحلي البحت ثم
// "تقفز" بعد لحظة إذا كان عندنا offset محفوظ من قبل
export async function loadCachedOffset(): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(OFFSET_KEY);
    cachedOffset = v ? parseInt(v, 10) : 0;
  } catch {
    cachedOffset = 0;
  }
  loadedFromStorage = true;
  return cachedOffset;
}

// القيمة الحالية المخزنة بالذاكرة - سنكرونس، تستخدم من hijriOccasions.ts بكل
// استدعاء لـ getHijriParts
export function getCachedOffset(): number {
  return cachedOffset;
}

// يجيب تاريخ اليوم من API الكفيل (تقويم النجف)، يحسب فرق الأيام مقارنة بالحساب
// المحلي، يخزنه، ويحدّث cachedOffset فوراً. لو فشل (ماكو نت، استجابة غير متوقعة،
// فرق غير منطقي) يرجع false ويبقى آخر offset صالح كما هو - ما يلمس أي شي.
// يتجنب تكرار الجلب أكثر من مرة بنفس اليوم تلقائياً.
export async function syncNajafOffset(): Promise<boolean> {
  try {
    const lastSyncDay = await AsyncStorage.getItem(OFFSET_DATE_KEY);
    if (lastSyncDay === todayKey()) {
      return true; // تمت المزامنة اليوم مسبقاً
    }

    const url = `https://hq.alkafeel.net/Api/init/init.php?v=jsonPrayerTimes&timezone=${TIMEZONE}&long=${NAJAF_LONG}&lati=${NAJAF_LAT}`;
    const res = await fetch(url);
    const json = await res.json();
    const rawDate: string | undefined = json?.date;
    if (!rawDate) return false;

    const parsed = parseNajafDateString(rawDate);
    if (!parsed) return false;

    const apiJDN = islamicCivilToJDN(parsed.year, parsed.month, parsed.day);
    const now = new Date();
    const todayJDN = gregorianToJDN(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const offset = apiJDN - todayJDN;

    // حماية: أكبر فرق طبيعي متوقع بين الحساب الفلكي والرؤية الشرعية يوم أو
    // يومين - أي فرق أكبر من هذا غالباً خطأ بارسنغ أو استجابة غير متوقعة من
    // الـ API، نتجاهله ونحافظ على آخر offset سليم بدل تطبيق رقم غلط
    if (Math.abs(offset) > 2) return false;

    cachedOffset = offset;
    loadedFromStorage = true;
    await AsyncStorage.setItem(OFFSET_KEY, String(offset));
    await AsyncStorage.setItem(OFFSET_DATE_KEY, todayKey());
    return true;
  } catch {
    return false;
  }
}

// هل تم تحميل/مزامنة offset حقيقي ولو مرة (مفيد لو أردت لاحقاً تعرض مؤشر صغير
// "متزامن مع تقويم النجف" بالواجهة - غير مستخدم حالياً، بس جاهز)
export function isNajafSynced(): boolean {
  return loadedFromStorage;
}