import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import PhoneFrameWrapper from '@/components/PhoneFrameWrapper';
import { useThemeContext } from '@/contexts/theme-contexts';
import { getSelectedBackground } from '@/utils/backgroundSettings';

// إعداد سلوك الإشعارات - تطلع كتنبيه + صوت حتى لو التطبيق مفتوح
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ===== باليت الألوان: أزرق نيوني موحد لكل العناصر =====
const C = {
  neon: '#00E5FF',
  white: '#FFFFFF',
  glass: 'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(255,255,255,0.22)',
  muted: 'rgba(255,255,255,0.55)',
};
const GOLD = C.neon; // كل العناصر (الرئيسية والثانوية) تستخدم نفس الأزرق النيوني
const BLUE = C.neon;
const NEON_RGB = '0,229,255'; // لاستخدامه بخلفيات rgba الشفافة

// دالة تنسيق رقمين (٠٥ بدل ٥)
const pad = (n: number) => n.toString().padStart(2, '0');

// تحويل الأرقام الإنجليزية لأرقام عربية (٠١٢٣٤٥٦٧٨٩)
const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const toArabicDigits = (input: string | number) =>
  String(input).replace(/[0-9]/g, (d) => AR_DIGITS[parseInt(d, 10)]);

/**
 * ===========================================================
 * أصوات المؤذنين - طريقة التفعيل:
 *
 * المسارات بالأسفل صارت مربوطة مسبقاً بالكود (require)، كل الي
 * تحتاجه هو تحط ملفات mp3 الفعلية بنفس الأسماء بهذا المسار:
 *
 *    assets/sounds/adhan/
 *
 * بنفس أسماء الملفات المكتوبة بكل require() بالأسفل، مثلاً:
 *    assets/sounds/adhan/abu_zar_halawaji.mp3
 *
 * شغّل الأمر بالترمنل (بجذر المشروع) عشان يصير عندك المجلد
 * والملفات الفارغة جاهزة بنفس الأسماء تماماً، بعدين تسحب عليها
 * ملفات الصوت الحقيقية وتستبدلها (drag & drop بنفس الاسم):
 *
 *    $files = @("abu_zar_halawaji","amer_khafaji","maytham_tammar","osama_karbalaei","ali_kaabi","amer_kadhimi","rafe_kadhimi","saeed_tousi","hussein_ali_sharif","karim_mansouri")
 *    New-Item -ItemType Directory -Path "assets\sounds\adhan" -Force | Out-Null
 *    foreach ($f in $files) { New-Item -ItemType File -Path "assets\sounds\adhan\$f.mp3" -Force | Out-Null }
 *
 * ملاحظة مهمة عن عمق المسار: "../../assets/..." مبني على افتراض
 * إنه هذا الملف موجود بـ src/app/settings/prayer-times.tsx وإنه
 * مجلد assets موجود جوا src (يعني src/assets/sounds/adhan)، بنفس
 * مكان باقي أصول التطبيق (backgrounds, fonts, maraji). إذا صارلك
 * خطأ "Cannot find module"، تأكد المجلد فعلاً جوا src/assets مو
 * بجذر المشروع، وعدّل عدد ../ إذا احتاج.
 * ===========================================================
 */
type MuezzinVoice = {
  id: string;
  label: string;
  flag: string;
  country: string;
  note: string;
  file: any;
};

const MUEZZIN_VOICES: MuezzinVoice[] = [
  { id: 'abu_zar_halawaji', label: 'أباذر الحلواجي', flag: '🇮🇶', country: 'العراق', note: 'رادود ومؤذن عراقي مشهور، له ألبومات أذان', file: require('../../assets/sounds/adhan/abu_zar_halawaji.mp3') },
  { id: 'amer_kadhimi', label: 'عامر الكاظمي', flag: '🇮🇶', country: 'العراق', note: 'قارئ من الكاظمية، مركز أول عالمي بالأذان', file: require('../../assets/sounds/adhan/amer_kadhimi.mp3') },
  { id: 'osama_karbalaei', label: 'الحاج أسامة الكربلائي', flag: '🇮🇶', country: 'العراق', note: 'مؤذن العتبتين الحسينية والعباسية المقدستين', file: require('../../assets/sounds/adhan/osama_karbalaei.mp3') },
  { id: 'amer_khafaji', label: 'عامر الخفاجي', flag: '🇮🇶', country: 'العراق', note: 'مؤذن الروضة الكاظمية المطهرة في بغداد', file: require('../../assets/sounds/adhan/amer_khafaji.mp3') },
  { id: 'saeed_tousi', label: 'سعيد الطوسي', flag: '🇮🇷', country: 'إيران', note: 'قارئ ومؤذن إيراني من طهران', file: require('../../assets/sounds/adhan/saeed_tousi.mp3') },
];

// ===== أصوات إضافية (مو مرفوعة بالتطبيق) - المستخدم يدوّرها بيوتيوب ويستوردها بنفسه =====
type AdditionalVoice = { id: string; label: string; flag: string; country: string; note: string };
const ADDITIONAL_MUEZZIN_VOICES: AdditionalVoice[] = [
  { id: 'rafe_kadhimi', label: 'رافع الكاظمي', flag: '🇮🇶', country: 'العراق', note: 'مؤذن العتبة الكاظمية المقدسة في بغداد' },
  { id: 'maytham_tammar', label: 'ميثم التمار', flag: '🇮🇶', country: 'العراق', note: 'مؤذن عراقي، أذان بمقام الحجاز' },
  { id: 'ali_kaabi', label: 'علي الكعبي', flag: '🇮🇶', country: 'العراق', note: 'مؤذن العتبة الحسينية المقدسة في كربلاء' },
  { id: 'hussein_ali_sharif', label: 'حسين علي شريف', flag: '🇮🇷', country: 'إيران', note: 'قارئ ومؤذن إيراني مشهور' },
  { id: 'karim_mansouri', label: 'كريم منصوري', flag: '🇮🇷', country: 'إيران', note: 'قارئ ومؤذن إيراني من عبادان' },
];

type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
type PrayerTimes = Record<PrayerKey, string>;

const PRAYER_LABELS: { key: PrayerKey; title: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'fajr', title: 'الفجر', icon: 'partly-sunny' },
  { key: 'sunrise', title: 'الشروق', icon: 'sunny' },
  { key: 'dhuhr', title: 'الظهر', icon: 'sunny' },
  { key: 'asr', title: 'العصر', icon: 'sunny-outline' },
  { key: 'maghrib', title: 'المغرب', icon: 'moon-outline' },
  { key: 'isha', title: 'العشاء', icon: 'moon' },
];

// الصلوات الفعلية (الشروق مو صلاة، بس نعرضها كعلامة وقت) - تُستخدم لحساب "الصلاة الجاية"
const ACTUAL_PRAYER_ORDER: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

const LEAD_OPTIONS = [5, 10, 15, 30];

const CALC_METHOD_LABEL = 'الطريقة الجعفرية (الشيعة الاثنا عشرية) - المرجع الفلكي: جامعة طهران';

/**
 * ملاحظة مهمة عن طريقة الحساب: جربنا زاوية "طهران" الفلكية (١٧.٧° فجر،
 * ٤.٥° مغرب) بافتراض إنها تحل الفرق مع تطبيق الكفيل تلقائياً، لكن
 * المقارنة الفعلية (٢٠٢٦-٠٧-١١، بغداد/الكاظمية) أثبتت إنه الفرق ضل
 * موجود: فجرنا متأخر ١٢ دقيقة عن الكفيل، ومغربنا متأخر ٤ دقايق. يعني
 * الزاوية النظرية وحدها ما كانت كافية.
 *
 * الحل الفعلي المعتمد الآن: أبقينا زاوية طهران (لأنها صحيحة فلكياً
 * وتتحرك صح مع الفصول)، وفوقها أضفنا معايرة tune يدوية مبنية على
 * فرق حقيقي مقاس (مو تخمين): فجر -١٢ دقيقة، مغرب -٤ دقايق. هذا الجمع
 * (زاوية صحيحة + تصحيح تجريبي) أدق من الاعتماد على وحدة بس.
 *
 * إذا لاحظت الفرق يتغير بمرور الوقت (خصوصاً قبل رمضان)، قارن وياهم
 * من جديد وعدّل رقمي "-12" و"-4" بمعامل tune بالأسفل (ترتيبه:
 * Imsak,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Sunset,Isha,Midnight).
 */

// ===== مفاتيح التخزين المحلي (تضل الإعدادات محفوظة حتى لو سكرت التطبيق) =====
const NOTIF_SETTINGS_KEY = 'noor_prayerNotifSettings';
const LEAD_MINUTES_KEY = 'noor_prayerLeadMinutes';
const NOTIF_IDS_KEY = 'noor_prayerNotifIds';
const CUSTOM_VOICE_FILES_KEY = 'noor_additionalVoiceFiles'; // ملفات مستوردة للأصوات الإضافية الجاهزة
const CUSTOM_VOICES_LIST_KEY = 'noor_customVoicesList'; // أصوات مخصصة أضافها المستخدم بنفسه

// ===== كل دول العالم (لاختيار الموقع عند تعذّر GPS) - العلم يتولد تلقائياً من كود الدولة =====
const getFlagEmoji = (countryCode: string) =>
  String.fromCodePoint(...[...countryCode.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));

type CountryOption = { code: string; name: string };
const COUNTRIES: CountryOption[] = [
  { code: 'AF', name: 'أفغانستان' }, { code: 'AL', name: 'ألبانيا' }, { code: 'DZ', name: 'الجزائر' },
  { code: 'AD', name: 'أندورا' }, { code: 'AO', name: 'أنغولا' }, { code: 'AG', name: 'أنتيغوا وباربودا' },
  { code: 'AR', name: 'الأرجنتين' }, { code: 'AM', name: 'أرمينيا' }, { code: 'AU', name: 'أستراليا' },
  { code: 'AT', name: 'النمسا' }, { code: 'AZ', name: 'أذربيجان' }, { code: 'BS', name: 'باهاماس' },
  { code: 'BH', name: 'البحرين' }, { code: 'BD', name: 'بنغلاديش' }, { code: 'BB', name: 'باربادوس' },
  { code: 'BY', name: 'بيلاروسيا' }, { code: 'BE', name: 'بلجيكا' }, { code: 'BZ', name: 'بليز' },
  { code: 'BJ', name: 'بنين' }, { code: 'BT', name: 'بوتان' }, { code: 'BO', name: 'بوليفيا' },
  { code: 'BA', name: 'البوسنة والهرسك' }, { code: 'BW', name: 'بوتسوانا' }, { code: 'BR', name: 'البرازيل' },
  { code: 'BN', name: 'بروناي' }, { code: 'BG', name: 'بلغاريا' }, { code: 'BF', name: 'بوركينا فاسو' },
  { code: 'BI', name: 'بوروندي' }, { code: 'CV', name: 'الرأس الأخضر' }, { code: 'KH', name: 'كمبوديا' },
  { code: 'CM', name: 'الكاميرون' }, { code: 'CA', name: 'كندا' }, { code: 'CF', name: 'أفريقيا الوسطى' },
  { code: 'TD', name: 'تشاد' }, { code: 'CL', name: 'تشيلي' }, { code: 'CN', name: 'الصين' },
  { code: 'CO', name: 'كولومبيا' }, { code: 'KM', name: 'جزر القمر' }, { code: 'CG', name: 'الكونغو' },
  { code: 'CD', name: 'الكونغو الديمقراطية' }, { code: 'CR', name: 'كوستاريكا' }, { code: 'CI', name: 'ساحل العاج' },
  { code: 'HR', name: 'كرواتيا' }, { code: 'CU', name: 'كوبا' }, { code: 'CY', name: 'قبرص' },
  { code: 'CZ', name: 'التشيك' }, { code: 'DK', name: 'الدنمارك' }, { code: 'DJ', name: 'جيبوتي' },
  { code: 'DM', name: 'دومينيكا' }, { code: 'DO', name: 'جمهورية الدومينيكان' }, { code: 'EC', name: 'الإكوادور' },
  { code: 'EG', name: 'مصر' }, { code: 'SV', name: 'السلفادور' }, { code: 'GQ', name: 'غينيا الاستوائية' },
  { code: 'ER', name: 'إريتريا' }, { code: 'EE', name: 'إستونيا' }, { code: 'SZ', name: 'إسواتيني' },
  { code: 'ET', name: 'إثيوبيا' }, { code: 'FJ', name: 'فيجي' }, { code: 'FI', name: 'فنلندا' },
  { code: 'FR', name: 'فرنسا' }, { code: 'GA', name: 'الغابون' }, { code: 'GM', name: 'غامبيا' },
  { code: 'GE', name: 'جورجيا' }, { code: 'DE', name: 'ألمانيا' }, { code: 'GH', name: 'غانا' },
  { code: 'GR', name: 'اليونان' }, { code: 'GD', name: 'غرينادا' }, { code: 'GT', name: 'غواتيمالا' },
  { code: 'GN', name: 'غينيا' }, { code: 'GW', name: 'غينيا بيساو' }, { code: 'GY', name: 'غيانا' },
  { code: 'HT', name: 'هايتي' }, { code: 'HN', name: 'هندوراس' }, { code: 'HU', name: 'هنغاريا' },
  { code: 'IS', name: 'آيسلندا' }, { code: 'IN', name: 'الهند' }, { code: 'ID', name: 'إندونيسيا' },
  { code: 'IR', name: 'إيران' }, { code: 'IQ', name: 'العراق' }, { code: 'IE', name: 'أيرلندا' },
  { code: 'IT', name: 'إيطاليا' }, { code: 'JM', name: 'جامايكا' }, { code: 'JP', name: 'اليابان' },
  { code: 'JO', name: 'الأردن' }, { code: 'KZ', name: 'كازاخستان' }, { code: 'KE', name: 'كينيا' },
  { code: 'KI', name: 'كيريباتي' }, { code: 'KR', name: 'كوريا الجنوبية' }, { code: 'KW', name: 'الكويت' },
  { code: 'KG', name: 'قيرغيزستان' }, { code: 'LA', name: 'لاوس' }, { code: 'LV', name: 'لاتفيا' },
  { code: 'LB', name: 'لبنان' }, { code: 'LS', name: 'ليسوتو' }, { code: 'LR', name: 'ليبيريا' },
  { code: 'LY', name: 'ليبيا' }, { code: 'LI', name: 'ليختنشتاين' }, { code: 'LT', name: 'ليتوانيا' },
  { code: 'LU', name: 'لوكسمبورغ' }, { code: 'MG', name: 'مدغشقر' }, { code: 'MW', name: 'مالاوي' },
  { code: 'MY', name: 'ماليزيا' }, { code: 'MV', name: 'جزر المالديف' }, { code: 'ML', name: 'مالي' },
  { code: 'MT', name: 'مالطا' }, { code: 'MR', name: 'موريتانيا' }, { code: 'MU', name: 'موريشيوس' },
  { code: 'MX', name: 'المكسيك' }, { code: 'MD', name: 'مولدوفا' }, { code: 'MC', name: 'موناكو' },
  { code: 'MN', name: 'منغوليا' }, { code: 'ME', name: 'الجبل الأسود' }, { code: 'MA', name: 'المغرب' },
  { code: 'MZ', name: 'موزمبيق' }, { code: 'MM', name: 'ميانمار' }, { code: 'NA', name: 'ناميبيا' },
  { code: 'NP', name: 'نيبال' }, { code: 'NL', name: 'هولندا' }, { code: 'NZ', name: 'نيوزيلندا' },
  { code: 'NI', name: 'نيكاراغوا' }, { code: 'NE', name: 'النيجر' }, { code: 'NG', name: 'نيجيريا' },
  { code: 'MK', name: 'مقدونيا الشمالية' }, { code: 'NO', name: 'النرويج' }, { code: 'OM', name: 'عمان' },
  { code: 'PK', name: 'باكستان' }, { code: 'PS', name: 'فلسطين' }, { code: 'PA', name: 'بنما' },
  { code: 'PG', name: 'بابوا غينيا الجديدة' }, { code: 'PY', name: 'باراغواي' }, { code: 'PE', name: 'بيرو' },
  { code: 'PH', name: 'الفلبين' }, { code: 'PL', name: 'بولندا' }, { code: 'PT', name: 'البرتغال' },
  { code: 'QA', name: 'قطر' }, { code: 'RO', name: 'رومانيا' }, { code: 'RU', name: 'روسيا' },
  { code: 'RW', name: 'رواندا' }, { code: 'WS', name: 'ساموا' }, { code: 'SM', name: 'سان مارينو' },
  { code: 'SA', name: 'السعودية' }, { code: 'SN', name: 'السنغال' }, { code: 'RS', name: 'صربيا' },
  { code: 'SC', name: 'سيشل' }, { code: 'SL', name: 'سيراليون' }, { code: 'SG', name: 'سنغافورة' },
  { code: 'SK', name: 'سلوفاكيا' }, { code: 'SI', name: 'سلوفينيا' }, { code: 'SB', name: 'جزر سليمان' },
  { code: 'SO', name: 'الصومال' }, { code: 'ZA', name: 'جنوب أفريقيا' }, { code: 'SS', name: 'جنوب السودان' },
  { code: 'ES', name: 'إسبانيا' }, { code: 'LK', name: 'سريلانكا' }, { code: 'SD', name: 'السودان' },
  { code: 'SR', name: 'سورينام' }, { code: 'SE', name: 'السويد' }, { code: 'CH', name: 'سويسرا' },
  { code: 'SY', name: 'سوريا' }, { code: 'TW', name: 'تايوان' }, { code: 'TJ', name: 'طاجيكستان' },
  { code: 'TZ', name: 'تنزانيا' }, { code: 'TH', name: 'تايلاند' }, { code: 'TL', name: 'تيمور الشرقية' },
  { code: 'TG', name: 'توغو' }, { code: 'TO', name: 'تونغا' }, { code: 'TT', name: 'ترينيداد وتوباغو' },
  { code: 'TN', name: 'تونس' }, { code: 'TR', name: 'تركيا' }, { code: 'TM', name: 'تركمانستان' },
  { code: 'UG', name: 'أوغندا' }, { code: 'UA', name: 'أوكرانيا' }, { code: 'AE', name: 'الإمارات العربية المتحدة' },
  { code: 'GB', name: 'المملكة المتحدة' }, { code: 'US', name: 'الولايات المتحدة' }, { code: 'UY', name: 'الأوروغواي' },
  { code: 'UZ', name: 'أوزبكستان' }, { code: 'VU', name: 'فانواتو' }, { code: 'VE', name: 'فنزويلا' },
  { code: 'VN', name: 'فيتنام' }, { code: 'YE', name: 'اليمن' }, { code: 'ZM', name: 'زامبيا' },
  { code: 'ZW', name: 'زيمبابوي' },
].sort((a, b) => a.name.localeCompare(b.name, 'ar'));

export default function PrayerTimesScreen() {
  const router = useRouter();
  const { backgroundId } = useThemeContext();
  const bgOption = getSelectedBackground(backgroundId);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [times, setTimes] = useState<PrayerTimes | null>(null);
  const [cityName, setCityName] = useState<string>('');

  // ===== ١. اختيار الموقع حسب الدولة/المدينة (بديل لو تعطّل تحديد الموقع) =====
  const [showCitySelector, setShowCitySelector] = useState(false);
  const [countrySearchText, setCountrySearchText] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryOption | null>(null);
  const [cityNameInput, setCityNameInput] = useState('');
  const [manualCity, setManualCity] = useState('');

  // ===== ٢. صوت المؤذن + معاينة فعلية =====
  const [selectedVoice, setSelectedVoice] = useState<string>('abu_zar_halawaji');
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // ===== ٢ب. أصوات إضافية مستوردة يدوياً + أصوات خاصة أضافها المستخدم =====
  const [additionalVoiceFiles, setAdditionalVoiceFiles] = useState<Record<string, string>>({});
  const [customVoices, setCustomVoices] = useState<{ id: string; label: string; uri: string }[]>([]);
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomUri, setNewCustomUri] = useState<string | null>(null);
  const [newCustomFileName, setNewCustomFileName] = useState('');

  // ===== ٣. تنبيهات مخصصة لكل صلاة + مدة قابلة للتغيير (شاشة منفصلة) =====
  const [notifSettings, setNotifSettings] = useState<Record<PrayerKey, boolean>>({
    fajr: true, sunrise: false, dhuhr: true, asr: true, maghrib: true, isha: true,
  });
  const [leadMinutes, setLeadMinutes] = useState(15);
  const [showNotifModal, setShowNotifModal] = useState(false);

  // ===== ٤. العد التنازلي للصلاة الجاية (بالثواني) =====
  const [now, setNow] = useState(new Date());

  // ===== ٥. تلميح شرح طريقة الحساب الجعفرية =====
  const [showCalcInfo, setShowCalcInfo] = useState(false);

  useEffect(() => {
    fetchPrayerTimes();
  }, []);

  // ===== تحميل إعدادات التنبيهات المحفوظة (تضل موجودة حتى لو سكرت التطبيق) =====
  useEffect(() => {
    (async () => {
      try {
        const rawSettings = await AsyncStorage.getItem(NOTIF_SETTINGS_KEY);
        if (rawSettings) setNotifSettings(JSON.parse(rawSettings));
        const rawLead = await AsyncStorage.getItem(LEAD_MINUTES_KEY);
        if (rawLead) setLeadMinutes(JSON.parse(rawLead));
      } catch {
        // تجاهل لو ماكو إعدادات محفوظة بعد
      }
    })();
  }, []);

  // ===== تحميل الأصوات الإضافية المستوردة + الأصوات الخاصة المحفوظة =====
  useEffect(() => {
    (async () => {
      try {
        const rawAdditional = await AsyncStorage.getItem(CUSTOM_VOICE_FILES_KEY);
        if (rawAdditional) setAdditionalVoiceFiles(JSON.parse(rawAdditional));
        const rawCustom = await AsyncStorage.getItem(CUSTOM_VOICES_LIST_KEY);
        if (rawCustom) setCustomVoices(JSON.parse(rawCustom));
      } catch {
        // تجاهل لو ماكو شي محفوظ بعد
      }
    })();
  }, []);

  // ===== حفظ الإعدادات تلقائياً كل ما المستخدم يغيّرها =====
  useEffect(() => {
    AsyncStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(notifSettings)).catch(() => {});
  }, [notifSettings]);

  useEffect(() => {
    AsyncStorage.setItem(LEAD_MINUTES_KEY, JSON.stringify(leadMinutes)).catch(() => {});
  }, [leadMinutes]);

  useEffect(() => {
    AsyncStorage.setItem(CUSTOM_VOICE_FILES_KEY, JSON.stringify(additionalVoiceFiles)).catch(() => {});
  }, [additionalVoiceFiles]);

  useEffect(() => {
    AsyncStorage.setItem(CUSTOM_VOICES_LIST_KEY, JSON.stringify(customVoices)).catch(() => {});
  }, [customVoices]);

  // ===== إعادة جدولة الإشعارات الفعلية كل ما تتغير المواقيت أو الإعدادات =====
  useEffect(() => {
    if (!times) return;
    scheduleNotificationsForTimes(times, notifSettings, leadMinutes);
  }, [times, notifSettings, leadMinutes]);

  // لما يفشل تحديد الموقع، نفتح اختيار الدولة/المدينة تلقائياً
  useEffect(() => {
    if (errorMsg) setShowCitySelector(true);
  }, [errorMsg]);

  // ساعة حية تحدّث كل ثانية لحساب العد التنازلي
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // تنظيف الصوت عند مغادرة الشاشة
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  // ===== لما المستخدم يضغط على إشعار الصلاة، نشغّل الأذان الكامل بصوت المؤذن المختار =====
  // (أنظمة التشغيل ما تسمح بصوت إشعار أطول من ٣٠ ثانية، فهذا البديل العملي: تنبيه قصير،
  // وبمجرد ما يضغط عليه المستخدم يفتح التطبيق ويشغل الأذان الكامل تلقائياً)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      const bundledVoice = MUEZZIN_VOICES.find((v) => v.id === selectedVoice);
      if (bundledVoice?.file) {
        previewVoice(bundledVoice.file, bundledVoice.id, false);
        return;
      }
      const importedUri =
        additionalVoiceFiles[selectedVoice] || customVoices.find((v) => v.id === selectedVoice)?.uri;
      if (importedUri) {
        previewVoice(importedUri, selectedVoice, false);
      }
    });
    return () => sub.remove();
  }, [selectedVoice, additionalVoiceFiles, customVoices]);

  // ===== طلب صلاحية الإشعارات من الجهاز =====
  const requestNotificationPermission = async (): Promise<boolean> => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert(
        'الإشعارات غير مفعّلة',
        'لازم تسمح بالإشعارات من إعدادات الجهاز عشان توصلك تنبيهات الصلاة'
      );
      return false;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('prayer-times', {
        name: 'تنبيهات الصلاة',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    return true;
  };

  // ===== إلغاء الإشعارات المجدولة سابقاً (قبل إعادة الجدولة بإعدادات جديدة) =====
  const cancelScheduledPrayerNotifications = async () => {
    try {
      const raw = await AsyncStorage.getItem(NOTIF_IDS_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
    } catch {
      // تجاهل
    }
  };

  // ===== جدولة إشعار متكرر يومياً لكل صلاة مفعّلة (يستمر حتى لو ما فتحت التطبيق كذا يوم) =====
  const scheduleNotificationsForTimes = async (
    currentTimes: PrayerTimes,
    settings: Record<PrayerKey, boolean>,
    lead: number
  ) => {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    await cancelScheduledPrayerNotifications();

    const newIds: string[] = [];

    for (const p of PRAYER_LABELS) {
      if (p.key === 'sunrise') continue; // الشروق مو صلاة، ما نسوي له تنبيه
      if (!settings[p.key]) continue;

      const [h, m] = currentTimes[p.key].split(':').map(Number);

      // نحسب الوقت ناقص مدة التنبيه، مع لف الساعات إذا صار سالب (مثلاً 00:05 ناقص 15 دقيقة)
      let totalMinutes = h * 60 + m - lead;
      totalMinutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
      const triggerHour = Math.floor(totalMinutes / 60);
      const triggerMinute = totalMinutes % 60;

      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'قربت الصلاة',
            body: `باقي ${lead} دقيقة على صلاة ${p.title}`,
            sound: true,
          },
          trigger: {
            hour: triggerHour,
            minute: triggerMinute,
            repeats: true,
          } as unknown as Notifications.DailyTriggerInput,
        });
        newIds.push(id);
      } catch {
        // تجاهل خطأ صلاة وحدة وكمل الباقي
      }
    }

    await AsyncStorage.setItem(NOTIF_IDS_KEY, JSON.stringify(newIds));
  };

  const fetchPrayerTimes = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('لازم تسمح بالوصول للموقع عشان نحسب مواقيت الصلاة بدقة، أو دوّر مدينتك بالأسفل');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      try {
        const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geo && geo[0]) {
          setCityName(geo[0].city || geo[0].region || '');
        }
      } catch {
        // تجاهل لو فشل
      }

      // Aladhan API - method 99 مخصص بزاوية طهران الفلكية (فجر 17.7°) لمطابقة الكفيل
      const res = await fetch(
        `https://api.aladhan.com/v1/timings?latitude=${latitude}&longitude=${longitude}&method=99&methodSettings=17.7,4.5,14&school=0&tune=0,-12,0,0,0,-4,0,0,0`
      );
      const data = await res.json();

      if (data?.data?.timings) {
        const t = data.data.timings;
        setTimes({
          fajr: t.Fajr,
          sunrise: t.Sunrise,
          dhuhr: t.Dhuhr,
          asr: t.Asr,
          maghrib: t.Maghrib,
          isha: t.Isha,
        });
      } else {
        setErrorMsg('ما تم جلب مواقيت الصلاة، حاول مرة ثانية أو دوّر مدينتك بالأسفل');
      }
    } catch (err) {
      setErrorMsg('حدث خطأ بالاتصال، تأكد من الإنترنت وحاول مرة ثانية');
    } finally {
      setLoading(false);
    }
  };

  // ===== جلب المواقيت حسب عنوان نصي (يُستخدم للاختيار حسب الدولة/المدينة أو الكتابة اليدوية) =====
  const fetchByAddress = async (address: string, displayName: string) => {
    if (!address.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `https://api.aladhan.com/v1/timingsByAddress?address=${encodeURIComponent(address.trim())}&method=99&methodSettings=17.7,4.5,14&school=0&tune=0,-12,0,0,0,-4,0,0,0`
      );
      const data = await res.json();
      if (data?.data?.timings) {
        const t = data.data.timings;
        setTimes({
          fajr: t.Fajr,
          sunrise: t.Sunrise,
          dhuhr: t.Dhuhr,
          asr: t.Asr,
          maghrib: t.Maghrib,
          isha: t.Isha,
        });
        setCityName(displayName);
        setShowCitySelector(false);
      } else {
        setErrorMsg('ما لكينا نتائج بهذا الموقع، جرب مدينة ثانية');
      }
    } catch {
      setErrorMsg('حدث خطأ بالاتصال، تأكد من الإنترنت وحاول مرة ثانية');
    } finally {
      setLoading(false);
    }
  };

  const confirmCountryCity = () => {
    if (!selectedCountry || !cityNameInput.trim()) return;
    fetchByAddress(`${cityNameInput.trim()}, ${selectedCountry.name}`, cityNameInput.trim());
  };

  const fetchByManualCity = () => {
    if (!manualCity.trim()) return;
    fetchByAddress(manualCity.trim(), manualCity.trim());
  };

  // ===== فتح بحث يوتيوب باسم المؤذن + "أذان" =====
  const openYoutubeSearch = (label: string) => {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(label + ' أذان')}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('خطأ', 'تعذّر فتح يوتيوب');
    });
  };

  // ===== استيراد ملف صوتي من الجهاز وربطه بصوت إضافي جاهز (بالاسم) =====
  const importForAdditionalVoice = async (voiceId: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      const destDir = `${FileSystem.documentDirectory}muezzin_sounds/`;
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true }).catch(() => {});
      const destPath = `${destDir}${voiceId}.mp3`;
      await FileSystem.copyAsync({ from: asset.uri, to: destPath });

      setAdditionalVoiceFiles((prev) => ({ ...prev, [voiceId]: destPath }));
      Alert.alert('تم', 'انربط الصوت بنجاح، تگدر تعاينه الحين');
    } catch {
      Alert.alert('خطأ', 'تعذّر استيراد الملف');
    }
  };

  // ===== اختيار ملف للصوت المخصص الجديد (قبل الحفظ) =====
  const pickCustomFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      setNewCustomUri(result.assets[0].uri);
      setNewCustomFileName(result.assets[0].name || 'ملف صوتي');
    } catch {
      Alert.alert('خطأ', 'تعذّر اختيار الملف');
    }
  };

  // ===== حفظ الصوت المخصص الجديد بعد اختيار الاسم والملف =====
  const saveCustomVoice = async () => {
    if (!newCustomName.trim() || !newCustomUri) {
      Alert.alert('ناقص شي', 'لازم تكتب اسم وتختار ملف صوتي قبل الحفظ');
      return;
    }
    try {
      const id = `custom_${Date.now()}`;
      const destDir = `${FileSystem.documentDirectory}muezzin_sounds/`;
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true }).catch(() => {});
      const destPath = `${destDir}${id}.mp3`;
      await FileSystem.copyAsync({ from: newCustomUri, to: destPath });

      setCustomVoices((prev) => [...prev, { id, label: newCustomName.trim(), uri: destPath }]);
      setShowAddCustomModal(false);
      setNewCustomName('');
      setNewCustomUri(null);
      setNewCustomFileName('');
    } catch {
      Alert.alert('خطأ', 'تعذّر حفظ الصوت الجديد');
    }
  };

  // ===== معاينة أي صوت (أساسي / إضافي مستورد / مخصص) =====
  const previewVoice = async (playableUri: any, id: string, isNotReady: boolean) => {
    if (isNotReady) {
      Alert.alert('غير مرتبط بعد', 'استورد ملف الصوت أول من زر "استيراد" حتى تگدر تعاينه');
      return;
    }
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setPreviewingId(id);
      const source = typeof playableUri === 'string' ? { uri: playableUri } : playableUri;
      const { sound } = await Audio.Sound.createAsync(source);
      soundRef.current = sound;
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPreviewingId(null);
        }
      });
    } catch {
      Alert.alert('خطأ', 'تعذّر تشغيل عينة الصوت');
      setPreviewingId(null);
    }
  };

  const stopPreview = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setPreviewingId(null);
  };

  const selectedVoiceLabel =
    MUEZZIN_VOICES.find((v) => v.id === selectedVoice)?.label ||
    ADDITIONAL_MUEZZIN_VOICES.find((v) => v.id === selectedVoice)?.label ||
    customVoices.find((v) => v.id === selectedVoice)?.label ||
    'اختر صوت المؤذن';

  // ===== حساب الصلاة الجاية + العد التنازلي بالثواني =====
  const nextPrayerInfo = useMemo(() => {
    if (!times) return null;
    const candidates = ACTUAL_PRAYER_ORDER.map((key) => {
      const [h, m] = times[key].split(':').map(Number);
      const d = new Date(now);
      d.setHours(h, m, 0, 0);
      return { key, date: d };
    });
    let next = candidates.find((c) => c.date.getTime() > now.getTime());
    let isTomorrow = false;
    if (!next) {
      const fajr = candidates[0];
      next = { key: fajr.key, date: new Date(fajr.date.getTime() + 24 * 60 * 60 * 1000) };
      isTomorrow = true;
    }
    const diffMs = next.date.getTime() - now.getTime();
    const totalSec = Math.max(0, Math.floor(diffMs / 1000));
    const hh = Math.floor(totalSec / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;
    const title = PRAYER_LABELS.find((p) => p.key === next!.key)?.title ?? '';
    return { key: next.key, title, isTomorrow, hh, mm, ss };
  }, [times, now]);

  // ===== محتوى شاشة التنبيهات (تُعرض كصفحة منفصلة عبر Modal، بنفس خلفية التطبيق الزجاجية) =====
  const notifModalContent = (
    <SafeAreaView style={[styles.container, !bgOption.image && { backgroundColor: bgOption.color }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowNotifModal(false)} style={styles.backBtn}>
            <Ionicons name="chevron-forward" size={22} color={C.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>التنبيهات</Text>
          <View style={{ width: 34 }} />
        </View>

        <Text style={styles.leadLabel}>نبّهني قبل الصلاة بـ</Text>
        <View style={styles.leadRow}>
          {LEAD_OPTIONS.map((min) => (
            <TouchableOpacity
              key={min}
              style={[styles.leadChip, leadMinutes === min && styles.leadChipActive]}
              onPress={() => setLeadMinutes(min)}
            >
              <Text style={[styles.leadChipText, leadMinutes === min && styles.leadChipTextActive]}>
                {toArabicDigits(min)} د
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.glassCard}>
          {PRAYER_LABELS.filter((p) => p.key !== 'sunrise').map((p, index, arr) => (
            <View
              key={p.key}
              style={[styles.notifRow, index < arr.length - 1 && styles.rowBorder]}
            >
              <Text style={styles.notifRowTitle}>{p.title}</Text>
              <Switch
                value={notifSettings[p.key]}
                onValueChange={(v) => setNotifSettings((prev) => ({ ...prev, [p.key]: v }))}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: BLUE }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

        <Text style={styles.notifHint}>
          الإشعارات تنجدول تلقائياً وتوصلك حتى لو التطبيق مسكر، وتتحدث كل ما تغيّر مدة التنبيه
          أو تفعّل/تعطّل صلاة معينة.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );

  // ===== محتوى اختيار الموقع حسب الدولة/المدينة (كل دول العالم + كتابة حرة للمدينة) =====
  const filteredCountries = COUNTRIES.filter((c) =>
    c.name.includes(countrySearchText.trim())
  );

  const citySelectorBlock = (
    <View style={styles.citySelectorBox}>
      <Text style={styles.manualCityLabel}>اختر بلدك</Text>
      <View style={styles.countrySearchRow}>
        <Ionicons name="search" size={16} color={C.muted} />
        <TextInput
          value={countrySearchText}
          onChangeText={setCountrySearchText}
          placeholder="دوّر اسم بلدك..."
          placeholderTextColor={C.muted}
          style={styles.countrySearchInput}
        />
      </View>

      <ScrollView style={styles.countryListScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        <View style={styles.countryChipRow}>
          {filteredCountries.map((c) => (
            <TouchableOpacity
              key={c.code}
              style={[styles.countryChip, selectedCountry?.code === c.code && styles.countryChipActive]}
              onPress={() => { setSelectedCountry(c); setCityNameInput(''); }}
            >
              <Text style={styles.countryChipText}>{getFlagEmoji(c.code)} {c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {selectedCountry && (
        <>
          <Text style={[styles.manualCityLabel, { marginTop: 14 }]}>
            اكتب اسم مدينتك بـ {selectedCountry.name}
          </Text>
          <View style={styles.manualCityRow}>
            <TextInput
              value={cityNameInput}
              onChangeText={setCityNameInput}
              placeholder="مثال: بغداد"
              placeholderTextColor={C.muted}
              style={styles.manualCityInput}
              onSubmitEditing={confirmCountryCity}
            />
            <TouchableOpacity style={styles.manualCityBtn} onPress={confirmCountryCity}>
              <Ionicons name="checkmark" size={18} color="#0d1f2d" />
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ===== أو الكتابة اليدوية المباشرة (بدون اختيار دولة) ===== */}
      <Text style={[styles.manualCityLabel, { marginTop: 18 }]}>أو اكتب المدينة والدولة مباشرة</Text>
      <View style={styles.manualCityRow}>
        <TextInput
          value={manualCity}
          onChangeText={setManualCity}
          placeholder="مثال: بغداد، العراق"
          placeholderTextColor={C.muted}
          style={styles.manualCityInput}
          onSubmitEditing={fetchByManualCity}
        />
        <TouchableOpacity style={styles.manualCityBtn} onPress={fetchByManualCity}>
          <Ionicons name="search" size={18} color="#0d1f2d" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const screenContent = (
    <SafeAreaView style={[styles.container, !bgOption.image && { backgroundColor: bgOption.color }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/settings')} style={styles.backBtn}>
            <Ionicons name="chevron-forward" size={22} color={C.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>أوقات الصلاة</Text>
          <View style={{ width: 34 }} />
        </View>

        {!loading && (
          <View style={styles.cityRow}>
            <Text style={styles.cityText}>{cityName || 'حدد موقعك'}</Text>
            <TouchableOpacity onPress={() => setShowCitySelector((s) => !s)}>
              <Text style={styles.changeCityText}>تغيير الموقع</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={GOLD} />
            <Text style={styles.loadingText}>جاري تحديد المواقيت...</Text>
          </View>
        )}

        {!loading && errorMsg && (
          <View style={styles.centerBox}>
            <Ionicons name="alert-circle-outline" size={40} color="#f87171" />
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchPrayerTimes}>
              <Text style={styles.retryBtnText}>إعادة المحاولة (الموقع)</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && showCitySelector && citySelectorBlock}

        {!loading && !errorMsg && times && (
          <>
            {/* ===== الصلاة الجاية + العد التنازلي بالثواني ===== */}
            {nextPrayerInfo && (
              <View style={styles.nextPrayerCard}>
                <Text style={styles.nextPrayerLabel}>
                  {nextPrayerInfo.isTomorrow ? 'الصلاة الجاية (غداً)' : 'الصلاة الجاية'}
                </Text>
                <Text style={styles.nextPrayerTitle}>{nextPrayerInfo.title}</Text>
                <Text style={styles.nextPrayerCountdown}>
                  {toArabicDigits(
                    `${nextPrayerInfo.hh > 0 ? pad(nextPrayerInfo.hh) + ':' : ''}${pad(nextPrayerInfo.mm)}:${pad(nextPrayerInfo.ss)}`
                  )}
                </Text>
              </View>
            )}

            <View style={styles.glassCard}>
              {PRAYER_LABELS.map((p, index) => {
                const isNext = nextPrayerInfo?.key === p.key;
                return (
                  <View
                    key={p.key}
                    style={[
                      styles.row,
                      index < PRAYER_LABELS.length - 1 && styles.rowBorder,
                      isNext && styles.rowHighlight,
                    ]}
                  >
                    <View style={[styles.iconBox, isNext && styles.iconBoxHighlight]}>
                      <Ionicons name={p.icon} size={18} color={isNext ? '#0d1f2d' : GOLD} />
                    </View>
                    <Text style={[styles.rowTitle, isNext && { color: GOLD }]}>{p.title}</Text>
                    <Text style={styles.rowTime}>{toArabicDigits(times[p.key])}</Text>
                  </View>
                );
              })}
            </View>

            {/* ===== طريقة الحساب ===== */}
            <TouchableOpacity
              style={styles.calcMethodRow}
              onPress={() => setShowCalcInfo((s) => !s)}
              activeOpacity={0.7}
            >
              <Ionicons name="information-circle-outline" size={14} color={C.muted} />
              <Text style={styles.calcMethodText}>{CALC_METHOD_LABEL}</Text>
            </TouchableOpacity>

            {showCalcInfo && (
              <View style={styles.calcInfoBox}>
                <Text style={styles.calcInfoText}>
                  الطريقة الجعفرية هي طريقة حساب فلكية معتمدة عالمياً عند الشيعة الاثنا عشرية
                  لحساب زوايا الفجر والعشاء بدقة توافق المذهب الجعفري. المرجع الفلكي المستخدم
                  بالحساب هو معهد الجيوفيزياء بجامعة طهران، وهذا مرجع فلكي بحت (لحساب زاوية
                  الشمس) ومو مرجعية دينية أو فتوى.
                </Text>
              </View>
            )}
          </>
        )}

        {/* ===== صوت المؤذن ===== */}
        <Text style={styles.sectionLabel}>صوت المؤذن</Text>
        <TouchableOpacity
          style={styles.selectorBox}
          onPress={() => setShowVoicePicker(!showVoicePicker)}
          activeOpacity={0.75}
        >
          <Ionicons name="volume-high" size={20} color={BLUE} />
          <Text style={styles.selectorText}>{selectedVoiceLabel}</Text>
          <Ionicons name={showVoicePicker ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
        </TouchableOpacity>

        {showVoicePicker && (
          <View style={styles.voiceList}>
            {/* ===== الأصوات الجاهزة (استخدام بسيط بضغطة وحدة) ===== */}
            {MUEZZIN_VOICES.map((voice, index) => (
              <View key={voice.id} style={[styles.voiceRow, styles.rowBorder]}>
                <TouchableOpacity
                  style={styles.voiceRowMain}
                  onPress={() => { setSelectedVoice(voice.id); setShowVoicePicker(false); }}
                >
                  <Ionicons
                    name={selectedVoice === voice.id ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={selectedVoice === voice.id ? BLUE : C.muted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.voiceRowText}>{voice.flag} {voice.label}</Text>
                    <Text style={styles.voiceRowSubtitle}>{voice.country} - {voice.note}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.previewBtn}
                  onPress={() =>
                    previewingId === voice.id
                      ? stopPreview()
                      : previewVoice(voice.file, voice.id, !voice.file)
                  }
                >
                  <Ionicons
                    name={previewingId === voice.id ? 'stop-circle' : 'play-circle-outline'}
                    size={22}
                    color={BLUE}
                  />
                </TouchableOpacity>
              </View>
            ))}

            {/* ===== أصوات إضافية: دور له بيوتيوب + استيراد ===== */}
            <Text style={styles.voiceSectionLabel}>أصوات إضافية (دوّرها واستوردها بنفسك)</Text>
            {ADDITIONAL_MUEZZIN_VOICES.map((voice) => {
              const importedUri = additionalVoiceFiles[voice.id];
              return (
                <View key={voice.id} style={[styles.voiceRow, styles.rowBorder]}>
                  <TouchableOpacity
                    style={styles.voiceRowMain}
                    onPress={() => {
                      if (!importedUri) {
                        Alert.alert('استورد الصوت أول', 'اضغط زر الاستيراد وحط ملف الصوت قبل لا تختاره');
                        return;
                      }
                      setSelectedVoice(voice.id);
                      setShowVoicePicker(false);
                    }}
                  >
                    <Ionicons
                      name={selectedVoice === voice.id ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={selectedVoice === voice.id ? BLUE : C.muted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.voiceRowText}>{voice.flag} {voice.label}</Text>
                      <Text style={styles.voiceRowSubtitle}>
                        {voice.country} - {importedUri ? 'مرتبط ✓' : 'غير مرتبط بعد'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.previewBtn} onPress={() => openYoutubeSearch(voice.label)}>
                    <Ionicons name="logo-youtube" size={20} color="#f87171" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.previewBtn} onPress={() => importForAdditionalVoice(voice.id)}>
                    <Ionicons name="download-outline" size={20} color={BLUE} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.previewBtn}
                    onPress={() =>
                      previewingId === voice.id ? stopPreview() : previewVoice(importedUri, voice.id, !importedUri)
                    }
                  >
                    <Ionicons
                      name={previewingId === voice.id ? 'stop-circle' : 'play-circle-outline'}
                      size={22}
                      color={BLUE}
                    />
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* ===== أصوات خاصة أضافها المستخدم ===== */}
            {customVoices.length > 0 && (
              <Text style={styles.voiceSectionLabel}>أصواتك الخاصة</Text>
            )}
            {customVoices.map((voice) => (
              <View key={voice.id} style={[styles.voiceRow, styles.rowBorder]}>
                <TouchableOpacity
                  style={styles.voiceRowMain}
                  onPress={() => { setSelectedVoice(voice.id); setShowVoicePicker(false); }}
                >
                  <Ionicons
                    name={selectedVoice === voice.id ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={selectedVoice === voice.id ? BLUE : C.muted}
                  />
                  <Text style={styles.voiceRowText}>{voice.label}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.previewBtn}
                  onPress={() =>
                    previewingId === voice.id ? stopPreview() : previewVoice(voice.uri, voice.id, false)
                  }
                >
                  <Ionicons
                    name={previewingId === voice.id ? 'stop-circle' : 'play-circle-outline'}
                    size={22}
                    color={BLUE}
                  />
                </TouchableOpacity>
              </View>
            ))}

            {/* ===== إضافة صوت خاص جديد ===== */}
            <TouchableOpacity
              style={styles.addCustomRow}
              onPress={() => setShowAddCustomModal(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color={BLUE} />
              <Text style={styles.addCustomText}>إضافة صوت خاص</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ===== التنبيهات (تفتح كصفحة منفصلة) ===== */}
        <Text style={styles.sectionLabel}>التنبيهات</Text>
        <TouchableOpacity
          style={styles.selectorBox}
          onPress={() => setShowNotifModal(true)}
          activeOpacity={0.75}
        >
          <Ionicons name="notifications" size={20} color={BLUE} />
          <Text style={styles.selectorText}>إعدادات تنبيهات الصلاة</Text>
          <Ionicons name="chevron-back" size={18} color={C.muted} />
        </TouchableOpacity>

      </ScrollView>

      <Modal
        visible={showNotifModal}
        animationType="slide"
        onRequestClose={() => setShowNotifModal(false)}
      >
        {withAppBackground(notifModalContent)}
      </Modal>

      <Modal
        visible={showAddCustomModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowAddCustomModal(false)}
      >
        <View style={styles.addCustomOverlay}>
          <View style={styles.addCustomBox}>
            <Text style={styles.addCustomTitle}>إضافة صوت خاص</Text>

            <TextInput
              value={newCustomName}
              onChangeText={setNewCustomName}
              placeholder="اسم المؤذن أو الصوت"
              placeholderTextColor={C.muted}
              style={styles.manualCityInput}
            />

            <TouchableOpacity style={styles.pickFileBtn} onPress={pickCustomFile}>
              <Ionicons name="document-attach-outline" size={18} color="#0d1f2d" />
              <Text style={styles.retryBtnText}>
                {newCustomFileName || 'اختيار ملف الصوت'}
              </Text>
            </TouchableOpacity>

            <View style={styles.addCustomActions}>
              <TouchableOpacity
                style={[styles.confirmLocationBtn, { flex: 1 }]}
                onPress={saveCustomVoice}
              >
                <Text style={styles.retryBtnText}>حفظ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelBtn, { flex: 1 }]}
                onPress={() => {
                  setShowAddCustomModal(false);
                  setNewCustomName('');
                  setNewCustomUri(null);
                  setNewCustomFileName('');
                }}
              >
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  const wrapInPhoneFrame = (node: ReactElement) => <PhoneFrameWrapper>{node}</PhoneFrameWrapper>;

  // يغلّف أي محتوى بنفس خلفية التطبيق (صورة أو لون) - يُستخدم للشاشة الرئيسية وشاشة التنبيهات
  function withAppBackground(node: ReactElement) {
    if (bgOption.image) {
      return (
        <View style={[styles.bgFill, { backgroundColor: bgOption.color }]}>
          <ImageBackground
            source={bgOption.image}
            style={styles.bgImage}
            resizeMode="cover"
            imageStyle={styles.bgImageFull}
          >
            <View style={[styles.bgOverlay, { opacity: bgOption.overlayOpacity }]} />
            {node}
          </ImageBackground>
        </View>
      );
    }
    return <View style={[styles.bgFill, { backgroundColor: bgOption.color }]}>{node}</View>;
  }

  return wrapInPhoneFrame(withAppBackground(screenContent));
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgFill: { flex: 1 },
  bgImage: { flex: 1, width: '100%', height: '100%' },
  bgImageFull: { width: '100%', height: '100%' },
  bgOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },

  scroll: { paddingHorizontal: 16, paddingBottom: 130 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    color: C.white, fontSize: 20, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  cityText: {
    color: C.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  changeCityText: {
    color: BLUE,
    fontSize: 12,
    fontWeight: '700',
  },

  centerBox: {
    alignItems: 'center',
    paddingVertical: 50,
    gap: 12,
  },
  loadingText: { color: C.muted, fontSize: 13 },
  errorText: { color: '#f87171', fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
  retryBtn: {
    backgroundColor: BLUE,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  retryBtnText: { color: '#0d1f2d', fontWeight: '700' },

  // ===== اختيار الموقع حسب الدولة/المدينة =====
  citySelectorBox: { width: '100%', marginTop: 8, marginBottom: 20 },
  countrySearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  countrySearchInput: { flex: 1, color: C.white, fontSize: 13, textAlign: 'right' },
  countryListScroll: { maxHeight: 180, marginBottom: 6 },
  manualCityLabel: { color: C.muted, fontSize: 12, marginBottom: 8, textAlign: 'right' },
  countryChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  countryChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: C.glass,
  },
  countryChipActive: { backgroundColor: BLUE, borderColor: BLUE },
  countryChipText: { color: C.white, fontSize: 13, fontWeight: '600' },
  confirmLocationBtn: {
    backgroundColor: GOLD,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },

  manualCityRow: { flexDirection: 'row', width: '100%', gap: 8 },
  manualCityInput: {
    flex: 1,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: C.white,
    fontSize: 13,
    textAlign: 'right',
  },
  manualCityBtn: {
    width: 42,
    backgroundColor: BLUE,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ===== الصلاة الجاية =====
  nextPrayerCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `rgba(${NEON_RGB},0.5)`,
    backgroundColor: `rgba(${NEON_RGB},0.10)`,
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 14,
  },
  nextPrayerLabel: { color: C.muted, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  nextPrayerTitle: {
    color: GOLD,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    textShadowColor: `rgba(${NEON_RGB},0.8)`,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  nextPrayerCountdown: {
    color: C.white,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
    textShadowColor: `rgba(${NEON_RGB},0.6)`,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },

  glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: C.glass,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  rowHighlight: { backgroundColor: `rgba(${NEON_RGB},0.10)` },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: `rgba(${NEON_RGB},0.15)`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBoxHighlight: { backgroundColor: GOLD },
  rowTitle: { color: C.white, fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'right' },
  rowTime: { color: GOLD, fontSize: 15, fontWeight: '700' },

  // ===== طريقة الحساب =====
  calcMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 20,
  },
  calcMethodText: { color: C.muted, fontSize: 11 },
  calcInfoBox: {
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    marginTop: -8,
  },
  calcInfoText: { color: C.white, fontSize: 12, lineHeight: 20, textAlign: 'right' },

  sectionLabel: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'right',
  },

  selectorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.glassBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectorText: { color: C.white, fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right' },

  voiceList: {
    backgroundColor: C.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.glassBorder,
    marginTop: 6,
    overflow: 'hidden',
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  voiceRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
  },
  voiceRowText: { color: C.white, fontSize: 14, textAlign: 'right' },
  voiceRowSubtitle: { color: C.muted, fontSize: 11, textAlign: 'right', marginTop: 2 },
  previewBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  voiceSectionLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  addCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  addCustomText: { color: BLUE, fontSize: 14, fontWeight: '700' },

  addCustomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  addCustomBox: {
    width: '100%',
    backgroundColor: 'rgba(20,30,40,0.95)',
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  addCustomTitle: { color: C.white, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  pickFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BLUE,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addCustomActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: { color: C.white, fontWeight: '700' },

  // ===== مدة التنبيه =====
  leadLabel: { color: C.muted, fontSize: 12, marginBottom: 8, textAlign: 'right' },
  leadRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  leadChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: C.glass,
    alignItems: 'center',
  },
  leadChipActive: { backgroundColor: BLUE, borderColor: BLUE },
  leadChipText: { color: C.muted, fontSize: 13, fontWeight: '700' },
  leadChipTextActive: { color: '#0d1f2d' },

  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  notifRowTitle: { color: C.white, fontSize: 14, fontWeight: '700' },
  notifHint: { color: C.muted, fontSize: 11, textAlign: 'right', marginTop: 14, lineHeight: 18 },
});
