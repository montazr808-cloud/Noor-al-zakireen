// ===== utils/muezzinVoices.ts =====
// مصدر مشترك لبيانات أصوات المؤذنين (المرفوعة بالتطبيق + الإضافية).
// كان هذا معرّف محلياً بملف شاشة أوقات الصلاة نفسها بس - نقلناه هنا لأن ملف
// جدولة الأذان بالخلفية (notifeeAzan.ts) يحتاج نفس البيانات بالضبط بدون
// ما يعتمد على أي شاشة React مفتوحة (الجدولة تصير حتى لو الشاشة مسكرة).

export type MuezzinVoice = {
  id: string;
  label: string;
  flag: string;
  country: string;
  note: string;
  file: any;
};

export const MUEZZIN_VOICES: MuezzinVoice[] = [
  { id: 'abu_zar_halawaji', label: 'أباذر الحلواجي', flag: '🇮🇶', country: 'العراق', note: 'رادود ومؤذن عراقي مشهور، له ألبومات أذان', file: require('../assets/sounds/adhan/abu_zar_halawaji.mp3') },
  { id: 'amer_kadhimi', label: 'عامر الكاظمي', flag: '🇮🇶', country: 'العراق', note: 'قارئ من الكاظمية، مركز أول عالمي بالأذان', file: require('../assets/sounds/adhan/amer_kadhimi.mp3') },
  { id: 'osama_karbalaei', label: 'الحاج أسامة الكربلائي', flag: '🇮🇶', country: 'العراق', note: 'مؤذن العتبتين الحسينية والعباسية المقدستين', file: require('../assets/sounds/adhan/osama_karbalaei.mp3') },
  { id: 'amer_khafaji', label: 'عامر الخفاجي', flag: '🇮🇶', country: 'العراق', note: 'مؤذن الروضة الكاظمية المطهرة في بغداد', file: require('../assets/sounds/adhan/amer_khafaji.mp3') },
  { id: 'saeed_tousi', label: 'سعيد الطوسي', flag: '🇮🇷', country: 'إيران', note: 'قارئ ومؤذن إيراني من طهران', file: require('../assets/sounds/adhan/saeed_tousi.mp3') },
];

// أصوات إضافية (مو مرفوعة بالتطبيق) - المستخدم يدوّرها بيوتيوب ويستوردها بنفسه
export type AdditionalVoice = { id: string; label: string; flag: string; country: string; note: string };
export const ADDITIONAL_MUEZZIN_VOICES: AdditionalVoice[] = [
  { id: 'rafe_kadhimi', label: 'رافع الكاظمي', flag: '🇮🇶', country: 'العراق', note: 'مؤذن العتبة الكاظمية المقدسة في بغداد' },
  { id: 'maytham_tammar', label: 'ميثم التمار', flag: '🇮🇶', country: 'العراق', note: 'مؤذن عراقي، أذان بمقام الحجاز' },
  { id: 'ali_kaabi', label: 'علي الكعبي', flag: '🇮🇶', country: 'العراق', note: 'مؤذن العتبة الحسينية المقدسة في كربلاء' },
  { id: 'hussein_ali_sharif', label: 'حسين علي شريف', flag: '🇮🇷', country: 'إيران', note: 'قارئ ومؤذن إيراني مشهور' },
  { id: 'karim_mansouri', label: 'كريم منصوري', flag: '🇮🇷', country: 'إيران', note: 'قارئ ومؤذن إيراني من عبادان' },
];

export const DEFAULT_VOICE_ID = 'abu_zar_halawaji';

// ===== تخزين اختيار المستخدم =====
// ملاحظة مهمة: هذا المفتاح ما كان موجود سابقاً - اختيار صوت المؤذن كان بس
// بذاكرة الشاشة المؤقتة (useState) وما ينحفظ إطلاقاً، فكان يرجع للافتراضي
// كل ما تفتح التطبيق من جديد (هذا كان سبب "اختيار المؤذن ما يبين متطبق").
export const SELECTED_VOICE_KEY = 'noor_selectedMuezzinVoice';
export const CUSTOM_VOICE_FILES_KEY = 'noor_additionalVoiceFiles';
export const CUSTOM_VOICES_LIST_KEY = 'noor_customVoicesList';

export type CustomVoice = { id: string; label: string; uri: string };

// يحدد مصدر التشغيل الفعلي لصوت مؤذن معين (بحث بنفس الترتيب: مرفوع بالتطبيق
// -> صوت إضافي مستورد -> صوت مخصص أضافه المستخدم بنفسه) - يرجع null إذا ما
// لقى شي (يعني المستخدم اختار صوت إضافي بس ما ربط له ملف بعد)
export function resolveVoiceSource(
  voiceId: string,
  additionalVoiceFiles: Record<string, string>,
  customVoices: CustomVoice[]
): any | null {
  const bundled = MUEZZIN_VOICES.find((v) => v.id === voiceId);
  if (bundled?.file) return bundled.file;

  const importedUri = additionalVoiceFiles[voiceId];
  if (importedUri) return { uri: importedUri };

  const custom = customVoices.find((v) => v.id === voiceId);
  if (custom?.uri) return { uri: custom.uri };

  return null;
}