import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  ImageBackground,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// ⚠️ SafeAreaView من react-native نفسها ما تشتغل بالاندرويد (بس بالآيفون) — لازم من هذي المكتبة
import { SafeAreaView } from 'react-native-safe-area-context';

import PhoneFrameWrapper from '@/components/PhoneFrameWrapper';
import { useThemeContext } from '@/contexts/theme-contexts';
import { getSelectedBackground } from '@/utils/backgroundSettings';
import {
  ADDITIONAL_MUEZZIN_VOICES,
  CUSTOM_VOICE_FILES_KEY,
  CUSTOM_VOICES_LIST_KEY,
  DEFAULT_VOICE_ID,
  MUEZZIN_VOICES,
  SELECTED_VOICE_KEY,
  type CustomVoice,
} from '@/utils/muezzinVoices';
import { getExactAlarmPermissionStatus, openExactAlarmSettings, openOverlayPermissionSettings, scheduleAzanNotifications } from '@/utils/notifeeAzan';
import { scheduleAthkarNotifications } from '@/utils/notificationScheduler';
import { geocodeAddress, getPrayerTimes } from '@/utils/prayerCalc';

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

// ===== أصوات المؤذنين =====
// البيانات (الأصوات الجاهزة + الإضافية) صارت مستوردة من utils/muezzinVoices.ts
// بدل ما تتعرف هنا محلياً - هذا المصدر المشترك الوحيد اللي يعتمد عليه أيضاً
// utils/notifeeAzan.ts (تشغيل الأذان الفعلي بالخلفية)، حتى ما يصير اختلاف
// بين شنو يبين بهذي الشاشة وشنو فعلياً ينشغل وقت الأذان.

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
 * المقارنة الفعلية أثبتت إنه الفرق يضل موجود ويتغير:
 *
 *   - قياس ٢٠٢٦-٠٧-١١: فجرنا متأخر ١٢ دقيقة عن الكفيل، مغربنا متأخر ٤ دقايق
 *     → تم اعتماد tune: فجر -١٢، مغرب -٤
 *   - قياس ٢٠٢٦-٠٧-١٤ (بعد ٣ أيام فقط): بنفس التعديل صار فجرنا مبكر ١٠
 *     دقايق عن الكفيل (٣:١٢ بدل ٣:٢٢)، ومغربنا مبكر دقيقة وحدة (٧:٣٠ بدل ٧:٣١)
 *     → تم تعديل tune الحين إلى: فجر -٢، مغرب -٣
 *
 * يعني الفرق مع الكفيل نفسه مو ثابت بمرور الأيام (يمكن الكفيل يستخدم
 * منهج فلكي مختلف يتحرك بسرعة غير سرعة زاوية طهران مع تغيّر الفصل).
 * هذا معناه إن رقم tune ثابت وحدة راح تكرر تنحرف كل كم يوم، وهذا
 * الأصلح فعلياً هو مقارنة دورية (كل أسبوعين تقريباً) وتحديث الرقم، مو
 * حل نهائي دائم. إذا حبيت حل أدق وأثبت على المدى الطويل، بديل مقترح:
 * التبديل لمكتبة حساب محلية (مثل adhan-js) بمنهج Jafari المدمج فيها
 * بدل الاعتماد على tune يدوي فوق منهج مخصص.
 *
 * إذا لاحظت الفرق يتغير بمرور الوقت (خصوصاً قبل رمضان)، قارن وياهم
 * من جديد وعدّل رقمي الفجر والمغرب بمعامل tune بالأسفل (ترتيبه:
 * Imsak,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Sunset,Isha,Midnight).
 */

// ===== مفاتيح التخزين المحلي (تضل الإعدادات محفوظة حتى لو سكرت التطبيق) =====
const NOTIF_SETTINGS_KEY = 'noor_prayerNotifSettings';
const LEAD_MINUTES_KEY = 'noor_prayerLeadMinutes';
const NOTIF_IDS_KEY = 'noor_prayerNotifIds';
// إحداثيات آخر موقع محسوب - نخزنها حتى نقدر نجدول تنبيهات الأذكار (نظام
// منفصل عن تنبيهات "قربت الصلاة" فوگ) بدون لا نحتاج نطلب الموقع من جديد
const SAVED_COORDS_KEY = 'noor_savedCoords';
// ملاحظة: CUSTOM_VOICE_FILES_KEY / CUSTOM_VOICES_LIST_KEY / SELECTED_VOICE_KEY
// صارت مستوردة من utils/muezzinVoices.ts (نفس المصدر اللي يعتمد عليه notifeeAzan.ts
// وقت تشغيل الأذان الفعلي بالخلفية) - عرّفهم هنا محلياً كان يسبب اختلاف/فقدان
// اختيار المستخدم لصوت المؤذن.

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

  // ===== توست زجاجي متناسق مع تصميم التطبيق - بديل لنوافذ Alert البيضاء
  // الافتراضية بكل رسائل هذي الشاشة (حفظ، خطأ، تنبيه ناقص) =====
  type ToastKind = 'success' | 'error' | 'warning';
  const [toast, setToast] = useState<{ title: string; message: string; kind: ToastKind } | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (title: string, message: string, kind: ToastKind = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ title, message, kind });
    toastAnim.setValue(0);
    Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    toastTimerRef.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        setToast(null);
      });
    }, 2800);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ===== ١. اختيار الموقع حسب الدولة/المدينة (بديل لو تعطّل تحديد الموقع) =====
  const [showCitySelector, setShowCitySelector] = useState(false);
  const [countrySearchText, setCountrySearchText] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryOption | null>(null);
  const [cityNameInput, setCityNameInput] = useState('');
  const [manualCity, setManualCity] = useState('');

  // ===== ٢. صوت المؤذن + معاينة فعلية =====
  const [selectedVoice, setSelectedVoice] = useState<string>(DEFAULT_VOICE_ID);
  // هل خلصنا تحميل الاختيار المحفوظ من AsyncStorage؟ نستخدمها حتى ما نكتب
  // فوگ التخزين بالقيمة الافتراضية قبل لا نقرا الاختيار الحقيقي المحفوظ
  const [voiceLoaded, setVoiceLoaded] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  // ===== اختيار مؤقت (مسودة) لصوت المؤذن - يتغيّر وانت تتصفح القائمة، وما
  // ينحفظ فعلياً إلا لما تضغط زر "حفظ" الصريح. يخليك تتصفح/تعاين بدون
  // ما يتغيّر الصوت الفعلي المستخدم بالأذان قبل ما تأكد =====
  const [pendingVoice, setPendingVoice] = useState<string>(DEFAULT_VOICE_ID);
  const soundRef = useRef<AudioPlayer | null>(null);

  // ===== ٢ب. أصوات إضافية مستوردة يدوياً + أصوات خاصة أضافها المستخدم =====
  const [additionalVoiceFiles, setAdditionalVoiceFiles] = useState<Record<string, string>>({});
  const [customVoices, setCustomVoices] = useState<CustomVoice[]>([]);
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
  // ===== نسخة مؤقتة (مسودة) من إعدادات التنبيهات - نفس فكرة pendingVoice
  // فوگ: تتغيّر وانت تلعب بالقائمة داخل شاشة التنبيهات، وما تنحفظ فعلياً
  // (ولا تنجدول الإشعارات الحقيقية) إلا لما تضغط زر "حفظ" =====
  const [pendingLeadMinutes, setPendingLeadMinutes] = useState(15);
  const [pendingNotifSettings, setPendingNotifSettings] = useState<Record<PrayerKey, boolean>>({
    fajr: true, sunrise: false, dhuhr: true, asr: true, maghrib: true, isha: true,
  });
  // نفس مبدأ voiceLoaded بالأسفل - نتجنب كتابة notifSettings/leadMinutes
  // فوگ القيمة المحفوظة بالتخزين قبل لا نخلص نقرأها أول مرة عند فتح الشاشة
  const [notifSettingsLoaded, setNotifSettingsLoaded] = useState(false);

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
        if (rawSettings) {
          const parsed = JSON.parse(rawSettings);
          setNotifSettings(parsed);
          setPendingNotifSettings(parsed);
        }
        const rawLead = await AsyncStorage.getItem(LEAD_MINUTES_KEY);
        if (rawLead) {
          const parsedLead = JSON.parse(rawLead);
          setLeadMinutes(parsedLead);
          setPendingLeadMinutes(parsedLead);
        }
      } catch {
        // تجاهل لو ماكو إعدادات محفوظة بعد
      } finally {
        setNotifSettingsLoaded(true);
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

  // ===== تحميل اختيار صوت المؤذن المحفوظ (هذا كان ناقص سابقاً - سبب رجوع
  // الاختيار للافتراضي كل ما يفتح التطبيق، ونظام الأذان بالخلفية notifeeAzan.ts
  // ما يعرف شنو اخترت لأنه هذا المفتاح ما كان ينكتب أصلاً) =====
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SELECTED_VOICE_KEY);
        if (raw) {
          setSelectedVoice(raw);
          setPendingVoice(raw);
        }
      } catch {
        // تجاهل - يضل على الافتراضي
      } finally {
        setVoiceLoaded(true);
      }
    })();
  }, []);

  // ===== حفظ اختيار صوت المؤذن تلقائياً كل ما يتغير - بنفس المفتاح اللي يقرا
  // منه notifeeAzan.ts وقت تشغيل الأذان الفعلي بالخلفية =====
  useEffect(() => {
    if (!voiceLoaded) return; // نتجنب الكتابة فوگ القيمة المحفوظة قبل لا نقراها
    AsyncStorage.setItem(SELECTED_VOICE_KEY, selectedVoice).catch(() => {});
  }, [selectedVoice, voiceLoaded]);

  // ===== حفظ الإعدادات تلقائياً كل ما المستخدم يغيّرها =====
  // (نتجنب الكتابة فوگ القيمة المحفوظة بالقيم الافتراضية قبل لا نخلص نقرأها
  // أول - نفس السبب اللي كان يسوي مشكلة "الاختيار يرجع للافتراضي" بصوت المؤذن)
  useEffect(() => {
    if (!notifSettingsLoaded) return;
    AsyncStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(notifSettings)).catch(() => {});
  }, [notifSettings, notifSettingsLoaded]);

  useEffect(() => {
    if (!notifSettingsLoaded) return;
    AsyncStorage.setItem(LEAD_MINUTES_KEY, JSON.stringify(leadMinutes)).catch(() => {});
  }, [leadMinutes, notifSettingsLoaded]);

  useEffect(() => {
    AsyncStorage.setItem(CUSTOM_VOICE_FILES_KEY, JSON.stringify(additionalVoiceFiles)).catch(() => {});
  }, [additionalVoiceFiles]);

  useEffect(() => {
    AsyncStorage.setItem(CUSTOM_VOICES_LIST_KEY, JSON.stringify(customVoices)).catch(() => {});
  }, [customVoices]);

  // ===== إعادة جدولة الإشعارات الفعلية كل ما تتغير المواقيت أو الإعدادات =====
  useEffect(() => {
    if (!times || !notifSettingsLoaded) return;
    scheduleNotificationsForTimes(times, notifSettings, leadMinutes);
  }, [times, notifSettings, leadMinutes, notifSettingsLoaded]);

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
      soundRef.current?.release();
    };
  }, []);

  // ===== لما المستخدم يضغط على إشعار الصلاة، نشغّل الأذان الكامل بصوت المؤذن المختار =====
  // (أنظمة التشغيل ما تسمح بصوت إشعار أطول من ٣٠ ثانية، فهذا البديل العملي: تنبيه قصير，
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
      showToast('الإشعارات غير مفعّلة', 'لازم تسمح بالإشعارات من إعدادات الجهاز عشان توصلك تنبيهات الصلاة', 'warning');
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
            ...(Platform.OS === 'android' ? { channelId: 'prayer-times' } : {}),
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: triggerHour, minute: triggerMinute },
        });
        newIds.push(id);
      } catch (e) {
        // تجاهل خطأ صلاة وحدة وكمل الباقي - بس نسجل الخطأ الحقيقي بالـ logs
        console.error(`[prayer-times] فشلت جدولة تنبيه "${p.title}":`, e);
      }
    }

    await AsyncStorage.setItem(NOTIF_IDS_KEY, JSON.stringify(newIds));

    // ===== نجدول الأذان الفعلي بالخلفية (notifee, أندرويد) بنفس تفعيل/تعطيل
    // كل صلاة من هذي الشاشة - حتى يضل متزامن مع تنبيه "قربت الصلاة" فوگ =====
    if (Platform.OS === 'android') {
      try {
        let coordsForAzan: { latitude: number; longitude: number } | undefined;
        try {
          const rawCoords = await AsyncStorage.getItem(SAVED_COORDS_KEY);
          if (rawCoords) {
            const parsed = JSON.parse(rawCoords);
            coordsForAzan = { latitude: parsed.latitude, longitude: parsed.longitude };
          }
        } catch {
          // تجاهل - بدون coords، الدالة ترجع لجدولة يوم وحد كالسابق (مو خطأ حرج)
        }

        await scheduleAzanNotifications(
          {
            fajr: currentTimes.fajr,
            dhuhr: currentTimes.dhuhr,
            asr: currentTimes.asr,
            maghrib: currentTimes.maghrib,
            isha: currentTimes.isha,
          },
          {
            fajr: settings.fajr,
            dhuhr: settings.dhuhr,
            asr: settings.asr,
            maghrib: settings.maghrib,
            isha: settings.isha,
          },
          coordsForAzan
        );
      } catch {
        // ما نوقف باقي الشاشة لأجل هذا - تنبيه "قربت الصلاة" فوگ ضل شغال بأي حال
      }

      // ===== فحص صلاحية "التنبيهات والمنبهات الدقيقة" - لو مقفلة، أذان الصلاة
      // ممكن يوصل متأخر بدقايق أو يتجمع مع إشعارات ثانية بدل ما يوصل بالضبط
      // بوقته.
      // ⚠️ إصلاح: كانت هذي الكتلة (والكتلة اللي تحتها) تستخدم useRef، اللي
      // ينصفر تلقائياً كل ما تدخل الشاشة من جديد (مكوّن جديد = ref جديد) -
      // يعني الرسالة كانت تطلع بكل مرة تدخل فيها شاشة أوقات الصلاة، مو مرة
      // وحدة فعلياً. الحل: مفتاح دائم بـ AsyncStorage (نفس أسلوب
      // ALARM_PERMISSION_PROMPTED_KEY المستخدم بـ notifications.ts) - يبقى
      // محفوظ حتى بعد إغلاق التطبيق بالكامل، فتطلع الرسالة مرة وحدة طول عمر
      // التطبيق على الجهاز (إلا إذا المستخدم مسح بيانات التطبيق يدوياً) =====
      try {
        const alarmPrompted = await AsyncStorage.getItem('@prayer_alarm_permission_prompted_v1');
        if (alarmPrompted !== 'true') {
          const alarmStatus = await getExactAlarmPermissionStatus();
          if (alarmStatus === 'denied') {
            await AsyncStorage.setItem('@prayer_alarm_permission_prompted_v1', 'true');
            Alert.alert(
              'صلاحية إضافية مطلوبة لدقة الأذان',
              'حتى يوصلك الأذان بالضبط بوقته (مو متأخر بدقايق)، فعّل صلاحية "التنبيهات والمنبهات" لتطبيق نور الذاكرين من إعدادات الجهاز.',
              [
                { text: 'لاحقاً', style: 'cancel' },
                { text: 'فتح الإعدادات', onPress: () => openExactAlarmSettings() },
              ]
            );
          }
        }
      } catch {
        // تجاهل فشل قراءة/كتابة AsyncStorage - أسوأ حالة الرسالة تطلع مرة زيادة
      }

      // ===== صلاحية "الظهور فوق التطبيقات الأخرى" - نفس مبدأ التخزين الدائم
      // فوگ، بمفتاح منفصل =====
      try {
        const overlayPrompted = await AsyncStorage.getItem('@prayer_overlay_permission_prompted_v1');
        if (overlayPrompted !== 'true') {
          await AsyncStorage.setItem('@prayer_overlay_permission_prompted_v1', 'true');
          Alert.alert(
            'صلاحية إضافية موصى فيها',
            'حتى تنعرض بطاقة الأذان بشكل موثوق فوگ أي تطبيق ثاني تكون فاتحه، فعّل صلاحية "الظهور فوق التطبيقات الأخرى" لتطبيق نور الذاكرين من إعدادات الجهاز.',
            [
              { text: 'لاحقاً', style: 'cancel' },
              { text: 'فتح الإعدادات', onPress: () => openOverlayPermissionSettings() },
            ]
          );
        }
      } catch {
        // تجاهل
      }
    }
  };

  // ===== حفظ الإحداثيات وتشغيل جدولة تنبيهات الأذكار (نظام منفصل عن =====
  // ===== تنبيهات "قربت الصلاة" فوگ - يذكّر بالتعقيب/الذكر بعد دخول وقت الصلاة =====
  const saveCoordsAndScheduleAthkar = async (latitude: number, longitude: number, city?: string) => {
    try {
      await AsyncStorage.setItem(SAVED_COORDS_KEY, JSON.stringify({ latitude, longitude, city }));
      await scheduleAthkarNotifications({ latitude, longitude });
    } catch {
      // ما نوقف الشاشة لأجل هذا - أهم شي أوقات الصلاة تبين للمستخدم بأي حال
    }
  };

  const fetchPrayerTimes = async (forceRefresh = false) => {
    setLoading(true);
    setErrorMsg(null);

    // لو عندنا إحداثيات محفوظة من قبل وما طالبين تحديث إجباري، نستخدمها فوراً
    // بدل طلب GPS جديد كل مرة تفتح الشاشة - هذا يحل مشكلة "يطلب الموقع من جديد
    // ويحدد من جديد كل ما افتح التطبيق" (الموقع ما يتغير فعلياً بين فتحة وفتحة،
    // بس التوقيت يتحدث تلقائياً لأنه getPrayerTimes يحسب بالتاريخ الحالي دايماً)
    if (!forceRefresh) {
      try {
        const raw = await AsyncStorage.getItem(SAVED_COORDS_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          const computed = getPrayerTimes(cached.latitude, cached.longitude);
          setTimes(computed);
          if (cached.city) setCityName(cached.city);
          setLoading(false);
          scheduleAthkarNotifications({ latitude: cached.latitude, longitude: cached.longitude }).catch(() => {});
          return;
        }
      } catch {
        // ماكو إحداثيات محفوظة أو تعذرت قراءتها - نكمل لجلب GPS جديد بالأسفل
      }
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('لازم تسمح بالوصول للموقع عشان نحسب مواقيت الصلاة بدقة، أو دوّر مدينتك بالأسفل');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      let resolvedCity = '';
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geo && geo[0]) {
          resolvedCity = geo[0].city || geo[0].region || '';
          setCityName(resolvedCity);
        }
      } catch {
        // تجاهل لو فشل
      }

      // حساب محلي بمكتبة adhan (زاوية طهران + معايرة يدوية) — بدون اعتماد على إنترنت،
      // ويحل المنطقة الزمنية تلقائياً من الاحداثيات نفسها
      try {
        const computed = getPrayerTimes(latitude, longitude);
        setTimes(computed);
        saveCoordsAndScheduleAthkar(latitude, longitude, resolvedCity);
      } catch {
        setErrorMsg('صار خطأ بحساب مواقيت الصلاة لهذا الموقع');
      }
    } catch (err) {
      setErrorMsg('حدث خطأ بتحديد الموقع، تأكد من تفعيل GPS وحاول مرة ثانية');
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
      // نجرب Nominatim أول (أثبت مع اسماء الدول/المدن العربية)، وإذا فشلت
      // نرجع لجيوكودر الجهاز كبديل احتياطي
      let coords = await geocodeAddress(address.trim());
      if (!coords) {
        try {
          const geocoded = await Location.geocodeAsync(address.trim());
          if (geocoded && geocoded[0]) {
            coords = { latitude: geocoded[0].latitude, longitude: geocoded[0].longitude };
          }
        } catch {
          // نتجاهل، بيتعامل معه الشرط تحت
        }
      }

      if (!coords) {
        setErrorMsg('ما لكينا نتائج بهذا الموقع، جرب مدينة ثانية أو اكتبها بشكل مختلف');
        setLoading(false);
        return;
      }

      const computed = getPrayerTimes(coords.latitude, coords.longitude);
      setTimes(computed);
      setCityName(displayName);
      setShowCitySelector(false);
      saveCoordsAndScheduleAthkar(coords.latitude, coords.longitude, displayName);
    } catch {
      setErrorMsg('حدث خطأ بتحديد الموقع، تأكد من الإنترنت وحاول مرة ثانية');
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
      showToast('خطأ', 'تعذّر فتح يوتيوب', 'error');
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
      showToast('تم', 'انربط الصوت بنجاح، تگدر تعاينه الحين', 'success');
    } catch {
      showToast('خطأ', 'تعذّر استيراد الملف', 'error');
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
      showToast('خطأ', 'تعذّر اختيار الملف', 'error');
    }
  };

  // ===== حفظ الصوت المخصص الجديد بعد اختيار الاسم والملف =====
  const saveCustomVoice = async () => {
    if (!newCustomName.trim() || !newCustomUri) {
      showToast('ناقص شي', 'لازم تكتب اسم وتختار ملف صوتي قبل الحفظ', 'warning');
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
      showToast('خطأ', 'تعذّر حفظ الصوت الجديد', 'error');
    }
  };

  // ===== معاينة أي صوت (أساسي / إضافي مستورد / مخصص) =====
  const previewVoice = async (playableUri: any, id: string, isNotReady: boolean) => {
    if (isNotReady) {
      showToast('غير مرتبط بعد', 'استورد ملف الصوت أول من زر "استيراد" حتى تگدر تعاينه', 'warning');
      return;
    }
    try {
if (soundRef.current) {
  soundRef.current.release();
  soundRef.current = null;
}
setPreviewingId(id);
const source = typeof playableUri === 'string' ? { uri: playableUri } : playableUri;
const player = createAudioPlayer(source);
soundRef.current = player;
player.play();
player.addListener('playbackStatusUpdate', (status) => {
  if (status.didJustFinish) {
    setPreviewingId(null);
  }
});
    } catch {
      showToast('خطأ', 'تعذّر تشغيل عينة الصوت', 'error');
      setPreviewingId(null);
    }
  };

  const stopPreview = async () => {
    if (soundRef.current) {
      await soundRef.current.pause();
      await soundRef.current.release();
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

  // ===== هل توجد تغييرات غير محفوظة بمسودة التنبيهات؟ (نفس فكرة pendingVoice) =====
  const notifHasUnsavedChanges =
    pendingLeadMinutes !== leadMinutes ||
    (Object.keys(pendingNotifSettings) as PrayerKey[]).some(
      (k) => pendingNotifSettings[k] !== notifSettings[k]
    );

  // ===== إغلاق شاشة التنبيهات بدون حفظ - نرجّع المسودة لآخر قيم محفوظة فعلياً =====
  const discardNotifChangesAndClose = () => {
    setPendingNotifSettings(notifSettings);
    setPendingLeadMinutes(leadMinutes);
    setShowNotifModal(false);
  };

  // ===== حفظ صريح لمسودة التنبيهات - هذا هو اللي يثبّتها فعلياً (يشغّل
  // useEffect الجدولة الحقيقية بالأسفل عبر تغيير notifSettings/leadMinutes) =====
  const saveNotifChanges = () => {
    setNotifSettings(pendingNotifSettings);
    setLeadMinutes(pendingLeadMinutes);
    setShowNotifModal(false);
    showToast('تم الحفظ', 'انحفظت إعدادات التنبيهات وراح تنجدول على أساسها', 'success');
  };

  // ===== محتوى شاشة التنبيهات (تُعرض كصفحة منفصلة عبر Modal، بنفس خلفية التطبيق الزجاجية) =====
  const notifModalContent = (
    <SafeAreaView style={[styles.container, !bgOption.image && { backgroundColor: bgOption.color }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={discardNotifChangesAndClose} style={styles.backBtn}>
            <Ionicons name="chevron-forward" size={22} color={C.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>التنبيهات</Text>
          <View style={{ width: 34 }} />
        </View>

        {/* ===== نفس بانر التنبيه الموجود بصوت المؤذن - بس هسه فيه زر "حفظ"
        جوه البانر نفسه (قريب من مكان الاختيار)، مو بس بالأسفل - طلب صريح
        حتى ما تحتاج تنزل لآخر الشاشة كل ما تغيّر مدة التنبيه أو المؤذن ===== */}
        {notifHasUnsavedChanges && (
          <View style={[styles.unsavedBanner, { borderRadius: 14, marginBottom: 14, borderBottomWidth: 0 }]}>
            <Ionicons name="alert-circle-outline" size={14} color={GOLD} />
            <Text style={[styles.unsavedBannerText, { flex: 1 }]}>
              عندك تغييرات ما انحفظت
            </Text>
            <TouchableOpacity
              style={styles.inlineSaveBtn}
              onPress={saveNotifChanges}
            >
              <Ionicons name="checkmark-circle" size={16} color="#0d1f2d" />
              <Text style={styles.inlineSaveBtnText}>حفظ</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.leadLabel}>نبّهني قبل الصلاة بـ</Text>
        <View style={styles.leadRow}>
          {LEAD_OPTIONS.map((min) => (
            <TouchableOpacity
              key={min}
              style={[styles.leadChip, pendingLeadMinutes === min && styles.leadChipActive]}
              onPress={() => setPendingLeadMinutes(min)}
            >
              <Text style={[styles.leadChipText, pendingLeadMinutes === min && styles.leadChipTextActive]}>
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
                value={pendingNotifSettings[p.key]}
                onValueChange={(v) => setPendingNotifSettings((prev) => ({ ...prev, [p.key]: v }))}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: BLUE }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

        <Text style={styles.notifHint}>
          الإشعارات تنجدول تلقائياً وتوصلك حتى لو التطبيق مسكر، وتتحدث كل ما تحفظ تغيير بمدة
          التنبيه أو تفعيل/تعطيل صلاة معينة.
        </Text>

        {/* ===== زر الحفظ الصريح + إلغاء - بنفس نمط شاشة صوت المؤذن تماماً ===== */}
        <View style={styles.voiceSaveRow}>
          <TouchableOpacity
            style={[styles.confirmLocationBtn, { flex: 1 }]}
            onPress={saveNotifChanges}
          >
            <Ionicons name="checkmark-circle" size={16} color="#0d1f2d" />
            <Text style={styles.retryBtnText}>  حفظ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cancelBtn, { flex: 1 }]}
            onPress={discardNotifChangesAndClose}
          >
            <Text style={styles.cancelBtnText}>إلغاء</Text>
          </TouchableOpacity>
        </View>
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
            <TouchableOpacity style={styles.retryBtn} onPress={() => fetchPrayerTimes(true)}>
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
          onPress={() => {
            if (!showVoicePicker) setPendingVoice(selectedVoice); // نبدأ المسودة من الاختيار المحفوظ فعلياً
            setShowVoicePicker(!showVoicePicker);
          }}
          activeOpacity={0.75}
        >
          <Ionicons name="volume-high" size={20} color={BLUE} />
          <Text style={styles.selectorText}>{selectedVoiceLabel}</Text>
          <Ionicons name={showVoicePicker ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
        </TouchableOpacity>

        {showVoicePicker && (
          <View style={styles.voiceList}>
            {/* ===== الاختيار بالأسفل يغيّر مسودة الصوت (pendingVoice) بس، ومو
            الصوت الفعلي المستخدم بالأذان - لازم تضغط "حفظ الاختيار" تحت حتى
            ينحفظ فعلياً. هذا يخليك تتصفح وتعاين براحتك بدون خوف تغيّر الصوت
            الحالي بالغلط ===== */}
            {pendingVoice !== selectedVoice && (
              <View style={styles.unsavedBanner}>
                <Ionicons name="alert-circle-outline" size={14} color={GOLD} />
                <Text style={[styles.unsavedBannerText, { flex: 1 }]}>
                  اخترت صوت جديد
                </Text>
                <TouchableOpacity
                  style={styles.inlineSaveBtn}
                  onPress={() => {
                    setSelectedVoice(pendingVoice);
                    setShowVoicePicker(false);
                    showToast('تم الحفظ', 'انحفظ صوت المؤذن وراح يُستخدم بالأذان القادم', 'success');
                  }}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#0d1f2d" />
                  <Text style={styles.inlineSaveBtnText}>حفظ</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ===== الأصوات الجاهزة (استخدام بسيط بضغطة وحدة) ===== */}
            {MUEZZIN_VOICES.map((voice, index) => (
              <View key={voice.id} style={[styles.voiceRow, styles.rowBorder]}>
                <TouchableOpacity
                  style={styles.voiceRowMain}
                  onPress={() => setPendingVoice(voice.id)}
                >
                  <Ionicons
                    name={pendingVoice === voice.id ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={pendingVoice === voice.id ? BLUE : C.muted}
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
                        showToast('استورد الصوت أول', 'اضغط زر الاستيراد وحط ملف الصوت قبل لا تختاره', 'warning');
                        return;
                      }
                      setPendingVoice(voice.id);
                    }}
                  >
                    <Ionicons
                      name={pendingVoice === voice.id ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={pendingVoice === voice.id ? BLUE : C.muted}
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
                  onPress={() => setPendingVoice(voice.id)}
                >
                  <Ionicons
                    name={pendingVoice === voice.id ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={pendingVoice === voice.id ? BLUE : C.muted}
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

            {/* ===== زر الحفظ الصريح - هذا هو اللي يثبّت المسودة كصوت الأذان
            الفعلي (يكتبه بـ AsyncStorage عبر selectedVoice) ويسكر القائمة،
            مع زر إلغاء جنبه يرجّع المسودة لآخر صوت محفوظ بدون حفظ ===== */}
            <View style={styles.voiceSaveRow}>
              <TouchableOpacity
                style={[styles.confirmLocationBtn, { flex: 1 }]}
                onPress={() => {
                  setSelectedVoice(pendingVoice);
                  setShowVoicePicker(false);
                  showToast('تم الحفظ', 'انحفظ صوت المؤذن وراح يُستخدم بالأذان القادم', 'success');
                }}
              >
                <Ionicons name="checkmark-circle" size={16} color="#0d1f2d" />
                <Text style={styles.retryBtnText}>  حفظ الاختيار</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelBtn, { flex: 1 }]}
                onPress={() => {
                  setPendingVoice(selectedVoice);
                  setShowVoicePicker(false);
                }}
              >
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ===== التنبيهات (تفتح كصفحة منفصلة) ===== */}
        <Text style={styles.sectionLabel}>التنبيهات</Text>
        <TouchableOpacity
          style={styles.selectorBox}
          onPress={() => {
            setPendingLeadMinutes(leadMinutes);
            setPendingNotifSettings(notifSettings);
            setShowNotifModal(true);
          }}
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
        onRequestClose={discardNotifChangesAndClose}
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
    const toastNode = toast && (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toastWrap,
          {
            opacity: toastAnim,
            transform: [
              { translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
            ],
          },
        ]}
      >
        <View
          style={[
            styles.toastCard,
            toast.kind === 'error' && styles.toastCardError,
            toast.kind === 'warning' && styles.toastCardWarning,
          ]}
        >
          <Ionicons
            name={
              toast.kind === 'error'
                ? 'close-circle'
                : toast.kind === 'warning'
                ? 'alert-circle'
                : 'checkmark-circle'
            }
            size={22}
            color={toast.kind === 'error' ? '#F87171' : toast.kind === 'warning' ? '#FBBF24' : C.neon}
          />
          <View style={styles.toastTextWrap}>
            <Text style={styles.toastTitle}>{toast.title}</Text>
            <Text style={styles.toastMessage}>{toast.message}</Text>
          </View>
        </View>
      </Animated.View>
    );

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
            {toastNode}
          </ImageBackground>
        </View>
      );
    }
    return (
      <View style={[styles.bgFill, { backgroundColor: bgOption.color }]}>
        {node}
        {toastNode}
      </View>
    );
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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

  // ===== توست زجاجي - بديل نوافذ Alert البيضاء لكل رسائل هذي الشاشة =====
  toastWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 36,
    alignItems: 'center',
    zIndex: 999,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(13,20,28,0.92)',
    borderWidth: 1,
    borderColor: `rgba(${NEON_RGB},0.35)`,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  toastCardError: {
    borderColor: 'rgba(248,113,113,0.4)',
  },
  toastCardWarning: {
    borderColor: 'rgba(251,191,36,0.4)',
  },
  toastTextWrap: { flex: 1 },
  toastTitle: { color: C.white, fontWeight: '700', fontSize: 14, marginBottom: 2, textAlign: 'right' },
  toastMessage: { color: C.muted, fontSize: 12.5, textAlign: 'right', lineHeight: 18 },
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

  unsavedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    backgroundColor: `rgba(${NEON_RGB},0.08)`,
  },
  unsavedBannerText: { color: GOLD, fontSize: 11.5, fontWeight: '600', flex: 1, textAlign: 'right' },
  inlineSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: GOLD,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  inlineSaveBtnText: { color: '#0d1f2d', fontSize: 12.5, fontWeight: '700' },
  voiceSaveRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
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