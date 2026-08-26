// src/utils/hijriSync.ts
// مزامنة التقويم الهجري المحلي (islamic-civil الحسابي بـ hijriOccasions.ts) مع
// التاريخ المعلن فعلياً من مكتب سماحة المرجع الديني السيد علي الحسيني
// السيستاني (دام ظله) - عبر استخراج نص من الصفحة الرئيسية لموقع sistani.org.
//
// ⚠️ تغيير مهم عن النسخة السابقة: كان هذا الملف يجيب التاريخ من API شبكة
// الكفيل (hq.alkafeel.net) - بس تأكدنا إن هذا مصدر مختلف فعلياً عن إعلان
// مكتب السيستاني (كل مؤسسة إلها لجنة رؤية هلال منفصلة، وصار فرق يوم فعلي
// بينهم). بما إن تطبيقك موجه لمقلّدي السيستاني تحديداً، صار المصدر هو موقعه
// الرسمي مباشرة.
//
// ⚠️ محدودية حقيقية يلزم تعرفها: sistani.org ماكو عنده API رسمي، فهذا الملف
// يسوي "استخراج نص" (scraping) من HTML الصفحة الرئيسية، معتمد على إن الموقع
// يعرض التاريخ بنفس الصيغة الحالية: "السبت ٨- ربيع الأول - ١٤٤٨هـ". إذا
// غيّروا تصميم الصفحة مستقبلاً، الاستخراج ممكن يفشل بصمت - لهذا كل شي هنا
// مبني حول "افشل بأمان": أي فشل بالجلب أو التحليل يبقي آخر offset محفوظ كما
// هو (أو صفر أول تشغيل)، والتطبيق يستمر بالحساب المحلي البحت بدون أي كسر.
//
// الحساب المحلي (فلكي جدولي بحت، بدون رصد هلال فعلي) فيمكن يختلف يوم أو
// يومين عن الإعلان الرسمي، خصوصاً بأوائل الأشهر. هذا الملف يجيب "فرق الأيام"
// (offset) من صفحة السيستاني مرة وحدة باليوم، يخزنه محلياً بـ AsyncStorage،
// ويطبق فوق الحساب المحلي.
//
// ملاحظة تصميم: الدوال الرياضية (gregorianToJDN, islamicCivilToJDN، أسماء
// الأشهر) مكررة هنا عمداً بدل استيرادها من hijriOccasions.ts، لأن ذاك الملف
// سيستورد getCachedOffset من هذا الملف (لتطبيق الأوفست بـ getHijriParts) - فلو
// استوردنا بالاتجاهين نطلع بـ circular import. التكرار هنا بسيط (رياضيات صرفة
// بلا حالة) وما يستاهل التعقيد البديل.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const OFFSET_KEY = '@hijri_sistani_offset';
const OFFSET_DATE_KEY = '@hijri_sistani_offset_date'; // آخر يوم (yyyy-m-d محلي) صارت فيه مزامنة ناجحة
// ⚠️ تعمّدت تغيير اسمي هذولة المفتاحين عن النسخة القديمة (كانوا
// @hijri_najaf_offset / @hijri_najaf_offset_date) بدل ما أبقيهم زي ما هم -
// لأنه لو خليت نفس الاسم، أي جهاز صارت عنده مزامنة ناجحة اليوم مع الكفيل
// (قبل التحديث) بيضل عالق على القيمة القديمة لين آخر اليوم (لأن الكود يشوف
// "تمت المزامنة اليوم" ويتخطى الجلب الجديد من السيستاني). تغيير الاسم يخلي
// الكاش القديم "غير موجود" تلقائياً، فتصير مزامنة جديدة فوراً بأول فتحة
// تطبيق بعد التحديث - بدون ما تحتاج تمسح بيانات التطبيق يدوياً

const HIJRI_MONTH_NAMES = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];

// أسماء الأشهر بكل الاختلافات الشائعة بالتهجئة - موقع السيستاني ممكن يستخدم
// أي وحدة منها، فنقبلها كلها ونطابقها لنفس رقم الشهر بـ HIJRI_MONTH_NAMES فوگ
const HIJRI_MONTH_NAME_ALIASES: Record<string, number> = {
  'محرم': 1,
  'صفر': 2,
  'ربيع الأول': 3, 'ربيع الاول': 3,
  'ربيع الآخر': 4, 'ربيع الاخر': 4, 'ربيع الثاني': 4,
  'جمادى الأولى': 5, 'جمادى الاولى': 5, 'جمادى الأول': 5, 'جمادى الاول': 5,
  'جمادى الآخرة': 6, 'جمادى الاخرة': 6, 'جمادى الثانية': 6, 'جمادى الثاني': 6,
  'رجب': 7,
  'شعبان': 8,
  'رمضان': 9,
  'شوال': 10, 'شوّال': 10,
  'ذو القعدة': 11, 'ذي القعدة': 11,
  'ذو الحجة': 12, 'ذي الحجة': 12,
};

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

// يفكك نص التاريخ الهجري من HTML الصفحة الرئيسية لموقع السيستاني - الشكل
// الفعلي الحالي: "السبت ٨- ربيع الأول - ١٤٤٨هـ || (النجف الأشرف)"
// (اتحقق فعلياً من محتوى الصفحة الحي وقت كتابة هذا الكود)
function parseSistaniDateFromHtml(html: string): { year: number; month: number; day: number } | null {
  const arToEn = (s: string) => {
    const map: Record<string, string> = {
      '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
      '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    };
    return s.replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => map[d]);
  };

  // اليوم - اسم الشهر - السنة "هـ"
  const match = html.match(/([٠-٩]+)\s*-\s*([\u0621-\u064A][\u0621-\u064A\s]*?)\s*-\s*([٠-٩]+)\s*هـ/);
  if (!match) return null;

  const day = parseInt(arToEn(match[1]), 10);
  const monthName = match[2].trim().replace(/\s+/g, ' ');
  const month = HIJRI_MONTH_NAME_ALIASES[monthName];
  const year = parseInt(arToEn(match[3]), 10);

  if (isNaN(day) || isNaN(year) || !month) return null;
  return { year, month, day };
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// آخر offset معروف - يبقى صفر افتراضياً لحد ما تصير أول مزامنة ناجحة (يعني
// getHijriParts يشتغل بالحساب المحلي البحت لحد هسه، بدون أي تأخير أو انتظار)
let cachedOffset = 0;
let loadedFromStorage = false;

// ⚠️ إصلاح جوهري (كان التاريخ الهجري يبين متقدم/متأخر يوم عن حقيبة المؤمن
// طول الجلسة رغم وجود مزامنة حقيقية شغالة): loadCachedOffset/syncNajafOffset
// تصير بـ_layout.tsx داخل useEffect (بعد أول رسم للشاشة، بشكل غير متزامن).
// getHijriParts تقرا cachedOffset مباشرة وقت كل استدعاء - فالمشكلة مو
// بالحساب نفسه، المشكلة إن الشاشة توصل أول offset (صفر، غير مصحح) وقت أول
// رسم، وبعدين لما تخلص المزامنة الحقيقية وتحدّث cachedOffset، ماكو أي شي
// يخلي React يعيد رسم الشاشة - فالتاريخ يضل عالق على القيمة الغلط طول
// الجلسة لحد ما يصير شي يفرض إعادة رسم.
//
// الحل: نظام تنبيه بسيط - أي شاشة تستخدم useHijriOffsetSync() تنعاد رسمها
// تلقائياً بلحظة تحدّث cachedOffset فعلياً، فيتصحح التاريخ لحاله خلال ثانية
// أو ثانيتين من فتح التطبيق، بدون أي تدخل من المستخدم.
type OffsetListener = () => void;
let offsetListeners: OffsetListener[] = [];
function notifyOffsetListeners() {
  offsetListeners.forEach((l) => l());
}

/**
 * Hook - ينادى داخل أي مكوّن يعرض التاريخ الهجري (تسبيح.tsx، calendar.tsx).
 * ما يرجع أي قيمة - بس يخلي المكوّن يعيد الرسم تلقائياً أول ما يتحدّث
 * الأوفست الحقيقي، فتُعاد قراءة getHijriParts() بأحدث قيمة صحيحة تلقائياً.
 */
export function useHijriOffsetSync(): void {
  const [, forceRerender] = useState(0);
  useEffect(() => {
    const listener = () => forceRerender((n) => n + 1);
    offsetListeners.push(listener);
    return () => {
      offsetListeners = offsetListeners.filter((l) => l !== listener);
    };
  }, []);
}

// يحمّل آخر offset محفوظ من AsyncStorage - يستدعى مرة وحدة عند بداية التطبيق
// (قبل أول render إذا ممكن) حتى ما تظهر الشاشة أول شي بالحساب المحلي البحت ثم
// "تقفز" بعد لحظة إذا كان عندنا offset محفوظ من قبل
export async function loadCachedOffset(): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(OFFSET_KEY);
    const next = v ? parseInt(v, 10) : 0;
    if (next !== cachedOffset) {
      cachedOffset = next;
      notifyOffsetListeners();
    }
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

// يجيب تاريخ اليوم من صفحة sistani.org الرئيسية، يحسب فرق الأيام مقارنة
// بالحساب المحلي، يخزنه، ويحدّث cachedOffset فوراً. لو فشل (ماكو نت، الموقع
// واقع، تغيّرت صيغة الصفحة، فرق غير منطقي) يرجع false ويبقى آخر offset صالح
// كما هو - ما يلمس أي شي. يتجنب تكرار الجلب أكثر من مرة بنفس اليوم تلقائياً.
export async function syncNajafOffset(): Promise<boolean> {
  try {
    const lastSyncDay = await AsyncStorage.getItem(OFFSET_DATE_KEY);
    if (lastSyncDay === todayKey()) {
      return true; // تمت المزامنة اليوم مسبقاً
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let html: string;
    try {
      const res = await fetch('https://www.sistani.org/', { signal: controller.signal });
      html = await res.text();
    } finally {
      clearTimeout(timeout);
    }

    const parsed = parseSistaniDateFromHtml(html);
    if (!parsed) return false;

    const apiJDN = islamicCivilToJDN(parsed.year, parsed.month, parsed.day);
    const now = new Date();
    const todayJDN = gregorianToJDN(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const offset = apiJDN - todayJDN;

    // حماية: أكبر فرق طبيعي متوقع بين الحساب الفلكي والرؤية الشرعية يوم أو
    // يومين - أي فرق أكبر من هذا غالباً خطأ بارسنغ أو تغيّر بصيغة الصفحة،
    // نتجاهله ونحافظ على آخر offset سليم بدل تطبيق رقم غلط
    if (Math.abs(offset) > 2) return false;

    if (offset !== cachedOffset) {
      cachedOffset = offset;
      notifyOffsetListeners();
    }
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