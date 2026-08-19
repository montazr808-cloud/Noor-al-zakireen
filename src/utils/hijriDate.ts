// @ts-ignore -- hijri-converter ماعدها تعريفات TypeScript جاهزة
import { toGregorian, toHijri } from 'hijri-converter';

export type HijriDate = { year: number; month: number; day: number };

const HIJRI_MONTH_NAMES = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];

/**
 * تحويل تاريخ ميلادي لهجري (بالحساب الفلكي لأم القرى). هذا تقريب رقمي
 * معتمد بمعظم التطبيقات الاسلامية، بس التاريخ الهجري الفعلي يعتمد أصلاً
 * على رؤية الهلال وممكن يختلف يوم وحد زيادة أو نقصان حسب البلد/المرجعية.
 */
export function gregorianToHijri(date: Date): HijriDate {
  const { hy, hm, hd } = toHijri(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return { year: hy, month: hm, day: hd };
}

export function hijriToGregorian(h: HijriDate): Date {
  const { gy, gm, gd } = toGregorian(h.year, h.month, h.day);
  return new Date(gy, gm - 1, gd);
}

export function hijriMonthName(month: number): string {
  return HIJRI_MONTH_NAMES[((month - 1) % 12 + 12) % 12] ?? '';
}

/**
 * يرجع أقرب تاريخ ميلادي قادم (اليوم أو بعده) يطابق يوم/شهر هجري معين
 * (مثلاً ١٠ محرم لعاشوراء). يجرب السنة الهجرية الحالية أول، وإذا كان
 * التاريخ فات هذا العام يرجع لنفس اليوم بالسنة الهجرية الجاية.
 */
export function getNextGregorianOccurrence(hijriMonth: number, hijriDay: number, from: Date = new Date()): Date {
  const startOfFrom = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const currentHijri = gregorianToHijri(startOfFrom);

  let candidate = hijriToGregorian({ year: currentHijri.year, month: hijriMonth, day: hijriDay });
  if (candidate.getTime() < startOfFrom.getTime()) {
    candidate = hijriToGregorian({ year: currentHijri.year + 1, month: hijriMonth, day: hijriDay });
  }
  return candidate;
}
