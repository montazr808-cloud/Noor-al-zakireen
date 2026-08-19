import { PrayerTimes as AdhanPrayerTimes, CalculationParameters, Coordinates, Madhab } from 'adhan';
// @ts-ignore -- مكتبة tz-lookup ماعدها تعريفات TypeScript جاهزة، بس تشتغل زين بجافاسكربت خام
import tzlookup from 'tz-lookup';

export type PrayerTimesResult = {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
};

/**
 * إعدادات الحساب: زاوية طهران الفلكية (فجر ١٧.٧°، مغرب ٤.٥° تحت الأفق بدل مجرد الغروب،
 * عشاء ١٤°) — تقارب الطريقة الجعفرية. فوقها معايرة adjustments يدوية مبنية على مقارنة
 * فعلية مع تطبيق الكفيل بتاريخ ٢٠٢٦-٠٧-١٤ (فجر -٢ دقيقة، مغرب -٣ دقايق).
 *
 * تنبيه: هذا التصحيح اليدوي قد ينحرف كل كم اسبوع (نفس المشكلة الي كانت موجودة
 * بطريقة Aladhan API القديمة) لأنه فرق حقيقي مقاس بيوم وحد، مو ثابت رياضي. إذا
 * لاحظت فرق يتكرر، قارن من جديد وعدّل fajr/maghrib بالأسفل.
 */
function buildCalculationParameters(): CalculationParameters {
  const params = new CalculationParameters(null, 17.7, 14);
  params.maghribAngle = 4.5;
  params.madhab = Madhab.Shafi;
  params.adjustments = {
    fajr: -2,
    sunrise: 0,
    dhuhr: 0,
    asr: 0,
    maghrib: -3,
    isha: 0,
  };
  return params;
}

// تنسيق الوقت (ساعة:دقيقة، 24 ساعة) بالمنطقة الزمنية الصحيحة لموقع الحساب —
// مهم لأن adhan يرجع كائن Date عالمي (UTC instant)، وبدون تحديد المنطقة الزمنية
// الصحيحة راح ينعرض بتوقيت جهاز المستخدم، اللي ممكن يكون مختلف عن الموقع المختار.
function formatInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(date);
}

export type GeocodeResult = { latitude: number; longitude: number };

/**
 * يحول عنوان نصي (اسم مدينة/دولة، عربي أو أي لغة) لاحداثيات، عبر خدمة
 * Nominatim (OpenStreetMap) — أثبت وأكثر تناسقاً من جيوكودر نظام الجهاز
 * (Location.geocodeAsync)، اللي طلع يفشل بمدن/دول كثيرة خصوصاً بالعربي
 * لأنه يعتمد على تغطية خرائط آبل/كوكل حسب الجهاز والمنطقة.
 *
 * ملاحظة: Nominatim مجانية بس محدودة بمعدل طلب وحد بالثانية وتحتاج
 * User-Agent يعرف عن التطبيق (حسب سياسة الاستخدام)، وهذا مطبق بالأسفل.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ar&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NoorAlZakireenApp/1.0 (Islamic prayer times app)' },
    });
    const data = await res.json();
    if (Array.isArray(data) && data[0]) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      if (!Number.isNaN(lat) && !Number.isNaN(lon)) return { latitude: lat, longitude: lon };
    }
  } catch {
    // نتجاهل ونرجع null، والمتصل يقرر البديل الاحتياطي
  }
  return null;
}

/**
 * يحسب أوقات الصلاة الخمسة محلياً (بدون اتصال إنترنت) بالاحداثيات المعطاة.
 * يحل المنطقة الزمنية تلقائياً من الاحداثيات نفسها عبر tz-lookup، فيصير
 * صحيح حتى لو الموقع المختار مختلف عن منطقة جهاز المستخدم الزمنية.
 *
 * ملاحظة توافق: يحتاج Intl.DateTimeFormat بدعم timeZone كامل على الجهاز
 * (متوفر افتراضياً بمحرك Hermes الحديث بمشاريع Expo/RN الحالية). إذا صار
 * خطأ "Invalid time zone" على جهاز قديم جداً، هذا مؤشر إنه دعم Intl ناقص.
 */
export function getPrayerTimes(latitude: number, longitude: number, date: Date = new Date()): PrayerTimesResult {
  const coordinates = new Coordinates(latitude, longitude);
  const params = buildCalculationParameters();
  const prayerTimes = new AdhanPrayerTimes(coordinates, date, params);
  const timeZone = tzlookup(latitude, longitude) as string;

  return {
    fajr: formatInTimeZone(prayerTimes.fajr, timeZone),
    sunrise: formatInTimeZone(prayerTimes.sunrise, timeZone),
    dhuhr: formatInTimeZone(prayerTimes.dhuhr, timeZone),
    asr: formatInTimeZone(prayerTimes.asr, timeZone),
    maghrib: formatInTimeZone(prayerTimes.maghrib, timeZone),
    isha: formatInTimeZone(prayerTimes.isha, timeZone),
  };
}
