// merge-quran-metadata.js
//
// هذا السكربت يدمج بيانات الجزء/الحزب/الصفحة الحقيقية (من alquran.cloud)
// مع ملف quran-full.json الموجود عندك، وينتج ملف جديد جاهز للاستخدام.
//
// طريقة التشغيل:
//   1. حط هذا الملف بنفس مجلد المشروع (أو أي مكان تحبه)
//   2. افتح الترمنال بنفس المجلد وشغّل:
//        node merge-quran-metadata.js
//   3. بعد ما يخلص، راح يطلعلك ملف جديد اسمه:
//        quran-full-with-meta.json
//   4. انسخه إلى src/assets/ واستبدل به quran-full.json القديم
//      (أو خليه باسم جديد وعدّل مسار require بملف quran.tsx)
//
// ملاحظة: يحتاج اتصال إنترنت وقت التشغيل فقط (مرة وحدة)، والتطبيق نفسه
// بعدها ما يحتاج إنترنت لأن البيانات تنحفظ داخل الملف مباشرة.

const fs = require('fs');
const path = require('path');
const https = require('https');

const CURRENT_QURAN_PATH = path.join(__dirname, 'quran-full.json'); // عدّل المسار إذا الملف بمكان ثاني
const OUTPUT_PATH = path.join(__dirname, 'quran-full-with-meta.json');
const API_URL = 'https://api.alquran.cloud/v1/quran/quran-uthmani';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} عند جلب ${url}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('▶ جاري قراءة الملف الحالي:', CURRENT_QURAN_PATH);
  if (!fs.existsSync(CURRENT_QURAN_PATH)) {
    console.error('✗ ما لقيت الملف. تأكد من المسار CURRENT_QURAN_PATH بأعلى السكربت.');
    process.exit(1);
  }
  const currentData = JSON.parse(fs.readFileSync(CURRENT_QURAN_PATH, 'utf8'));

  console.log('▶ جاري تحميل بيانات الجزء/الحزب/الصفحة من alquran.cloud ...');
  const apiResponse = await fetchJson(API_URL);

  if (!apiResponse || !apiResponse.data || !apiResponse.data.surahs) {
    console.error('✗ شكل استجابة الـ API غير متوقع. راجع الرابط يدوياً بالمتصفح.');
    process.exit(1);
  }

  const apiSurahs = apiResponse.data.surahs; // مصفوفة 114 سورة، كل وحدة فيها ayahs[]

  console.log('▶ جاري الدمج ...');
  let mergedVerses = 0;
  let mismatches = 0;

  const merged = currentData.map((surah) => {
    const apiSurah = apiSurahs.find((s) => s.number === surah.id);
    if (!apiSurah) {
      console.warn(`⚠ لم يتم إيجاد السورة رقم ${surah.id} (${surah.name}) في بيانات الـ API`);
      return surah;
    }

    const newVerses = surah.verses.map((verse) => {
      const apiAyah = apiSurah.ayahs.find((a) => a.numberInSurah === verse.id);
      if (!apiAyah) {
        mismatches++;
        return verse;
      }
      mergedVerses++;
      return {
        ...verse,
        juz: apiAyah.juz,
        hizb: Math.ceil(apiAyah.hizbQuarter / 4), // hizbQuarter من الـ API هو ربع الحزب (1-240)؛ نحوّله لرقم الحزب (1-60)
        page: apiAyah.page,
      };
    });

    return { ...surah, verses: newVerses };
  });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(merged, null, 2), 'utf8');

  console.log('✓ تم الدمج بنجاح');
  console.log(`  - عدد الآيات المدموجة: ${mergedVerses}`);
  if (mismatches > 0) console.log(`  - عدد الآيات غير المتطابقة (تحققها يدوياً): ${mismatches}`);
  console.log('  - الملف الجديد:', OUTPUT_PATH);
  console.log('');
  console.log('الخطوة التالية: انسخ هذا الملف إلى src/assets/quran-full.json (استبدال) ثم أعد تشغيل التطبيق.');
}

main().catch((err) => {
  console.error('✗ صار خطأ:', err.message);
  process.exit(1);
});
