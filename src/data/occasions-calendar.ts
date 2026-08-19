// خريطة المناسبات الهجرية السنوية، مربوطة بمعرف العنصر بقسم "أذكار المناسبات"
// (athkar-data.json -> athkar.groups[occasions].items) عشان نعرف اي دعاء/ذكر
// نذكّر بيه بكل مناسبة. الأيام والشهور مأخوذة من نفس نص العنصر بالتطبيق.
//
// ملاحظة: "ليلة الجمعة" (o1) ما مذكورة هنا لأنها أسبوعية (مجدولة بالمجدول
// الأسبوعي بملف notificationScheduler.ts) مو هجرية سنوية.

export type OccasionHijriEntry = {
  athkarItemId: string;
  hijriMonth: number; // ١=محرم ... ١٢=ذو الحجة
  hijriDay: number;
  label: string;
};

export const OCCASION_HIJRI_CALENDAR: OccasionHijriEntry[] = [
  { athkarItemId: 'o2', hijriMonth: 1, hijriDay: 10, label: 'عاشوراء' },
  { athkarItemId: 'o3', hijriMonth: 7, hijriDay: 27, label: 'المبعث النبوي الشريف' },
  { athkarItemId: 'o4', hijriMonth: 8, hijriDay: 15, label: 'ليلة النصف من شعبان' },
  { athkarItemId: 'o5', hijriMonth: 9, hijriDay: 19, label: 'ليلة القدر (١٩ رمضان)' },
  { athkarItemId: 'o5', hijriMonth: 9, hijriDay: 21, label: 'ليلة القدر (٢١ رمضان)' },
  { athkarItemId: 'o5', hijriMonth: 9, hijriDay: 23, label: 'ليلة القدر (٢٣ رمضان)' },
  { athkarItemId: 'o6', hijriMonth: 10, hijriDay: 1, label: 'عيد الفطر' },
  { athkarItemId: 'o7', hijriMonth: 11, hijriDay: 25, label: 'دحو الأرض' },
  { athkarItemId: 'o8', hijriMonth: 12, hijriDay: 9, label: 'يوم عرفة' },
  { athkarItemId: 'o9', hijriMonth: 12, hijriDay: 10, label: 'عيد الأضحى' },
  { athkarItemId: 'o10', hijriMonth: 12, hijriDay: 18, label: 'عيد الغدير' },
];
