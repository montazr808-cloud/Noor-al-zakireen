// src/utils/hijriOccasions.ts
// بيانات المناسبات الهجرية الشيعية + دوال التحويل والحساب
// مستخدمة من: app/settings/calendar.tsx و utils/hijriNotifications.ts

import { getCachedOffset } from './hijriSync';

export function toArabicDigits(num: number | string): string {
  const ar = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/[0-9]/g, (d) => ar[parseInt(d, 10)]);
}

export function arabicDigitsToNumber(s: string): number {
  const map: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  };
  return parseInt(s.replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => map[d]), 10);
}

export interface HijriParts {
  day: string;
  month: string;
  year: string;
}

// أسماء الأشهر الهجرية - بنفس التسميات المستخدمة بقائمة HIJRI_OCCASIONS تحت (يهم التطابق
// حتى getOccasion يلاگي المناسبة الصح)
const HIJRI_MONTH_NAMES = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];

// رقم اليوم اليولياني (Julian Day Number) لأي تاريخ ميلادي - حساب رياضي معياري
// (خوارزمية Fliegel & Van Flandern)، ما يعتمد على أي مكتبة أو Intl
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

// تحويل رقم اليوم اليولياني للتقويم الهجري "التابعي/الحسابي" (نفس تقويم islamic-civil
// المعياري - قاعدة كبيسة ثابتة معروفة، بدون رصد فلكي). هذا بديل كامل لـ
// Intl.DateTimeFormat({calendar:'islamic-civil'}) اللي دعمها ناقص/غير موجود على محرك
// Hermes ببعض أجهزة أندرويد، وهذا كان السبب الحقيقي وراء فشل عرض "هجري فقط" بصمت
// ورجوعه للميلادي تلقائياً على الموبايل رغم إنه يشتغل زين بالمتصفح (الويب عنده Intl كامل)
function jdnToIslamicCivil(jdn: number): { year: number; month: number; day: number } {
  const epoch = 1948439; // يعادل ١ محرم ١ هـ بالتقويم التابعي - مصحّح (كان 1948440 وهذا يسبب تأخر يوم وحد كامل عن التاريخ الصحيح، تأكدنا بمرجعين: ١ محرم ١٤٤٦ = ٧ يوليو ٢٠٢٤، و١ محرم ١٤٤٧ = ٢٦ يونيو ٢٠٢٥)
  let l = jdn - epoch + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

// يحول تاريخ ميلادي لهجري - يطبق فوق الحساب المحلي (islamic-civil) فرق الأيام
// (offset) المتزامن مع تقويم النجف الأشرف الرسمي (حقيبة المؤمن / شبكة الكفيل)
// عبر hijriSync.ts. الدالة تبقى متزامنة (sync) بالكامل زي ما كانت - الأوفست
// يكون آخر قيمة محفوظة محلياً (0 افتراضياً لحد أول مزامنة ناجحة)، فما يصير أي
// تأخير أو حاجة لـ await بأي مكان يستدعي هذي الدالة حالياً
export function getHijriParts(date: Date): HijriParts {
  const jdn = gregorianToJDN(date.getFullYear(), date.getMonth() + 1, date.getDate()) + getCachedOffset();
  const { year, month, day } = jdnToIslamicCivil(jdn);
  const monthName = HIJRI_MONTH_NAMES[Math.min(Math.max(month - 1, 0), 11)];
  return { day: String(day), month: monthName, year: String(year) };
}

export type OccasionType = 'joy' | 'sorrow';

export interface HijriOccasion {
  key: string;
  name: string;
  type: OccasionType;
}

// قاعدة المناسبات الهجرية الشيعية - "اسم الشهر الهجري-اليوم"
// مراجعة ومصححة اعتماداً على مصادر شيعية (ويكي شيعة، شبكة المعارف، منتدى الكفيل،
// ويكيبيديا العربية - صفحة "أيام الشيعة الاثني عشرية")
// تغطي مواليد ووفيات المعصومين الأربعة عشر كاملة + أهم المناسبات الأخرى
// (الهجرة النبوية، عيد الزهراء، أيام كربلاء العشرة الأولى، بدء الغيبة الكبرى،
// دحو الأرض، غزوة بدر، فتح مكة، وفاة السيدة خديجة...). بعض المناسبات لها أكثر
// من رواية بتاريخها (مثل وفاة الإمام الحسن، وولادة الإمام علي) فأدرجناها
// كمناسبتين منفصلتين موسومتين بـ"(رواية)" ليتضح أنها روايات بديلة لا تكرار خطأ
export const HIJRI_OCCASIONS: HijriOccasion[] = [
  // محرم
  { key: 'محرم-1',          name: 'رأس السنة الهجرية',                                          type: 'joy' },
  { key: 'محرم-3',          name: 'وصول الإمام الحسين عليه السلام إلى كربلاء',                   type: 'sorrow' },
  { key: 'محرم-7',          name: 'منع الماء عن مخيم الإمام الحسين عليه السلام',                 type: 'sorrow' },
  { key: 'محرم-9',          name: 'تاسوعاء',                                                     type: 'sorrow' },
  { key: 'محرم-10',         name: 'عاشوراء - شهادة الإمام الحسين عليه السلام',                   type: 'sorrow' },
  { key: 'محرم-11',         name: 'سبي عيال الإمام الحسين عليه السلام وإحراق الخيام',             type: 'sorrow' },
  { key: 'محرم-25',         name: 'شهادة الإمام علي زين العابدين عليه السلام',                   type: 'sorrow' },

  // صفر
  { key: 'صفر-1',           name: 'وصول ركب سبايا أهل البيت عليهم السلام إلى الشام',             type: 'sorrow' },
  { key: 'صفر-5',           name: 'وفاة السيدة رقية بنت الإمام الحسين عليها السلام',             type: 'sorrow' },
  { key: 'صفر-7',           name: 'وفاة الإمام الحسن المجتبى عليه السلام (رواية)',               type: 'sorrow' },
  { key: 'صفر-7',           name: 'مولد الإمام موسى الكاظم عليه السلام',                         type: 'joy' },
  { key: 'صفر-17',          name: 'شهادة الإمام علي الرضا عليه السلام (رواية)',                  type: 'sorrow' },
  { key: 'صفر-20',          name: 'أربعين الإمام الحسين عليه السلام',                            type: 'sorrow' },
  { key: 'صفر-28',          name: 'وفاة النبي محمد ﷺ وشهادة الإمام الحسن المجتبى ع',             type: 'sorrow' },
  { key: 'صفر-29',          name: 'شهادة الإمام علي الرضا عليه السلام',                          type: 'sorrow' },

  // ربيع الأول
  { key: 'ربيع الأول-1',    name: 'الهجرة النبوية الشريفة إلى المدينة المنورة',                  type: 'joy' },
  { key: 'ربيع الأول-8',    name: 'شهادة الإمام الحسن العسكري عليه السلام',                      type: 'sorrow' },
  { key: 'ربيع الأول-9',    name: 'عيد الزهراء (فرحة الزهراء) عليها السلام',                     type: 'joy' },
  { key: 'ربيع الأول-17',   name: 'المولد النبوي الشريف ومولد الإمام جعفر الصادق ع',             type: 'joy' },

  // ربيع الآخر
  { key: 'ربيع الآخر-8',    name: 'ولادة الإمام الحسن العسكري عليه السلام',                      type: 'joy' },

  // جمادى الأولى
  { key: 'جمادى الأولى-5',  name: 'مولد السيدة زينب الكبرى عليها السلام',                        type: 'joy' },
  { key: 'جمادى الأولى-13', name: 'شهادة السيدة فاطمة الزهراء عليها السلام',                     type: 'sorrow' },

  // جمادى الآخرة
  { key: 'جمادى الآخرة-3',  name: 'شهادة السيدة فاطمة الزهراء (رواية ثانية)',                    type: 'sorrow' },
  { key: 'جمادى الآخرة-13', name: 'وفاة أم البنين عليها السلام',                                 type: 'sorrow' },
  { key: 'جمادى الآخرة-20', name: 'مولد السيدة فاطمة الزهراء عليها السلام',                      type: 'joy' },

  // رجب
  { key: 'رجب-1',           name: 'ولادة الإمام محمد الباقر عليه السلام',                        type: 'joy' },
  { key: 'رجب-3',           name: 'شهادة الإمام علي الهادي عليه السلام',                         type: 'sorrow' },
  { key: 'رجب-10',          name: 'ولادة الإمام محمد الجواد عليه السلام',                        type: 'joy' },
  { key: 'رجب-13',          name: 'ولادة الإمام علي عليه السلام',                                type: 'joy' },
  { key: 'رجب-15',          name: 'ليلة أم داود (ليلة النصف من رجب)',                            type: 'joy' },
  { key: 'رجب-25',          name: 'شهادة الإمام موسى الكاظم عليه السلام',                        type: 'sorrow' },
  { key: 'رجب-27',          name: 'المبعث النبوي الشريف',                                        type: 'joy' },

  // شعبان
  { key: 'شعبان-3',         name: 'ولادة الإمام الحسين عليه السلام',                             type: 'joy' },
  { key: 'شعبان-4',         name: 'ولادة أبي الفضل العباس عليه السلام',                          type: 'joy' },
  { key: 'شعبان-5',         name: 'ولادة الإمام زين العابدين عليه السلام',                       type: 'joy' },
  { key: 'شعبان-11',        name: 'ولادة علي الأكبر عليه السلام',                                type: 'joy' },
  { key: 'شعبان-15',        name: 'ولادة الإمام محمد المهدي المنتظر عليه السلام',                type: 'joy' },

  // رمضان
  { key: 'رمضان-1',         name: 'بداية شهر رمضان المبارك',                                     type: 'joy' },
  { key: 'رمضان-10',        name: 'وفاة السيدة خديجة الكبرى عليها السلام',                       type: 'sorrow' },
  { key: 'رمضان-15',        name: 'ولادة الإمام الحسن المجتبى عليه السلام',                      type: 'joy' },
  { key: 'رمضان-17',        name: 'ذكرى غزوة بدر الكبرى',                                        type: 'joy' },
  { key: 'رمضان-19',        name: 'ضرب أمير المؤمنين علي عليه السلام بسيف ابن ملجم',             type: 'sorrow' },
  { key: 'رمضان-20',        name: 'فتح مكة المكرمة',                                             type: 'joy' },
  { key: 'رمضان-21',        name: 'شهادة الإمام علي عليه السلام',                                type: 'sorrow' },
  { key: 'رمضان-23',        name: 'ليلة القدر (مرجوة)',                                          type: 'joy' },

  // شوال
  { key: 'شوال-1',          name: 'عيد الفطر المبارك',                                           type: 'joy' },
  { key: 'شوال-4',          name: 'بداية الغيبة الكبرى للإمام المهدي عجل الله فرجه',             type: 'sorrow' },
  { key: 'شوال-8',          name: 'هدم قبور أئمة البقيع عليهم السلام',                           type: 'sorrow' },
  { key: 'شوال-25',         name: 'شهادة الإمام جعفر الصادق عليه السلام',                        type: 'sorrow' },

  // ذو القعدة
  { key: 'ذو القعدة-11',    name: 'ولادة الإمام علي الرضا عليه السلام',                          type: 'joy' },
  { key: 'ذو القعدة-25',    name: 'يوم دحو الأرض',                                               type: 'joy' },
  { key: 'ذو القعدة-29',    name: 'شهادة الإمام محمد الجواد عليه السلام',                        type: 'sorrow' },

  // ذو الحجة
  { key: 'ذو الحجة-6',      name: 'ولادة الإمام علي عليه السلام في جوف الكعبة المشرفة (رواية)',  type: 'joy' },
  { key: 'ذو الحجة-7',      name: 'شهادة الإمام محمد الباقر عليه السلام',                        type: 'sorrow' },
  { key: 'ذو الحجة-9',      name: 'يوم عرفة',                                                    type: 'joy' },
  { key: 'ذو الحجة-10',     name: 'عيد الأضحى المبارك',                                          type: 'joy' },
  { key: 'ذو الحجة-15',     name: 'ولادة الإمام علي الهادي عليه السلام',                         type: 'joy' },
  { key: 'ذو الحجة-18',     name: 'عيد الغدير الأغر',                                            type: 'joy' },
  { key: 'ذو الحجة-24',     name: 'يوم المباهلة',                                                type: 'joy' },
];

export const OCCASIONS_MAP: Record<string, { name: string; type: OccasionType }> = {};
HIJRI_OCCASIONS.forEach((o) => { OCCASIONS_MAP[o.key] = { name: o.name, type: o.type }; });

export function getOccasion(hijriMonth: string, hijriDayArabic: string): { name: string; type: OccasionType } | null {
  const dayNum = arabicDigitsToNumber(hijriDayArabic);
  return OCCASIONS_MAP[`${hijriMonth}-${dayNum}`] ?? null;
}

// كل مناسبات نفس اليوم (مو بس وحدة) - مفيدة لما بيوم وحد أكثر من مناسبة (مثل ٧ صفر
// اللي فيه ولادة الإمام الكاظم + رواية وفاة الإمام الحسن بنفس اليوم) حتى ما تنفقد
// أي مناسبة إذا استُخدم getOccasion فقط (يرجع وحدة بس - آخر مدخل بنفس المفتاح)
export function getAllOccasions(hijriMonth: string, hijriDayArabic: string): HijriOccasion[] {
  const dayNum = arabicDigitsToNumber(hijriDayArabic);
  const key = `${hijriMonth}-${dayNum}`;
  return HIJRI_OCCASIONS.filter((o) => o.key === key);
}

// الأيام البيض: ١٣ - ١٤ - ١٥ من كل شهر هجري
export const WHITE_DAY_NUMS = [13, 14, 15];
// الأشهر اللي فيها تنبيه أيام بيض مميز (رجب وشعبان)
export const WHITE_DAY_SPECIAL_MONTHS = ['رجب', 'شعبان'];