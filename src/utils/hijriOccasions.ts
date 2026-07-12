// src/utils/hijriOccasions.ts
// بيانات المناسبات الهجرية الشيعية + دوال التحويل والحساب
// مستخدمة من: app/settings/calendar.tsx و utils/hijriNotifications.ts

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

export function getHijriParts(date: Date): HijriParts {
  try {
    const dayFmt   = new Intl.DateTimeFormat('ar', { calendar: 'islamic-civil', day: 'numeric' });
    const monthFmt = new Intl.DateTimeFormat('ar', { calendar: 'islamic-civil', month: 'long' });
    const yearFmt  = new Intl.DateTimeFormat('ar', { calendar: 'islamic-civil', year: 'numeric' });
    const rawYear  = yearFmt.format(date).replace(/\s*هـ\.?\s*/g, '').trim();
    return { day: dayFmt.format(date), month: monthFmt.format(date), year: rawYear };
  } catch {
    return { day: '', month: '', year: '' };
  }
}

export type OccasionType = 'joy' | 'sorrow';

export interface HijriOccasion {
  key: string;
  name: string;
  type: OccasionType;
}

// قاعدة المناسبات الهجرية الشيعية الكاملة - "اسم الشهر الهجري-اليوم"
export const HIJRI_OCCASIONS: HijriOccasion[] = [
  { key: 'محرم-1',          name: 'رأس السنة الهجرية',                          type: 'joy' },
  { key: 'محرم-9',          name: 'تاسوعاء',                                     type: 'sorrow' },
  { key: 'محرم-10',         name: 'عاشوراء - شهادة الإمام الحسين عليه السلام',   type: 'sorrow' },
  { key: 'صفر-7',           name: 'ولادة الإمام الباقر عليه السلام',             type: 'joy' },
  { key: 'صفر-20',          name: 'أربعين الإمام الحسين عليه السلام',            type: 'sorrow' },
  { key: 'صفر-28',          name: 'وفاة النبي محمد ﷺ / شهادة الإمام الحسن ع',    type: 'sorrow' },
  { key: 'ربيع الأول-8',    name: 'شهادة الإمام علي الهادي عليه السلام',         type: 'sorrow' },
  { key: 'ربيع الأول-17',   name: 'المولد النبوي الشريف',                        type: 'joy' },
  { key: 'جمادى الأولى-13', name: 'شهادة السيدة فاطمة الزهراء عليها السلام',     type: 'sorrow' },
  { key: 'جمادى الآخرة-3',  name: 'شهادة السيدة فاطمة الزهراء (رواية ثانية)',     type: 'sorrow' },
  { key: 'جمادى الآخرة-20', name: 'مولد السيدة فاطمة الزهراء عليها السلام',      type: 'joy' },
  { key: 'رجب-1',           name: 'ولادة الإمام محمد الباقر عليه السلام',        type: 'joy' },
  { key: 'رجب-3',           name: 'شهادة الإمام علي الهادي عليه السلام',         type: 'sorrow' },
  { key: 'رجب-10',          name: 'ولادة الإمام محمد الجواد عليه السلام',        type: 'joy' },
  { key: 'رجب-13',          name: 'ولادة الإمام علي عليه السلام',                type: 'joy' },
  { key: 'رجب-15',          name: 'ولادة الإمام زين العابدين عليه السلام',       type: 'joy' },
  { key: 'رجب-25',          name: 'شهادة الإمام موسى الكاظم عليه السلام',        type: 'sorrow' },
  { key: 'رجب-27',          name: 'المبعث النبوي الشريف',                        type: 'joy' },
  { key: 'شعبان-3',         name: 'ولادة الإمام الحسين عليه السلام',             type: 'joy' },
  { key: 'شعبان-4',         name: 'ولادة أبي الفضل العباس عليه السلام',          type: 'joy' },
  { key: 'شعبان-5',         name: 'ولادة الإمام زين العابدين عليه السلام',       type: 'joy' },
  { key: 'شعبان-15',        name: 'ولادة الإمام المهدي المنتظر عليه السلام',     type: 'joy' },
  { key: 'رمضان-1',         name: 'بداية شهر رمضان المبارك',                     type: 'joy' },
  { key: 'رمضان-19',        name: 'ليلة القدر (مرجوة) - ضرب الإمام علي ع',       type: 'sorrow' },
  { key: 'رمضان-21',        name: 'شهادة الإمام علي عليه السلام / ليلة القدر',   type: 'sorrow' },
  { key: 'رمضان-23',        name: 'ليلة القدر (مرجوة)',                          type: 'joy' },
  { key: 'شوال-1',          name: 'عيد الفطر المبارك',                           type: 'joy' },
  { key: 'شوال-25',         name: 'شهادة الإمام جعفر الصادق عليه السلام',        type: 'sorrow' },
  { key: 'ذو القعدة-1',     name: 'ولادة الإمام محمد الباقر عليه السلام',        type: 'joy' },
  { key: 'ذو القعدة-11',    name: 'ولادة الإمام علي الرضا عليه السلام',          type: 'joy' },
  { key: 'ذو الحجة-7',      name: 'شهادة الإمام محمد الباقر عليه السلام',        type: 'sorrow' },
  { key: 'ذو الحجة-9',      name: 'يوم عرفة',                                    type: 'joy' },
  { key: 'ذو الحجة-10',     name: 'عيد الأضحى المبارك',                          type: 'joy' },
  { key: 'ذو الحجة-15',     name: 'ولادة الإمام زين العابدين عليه السلام',       type: 'joy' },
  { key: 'ذو الحجة-18',     name: 'عيد الغدير الأغر',                            type: 'joy' },
  { key: 'ذو الحجة-24',     name: 'يوم المباهلة',                                type: 'joy' },
];

export const OCCASIONS_MAP: Record<string, { name: string; type: OccasionType }> = {};
HIJRI_OCCASIONS.forEach((o) => { OCCASIONS_MAP[o.key] = { name: o.name, type: o.type }; });

export function getOccasion(hijriMonth: string, hijriDayArabic: string): { name: string; type: OccasionType } | null {
  const dayNum = arabicDigitsToNumber(hijriDayArabic);
  return OCCASIONS_MAP[`${hijriMonth}-${dayNum}`] ?? null;
}

// الأيام البيض: ١٣ - ١٤ - ١٥ من كل شهر هجري
export const WHITE_DAY_NUMS = [13, 14, 15];
// الأشهر اللي فيها تنبيه أيام بيض مميز (رجب وشعبان)
export const WHITE_DAY_SPECIAL_MONTHS = ['رجب', 'شعبان'];
