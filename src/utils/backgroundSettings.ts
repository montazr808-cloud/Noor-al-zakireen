// ===== utils/backgroundSettings.ts =====

import AsyncStorage from '@react-native-async-storage/async-storage';

const BG_STORAGE_KEY = '@app_settings_background';

export type BackgroundId =
  | 'quran'
  | 'purple_flowers'
  | 'medina'
  | 'mecca'
  | 'karbala'
  | 'najef'
  | 'masjid_azraq'
  | 'purple_mandala'
  | 'blue_mandala'
  | 'karbala_aerial'
  | 'kadhimiya';
export type BackgroundOption = {
  id: BackgroundId;
  label: string;
  name: string;
  labelEn: string;
  image?: any;
  color: string;
  overlayOpacity: number;
};

const makeOption = (
  id: BackgroundId,
  label: string,
  labelEn: string,
  color: string,
  overlayOpacity: number,
  image?: any
): BackgroundOption => ({
  id, label, name: label, labelEn, color, overlayOpacity, image,
});

export const BACKGROUND_OPTIONS: BackgroundOption[] = [
  makeOption('quran',           'القرآن الكريم',      'Holy Quran',      '#1a1200', 0.40,
    require('../assets/backgrounds/quran.jpg')),
  makeOption('purple_flowers',  'أزهار بنفسجية',      'Purple Flowers',  '#2d1b4e', 0.35,
    require('../assets/backgrounds/purple_flowers.jpg')),
  makeOption('medina',          'المدينة المنورة',    'Medina',          '#2a1f0e', 0.45,
    require('../assets/backgrounds/medina.jpg')),
  makeOption('mecca',           'مكة المكرمة',        'Mecca',           '#0a0e1a', 0.40,
    require('../assets/backgrounds/mecca.jpg')),
  makeOption('karbala',         'كربلاء المقدسة',    'Karbala',         '#1a1200', 0.35,
    require('../assets/backgrounds/karbala.jpg')),
  makeOption('najef',           'النجف الأشرف',       'Najaf',           '#1a1200', 0.35,
    require('../assets/backgrounds/najef.jpg')),
  makeOption('masjid_azraq',    'المسجد الأزرق',      'Blue Mosque',     '#0e1b2a', 0.35,
    require('../assets/backgrounds/masjid_azraq.jpg')),
  // ملاحظة: كان مسجل هنا ان الملفين الفعليين على القرص مبدّلين بالمحتوى، فسوينا
  // تبديل بالـ require تعويضاً عن هذا. المستخدم يبلغ الآن إن التسميات صارت معكوسة
  // (يعني هذا التعويض صار هو المشكلة، إما لأن التشخيص الأصلي كان معكوس، أو الملفات
  // انصلحت على القرص من عدها) - رجعناها لمصدرها الطبيعي المباشر، وننتظر تأكيده
  makeOption('purple_mandala',  'ماندالا بنفسجية',    'Purple Mandala',  '#2a1240', 0.30,
    require('../assets/backgrounds/purple_mandala.jpg')),
  makeOption('blue_mandala',    'ماندالا زرقاء',      'Blue Mandala',    '#0b1f2e', 0.30,
    require('../assets/backgrounds/blue_mandala.jpg')),
  makeOption('karbala_aerial',  'كربلاء من الأعلى',   'Karbala Aerial',  '#0a0a0a', 0.35,
    require('../assets/backgrounds/karbala_aerial.jpg')),
  makeOption('kadhimiya',       'الكاظمية',           'Kadhimiya',       '#1a1200', 0.35,
    require('../assets/backgrounds/kadhimiya.jpg')),
];

export const BACKGROUNDS = BACKGROUND_OPTIONS;

export async function getSavedBackgroundId(): Promise<BackgroundId> {
  try {
    const val = await AsyncStorage.getItem(BG_STORAGE_KEY);
    if (val) return val as BackgroundId;
  } catch {}
  return 'quran';
}

export async function saveSelectedBackgroundId(id: BackgroundId): Promise<void> {
  try {
    await AsyncStorage.setItem(BG_STORAGE_KEY, id);
  } catch {}
}

export function getSelectedBackground(id: BackgroundId): BackgroundOption {
  return BACKGROUND_OPTIONS.find((b) => b.id === id) ?? BACKGROUND_OPTIONS[0];
}
