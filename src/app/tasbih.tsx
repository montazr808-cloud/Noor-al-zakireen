import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  Alert,
  Animated,
  Image,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle as SvgCircle } from 'react-native-svg';

import GlassHamburgerMenu from '@/components/GlassHamburgerMenu';
import LogoIntroModal from '@/components/LogoIntroModal';
import PhoneFrameWrapper from '@/components/PhoneFrameWrapper';
import { useThemeContext } from '@/contexts/theme-contexts';
import { getSelectedBackground } from '@/utils/backgroundSettings';
import { getHijriParts, getOccasion } from '@/utils/hijriOccasions';

// ===== باليت ثابتة =====
// خط الآيات القرآنية - "خط عثماني" حقيقي محتاج ملف خط فعلي (متوفر مجاناً مثل
// UthmanicHafs1 أو KFGQPC Uthman Taha Naskh) ينحمّل بـ useFonts (expo-font) بنفس
// الاسم هذا بالضبط. لحد ما ينضاف الملف، RN يتجاهل fontFamily غير الموجود ويرجع
// للخط الافتراضي تلقائياً وبأمان (ما يصير كراش) - فالستايل جاهز والتفعيل بس بإضافة الخط
const QURAN_FONT_FAMILY = 'UthmanicHafs';

const C = {
  navy: '#1C2B39',
  navyLight: '#27394A',
  cream: '#EFE3C8',
  creamDim: 'rgba(239,227,200,0.35)',
  blue: '#3FA9D9',
  blueDim: 'rgba(63,169,217,0.18)',
  neonBlue: '#57C8F2',
  neonGlow: 'rgba(87,200,242,0.55)',
  white: '#FFFFFF',
  glass: 'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(255,255,255,0.22)',
  glassDark: 'rgba(0,0,0,0.28)',
  overlay: 'rgba(28,43,57,0.55)',
};

// لون توهج مختلف لكل ذكر أساسي (هدف ٦ - إضافة)
const DHIKR_GLOW: Record<string, string> = {
  tasbih: '#57C8F2',     // أزرق
  tahmid: '#5BD68C',     // أخضر
  takbir: '#B58CF2',     // بنفسجي
  istighfar: '#F2B85B',  // برتقالي
  tahlil: '#F25B8C',     // وردي
  hawqala: '#5BC9C9',    // فيروزي
  salawat: '#D9C45B',    // ذهبي
};
const getGlow = (id: string) =>
  DHIKR_GLOW[id] ?? (id.startsWith('custom_') ? '#9A9FAE' : C.neonBlue);

// ===== Types =====
type DhikrType = {
  id: string;
  label: string;
  sub: string;
  target: number;
  keywords: string[];
  isCustom?: boolean;
};

// ===== الأذكار الأساسية (موسّعة - هدف ٥) =====
const BASE_DHIKR: DhikrType[] = [
  { id: 'takbir', label: 'تكبير', sub: 'الله أَكْبَر', target: 34,
    keywords: ['الله اكبر', 'الله أكبر', 'تكبير', 'اكبر'] },
  { id: 'tahmid', label: 'تحميد', sub: 'الحَمْدُ لله', target: 33,
    keywords: ['الحمد لله', 'حمدلله', 'الحمدلله', 'الحمد'] },
  { id: 'tasbih', label: 'تسبيح', sub: 'سُبْحَانَ الله', target: 33,
    keywords: ['سبحان الله', 'سبحانه', 'تسبيح', 'سبحان'] },
  { id: 'istighfar', label: 'استغفار', sub: 'أَسْتَغْفِرُ الله', target: 100,
    keywords: ['استغفر الله', 'أستغفر الله', 'استغفرالله', 'استغفر'] },
  { id: 'tahlil', label: 'تهليل', sub: 'لَا إِلٰهَ إِلَّا الله', target: 100,
    keywords: ['لا اله الا الله', 'لا إله إلا الله', 'لا اله الله'] },
  { id: 'hawqala', label: 'حولقة', sub: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِالله', target: 100,
    keywords: ['لا حول ولا قوة الا بالله', 'لا حول ولا قوة', 'حول ولا قوة'] },
  { id: 'salawat', label: 'صلوات', sub: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّد', target: 100,
    keywords: ['اللهم صل على محمد', 'صلي على محمد', 'صل على محمد وآل محمد'] },
];

// ===== تذكيرات اليوم =====
const DAILY_VERSES = [
  { text: 'فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ', source: 'البقرة: 152' },
  { text: 'وَعَسَىٰ أَن تَكْرَهُوا شَيْئًا وَهُوَ خَيْرٌ لَّكُمْ',        source: 'البقرة: 216' },
  { text: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا',                                  source: 'الشرح: 5'   },
  { text: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا',                source: 'الطلاق: 2'  },
  { text: 'الَّذِينَ آمَنُوا وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ اللَّهِ', source: 'الرعد: 28'  },
  { text: 'وَاذْكُر رَّبَّكَ فِي نَفْسِكَ تَضَرُّعًا وَخِيفَةً',           source: 'الأعراف: 205' },
  { text: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',                 source: 'الرعد: 28'   },
  { text: 'فَاسْتَقِمْ كَمَا أُمِرْتَ',                                     source: 'هود: 112'    },
  { text: 'وَقُل رَّبِّ زِدْنِي عِلْمًا',                                   source: 'طه: 114'     },
  { text: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ',                               source: 'البقرة: 153' },
  { text: 'وَبَشِّرِ الصَّابِرِينَ',                                        source: 'البقرة: 155' },
  { text: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً', source: 'البقرة: 201' },
  { text: 'وَقُل رَّبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي',          source: 'طه: 25-26'   },
  { text: 'إِنَّ اللَّهَ لَا يُضِيعُ أَجْرَ الْمُحْسِنِينَ',                 source: 'التوبة: 120' },
  { text: 'فَإِذَا فَرَغْتَ فَانصَبْ وَإِلَىٰ رَبِّكَ فَارْغَب',            source: 'الشرح: 7-8'  },
  { text: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ',                 source: 'الطلاق: 3'   },
  { text: 'رَبِّ اشْرَحْ لِي صَدْرِي',                                       source: 'طه: 25'      },
  { text: 'وَافْعَلُوا الْخَيْرَ لَعَلَّكُمْ تُفْلِحُونَ',                   source: 'الحج: 77'    },
];

const DAILY_QUOTES = [
  { text: 'خير الناس أنفعهم للناس',                                           author: 'النبي محمد ﷺ'         },
  { text: 'إنما الأعمال بالنيات',                                             author: 'النبي محمد ﷺ'         },
  { text: 'الدين النصيحة',                                                    author: 'النبي محمد ﷺ'         },
  { text: 'المؤمن للمؤمن كالبنيان يشد بعضه بعضاً',                          author: 'النبي محمد ﷺ'         },
  { text: 'من حسن إسلام المرء تركه ما لا يعنيه',                             author: 'النبي محمد ﷺ'         },
  { text: 'الكلمة الطيبة صدقة',                                               author: 'النبي محمد ﷺ'         },
  { text: 'قيمة كل امرئ ما يحسنه',                                           author: 'الإمام علي ع'          },
  { text: 'الصمت حكمة وقليل فاعله',                                          author: 'الإمام علي ع'          },
  { text: 'من عرف نفسه فقد عرف ربه',                                         author: 'الإمام علي ع'          },
  { text: 'لا تكن عبد غيرك وقد جعلك الله حراً',                             author: 'الإمام علي ع'          },
  { text: 'الفقر يخرس الفطن عن حجته',                                        author: 'الإمام علي ع'          },
  { text: 'أفضل الجهاد أن يجاهد الرجل نفسه وهواه',                          author: 'الإمام علي ع'          },
  { text: 'العقل حفظ التجارب',                                               author: 'الإمام علي ع'          },
  { text: 'الموت في حياة الذل حياة في ميتة الشرف',                          author: 'الإمام الحسين ع'       },
  { text: 'الناس عبيد الدنيا والدين لعق على ألسنتهم',                       author: 'الإمام الحسين ع'       },
  { text: 'كونوا دعاة الناس بأعمالكم ولا تكونوا دعاة بألسنتكم',            author: 'الإمام جعفر الصادق ع'  },
  { text: 'ليس منا من لم يحاسب نفسه في كل يوم',                             author: 'الإمام جعفر الصادق ع'  },
  { text: 'التودد إلى الناس نصف العقل',                                      author: 'الإمام جعفر الصادق ع'  },
  { text: 'صديق كل امرئ عقله وعدوه جهله',                                   author: 'الإمام علي الرضا ع'    },
  { text: 'من استشار أخاه بالنصيحة ولم يشره بها فقد خانه',                  author: 'الإمام زين العابدين ع' },
  { text: 'ما عبد الله بشيء أفضل من العقل',                                 author: 'الإمام موسى الكاظم ع'  },
  { text: 'من رضي بالقليل من الرزق رضي الله منه بالقليل من العمل',         author: 'الإمام محمد الباقر ع'  },
];

const STORAGE_KEY   = '@tasbih_data_v4';
const ARCHIVE_KEY   = '@tasbih_archive_v1';
const DAILY_KEY      = '@tasbih_daily_v1';
const SOUND_PREF_KEY = '@tasbih_sound_v1';
// نفس المفتاح المستخدم بمفتاح "الاهتزاز" بشاشة إعدادات التطبيق (app-settings.tsx)
// حتى يصير المفتاحين مصدر واحد بدل توفر مفتاحين منفصلين ما يشتغل غير وحد منهم
const VIBRATION_PREF_KEY = '@app_vibration_v1';
// نفس المفتاح والقيم المستخدمة بـ app/settings/calendar.tsx (CALENDAR_PREF_KEY / CalendarPref)
// - محلي هنا بدل استيراد شاشة كاملة داخل شاشة التسبيح
const CALENDAR_PREF_KEY = '@calendar_display_pref';
type CalendarPref = 'both' | 'hijri' | 'gregorian';
const ONBOARD_KEY    = '@tasbih_onboard_seen_v1';

// ===== ملاحظات لأول مرة - توضح كل جزء بالواجهة ببساطة، تختفي بعد أول فتح =====
const ONBOARD_STEPS: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[] = [
  { icon: 'radio-button-on', title: 'الدائرة الكبيرة',
    desc: 'دوس عليها = تعد وحدة. اضغط مطوّل = تراجع وحدة. اسحب يمين/يسار = تبدّل الذكر.' },
  { icon: 'mic', title: 'زر المايكروفون',
    desc: 'يفتح التعرف الصوتي - احچي الذكر وهو يعده وينتقل له تلقائياً.' },
  { icon: 'apps', title: 'التبويبات + زر المزيد',
    desc: 'أول ٣ أذكار ظاهرة مباشرة، والباقي (وأذكارك المخصصة) تحت زر "المزيد".' },
  { icon: 'calendar', title: 'التاريخ فوق',
    desc: 'دوس عليه يوديك لصفحة التقويم بالإعدادات.' },
  { icon: 'stats-chart', title: 'مجموع اليوم',
    desc: 'دوس عليه تشوف تفصيل كل ذكر سبّحته اليوم.' },
];
// رابط الـ Cloudflare Worker اللي يحتفظ بمفتاح Groq بالسيرفر (مو بالتطبيق) - شوف ملف groq-worker.js المرفق
const GROQ_PROXY_URL = process.env.EXPO_PUBLIC_GROQ_PROXY_URL ?? '';
// رأس سري خفيف يميز طلبات تطبيقك عن أي طلب عشوائي يوصل لعنوان الـ Worker (مو حماية كاملة، بس رادع بسيط)
const APP_SHARED_SECRET = process.env.EXPO_PUBLIC_APP_SHARED_SECRET ?? '';
const MAX_CUSTOM    = 5;      // أقصى عدد كاردات تسبيح مخصصة ظاهرة بنفس وقت (هدف ٥)
const SIM_HIGH      = 0.68;   // ثقة عالية = اعتماد مباشر (خُفِّضت من 0.80: بصوت هادئ محرك
                               // التعرف الصوتي يرجع نص فيه أخطاء تفريغ بسيطة فتوصل الدرجة
                               // 0.6-0.75 رغم إن الذكر قيل صح؛ التخفيف آمن لأن bestLocalMatch
                               // أصلاً يشترط كلمتين متتاليتين قبل قبول أي تطابق جزئي)
const SIM_LOW       = 0.45;   // أقل من هذا = ذكر جديد كلياً
const VOICE_DEBOUNCE = 0;     // استجابة فورية بنفس سرعة الكلام

// إعدادات موحدة لجلسة التعرف على الصوت (تنطبق على أندرويد/آيفون/الويب بنفس الشكل)
const SPEECH_OPTIONS = {
  lang: 'ar-IQ',
  interimResults: true,
  continuous: true,
  // 3 بدائل بدل بديل وحد - يتيح لنا نختار الأدق تطابقاً مع الأذكار بدل الاعتماد على
  // أول تفريغ يرجعه المحرك (اللي يطلع مشوّه أكثر بصوت هادئ/بعيد عن المايك)
  maxAlternatives: 3,
  volumeChangeEventOptions: { enabled: true, intervalMillis: 150 },
} as const;

// قيمة volumechange تتراوح تقريباً بين -2 و 10 - أي شي تحت 0 يعتبر غير مسموع تقريباً
const VOLUME_MIN = -2;
const VOLUME_MAX = 10;
const VOLUME_AUDIBLE_THRESHOLD = 0.5;

// ===== Utils =====
const getDayIndex = (date: Date = new Date()) =>
  Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);

const getTodayVerse = () => DAILY_VERSES[getDayIndex() % DAILY_VERSES.length];
const getTodayQuote = () => DAILY_QUOTES[getDayIndex() % DAILY_QUOTES.length];
const getVerseForDate = (date: Date) => DAILY_VERSES[getDayIndex(date) % DAILY_VERSES.length];
const getQuoteForDate = (date: Date) => DAILY_QUOTES[getDayIndex(date) % DAILY_QUOTES.length];

// ===== إشعار يومي بآية وكلمة اليوم - الساعة ٨ صباحاً محلياً =====
// إشعارات الجدولة المحلية محتواها ثابت وقت الجدولة نفسها (ما فيها منطق يشتغل وقت
// الإطلاق الفعلي)، فحتى يتغيّر المحتوى فعلاً كل يوم، نجدول نافذة أيام قادمة دفعة وحدة
// (كل يوم بمحتواه الصحيح المحسوب له بالضبط)، ونعيد المزامنة (نلغي القديم ونجدول من جديد)
// كل ما يفتح المستخدم التطبيق - فتضل النافذة ممتدة حتى لو غاب أيام عن فتحه
const DAILY_NOTIF_TAG = 'daily-verse';
const DAILY_NOTIF_DAYS_AHEAD = 14;

async function syncDailyVerseNotifications() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let granted = existing === 'granted';
    if (!granted) {
      const { status } = await Notifications.requestPermissionsAsync();
      granted = status === 'granted';
    }
    if (!granted) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(DAILY_NOTIF_TAG, {
        name: 'آية وكلمة اليوم',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    // نلغي بس الإشعارات اللي جدولناها احنا بهذا الوسم - ما نأثر على أي إشعار
    // ثاني بالتطبيق (تذكير أذكار أو صلاة مثلاً لو انضاف مستقبلاً)
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.content.data?.tag === DAILY_NOTIF_TAG)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );

    const now = new Date();
    for (let i = 0; i < DAILY_NOTIF_DAYS_AHEAD; i++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 8, 0, 0);
      if (day.getTime() <= now.getTime()) continue; // فات الساعة ٨ اليوم -> أول موعد يصير باچر
      const v = getVerseForDate(day);
      const q = getQuoteForDate(day);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'آية وكلمة اليوم 🕊️',
          body: `${v.text}\n\n"${q.text}" — ${q.author}`,
          data: { tag: DAILY_NOTIF_TAG },
        },
        trigger: { date: day } as any,
      });
    }
  } catch {
    // فشل الجدولة (صلاحية مرفوضة، منصة ويب بدون دعم...) - نتجاهل بصمت، التطبيق يشتغل عادي بدونها
  }
}

// ===== أجزاء التاريخ (هجري فوق / ميلادي تحت) =====
// ملاحظة مهمة: كان هذا يعتمد على Intl.DateTimeFormat({calendar:'islamic-civil'})
// اللي دعمها ناقص/غير موجود على محرك Hermes ببعض أجهزة أندرويد (يرجع فاضي بصمت)
// - نفس المشكلة اللي انحلت بشاشة التقويم. صار يستخدم نفس مصدر الحساب الموثوق
// (hijriOccasions.ts) حتى التاريخ يتطابق بين الشاشة الرئيسية وشاشة التقويم تماماً.
const getDateParts = () => {
  const d = new Date();
  const days   = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const gregorian = `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} م`;

  const { day, month, year } = getHijriParts(d);
  const hijri = `${toArabicDigits(day)} ${month} ${toArabicDigits(year)} هـ`;
  const occasion = getOccasion(month, day);

  return { hijri, gregorian, occasion };
};

function toArabicDigits(num: number | string): string {
  const ar = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  return String(num).replace(/[0-9]/g, (d) => ar[parseInt(d, 10)]);
}

// ===== تطبيع النص العربي (هدف ٥) - يشيل التشكيل ويوحّد صيغ الحروف =====
function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '')      // تشكيل
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\u0640/g, '')                      // تطويل
    .replace(/[^\u0600-\u06FF\s]/g, '')          // رموز غريبة
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ===== نسبة تشابه نصين (Levenshtein ratio) =====
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  const dist = dp[m][n];
  return 1 - dist / Math.max(m, n);
}

// جذور لازم يحتوي عليها الكلام حتى نعتبره "ذكر" من الأساس (يمنع اعتبار أي كلام عشوائي تسبيحاً)
const ISLAMIC_ROOTS = ['الله', 'سبحان', 'حمد', 'اكبر', 'استغفر', 'قوه', 'حول', 'صل', 'محمد', 'كريم', 'رحيم', 'عظيم'];
function looksIslamic(normText: string, dhikrList?: DhikrType[]): boolean {
  if (ISLAMIC_ROOTS.some((r) => normText.includes(r))) return true;
  // أي ذكر مخصص المستخدم نفسه ضافه صراحة (مثل "يا علي" أو أي دعاء غير مشمول بالجذور العامة
  // أعلاه) يُعتبر ذكراً مباشرة بدون فحص الجذور - لأن المستخدم صرّح بيه وقت الإضافة اليدوية
  if (dhikrList) {
    for (const d of dhikrList) {
      if (!d.isCustom) continue;
      for (const kw of d.keywords) {
        const nkw = normalizeArabic(kw);
        if (nkw && (normText.includes(nkw) || nkw.includes(normText))) return true;
      }
    }
  }
  return false;
}

// أفضل تطابق محلي لنص معيّن مقابل قائمة الأذكار (يرجع أيضاً الكلمة المطابقة لعد التكرار - هدف ٧)
function bestLocalMatch(text: string, dhikrList: DhikrType[]) {
  const norm = normalizeArabic(text);
  const normWords = norm.split(' ').filter(Boolean);
  let bestId = '';
  let bestScore = 0;
  let bestKeyword = '';
  let bestKeywordWords = 0;

  // نفحص *كل* الأذكار ونختار الأدق تطابق - مو نوقف عند أول وحدة نلگاها (هذا كان الباگ الأساسي:
  // كلمة مشتركة بين ذكرين، زي "لا" بين "لا اله الا الله" و"لا حول ولا قوة"، كانت تخلي الكود
  // يگفل غلط على أي ذكر يجي أول بالقائمة، بدون ما يشوف باقي الاحتمالات)
  for (const d of dhikrList) {
    for (const kw of d.keywords) {
      const nkw = normalizeArabic(kw);
      if (!nkw) continue;
      const nkwWords = nkw.split(' ').filter(Boolean);

      let score: number;
      if (norm.includes(nkw)) {
        // الكلام المسموع فيه الذكر كامل (حتى لو وسط جملة أطول) -> ثقة شبه تامة
        score = 0.99;
      } else if (
        normWords.length >= 2 &&
        normWords.length < nkwWords.length &&
        normWords.every((w, i) => w === nkwWords[i])
      ) {
        // الكلام لسا ناقص (بداية الذكر بالضبط، كلمة-كلمة) -> ثقة تتصاعد تدريجياً
        // نشترط كلمتين على الأقل (مو كلمة وحدة) حتى ما نلتزم بذكر معيّن بس لأنه يبدأ بكلمة
        // مشتركة بينه وبين ذكر ثاني (مثلاً "لا" مشتركة بين "لا إله إلا الله" و"لا حول ولا قوة") -
        // بمجرد ما تنقال الكلمة الثانية، الذكرين ينفصلون عن بعض ويوصل التطابق الصحيح بس
        const ratio = normWords.length / nkwWords.length;
        score = 0.5 + 0.45 * ratio;
      } else {
        score = similarity(norm, nkw);
      }

      // عند تعادل الدرجة بالضبط (مثلاً كلمة عامة قصيرة مقابل عبارة أطول لذكر ثاني)،
      // نفضّل الكلمة المفتاحية الأطول لأنها أدق وأقل عمومية - حماية عامة من تعارض الكلمات القصيرة
      const isBetter =
        score > bestScore ||
        (score === bestScore && nkwWords.length > bestKeywordWords);

      if (isBetter) {
        bestScore = score;
        bestId = d.id;
        bestKeyword = nkw;
        bestKeywordWords = nkwWords.length;
      }
    }
  }
  return { id: bestId, score: bestScore, keyword: bestKeyword };
}

// ===== تعارض "بداية مطابقة" مع ذكر أطول =====
// لو ذكر مخصص طويل يبدأ بنفس كلمات ذكر ثابت قصير بالضبط (مثال: الذكر المخصص "لا اله الا الله
// سبحانك اني كنت من الظالمين" يبدأ بنفس كلمات ذكر "تهليل" الثابت "لا اله الا الله")، فأول مقطع
// كلام يوصل يطابق الذكر القصير تطابقاً تاماً (0.99) ومحتمل بنفس الوقت يكون بس "بداية" الذكر
// الطويل. هذا الفحص يلگي أطول ذكر بالقائمة كلماته تبدأ بنفس كلمات الذكر المطابق حالياً بالضبط.
function findLongerPrefixCollision(
  matchedKeywordWords: string[],
  matchedId: string,
  list: DhikrType[]
): { dhikr: DhikrType; keywordWords: string[] } | null {
  let best: { dhikr: DhikrType; keywordWords: string[] } | null = null;
  for (const d of list) {
    if (d.id === matchedId) continue;
    for (const kw of d.keywords) {
      const words = normalizeArabic(kw).split(' ').filter(Boolean);
      if (words.length <= matchedKeywordWords.length) continue;
      const isPrefix = matchedKeywordWords.every((w, i) => words[i] === w);
      if (isPrefix && (!best || words.length > best.keywordWords.length)) {
        best = { dhikr: d, keywordWords: words };
      }
    }
  }
  return best;
}

// ===== اختيار أفضل بديل من عدة بدائل يرجعها محرك التعرف الصوتي لنفس المقطع =====
// بصوت هادئ/نسائي، أول بديل (results[0]) غالباً يطلع فيه أخطاء تفريغ (transcription)
// بينما بديل تاني أو ثالث يطابق الذكر بدقة أعلى - قبل هذا كان الكود ياخذ بس البديل الأول
// ويتجاهل الباقي كلياً، وهذا سبب رئيسي لعدم التبديل بصوت هادئ (هدف: تحسين حساسية المايك)
function pickBestAlternative(alts: string[], dhikrList: DhikrType[]): string {
  if (alts.length === 0) return '';
  if (alts.length === 1) return alts[0];
  let best = alts[0];
  let bestScore = -1;
  for (const alt of alts) {
    if (!alt) continue;
    const { score } = bestLocalMatch(alt, dhikrList);
    if (score > bestScore) {
      bestScore = score;
      best = alt;
    }
  }
  return best;
}

// عد تكرار عبارة (ذكر) داخل نص واحد - يدعم حالة "قال نفس الذكر مرتين بثانية واحدة" (هدف ٧)
function countRepeats(normText: string, normKeyword: string): number {
  if (!normKeyword) return 1;
  const words = normText.split(' ').filter(Boolean);
  const kwWords = normKeyword.split(' ').filter(Boolean);
  if (kwWords.length === 0) return 1;
  let count = 0;
  for (let i = 0; i <= words.length - kwWords.length; i++) {
    if (words.slice(i, i + kwWords.length).join(' ') === kwWords.join(' ')) {
      count++;
      i += kwWords.length - 1;
    }
  }
  return Math.max(count, 1);
}

// قص عنوان الذكر المخصص بحدود الكلمة (مو نص حرف بنص كلمة) + "…" إذا انقص فعلاً
function truncateLabel(text: string, maxLen = 8): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  const slice = trimmed.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  return cut + '…';
}

// فحص خفيف للاتصال بالإنترنت (بدون أي مكتبة إضافية) - يُستخدم لتحذير لطيف عند فتح المايك
// generate_204 نفس الرابط اللي أندرويد يستخدمه داخلياً للتأكد من الاتصال، رابط خفيف وموثوق
async function checkNetworkReachable(timeoutMs = 2500): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch('https://www.gstatic.com/generate_204', {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

// ===== Groq API (يُستخدم كحكم احتياطي فقط بحالة الثقة المتوسطة) =====
// المفتاح ما عاد موجود بالتطبيق - الطلب يمر عبر الـ Worker اللي يحتفظ بالمفتاح بالسيرفر
const askGroq = async (text: string, dhikrList: DhikrType[]): Promise<string | null> => {
  if (!GROQ_PROXY_URL) return null;
  try {
    const dhikrOptions = dhikrList
      .map((d) => `- ${d.sub} → أجب: ${d.id}`)
      .join('\n');

    const res = await fetch(GROQ_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(APP_SHARED_SECRET ? { 'x-app-secret': APP_SHARED_SECRET } : {}),
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'أنت متخصص في التعرف على الأذكار الإسلامية. ' +
              'المستخدم يذكر الله ويريدك تعرف أي ذكر قاله بدقة تامة، بدون أي تخمين أو تقريب. ' +
              'أجب بـ id الذكر فقط بدون أي كلمة أخرى إذا كان مطابقاً تماماً لمعنى أحد الأذكار بالقائمة. ' +
              'إذا قال ذكراً مختلفاً تماماً غير موجود في القائمة أجب: new:نص_الذكر بالضبط كما قاله المستخدم.',
          },
          {
            role: 'user',
            content:
              `المستخدم قال: "${text}"\n` +
              `الأذكار الموجودة:\n${dhikrOptions}\n` +
              `إذا لم يقل أي ذكر إسلامي → أجب: none\n` +
              `إذا قال ذكراً جديداً غير مطابق → أجب: new:نص_الذكر`,
          },
        ],
        max_tokens: 30,
        temperature: 0,
      }),
    });
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim().toLowerCase() ?? null;
  } catch {
    return null;
  }
};

// ===== المطابقة الذكية الكاملة (هدف ٥) =====
// أولاً: فحص هل النص فيه جذر إسلامي أساساً، وإلا نتجاهله فوراً (يمنع اللغط - ملاحظة المستخدم)
// محلي عالي الثقة -> اعتماد فوري بدون أي API (سرعة = دقة بالكلام السريع - هدف ٧)
// محلي ثقة متوسطة -> استشارة Groq كحكم احتياطي
// محلي ثقة منخفضة -> ذكر جديد كلياً (new:النص بالضبط)
// يرجع أيضاً عدد التكرارات داخل نفس الجملة (لدعم الكلام السريع - هدف ٧)
const matchDhikr = async (
  text: string,
  dhikrList: DhikrType[]
): Promise<{ result: string; repeats: number }> => {
  const norm = normalizeArabic(text);

  // حارس أساسي: إذا الكلام مالة أي علاقة بذكر إسلامي ولا بذكر مخصص، تجاهله كلياً (تصحيح اللغط)
  if (!looksIslamic(norm, dhikrList)) {
    return { result: 'none', repeats: 1 };
  }

  const { id, score, keyword } = bestLocalMatch(text, dhikrList);

  if (score >= SIM_HIGH && id) {
    return { result: id, repeats: countRepeats(norm, keyword) };
  }

  if (score >= SIM_LOW && id) {
    const groqResult = await askGroq(text, dhikrList);
    if (groqResult && groqResult !== 'none') {
      // "new:نص" حالة صحيحة دايماً (ذكر جديد كلياً) - نقبلها مباشرة
      if (groqResult.startsWith('new:')) {
        return { result: groqResult, repeats: countRepeats(norm, keyword) };
      }
      // غير هيچي، لازم نتأكد إن الـ id اللي رجعته Groq موجود فعلاً بالقائمة -
      // قبل هذا التحقق، أي رد غير متوقع من الموديل (id غلط أو غير مطابق) كان
      // يخلي العدة تضيع بصمت لأن الكود يدور عن ذكر مو موجود وما يلگه
      if (dhikrList.some((d) => d.id === groqResult)) {
        return { result: groqResult, repeats: countRepeats(norm, keyword) };
      }
    }
    return { result: id, repeats: countRepeats(norm, keyword) };
  }

  // ثقة منخفضة + لكن فيه جذر إسلامي = ذكر جديد غير معروف، يحفظ بنص المستخدم بالضبط
  return { result: `new:${text.trim()}`, repeats: 1 };
};

// ===== حلقة التقدم المضيئة الحقيقية (SVG) + النقطة المتحركة على المحيط =====
function ProgressRing({
  size,
  strokeWidth,
  progress,   // Animated.Value من 0 إلى 1
  color,
  celebrating,
}: {
  size: number;
  strokeWidth: number;
  progress: Animated.Value;
  color: string;
  celebrating: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // نتابع قيمة الأنيميشن يدوياً (state عادي) بدل Animated.createAnimatedComponent
  // حتى نتفادى خاصية collapsable اللي يحطها RN تلقائياً وتسبب خطأ على الويب
  const [liveProgress, setLiveProgress] = useState(0);
  useEffect(() => {
    const id = progress.addListener(({ value }) => setLiveProgress(value));
    return () => progress.removeListener(id);
  }, [progress]);

  const strokeDashoffset = circumference * (1 - liveProgress);
  const dotAngleDeg = liveProgress * 360;

  const rad = ((dotAngleDeg - 90) * Math.PI) / 180;
  const cx = size / 2 + radius * Math.cos(rad);
  const cy = size / 2 + radius * Math.sin(rad);
  const dotVisible = dotAngleDeg > 2;

  return (
    <View style={{ position: 'absolute', width: size, height: size }} pointerEvents="none">
      <Svg width={size} height={size}>
        {/* المسار الخافت الكامل */}
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* الحلقة المضيئة المتقدمة */}
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference}, ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {dotVisible && (
        <View
          style={{
            position: 'absolute',
            left: cx - (celebrating ? 7 : 5),
            top: cy - (celebrating ? 7 : 5),
            width: celebrating ? 14 : 10,
            height: celebrating ? 14 : 10,
            borderRadius: 8,
            backgroundColor: color,
          }}
        />
      )}
    </View>
  );
}

// ===== توهج خلفي هادئ يتلوّن حسب الذكر المختار =====
function BackgroundGlow({ color }: { color: string }) {
  const fade = useRef(new Animated.Value(0)).current;
  const colorRef = useRef(color);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      colorRef.current = color;
      Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }).start();
    });
  }, [color]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: colorRef.current,
        opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [0, 0.10] }),
      }}
    />
  );
}

// ===== جسيمات مضيئة هادئة بالخلفية (لمسة روحانية خفيفة) =====
const PARTICLE_COUNT = 22;
function FloatingParticles({ color }: { color: string }) {
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }).map(() => ({
      left: Math.random() * 100,
      size: 2 + Math.random() * 3,
      delay: Math.random() * 4000,
      duration: 7000 + Math.random() * 6000,
      anim: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    const loops = particles.map((p) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(p.anim, { toValue: 1, duration: p.duration, useNativeDriver: true }),
          Animated.timing(p.anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {particles.map((p, i) => {
        const translateY = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -260] });
        const opacity = p.anim.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 0.35, 0.35, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: `${p.left}%`,
              bottom: 0,
              width: p.size,
              height: p.size,
              borderRadius: p.size,
              backgroundColor: color,
              opacity,
              transform: [{ translateY }],
            }}
          />
        );
      })}
    </View>
  );
}

// ===== الشاشة الرئيسية =====
export default function TasbihScreen() {
  const router = useRouter();
  const { fontScale, backgroundId } = useThemeContext();
  const { width, height } = useWindowDimensions();
  // ارتفاع الستيتس بار الحقيقي لكل جهاز (يختلف أندرويد عن آيفون، وحتى بين أجهزة أندرويد
  // نفسها حسب وجود كاميرا مخرومة بالشاشة أو لا) - هذا كان الفاضي بالكود قبل، والسبب
  // الحقيقي وراء تراكب الساعة/الشبكة فوق الهيدر بأجهزة أندرويد تحديداً
  const insets = useSafeAreaInsets();

  const isTablet  = width >= 700;
  const isDesktop = width >= 1024;
  const circleSize = isDesktop ? 300 : isTablet ? 280 : 220;
  const FOCUS_CIRCLE_SIZE = isDesktop ? 240 : isTablet ? 220 : 180;
  const circleFont = isDesktop ? 78  : isTablet ? 72  : 58;

  const bgOption = getSelectedBackground(backgroundId);

  const styles = useMemo(
    () => createStyles(fontScale, isTablet, isDesktop, circleSize, circleFont, height, FOCUS_CIRCLE_SIZE),
    [fontScale, isTablet, isDesktop, circleSize, circleFont, height, FOCUS_CIRCLE_SIZE]
  );

  // ===== State =====
  const [dhikrList,   setDhikrList]   = useState<DhikrType[]>(BASE_DHIKR);
  const [counts,      setCounts]      = useState<Record<string, number>>(
    BASE_DHIKR.reduce((acc, d) => ({ ...acc, [d.id]: 0 }), {} as Record<string, number>)
  );
  const [activeTab,   setActiveTab]   = useState(0);
  const [moreOpen,    setMoreOpen]    = useState(false);
  const [showLogoIntro, setShowLogoIntro] = useState(false);
  // يتحول true مرة وحدة بس (أول ضغطة على الشعار) وما يرجع أبداً false - هذا
  // يمنع تحميل مشغّل الفيديو (useVideoPlayer) فور فتح التطبيق، ويخليه يتحمّل
  // بس أول مرة المستخدم يضغط فعلياً على الشعار. بدون هذا، المكوّن كان
  // يتحمّل مع الشاشة الرئيسية مباشرة حتى لو مخفي - وهذا سبب كراش السبلاش
  // القديم بالضبط (تحميل مكتبة فيديو بأخطر لحظة: فتح التطبيق)
  const [logoIntroMounted, setLogoIntroMounted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastWord,     setLastWord]   = useState('');
  const [verse] = useState(getTodayVerse());
  const [quote] = useState(getTodayQuote());
  const [celebrating, setCelebrating] = useState(false);
  const [dailyTotal,  setDailyTotal]  = useState(0);
  const [streak,      setStreak]      = useState(0);
  const [dailyBreakdown, setDailyBreakdown] = useState<Record<string, number>>({});
  const [dailyModalOpen, setDailyModalOpen] = useState(false);
  const [soundOn,     setSoundOn]     = useState(true);
  const [composerText, setComposerText] = useState('');
  const [composerTarget, setComposerTarget] = useState('33');
  const [onboardOpen, setOnboardOpen] = useState(false);
  // ===== وضع التركيز (تسبيح منفصل للأذكار المضافة) =====
  // لما مفعّل، المايك يسمع بس الذكر المضاف هذا ويتجاهل الأذكار الثابتة كلياً - والعكس:
  // المايك الأساسي (وضع التركيز مغلق) يسمع بس الأذكار الثابتة ويتجاهل أي ذكر مضاف
  const [focusDhikrId, setFocusDhikrId] = useState<string | null>(null);

  // ===== Refs =====
  const countsRef       = useRef(counts);
  const dhikrListRef    = useRef(dhikrList);
  // نطاق المطابقة الصوتية الفعّال حالياً - أذكار ثابتة بس بالوضع العادي، أو الذكر
  // المركّز عليه بس بوضع التركيز. كل دوال المطابقة (bestLocalMatch/looksIslamic/matchDhikr)
  // لازم تستخدم هذا الـ ref بدل dhikrListRef.current حتى الفصل يصير حقيقي وكامل
  const matchScopeRef   = useRef<DhikrType[]>([]);
  const focusPrevTabRef = useRef(0); // نحفظ فيه التبويب النشط قبل فتح وضع التركيز لنرجعله عند الخروج
  const isListeningRef  = useRef(false);
  const lastCountTime   = useRef(0);
  const circleScale     = useRef(new Animated.Value(1)).current;
  const countScale      = useRef(new Animated.Value(1)).current;
  const ringProgress    = useRef(new Animated.Value(0)).current;
  const focusRingProgress = useRef(new Animated.Value(0)).current; // حلقة تقدّم مستقلة لوضع التركيز
  const leftArrowScale  = useRef(new Animated.Value(1)).current;
  const rightArrowScale = useRef(new Animated.Value(1)).current;
  const dailyTotalRef   = useRef(0);
  const streakRef       = useRef(0);
  // يمنع زيادة الـ streak أكثر من مرة بنفس اليوم لو العدد اليومي رجع صفر (تراجع) وبعدين
  // زاد من جديد - قبل هذا كان أي رجوع للصفر ثم عدة جديدة يزيد الـ streak غلط بنفس اليوم
  const streakBumpedTodayRef = useRef(false);
  const dailyBreakdownRef = useRef<Record<string, number>>({});
  // ===== الـ "Liquid Pill" المتحرك خلف التبويب النشط =====
  const tabLayoutsRef = useRef<Record<number, { x: number; width: number }>>({});
  const pillX      = useRef(new Animated.Value(0)).current;
  const pillWidth  = useRef(new Animated.Value(0)).current;
  const pillReady  = useRef(false); // يمنع ظهور الـ pill بمكان غلط قبل ما نعرف مواقع التبويبات
  const soundOnRef      = useRef(true);
  const vibrationOnRef  = useRef(true);
  const [calendarPref, setCalendarPref] = useState<CalendarPref>('both');
  const audioCtxRef     = useRef<any>(null);
  const touchStartRef    = useRef({ x: 0, y: 0, time: 0 });
  const longPressTimerRef = useRef<any>(null);
  const longPressFiredRef = useRef(false);

  useEffect(() => { countsRef.current    = counts;    }, [counts]);
  useEffect(() => { dhikrListRef.current = dhikrList; }, [dhikrList]);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

  // تحديث نطاق المطابقة الصوتية كل ما يتغيّر وضع التركيز أو قائمة الأذكار
  useEffect(() => {
    if (focusDhikrId) {
      const f = dhikrList.find((d) => d.id === focusDhikrId);
      matchScopeRef.current = f ? [f] : [];
    } else {
      matchScopeRef.current = dhikrList.filter((d) => !d.isCustom);
    }
    // تبديل النطاق = لازم نصفّر أي حالة معلقة من النطاق القديم حتى ما تختلط وياه
    lastCommittedRef.current = null;
    clearPendingFallback();
    deferredIdxRef.current = null;
  }, [dhikrList, focusDhikrId]);

  // فتح/إغلاق وضع التركيز - يحفظ ويرجّع التبويب الأساسي تلقائياً
  const openFocusMode = (id: string) => {
    focusPrevTabRef.current = activeTab;
    setFocusDhikrId(id);
  };
  const closeFocusMode = () => {
    setFocusDhikrId(null);
    setActiveTab(focusPrevTabRef.current);
  };

  useEffect(() => {
    loadData();
    loadDailyAndStreak();
    loadSoundPref();
    loadVibrationPref();
    syncDailyVerseNotifications();
    AsyncStorage.getItem(ONBOARD_KEY).then((seen) => {
      if (!seen) setOnboardOpen(true);
    }).catch(() => {});
    return () => {
      isListeningRef.current = false;
      clearPendingFallback();
      deferredIdxRef.current = null;
      try { ExpoSpeechRecognitionModule.stop(); } catch {}
    };
  }, []);

  // يحدّث إعداد عرض التقويم (هجري/ميلادي/الاثنين) والاهتزاز كل ما ترجع لهذي
  // الشاشة - مهم خصوصاً بعد ما يغيّر المستخدم الإعداد بشاشة settings/calendar
  // ويرجع، لأن الشاشة ما تنعاد mount من جديد بس تستعيد التركيز (focus)
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(CALENDAR_PREF_KEY).then((v) => {
        if (v) setCalendarPref(v as CalendarPref);
      }).catch(() => {});
      loadVibrationPref();
    }, [])
  );

  const dismissOnboard = () => {
    setOnboardOpen(false);
    AsyncStorage.setItem(ONBOARD_KEY, '1').catch(() => {});
  };

  // ===== العداد اليومي + الأيام المتتالية (streak) =====
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const yesterdayKey = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const loadDailyAndStreak = async () => {
    try {
      const raw = await AsyncStorage.getItem(DAILY_KEY);
      const today = todayKey();
      if (!raw) {
        setDailyTotal(0); setStreak(0);
        dailyTotalRef.current = 0; streakRef.current = 0;
        setDailyBreakdown({}); dailyBreakdownRef.current = {};
        streakBumpedTodayRef.current = false;
        return;
      }
      const data = JSON.parse(raw);
      if (data.date === today) {
        setDailyTotal(data.total ?? 0);
        setStreak(data.streak ?? 0);
        dailyTotalRef.current = data.total ?? 0;
        streakRef.current = data.streak ?? 0;
        setDailyBreakdown(data.breakdown ?? {});
        dailyBreakdownRef.current = data.breakdown ?? {};
        // إذا اليوم عنده مجموع مسبقاً، يعني الـ streak انزاد مسبقاً اليوم - ما نزيده مرة ثانية
        streakBumpedTodayRef.current = (data.total ?? 0) > 0;
      } else {
        // يوم جديد: العداد اليومي والتفصيل يصفرون، والـ streak يستمر بس أول ما يسبح اليوم (بينحسب بـ bumpDailyTotal)
        const streakContinues = data.date === yesterdayKey();
        setDailyTotal(0);
        setStreak(streakContinues ? (data.streak ?? 0) : 0);
        dailyTotalRef.current = 0;
        streakRef.current = streakContinues ? (data.streak ?? 0) : 0;
        setDailyBreakdown({}); dailyBreakdownRef.current = {};
        streakBumpedTodayRef.current = false;
      }
    } catch {}
  };

  // يُستدعى مع كل عدة (زيادة أو تراجع) حتى يبقى العداد اليومي والـ streak وتفصيل كل ذكر محدّثين
  const bumpDailyTotal = async (delta: number, dhikrId?: string) => {
    const today = todayKey();
    const newTotal = Math.max(0, dailyTotalRef.current + delta);
    let newStreak = streakRef.current;

    // أول عدة فعلية باليوم (ولسا ما انزاد الـ streak اليوم) = يوم نشط جديد -> زيادة الـ streak
    // نعتمد على العلم streakBumpedTodayRef مو على "وصل صفر" لوحدها، حتى لو المستخدم راجع
    // (undo) لين رجع العداد اليومي صفر وبعدين كمل تسبيح، الـ streak ما ينزاد مرتين بنفس اليوم
    if (delta > 0 && !streakBumpedTodayRef.current) {
      newStreak = streakRef.current + 1;
      streakBumpedTodayRef.current = true;
    }

    dailyTotalRef.current = newTotal;
    streakRef.current = newStreak;
    setDailyTotal(newTotal);
    setStreak(newStreak);

    let newBreakdown = dailyBreakdownRef.current;
    if (dhikrId) {
      const prevForDhikr = dailyBreakdownRef.current[dhikrId] ?? 0;
      const newForDhikr  = Math.max(0, prevForDhikr + delta);
      newBreakdown = { ...dailyBreakdownRef.current, [dhikrId]: newForDhikr };
      dailyBreakdownRef.current = newBreakdown;
      setDailyBreakdown(newBreakdown);
    }

    try {
      await AsyncStorage.setItem(
        DAILY_KEY,
        JSON.stringify({ date: today, total: newTotal, streak: newStreak, breakdown: newBreakdown })
      );
    } catch {}
  };

  // ===== تفضيل الصوت =====
  const loadSoundPref = async () => {
    try {
      const raw = await AsyncStorage.getItem(SOUND_PREF_KEY);
      const on = raw === null ? true : raw === '1';
      setSoundOn(on);
      soundOnRef.current = on;
    } catch {}
  };
  const toggleSound = async () => {
    const next = !soundOnRef.current;
    soundOnRef.current = next;
    setSoundOn(next);
    try { await AsyncStorage.setItem(SOUND_PREF_KEY, next ? '1' : '0'); } catch {}
  };

  // ===== تفضيل الاهتزاز (يُقرأ ويُكتب بنفس مفتاح شاشة إعدادات التطبيق) =====
  const loadVibrationPref = async () => {
    try {
      const raw = await AsyncStorage.getItem(VIBRATION_PREF_KEY);
      vibrationOnRef.current = raw === null ? true : raw === '1';
    } catch {}
  };
  // يلف أي نداء Haptics.* ويشغّله فقط إذا الاهتزاز مفعّل من الإعدادات
  const triggerHaptic = (fn: () => void | Promise<void>) => {
    if (vibrationOnRef.current) fn();
  };

  // نقرة صوتية عند كل عدة - على الويب: نغمة مبنية مباشرة بـ Web Audio API.
  // على الموبايل (أندرويد/آيفون): نشغّل ملف صوتي قصير عبر expo-audio (متوافقة مع SDK 56).
  // ⚠️ يشترط وجود ملف tick.mp3 بمسار src/assets/sounds/tick.mp3 - نقرة قصيرة جداً (٥٠-١٠٠ ملي ثانية)
  // كافية. بدون هذا الملف الفعلي، السطر تحت (require) بيسبب خطأ بناء (Metro) - لازم تضيف
  // الملف أول قبل لا تشغّل بيلد. جيب أي نقرة "click/tick" مجانية من freesound.org أو mixkit.co
  const tickPlayerRef = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createAudioPlayer } = require('expo-audio');
      tickPlayerRef.current = createAudioPlayer(require('../assets/sounds/tick.mp3'));
    } catch {
      // الملف/المكتبة مو موجودين هسه - نتجاهل بصمت حتى ما نكرش التطبيق، وصوت النقرة
      // يبقى معطل بالموبايل لغاية ما يتضاف الملف (نفس الوضع الحالي بالضبط)
      tickPlayerRef.current = null;
    }
    return () => {
      try { tickPlayerRef.current?.remove?.(); } catch {}
    };
  }, []);

  const playTick = () => {
    if (!soundOnRef.current) return;
    if (Platform.OS === 'web') {
      try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } catch {}
      return;
    }
    // موبايل: نرجع لبداية الملف ونشغّله من جديد كل عدة (يسمح بنقرات متلاحقة بسرعة)
    try {
      const player = tickPlayerRef.current;
      if (!player) return;
      player.seekTo(0);
      player.play();
    } catch {}
  };

  // ===== حفظ وتحميل =====
  // ملاحظة مهمة: ما نستبدل قائمة الأذكار بالكامل بالمحفوظة، لأنه لو انضاف ذكر أساسي جديد
  // بتحديث للتطبيق (متل تسبيح الركوع/السجود)، وين المستخدم عنده بيانات محفوظة من قبل التحديث،
  // بيختفي الذكر الجديد كلياً لأنه مو موجود بالقائمة القديمة المحفوظة. الحل: ندمج - نبلش
  // بأحدث BASE_DHIKR (تضمن كل الأذكار الأساسية موجودة دايماً) ونضيف عليها بس الكاردات
  // المخصصة (isCustom) المحفوظة، مع الحفاظ على أعداد كل ذكر.
  const loadData = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        const savedCustoms: DhikrType[] = Array.isArray(data.dhikrList)
          ? data.dhikrList.filter((d: DhikrType) => d.isCustom)
          : [];
        const mergedList = [...BASE_DHIKR, ...savedCustoms];
        const mergedCounts = mergedList.reduce(
          (acc, d) => ({ ...acc, [d.id]: data.counts?.[d.id] ?? 0 }),
          {} as Record<string, number>
        );
        setDhikrList(mergedList);
        setCounts(mergedCounts);
        dhikrListRef.current = mergedList;
        countsRef.current = mergedCounts;
      }
    } catch {}
  };

  const saveData = async (
    newCounts: Record<string, number>,
    newDhikrList: DhikrType[]
  ) => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ counts: newCounts, dhikrList: newDhikrList })
      );
    } catch {}
  };

  // أرشفة كارد مخصص قديم بدون حذف بياناته نهائياً (هدف ٥)
  const archiveOldestCustom = async (list: DhikrType[], cnts: Record<string, number>) => {
    const customs = list.filter((d) => d.isCustom);
    if (customs.length === 0) return { list, cnts };
    const oldest = customs[0];
    try {
      const rawArchive = await AsyncStorage.getItem(ARCHIVE_KEY);
      const archive = rawArchive ? JSON.parse(rawArchive) : [];
      archive.push({ dhikr: oldest, count: cnts[oldest.id] ?? 0, archivedAt: Date.now() });
      await AsyncStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
    } catch {}
    const newList = list.filter((d) => d.id !== oldest.id);
    const { [oldest.id]: _removed, ...restCounts } = cnts;
    return { list: newList, cnts: restCounts };
  };

  // ===== إضافة ذكر جديد تلقائياً (مع حد أقصى للكاردات الظاهرة - هدف ٥) =====
  const addCustomDhikr = async (text: string, target: number = 33): Promise<DhikrType> => {
    const id    = 'custom_' + Date.now();
    const label = truncateLabel(text);
    const normFull = normalizeArabic(text);
    const words = normFull.split(' ').filter(Boolean);
    // كلمات رابطة/نداء عامة جداً ومكررة ببداية كثير من الأذكار (خصوصاً صيغة
    // "يا فلان" بأسماء الله الحسنى) - ما نعتمدها وحدها ككلمة مفتاحية مختصرة
    // لأنها لو انقالت لحالها ما تميز هذا الذكر عن غيره، ولو غابت عن الكلام
    // (مثلاً المستخدم گال "كريم" بس بدون "يا") ما ننتبه للكلمة المميزة الفعلية
    const FILLER_WORDS = new Set(['يا', 'لا', 'ال', 'و', 'ف', 'ب', 'يالله', 'اللهم']);
    // نختار أول كلمة "مميزة" (مو من كلمات الربط) وطولها كافي - هذي هي الكلمة
    // اللي لو انقالت لحالها (بوجود "يا" او بدونها) لازم تكفي لعدّ الذكر
    const shortWord =
      words.find((w) => !FILLER_WORDS.has(w) && w.length >= 2) ?? words[0] ?? '';
    const keywords =
      shortWord && shortWord !== normFull ? [normFull, shortWord] : [normFull];
    const newD: DhikrType = {
      id, label, sub: text, target: Math.max(1, Math.min(99999, Math.round(target) || 33)),
      keywords,
      isCustom: true,
    };

    let newList   = [...dhikrListRef.current, newD];
    let newCounts = { ...countsRef.current, [id]: 0 };

    const customCount = newList.filter((d) => d.isCustom).length;
    if (customCount > MAX_CUSTOM) {
      // نحفظ اسم الأقدم قبل الأرشفة حتى نگدر نبلغ المستخدم بالضبط شنو انأرشف
      const oldestLabel = newList.filter((d) => d.isCustom)[0]?.label;
      const archived = await archiveOldestCustom(newList, newCounts);
      newList   = archived.list;
      newCounts = archived.cnts;
      if (oldestLabel) {
        Alert.alert(
          'تم أرشفة ذكر قديم',
          `وصلت الحد الأقصى (${MAX_CUSTOM}) أذكار مخصصة، فتم أرشفة "${oldestLabel}" تلقائياً لإفساح المجال للذكر الجديد. تگدر تلگاه بأرشيف الأذكار.`
        );
      }
    }

    setDhikrList(newList);
    setCounts(newCounts);
    countsRef.current    = newCounts;
    dhikrListRef.current = newList;
    saveData(newCounts, newList);

    // ملاحظة: ما نبدّل activeTab هنا بعد - الأذكار المضافة صارت تنعد بوضع التركيز
    // المنفصل بس (شوف openFocusMode)، مو بالتبويب الرئيسي المشترك مع الأذكار الثابتة
    return newD;
  };

  // ===== إزالة ذكر مخصص نهائياً (هدف: قابلية الحذف للأذكار المضافة) =====
  const removeCustomDhikr = async (id: string) => {
    const newList = dhikrListRef.current.filter((d) => d.id !== id);
    const { [id]: _removed, ...restCounts } = countsRef.current;
    setDhikrList(newList);
    setCounts(restCounts);
    dhikrListRef.current = newList;
    countsRef.current = restCounts;
    saveData(restCounts, newList);
    // لو كان هذا الذكر مفتوح حالياً بوضع التركيز، نسكره فوراً حتى ما يضل المايك
    // شغال على ذكر انحذف
    if (focusDhikrId === id) closeFocusMode();
  };

  // إضافة ذكر مخصص يدوياً من كارد "أضف ذكر خاص" بقائمة المزيد - مضمون ١٠٠٪ (مو تعرّف صوتي عشوائي)
  const handleAddComposerDhikr = async () => {
    const text = composerText.trim();
    if (!text) return;

    // فحص التكرار: هل هذا الذكر موجود مسبقاً (أساسي أو مخصص) بنفس النص أو نفس الكلمة المفتاحية؟
    const normText = normalizeArabic(text);
    const existing = dhikrListRef.current.find(
      (d) =>
        normalizeArabic(d.sub) === normText ||
        d.keywords.some((kw) => normalizeArabic(kw) === normText)
    );
    if (existing) {
      const idx = dhikrListRef.current.findIndex((d) => d.id === existing.id);
      if (idx !== -1) setActiveTab(idx);
      Alert.alert('موجود مسبقاً', `هذا الذكر مضاف عندك مسبقاً باسم "${existing.label}"`);
      setComposerText('');
      return;
    }

    const newD = await addCustomDhikr(text, parseInt(composerTarget, 10) || 33);
    setComposerText('');
    setComposerTarget('33');
    // نفتح وضع التركيز فوراً على الذكر الجديد ونسكر قائمة "المزيد" - هيك المايك يصير
    // جاهز يلقط الذكر المضاف مباشرة بدون ما يحتاج المستخدم يدور عليه ويفتحه يدوياً
    setMoreOpen(false);
    openFocusMode(newD.id);
  };

  // ===== تطبيق العدة فعلياً (تشترك فيها المعالجة اللحظية والمعالجة النهائية) =====
  // delta موجب = عدّة جديدة (نبضة + صوت + هبتك + احتمال احتفال)
  // delta سالب = تراجع صامت (لما المتعرف الصوتي يراجع كلامه للأقل) - بدون أي تأثير بصري/صوتي مزعج
  // switchTab = false يمنع قفز التبويب وقت الشك (كلام أولي لسا مو مؤكد) - يمنع الالتباس البصري
  const applyDhikrCount = (dhikr: DhikrType, delta: number, switchTab: boolean = true) => {
    if (!dhikr || delta === 0) return;

    if (switchTab) {
      const idx = dhikrListRef.current.findIndex((d) => d.id === dhikr.id);
      if (idx !== -1) setActiveTab(idx);
    }

    const prevCount = countsRef.current[dhikr.id] ?? 0;
    const newCount  = Math.max(0, prevCount + delta);
    const appliedDelta = newCount - prevCount;
    if (appliedDelta === 0) return;

    const newCounts = { ...countsRef.current, [dhikr.id]: newCount };
    setCounts(newCounts);
    countsRef.current = newCounts;
    saveData(newCounts, dhikrListRef.current);
    bumpDailyTotal(appliedDelta, dhikr.id);

    if (delta < 0) return; // تراجع صامت - بدون أي تأثير إضافي

    setLastWord(dhikr.sub);
    playTick();

    pulseCircle();
    bounceNumber();
    triggerHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

    if (prevCount < dhikr.target && newCount >= dhikr.target) celebrate();
  };

  // ===== معالجة الحالات الغامضة فقط (ثقة متوسطة تحتاج Groq) =====
  // هذي تنحل فقط عند اكتمال الجملة (isFinal) حتى ما نرسل طلبات API على كل كلمة أولية
  const handleSpeechResult = async (text: string) => {
    if (!text) return;
    const now = Date.now();
    // عتبة زمنية صغيرة فقط لمنع التكرار الحرفي لنفس الحدث الصوتي (هدف ٧)
    if (now - lastCountTime.current < VOICE_DEBOUNCE) return;
    lastCountTime.current = now;

    const { result, repeats } = await matchDhikr(text, matchScopeRef.current);
    if (!result || result === 'none') return;

    // "new:" (ذكر غير معروف) صار يُتجاهل عمداً - الإضافة انصارت يدوية بس (من "أضف ذكر خاص"
    // بقائمة المزيد) حتى ما تنسوي كاردات تلقائية من كلام مسموع بالغلط أو ضجيج
    if (result.startsWith('new:')) return;

    const dhikr = matchScopeRef.current.find((d) => d.id === result);
    if (!dhikr) return;
    applyDhikrCount(dhikr, repeats);
  };

  // ===== معالجة لحظية لكل قطعة كلام (أولية أو نهائية) — العد يصير وياك أثناء الحچي مباشرة =====
  // مدمج فيها تصحيح الالتباس: bestLocalMatch هسه تعتمد على "بداية" العبارة (prefix) مو أي جزء
  // بنص الذكر. تبديل التبويب البصري يصير فوري بمجرد أول قراءة تصل ثقة عالية (SIM_HIGH) -
  // ما نستنى تكرارها ولا اكتمال الجملة (isFinal)، لأن تشديد المطابقة (كلمتين على الأقل +
  // العبارة كاملة لثقة ٠٫٨+) صار كافي لمنع القفز الغلط من كلمة جزئية.
  const segmentMatchRef = useRef<
    Map<number, { id: string; total: number; pendingId: string; pendingTotal: number; stableCount: number }>
  >(new Map());
  const finalizedSegments = useRef<Set<number>>(new Set()); // يمنع معالجة نفس المقطع مرتين

  // ===== ذاكرة استمرارية قصيرة الأمد بين مقطعين متتاليين لنفس الذكر الطويل =====
  // تحل مشكلة: لو محرك التعرف "قفل" مقطع كلام (isFinal) بمنتصف ذكر طويل (خاصة الأذكار
  // المخصصة)، والكلمة/الكلمات الجاية بعده توصل كـ"مقطع جديد" منفصل بدون أي رابط بالمقطع
  // السابق، فتنطابق من الصفر مع كل الأذكار وممكن "تنخطف" لذكر قصير غير مقصود (مثال:
  // "سبحانك" لحالها تنطابق مع "سبحان الله" بدل ما تُحسب استمرار للذكر الطويل الأصلي).
  const CONTINUATION_WINDOW_MS = 1800;
  const lastCommittedRef = useRef<{
    dhikrId: string;
    keywordWords: string[];
    matchedCount: number;
    ts: number;
  } | null>(null);

  // ===== عدّة معلّقة بانتظار حسم تعارض "بداية مطابقة" =====
  // لو مقطع كلام يطابق ذكر قصير تطابقاً تاماً، بس بنفس الوقت هو بداية محتملة لذكر أطول
  // (شوف findLongerPrefixCollision)، ما نطبق عدة الذكر القصير فوراً - نستنى نافذة قصيرة
  // (CONTINUATION_WINDOW_MS) نشوف هل المقطع الجاي يكمل الذكر الطويل. إذا اكتمل/تقدّم -
  // نلغي هذي العدة المعلقة نهائياً (كانت غلط). إذا ما اكمل - نطبقها بعد انتهاء المهلة
  // (أو فوراً إذا تأكدنا الاستمرارية فشلت). هذا التأخير البسيط ما يصير إلا بحالة التعارض
  // الفعلي بس (ذكر مخصص يبدأ بنفس كلمات ذكر ثابت) - باقي الأذكار العادية تبقى فورية 100%.
  const pendingFallbackRef = useRef<{
    timer: any;
    dhikr: DhikrType;
    total: number;
  } | null>(null);
  // رقم المقطع (resultIdx) اللي سببّ التأجيل - يمنع إعادة معالجة نفس المقطع مرتين
  // (المقطع الواحد ممكن يوصل بأكثر من حدث: أولي ثم نهائي لنفس resultIdx)
  const deferredIdxRef = useRef<number | null>(null);

  const clearPendingFallback = () => {
    if (pendingFallbackRef.current) {
      clearTimeout(pendingFallbackRef.current.timer);
      pendingFallbackRef.current = null;
    }
  };

  const commitPendingFallback = () => {
    const p = pendingFallbackRef.current;
    if (!p) return;
    clearTimeout(p.timer);
    pendingFallbackRef.current = null;
    applyDhikrCount(p.dhikr, p.total, true);
  };

  const processLiveSegment = (text: string, resultIdx: number, isFinal: boolean) => {
    if (isFinal && finalizedSegments.current.has(resultIdx)) return;

    // هذا المقطع بالذات أجّلنا قراره سابقاً (تعارض بداية مطابقة) - أي حدث جديد إلو (أولي
    // أو نهائي) نتجاهله هنا؛ القرار النهائي يتحدد بالمقطع الجاي عبر منطق الاستمرارية فوق
    if (deferredIdxRef.current === resultIdx) {
      if (isFinal) {
        finalizedSegments.current.add(resultIdx);
        deferredIdxRef.current = null;
      }
      return;
    }

    const rollbackSegment = () => {
      const prevEntry = segmentMatchRef.current.get(resultIdx);
      if (prevEntry && prevEntry.total > 0) {
        const oldDhikr = dhikrListRef.current.find((d) => d.id === prevEntry.id);
        if (oldDhikr) applyDhikrCount(oldDhikr, -prevEntry.total, isFinal);
      }
      segmentMatchRef.current.delete(resultIdx);
    };

    // نص فاضي = سكوت/انقطاع لحظي بالتعرف الصوتي - مو "لغط" ومو سبب كافي نراجع عدة
    // مطبقة مسبقاً لهذا المقطع. قبل هذا الفحص كان أي نص فاضي (شي طبيعي عند توقف
    // المستخدم عن الحچي) يسوي rollback كامل ويرجع العداد صفر رغم إن الذكر انعد صح.
    if (!text) {
      if (isFinal) finalizedSegments.current.add(resultIdx);
      return;
    }

    const norm = normalizeArabic(text);
    const normWords = norm.split(' ').filter(Boolean);

    // أول شي نتحقق: هل هذا المقطع الجديد استمرار لذكر طويل كان قاعد ينبني بمقطع سابق
    // وانقطع بمنتصفه؟ إذا نعم، نكمله بدل ما نطابقه من الصفر مع كل الأذكار.
    if (!segmentMatchRef.current.has(resultIdx)) {
      const lc = lastCommittedRef.current;
      if (lc && Date.now() - lc.ts <= CONTINUATION_WINDOW_MS && lc.matchedCount < lc.keywordWords.length) {
        const nextWord = lc.keywordWords[lc.matchedCount];
        if (normWords.length && normWords[0] === nextWord) {
          const combinedWords = lc.keywordWords.slice(0, lc.matchedCount).concat(normWords);
          const isNowComplete = combinedWords.length >= lc.keywordWords.length;
          const dhikrObj = dhikrListRef.current.find((d) => d.id === lc.dhikrId);
          if (dhikrObj) {
            // الكلام كمّل فعلاً كلمات الذكر الطويل -> العدة المعلقة (إن وجدت) كانت خطأ، تُلغى نهائياً
            clearPendingFallback();
            if (isNowComplete) {
              applyDhikrCount(dhikrObj, 1, true);
              const idx = dhikrListRef.current.findIndex((d) => d.id === lc.dhikrId);
              if (idx !== -1) setActiveTab(idx);
              lastCommittedRef.current = null;
            } else {
              lastCommittedRef.current = { ...lc, matchedCount: combinedWords.length, ts: Date.now() };
            }
            if (isFinal) finalizedSegments.current.add(resultIdx);
            return;
          }
        } else {
          // ما كملت نفس الذكر المعلق - نلغي الاستمرارية، ولو فيه عدة معلقة (fallback) كانت
          // مستنية هذا القرار بالضبط -> نطبقها هسه فوراً (تأكدنا الاستمرارية فشلت، ما داعي ننتظر)
          lastCommittedRef.current = null;
          commitPendingFallback();
        }
      }
    }

    if (!looksIslamic(norm, matchScopeRef.current)) {
      // ⚠️ تعديل (حل مشكلة "العداد يطلع وينزل بنفس الوقت" بوضع التركيز، خصوصاً
      // مع كلمات مفتاحية قصيرة مثل "كريم"): مقطع كلام وسيط (interim، مو isFinal)
      // وقصير جداً (كلمة وحدة أو أقل) ما يكفي لنحكم عليه "لغط حقيقي" ونسوي
      // تراجع فوري. الأشيع إن هذا مجرد تشويش لحظي بمحرك التعرف الصوتي أثناء
      // تكوّن الجملة (مثلاً يرجع "يا" لحالها لحظياً قبل ما تكتمل "يا كريم") -
      // كلمات مفتاحية قصيرة زي "كريم" حساسة جداً لهذا التذبذب لأن أي انحراف
      // بسيط بالتفريغ يخرجها عن التطابق. قبل هذا التعديل، كل مقطع وسيط
      // يفشل المطابقة كان يسوي rollback فوري على عدة اتطبقت بالمقطع اللي
      // قبله، وبعدين تنزاد من جديد لما يوصل مقطع صحيح - وهذا يبين كـ"صعود
      // ونزول بنفس الوقت". الحل: نستنى إما جملة أطول (كلمتين فأكثر) أو
      // اكتمال المقطع فعلياً (isFinal) قبل ما نراجع عدة سابقة - هذا ما يأثر
      // إطلاقاً على رفض اللغط الحقيقي (جملة كاملة واضحة غير متعلقة بالذكر).
      const isNoisyShortInterim = !isFinal && normWords.length <= 1;
      if (!isNoisyShortInterim) {
        // هنا فعلاً كلام غير متعلق بذكر (لغط حقيقي) -> التراجع مبرر
        rollbackSegment();
      }
      if (isFinal) finalizedSegments.current.add(resultIdx);
      return;
    }

    const { id, score, keyword } = bestLocalMatch(text, matchScopeRef.current);

    // ===== فحص تعارض "بداية مطابقة" =====
    // هذا المقطع طابق ذكر قصير تطابقاً تاماً - بس هل هو بنفس الوقت بداية محتملة لذكر
    // أطول بالقائمة (ذكر مخصص يبدأ بنفس كلماته بالضبط)؟ لو نعم، لا نطبق عدة الذكر
    // القصير فوراً - نؤجلها ونعطي فرصة للمقطع الجاي يثبت هل هو استمرار للذكر الطويل.
    if (score >= SIM_HIGH && id && !pendingFallbackRef.current) {
      const kwWordsNow = keyword.split(' ').filter(Boolean);
      if (normWords.length === kwWordsNow.length) {
        const collision = findLongerPrefixCollision(kwWordsNow, id, matchScopeRef.current);
        if (collision) {
          const shortDhikr = matchScopeRef.current.find((d) => d.id === id);
          if (shortDhikr) {
            lastCommittedRef.current = {
              dhikrId: collision.dhikr.id,
              keywordWords: collision.keywordWords,
              matchedCount: normWords.length,
              ts: Date.now(),
            };
            pendingFallbackRef.current = {
              dhikr: shortDhikr,
              total: countRepeats(norm, keyword),
              timer: setTimeout(commitPendingFallback, CONTINUATION_WINDOW_MS),
            };
            deferredIdxRef.current = resultIdx;
            if (isFinal) finalizedSegments.current.add(resultIdx);
            return;
          }
        }
      }
    }

    // ثقة عالية = ذكر معروف بالتأكيد -> عدّ لحظي محلي فوري
    if (score >= SIM_HIGH && id) {
      const rawTotal = countRepeats(norm, keyword);
      const prevEntry =
        segmentMatchRef.current.get(resultIdx) ??
        { id: '', total: 0, pendingId: '', pendingTotal: 0, stableCount: 0 };

      // هل نفس القراءة (id + عدد) اللي جتنا هالمرة هي نفس اللي جتنا المرة اللي فاتت؟
      const sameAsPending = prevEntry.pendingId === id && prevEntry.pendingTotal === rawTotal;
      const stableCount = sameAsPending ? prevEntry.stableCount + 1 : 1;
      // تثبيت أسرع: أول قراءة توصلنا كافية (بدل ما ننتظر تكرارها مرتين) - التبديل هسه صار
      // مضمون وسريع بفضل تشديد المطابقة (كلمتين على الأقل) فما فيه خطر التباس من كلمة وحدة
      const confirmed = isFinal || stableCount >= 1;

      if (confirmed) {
        if (prevEntry.id === id) {
          const delta = rawTotal - prevEntry.total;
          // نطبق بس لما العدد يطلع (delta موجب). لو نزل نتجاهله - تذبذب مؤقت مو تراجع حقيقي
          if (delta > 0) {
            const dhikr = dhikrListRef.current.find((d) => d.id === id);
            if (dhikr) applyDhikrCount(dhikr, delta, true);
          } else if (isFinal) {
            // العدة اتطبقت مسبقاً بمرحلة التثبيت المبكرة - هسه إحنا متأكدين 100%، فلازم نوصل
            // التبويب البصري لمكانه الصحيح حتى لو ما فيه عدة جديدة تنضاف هالمرة تحديداً
            const idx = dhikrListRef.current.findIndex((d) => d.id === id);
            if (idx !== -1) setActiveTab(idx);
          }
        } else {
          // الذكر المتعرّف عليه تغيّر فعلاً -> نتراجع عن القديم ونطبق الجديد فوراً (بسرعة)
          if (prevEntry.total > 0) {
            const oldDhikr = dhikrListRef.current.find((d) => d.id === prevEntry.id);
            if (oldDhikr) applyDhikrCount(oldDhikr, -prevEntry.total, true);
          }
          if (rawTotal > 0) {
            const newDhikr = dhikrListRef.current.find((d) => d.id === id);
            if (newDhikr) applyDhikrCount(newDhikr, rawTotal, true);
          }
        }
        segmentMatchRef.current.set(resultIdx, {
          id,
          total: Math.max(rawTotal, prevEntry.id === id ? prevEntry.total : 0),
          pendingId: id,
          pendingTotal: rawTotal,
          stableCount,
        });
      } else {
        // لسا مو مستقر - نسجل القراءة المعلقة بس بدون ما نطبقها فعلياً على العداد
        segmentMatchRef.current.set(resultIdx, { ...prevEntry, pendingId: id, pendingTotal: rawTotal, stableCount });
      }

      if (isFinal) {
        // نسجل استمرارية للمقطع الجاي بس إذا الذكر المطابق لسا ناقص (كلمتين أو أكثر
        // بالكلمة المفتاحية، وعدد كلمات الكلام المسموع أقل من عدد كلمات الذكر الكامل)
        const kwWordsArr = keyword.split(' ').filter(Boolean);
        if (kwWordsArr.length >= 2 && normWords.length < kwWordsArr.length) {
          lastCommittedRef.current = { dhikrId: id, keywordWords: kwWordsArr, matchedCount: normWords.length, ts: Date.now() };
        } else {
          lastCommittedRef.current = null;
        }
        finalizedSegments.current.add(resultIdx);
        segmentMatchRef.current.delete(resultIdx);
      }
      return;
    }

    // ثقة متوسطة/منخفضة (ذكر جديد أو غامض) -> نستنى اكتمال الجملة فقط
    if (isFinal) {
      rollbackSegment();
      lastCommittedRef.current = null;
      finalizedSegments.current.add(resultIdx);
      handleSpeechResult(text);
    }
  };

  // ===== التعرف على الصوت (expo-speech-recognition - يشتغل على أندرويد/آيفون/الويب بنفس الكود) =====
  // عداد داخلي للتفريق بين "مقطع كلام" وآخر (كل ما توصل نتيجة نهائية isFinal=true نبدي مقطع جديد)
  const segmentIdRef = useRef(0);
  const restartTimerRef = useRef<any>(null);
  // عداد محاولات إعادة التشغيل المتتالية - يمنع اللوب اللانهائي الصامت عند خطأ متكرر
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 4;
  // مؤشر مستوى الصوت الحي (يغذّي نبضة مؤشر المايك) + آخر حالة "هل نسمع صوت مسموع الآن"
  const micVolumeAnim = useRef(new Animated.Value(0)).current;
  const hearingStateRef = useRef(false);

  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
    setLastWord('🎙 جاري الاستماع...');
    retryCountRef.current = 0; // بدء ناجح = نصفّر عداد المحاولات الفاشلة
  });

  useSpeechRecognitionEvent('result', (event: any) => {
    const alternatives: string[] = Array.isArray(event.results)
      ? event.results.map((r: any) => r?.transcript).filter(Boolean)
      : [];
    const text = alternatives.length
      ? pickBestAlternative(alternatives, matchScopeRef.current)
      : (event.results?.[0]?.transcript ?? '');
    processLiveSegment(text, segmentIdRef.current, !!event.isFinal);
    if (event.isFinal) segmentIdRef.current += 1;
  });

  useSpeechRecognitionEvent('volumechange', (event: any) => {
    const raw = typeof event?.value === 'number' ? event.value : VOLUME_MIN;
    const norm = Math.max(0, Math.min(1, (raw - VOLUME_MIN) / (VOLUME_MAX - VOLUME_MIN)));
    Animated.timing(micVolumeAnim, { toValue: norm, duration: 100, useNativeDriver: true }).start();

    // فيدباك نصي حي: نبدّل بين "جاري الاستماع" و"يسمعك" حسب مستوى الصوت الفعلي -
    // بس لو ما فيه ذكر انطابق هسه (النص الحالي لسا رسالة حالة، مو اسم ذكر فعلي)
    const audibleNow = raw > VOLUME_AUDIBLE_THRESHOLD;
    if (audibleNow !== hearingStateRef.current) {
      hearingStateRef.current = audibleNow;
      if (audibleNow) {
        setLastWord((prev) => (prev.startsWith('🎙') ? '🎙 يسمعك...' : prev));
      } else {
        setLastWord((prev) => (prev === '🎙 يسمعك...' ? '🎙 جاري الاستماع...' : prev));
      }
    }
  });

  useSpeechRecognitionEvent('error', (event: any) => {
    // "no-speech" و"aborted" مو أخطاء حقيقية تستاهل تنبيه - أول وحدة سكوت لحظي، والثانية توقف طبيعي
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    // أي خطأ ثاني وإحنا لسا بوضع استماع -> نحاول نعيد التشغيل، بس بحد أقصى محاولات
    // (سابقاً كان يعيد المحاولة للأبد بصمت حتى لو المشكلة مستمرة - الحين نوقف ونبلغ المستخدم)
    if (isListeningRef.current) {
      retryCountRef.current += 1;
      if (retryCountRef.current > MAX_RETRIES) {
        isListeningRef.current = false;
        setIsListening(false);
        setLastWord('');
        Alert.alert(
          'تعذر الاستماع بشكل متكرر',
          'صار فيه مشكلة مستمرة بالتعرف على الصوت. تأكد من إذن المايك ومن اتصال الإنترنت وحاول تفتح الاستماع مرة ثانية.'
        );
        return;
      }
      segmentMatchRef.current.clear();
      finalizedSegments.current.clear();
      lastCommittedRef.current = null;
      restartTimerRef.current = setTimeout(() => {
        try { ExpoSpeechRecognitionModule.start(SPEECH_OPTIONS); } catch {}
      }, 300);
    } else {
      Alert.alert('تعذر التسجيل الصوتي', event.message || 'حدث خطأ أثناء التعرف على الصوت');
    }
  });

  useSpeechRecognitionEvent('end', () => {
    // "end" ينوصل حتى لو المستخدم هو اللي أوقف. مهم: نمسح خرائط التتبع هنا بس - بعد ما
    // نتأكد ما فيه نتائج متأخرة راح توصل - وليس فوراً جوه stopListening()، لأن محرك
    // التعرف الصوتي أحياناً يرسل نتيجة نهائية متأخرة *بعد* نداء stop() مباشرة. لو مسحنا
    // الخرائط قبل وصولها، هذي النتيجة المتأخرة تنعامل كذكر جديد كامل وتزيد العدة فوق
    // الشي المعدود مسبقاً أثناء التسبيح الفعلي (سبب علة "زيادة العدات وقت التوقف").
    segmentMatchRef.current.clear();
    finalizedSegments.current.clear();
    lastCommittedRef.current = null;
    // نفس المبدأ ينطبق على العدة المعلقة (تعارض بداية مطابقة) - لو ضلت مؤجلة وصار
    // "end" (حتى بإعادة التشغيل التلقائي، مو بس الإيقاف اليدوي)، لازم تنمسح هنا،
    // وإلا ممكن تنطبق متأخرة بجلسة استماع جديدة كلياً على مقطع صار قديم
    clearPendingFallback();
    deferredIdxRef.current = null;
    if (isListeningRef.current) {
      try { ExpoSpeechRecognitionModule.start(SPEECH_OPTIONS); } catch {}
    } else {
      setIsListening(false);
    }
  });

  const startListening = async () => {
    const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
    if (!available) {
      Alert.alert(
        'التعرف على الصوت غير متاح',
        'تأكد إن خدمة التعرف على الصوت مفعّلة بجهازك (على أندرويد: تطبيق Google أو Speech Services من Play Store، وعلى آيفون: تفعيل Siri والإملاء من الإعدادات).'
      );
      return;
    }
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('الإذن مطلوب', 'التطبيق يحتاج إذن الميكرفون والتعرف على الصوت حتى يشتغل التسبيح الصوتي.');
      return;
    }
    segmentMatchRef.current.clear();
    finalizedSegments.current.clear();
    lastCommittedRef.current = null;
    segmentIdRef.current = 0;
    isListeningRef.current = true;
    setIsListening(true);
    setLastWord('🎙 جاري الاستماع...');
    ExpoSpeechRecognitionModule.start(SPEECH_OPTIONS);

    // تحذير لطيف بالخلفية إذا مافي إنترنت - ما يأخر ولا يوقف بدء الاستماع نفسه،
    // لأن الأذكار الأساسية تنعد صوتياً محلياً بدون نت أصلاً
    checkNetworkReachable().then((online) => {
      if (!online && isListeningRef.current) {
        Alert.alert(
          'لا يوجد اتصال بالإنترنت',
          'الأذكار الأساسية (تسبيح، تحميد، تكبير...) بتنعد صوتياً عادي بدون نت، بس تمييز الكلام الغامض أو الأذكار غير الشائعة يحتاج اتصال وممكن ما يشتغل هسه.'
        );
      }
    });
  };

  const stopListening = () => {
    isListeningRef.current = false;
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
    clearPendingFallback();
    deferredIdxRef.current = null;
    lastCommittedRef.current = null;
    ExpoSpeechRecognitionModule.stop();
    // ملاحظة: خرائط التتبع (segmentMatchRef/finalizedSegments) ما تنمسح هنا عمداً -
    // تنمسح بحدث 'end' الحقيقي بعد ما نضمن وصول كل النتائج المتأخرة أول (شوف تعليق 'end' فوق)
    hearingStateRef.current = false;
    micVolumeAnim.setValue(0);
    setIsListening(false);
    setLastWord('');
  };

  const toggleListening = () => {
    if (isListening) stopListening();
    else startListening();
  };

  // ===== Animations =====
  const pulseCircle = () => {
    Animated.sequence([
      Animated.timing(circleScale, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.spring(circleScale, { toValue: 1,    friction: 4,  useNativeDriver: true }),
    ]).start();
  };

  const bounceNumber = () => {
    Animated.sequence([
      Animated.timing(countScale, { toValue: 1.16, duration: 90, useNativeDriver: true }),
      Animated.spring(countScale, { toValue: 1,    friction: 3.5, tension: 140, useNativeDriver: true }),
    ]).start();
  };

  // ===== تحريك الـ Liquid Pill خلف التبويب النشط =====
  const movePillTo = (index: number, animate: boolean) => {
    const layout = tabLayoutsRef.current[index];
    if (!layout) return; // لسا ما انقاست هذا التبويب (أول رندر)
    if (animate) {
      Animated.parallel([
        Animated.spring(pillX,     { toValue: layout.x,     friction: 9, tension: 90, useNativeDriver: false }),
        Animated.spring(pillWidth, { toValue: layout.width, friction: 9, tension: 90, useNativeDriver: false }),
      ]).start();
    } else {
      pillX.setValue(layout.x);
      pillWidth.setValue(layout.width);
    }
    pillReady.current = true;
  };

  const onTabLayout = (index: number) => (e: any) => {
    const { x, width } = e.nativeEvent.layout;
    tabLayoutsRef.current[index] = { x, width };
    // أول ما تنقاس مواقع التبويب النشط حالياً، نحط الـ pill عليه فوراً بدون أنيميشن
    const pillIndex = activeTab < 3 ? activeTab : 3;
    if (index === pillIndex && !pillReady.current) {
      movePillTo(index, false);
    }
  };

  useEffect(() => {
    const pillIndex = activeTab < 3 ? activeTab : 3;
    movePillTo(pillIndex, true);
  }, [activeTab, dhikrList.length]);

  // احتفال بصري عند الوصول للهدف: نبضات متتالية واضحة + اهتزاز مختلف عن العد العادي (بدون نص)
  const celebrate = () => {
    setCelebrating(true);
    Animated.sequence([
      Animated.timing(circleScale, { toValue: 1.14, duration: 160, useNativeDriver: true }),
      Animated.spring(circleScale, { toValue: 0.98, friction: 3,   useNativeDriver: true }),
      Animated.timing(circleScale, { toValue: 1.08, duration: 140, useNativeDriver: true }),
      Animated.spring(circleScale, { toValue: 1,     friction: 3,   useNativeDriver: true }),
    ]).start();
    triggerHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    setTimeout(() => setCelebrating(false), 1800);
  };

  // ===== العدّ اليدوي (تاب على الدائرة) - يستخدم نفس منطق applyDhikrCount حتى ما نكرر الكود
  // ونضمن أي إصلاح مستقبلي (متل مزامنة countsRef) ينطبق على الاثنين سوا =====
  const manualCount = () => {
    const current = dhikrList[activeTab];
    applyDhikrCount(current, 1);
  };

  // ===== تراجع بوحدة واحدة (تُستدعى من اللمسة الطويلة على الدائرة) =====
  const undoOneCount = () => {
    const cur = dhikrList[activeTab] ?? dhikrList[0];
    if (!cur) return;
    const prevCount = countsRef.current[cur.id] ?? 0;
    if (prevCount <= 0) {
      triggerHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
      return;
    }
    const newCount  = prevCount - 1;
    const newCounts = { ...countsRef.current, [cur.id]: newCount };
    setCounts(newCounts);
    countsRef.current = newCounts;
    saveData(newCounts, dhikrListRef.current);
    bumpDailyTotal(-1, cur.id);
    setLastWord('تراجع وحدة ↩');
    triggerHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  };

  // ===== إعادة تعيين =====
  const resetCurrent = async () => {
    const current   = dhikrList[activeTab];
    const prevCount = countsRef.current[current.id] ?? 0;
    const newCounts = { ...countsRef.current, [current.id]: 0 };
    setCounts(newCounts);
    countsRef.current = newCounts;
    await saveData(newCounts, dhikrList);
    // نطرح العدة القديمة من "تسبيح اليوم" وتفصيله حتى ما يبقون عادّين عدة انصفرت
    // من كارد الذكر نفسه - نفس منطق التراجع (undoOneCount) بالضبط
    if (prevCount > 0) await bumpDailyTotal(-prevCount, current.id);
  };

  const resetAll = async () => {
    const prevCounts = countsRef.current;
    const newCounts: Record<string, number> = {};
    dhikrList.forEach((d) => { newCounts[d.id] = 0; });
    setCounts(newCounts);
    countsRef.current = newCounts;
    await saveData(newCounts, dhikrList);
    // نفس الشي لكل ذكر لحاله - كل ذكر عنده عدة سابقة، نطرحها من مجموع اليوم وتفصيله
    for (const d of dhikrList) {
      const prevCount = prevCounts[d.id] ?? 0;
      if (prevCount > 0) await bumpDailyTotal(-prevCount, d.id);
    }
  };

  // ===== القيم الحالية =====
  const current      = dhikrList[activeTab] ?? dhikrList[0];
  const focusDhikr    = focusDhikrId ? dhikrList.find((d) => d.id === focusDhikrId) ?? null : null;
  const focusCount    = focusDhikrId ? (counts[focusDhikrId] ?? 0) : 0;
  const focusProgress = focusDhikr ? Math.min(focusCount / focusDhikr.target, 1) : 0;
  const currentCount = counts[current.id] ?? 0;
  const progress     = Math.min(currentCount / current.target, 1);
  const glowColor     = getGlow(current.id);
  const dateParts     = getDateParts();

  // تحريك حلقة التقدم بسلاسة كل ما يتغير العدد أو الذكر النشط
  useEffect(() => {
    Animated.timing(ringProgress, {
      toValue: progress,
      duration: 350,
      useNativeDriver: false, // strokeDashoffset ما يدعم native driver
    }).start();
  }, [progress]);

  // نفس الشي لحلقة وضع التركيز - مستقلة كلياً عن الحلقة الرئيسية
  useEffect(() => {
    Animated.timing(focusRingProgress, {
      toValue: focusProgress,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [focusProgress]);

  // ===== عدّ يدوي (تاب) داخل وضع التركيز - يستخدم نفس applyDhikrCount بالضبط
  // (نفس الاهتزاز/الصوت/الاحتفال عند الوصول للهدف)، بس switchTab=false حتى ما يأثر
  // على التبويب الرئيسي المخفي خلف الوضع الضبابي =====
  const focusManualCount = () => {
    if (!focusDhikr) return;
    applyDhikrCount(focusDhikr, 1, false);
  };

  const focusUndoCount = () => {
    if (!focusDhikr) return;
    const prevCount = countsRef.current[focusDhikr.id] ?? 0;
    if (prevCount <= 0) {
      triggerHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
      return;
    }
    const newCounts = { ...countsRef.current, [focusDhikr.id]: prevCount - 1 };
    setCounts(newCounts);
    countsRef.current = newCounts;
    saveData(newCounts, dhikrListRef.current);
    bumpDailyTotal(-1, focusDhikr.id);
    triggerHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  };

  // ===== نظام لمس موحّد على الدائرة (تاب = عدّة، لمسة طويلة = تراجع، سحب = تبديل ذكر) =====
  // ملاحظة: تعمّدنا عدم الجمع بين Pressable و PanResponder على نفس العنصر لأنهم يتعارضون
  // بمنازعة "من ياخذ اللمسة" (خصوصاً على الويب) وهذا كان سبب عدم اشتغال السحب سابقاً.
  const LONG_PRESS_MS = 500;

  const onCircleTouchStart = (evt: any) => {
    const { pageX, pageY } = evt.nativeEvent;
    touchStartRef.current = { x: pageX, y: pageY, time: Date.now() };
    longPressFiredRef.current = false;

    // مؤقت اللمسة الطويلة - إذا الإصبع ثابت (ما تحرك وما رفع) لمدة LONG_PRESS_MS نعتبرها تراجع
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      undoOneCount();
    }, LONG_PRESS_MS);
  };

  const onCircleTouchMove = (evt: any) => {
    const { pageX, pageY } = evt.nativeEvent;
    const dx = pageX - touchStartRef.current.x;
    const dy = pageY - touchStartRef.current.y;
    // أول ما يتحرك الإصبع بشكل ملحوظ، نلغي مؤقت اللمسة الطويلة (حتى ما تنعد تراجع أثناء سحب)
    if ((Math.abs(dx) > 12 || Math.abs(dy) > 12) && longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const onCircleTouchEnd = (evt: any) => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
    if (longPressFiredRef.current) return; // اتعالجت كتراجع، ما نكمل

    const { pageX, pageY } = evt.nativeEvent;
    const dx = pageX - touchStartRef.current.x;
    const dy = pageY - touchStartRef.current.y;
    const elapsed = Date.now() - touchStartRef.current.time;

    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      // سحب أفقي = تبديل الذكر النشط (بس بين الأذكار الثابتة - المضافة بوضع التركيز المنفصل)
      const list = dhikrListRef.current.filter((d) => !d.isCustom);
      if (list.length > 1) {
        const dir = dx < 0 ? 1 : -1; // سحب لليسار = التالي، لليمين = السابق
        const curIdx = list.findIndex((d) => d.id === dhikrListRef.current[activeTab]?.id);
        const base = curIdx === -1 ? 0 : curIdx;
        const nextIdx = (base + dir + list.length) % list.length;
        const nextGlobalIdx = dhikrListRef.current.findIndex((d) => d.id === list[nextIdx].id);
        if (nextGlobalIdx !== -1) setActiveTab(nextGlobalIdx);
        triggerHaptic(() => Haptics.selectionAsync());
      }
    } else if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && elapsed < 500) {
      // ضغطة عادية = عدّة
      manualCount();
    }
  };

  // ===== واجهة الشاشة =====
  const screenContent = (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top },
        !bgOption.image && { backgroundColor: bgOption.color },
      ]}
    >
      <BackgroundGlow color={glowColor} />
      <FloatingParticles color={glowColor} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollOuter}>
        <View style={styles.scroll}>

          {/* ===== الهيدر (الشعار + التاريخ + الصوت والمنيو، كلهم بنفس المستوى) ===== */}
          <View style={styles.header}>
            {/* شعار التطبيق الحقيقي - الملف بمسار src/assets/logo.png - صار قابل
                للضغط: يفتح فيديو تعريفي قصير ثم واجهة "حول التطبيق" */}
            <TouchableOpacity
              style={styles.logoBadge}
              activeOpacity={0.75}
              onPress={() => { setLogoIntroMounted(true); setShowLogoIntro(true); }}
            >
              <Image
                source={require('../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/settings/calendar' as any)}
              activeOpacity={0.75}
              style={styles.dateBlock}
            >
              {calendarPref !== 'gregorian' && (
                <Text style={styles.dateHijri}>{dateParts.hijri}</Text>
              )}
              {calendarPref !== 'hijri' && (
                <Text style={styles.dateGregorian}>{dateParts.gregorian}</Text>
              )}
              {dateParts.occasion && (
                <Text
                  style={[
                    styles.occasionBadge,
                    { color: dateParts.occasion.type === 'sorrow' ? '#c8a8a8' : '#c8e0a8' },
                  ]}
                  numberOfLines={1}
                >
                  {dateParts.occasion.type === 'sorrow' ? '🕯️ ' : '✨ '}{dateParts.occasion.name}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.headerRightRow}>
              <TouchableOpacity onPress={toggleSound} style={styles.soundToggleBtn}>
                <Ionicons
                  name={soundOn ? 'volume-medium-outline' : 'volume-mute-outline'}
                  size={16}
                  color={soundOn ? C.neonBlue : 'rgba(255,255,255,0.45)'}
                />
              </TouchableOpacity>
              <GlassHamburgerMenu />
            </View>
          </View>

          {logoIntroMounted && (
            <LogoIntroModal visible={showLogoIntro} onClose={() => setShowLogoIntro(false)} />
          )}

          <View style={styles.mainLayout}>
            <View style={styles.leftPanel}>

              {/* ===== الدائرة - كل التفاعل (عدّ، تراجع، سحب) صار عليها بس ===== */}
              <View style={styles.circleRow}>
                <View
                  style={styles.circleWrapper}
                  onStartShouldSetResponder={() => true}
                  onResponderGrant={onCircleTouchStart}
                  onResponderMove={onCircleTouchMove}
                  onResponderRelease={onCircleTouchEnd}
                  onResponderTerminationRequest={() => false}
                >
                  <Animated.View
                    style={[
                      styles.outerRing,
                      { borderColor: glowColor },
                      { transform: [{ scale: circleScale }] },
                    ]}
                  >
                    <ProgressRing
                      size={circleSize}
                      strokeWidth={4}
                      progress={ringProgress}
                      color={glowColor}
                      celebrating={celebrating}
                    />
                    <View style={styles.glassCircle}>
                      <Text
                        style={styles.dhikrText}
                        numberOfLines={3}
                        adjustsFontSizeToFit
                        minimumFontScale={0.55}
                      >
                        {current.sub}
                      </Text>
                      <Animated.Text
                        style={[
                          styles.countText,
                          { textShadowColor: glowColor, transform: [{ scale: countScale }] },
                        ]}
                      >
                        {toArabicDigits(currentCount)}
                      </Animated.Text>
                      <Text style={styles.targetText}>/ {toArabicDigits(current.target)}</Text>
                    </View>
                  </Animated.View>
                </View>
              </View>

              {/* ===== العداد اليومي + الأيام المتتالية (اضغط لتفاصيل كل ذكر) ===== */}
              <TouchableOpacity
                style={styles.dailyRow}
                activeOpacity={0.7}
                onPress={() => setDailyModalOpen(true)}
              >
                <Text style={styles.dailyText}>
                  تسبيح اليوم: {toArabicDigits(dailyTotal)}
                </Text>
                {streak > 0 && (
                  <View style={styles.streakBadge}>
                    <Ionicons name="flame" size={12} color="#F2A65B" />
                    <Text style={styles.streakText}>{toArabicDigits(streak)} يوم</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* ===== تبويبات الأذكار (شريط أفقي قابل للسحب) ===== */}
              <View style={styles.tabRowWrap}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tabRow}
                >
                  {/* Liquid Pill - خلفية زجاجية متحركة تتبع التبويب النشط بسلاسة */}
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.liquidPill,
                      {
                        borderColor: getGlow(current.id),
                        transform: [{ translateX: pillX }],
                        width: pillWidth,
                      },
                    ]}
                  />

                  {dhikrList.slice(0, 3).map((d, i) => {
                    const tabGlow = getGlow(d.id);
                    const active = activeTab === i;
                    return (
                      <TouchableOpacity
                        key={d.id}
                        style={styles.tab}
                        onLayout={onTabLayout(i)}
                        onPress={() => setActiveTab(i)}
                      >
                        <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                          {d.label}
                        </Text>
                        <Text style={[styles.tabSub, active && styles.tabSubActive]}>
                          {d.sub}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  {/* زر المزيد - يفتح قائمة بباقي التسبيحات (الموسّعة + المخصصة) */}
                  {dhikrList.length > 3 && (
                    <TouchableOpacity
                      style={[styles.tab, styles.moreTab]}
                      onLayout={onTabLayout(3)}
                      onPress={() => setMoreOpen(true)}
                    >
                      <Ionicons
                        name="ellipsis-horizontal-circle"
                        size={18}
                        color={activeTab >= 3 ? getGlow(current.id) : C.neonBlue}
                      />
                      <Text style={[styles.tabLabel, { marginTop: 4 }]}>المزيد</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>

              {/* قائمة المزيد - Modal زجاجي احترافي */}
              <Modal
                visible={moreOpen}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => setMoreOpen(false)}
              >
                <Pressable style={styles.modalOverlay} onPress={() => setMoreOpen(false)}>
                  <View style={styles.moreDropdown} onStartShouldSetResponder={() => true}>
                    <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />
                    {/* هيدر */}
                    <View style={styles.moreDropdownHeader}>
                      <Text style={styles.moreDropdownTitle}>باقي التسبيحات</Text>
                      <TouchableOpacity onPress={() => setMoreOpen(false)} style={styles.moreCloseBtn}>
                        <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                      {/* كارد زجاجي: أضف ذكر خاص (مضمون ١٠٠٪ - مو تعرّف صوتي عشوائي) */}
                      <View style={styles.composerCard}>
                        <View style={styles.composerHeader}>
                          <Ionicons name="sparkles" size={13} color={C.neonBlue} />
                          <Text style={styles.composerTitle}>أضف ذكر خاص</Text>
                        </View>
                        <TextInput
                          style={styles.composerInput}
                          placeholder="مثلاً: سبحان الله والحمد لله ولا إله إلا الله والله أكبر"
                          placeholderTextColor="rgba(255,255,255,0.32)"
                          value={composerText}
                          onChangeText={setComposerText}
                          multiline
                          textAlign="right"
                        />
                        <View style={styles.composerTargetRow}>
                          <Text style={styles.composerTargetLabel}>الهدف (عدد المرات)</Text>
                          <TextInput
                            style={styles.composerTargetInput}
                            value={composerTarget}
                            onChangeText={(t) => setComposerTarget(t.replace(/[^0-9]/g, ''))}
                            keyboardType="number-pad"
                            textAlign="center"
                            maxLength={5}
                          />
                        </View>
                        <TouchableOpacity
                          onPress={handleAddComposerDhikr}
                          activeOpacity={composerText.trim() ? 0.7 : 1}
                          style={[
                            styles.composerBtn,
                            !composerText.trim() && { opacity: 0.4 },
                          ]}
                        >
                          <Ionicons name="add-circle" size={15} color={C.navy} />
                          <Text style={styles.composerBtnText}>إضافة وابدأ التسبيح</Text>
                        </TouchableOpacity>
                      </View>

                      {/* أذكار إسلامية أساسية (من القائمة الموسّعة) */}
                      {dhikrList.slice(3).filter(d => !d.isCustom).length > 0 && (
                        <View style={styles.moreSectionLabel}>
                          <Ionicons name="moon" size={11} color="rgba(255,255,255,0.35)" />
                          <Text style={styles.moreSectionText}>أذكار إسلامية</Text>
                        </View>
                      )}
                      {dhikrList.slice(3).filter(d => !d.isCustom).map((d) => {
                        const i = dhikrList.findIndex(x => x.id === d.id);
                        const tabGlow = getGlow(d.id);
                        const active = activeTab === i;
                        const usedCount = counts[d.id] ?? 0;
                        return (
                          <TouchableOpacity
                            key={d.id}
                            style={[styles.moreItem, active && styles.moreItemActive]}
                            onPress={() => { setActiveTab(i); setMoreOpen(false); }}
                          >
                            <View style={[styles.moreItemDot, { backgroundColor: tabGlow }]} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.moreItemLabel, { color: active ? tabGlow : C.white }]}>
                                {d.label}
                              </Text>
                              <Text style={styles.moreItemSub}>{d.sub}</Text>
                            </View>
                            <Text style={[styles.moreItemCount, { color: tabGlow }]}>
                              {toArabicDigits(usedCount)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}

                      {/* أذكار مخصصة (تعرّف عليها الذكاء الاصطناعي) */}
                      {dhikrList.filter(d => d.isCustom).length > 0 && (
                        <>
                          <View style={[styles.moreSectionLabel, { marginTop: 8 }]}>
                            <Ionicons name="sparkles" size={11} color="rgba(255,255,255,0.35)" />
                            <Text style={styles.moreSectionText}>أذكار مكتشفة بالصوت</Text>
                          </View>
                          {dhikrList.filter(d => d.isCustom).map((d) => {
                            const tabGlow = '#9A9FAE';
                            const usedCount = counts[d.id] ?? 0;
                            return (
                              <View key={d.id} style={styles.moreItem}>
                                <TouchableOpacity
                                  onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                                    removeCustomDhikr(d.id);
                                  }}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  style={styles.moreItemRemoveBtn}
                                >
                                  <Ionicons name="close" size={18} color="rgba(255,120,120,0.9)" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}
                                  onPress={() => { openFocusMode(d.id); setMoreOpen(false); }}
                                >
                                  <View style={[styles.moreItemDot, { backgroundColor: tabGlow }]} />
                                  <View style={{ flex: 1 }}>
                                    <Text style={[styles.moreItemLabel, { color: C.white }]}>
                                      {d.label}
                                    </Text>
                                    <Text style={styles.moreItemSub}>{d.sub}</Text>
                                  </View>
                                  <Text style={[styles.moreItemCount, { color: tabGlow }]}>
                                    {toArabicDigits(usedCount)}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            );
                          })}
                        </>
                      )}
                    </ScrollView>
                  </View>
                </Pressable>
              </Modal>

              {/* ===== وضع التركيز - عداد منفصل كلياً للأذكار المضافة ===== */}
              {/* المايك هنا يسمع بس هذا الذكر بالذات (matchScopeRef يتحول لعنصر واحد فقط) -
                  ما فيه أي تنافس أو التباس مع الأذكار الثابتة. وقت الخروج يرجع كل شي
                  للمايك الأساسي تلقائياً (شوف closeFocusMode). الدائرة تدعم تاب = عدّة
                  يدوية ولمسة طويلة = تراجع، بالضبط متل الدائرة الرئيسية */}
              <Modal
                visible={!!focusDhikrId}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={closeFocusMode}
              >
                <View style={styles.focusOverlay}>
                  <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
                  <View style={styles.focusCard}>
                    <View style={styles.moreDropdownHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="sparkles" size={14} color={C.neonBlue} />
                        <Text style={styles.moreDropdownTitle}>وضع التركيز</Text>
                      </View>
                      <TouchableOpacity onPress={closeFocusMode} style={styles.moreCloseBtn}>
                        <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={focusManualCount}
                      onLongPress={focusUndoCount}
                      delayLongPress={500}
                      style={styles.focusCircleWrap}
                    >
                      <ProgressRing
                        size={FOCUS_CIRCLE_SIZE}
                        strokeWidth={9}
                        progress={focusRingProgress}
                        color={C.neonBlue}
                        celebrating={celebrating}
                      />
                      <Animated.View style={[styles.focusGlassCircle, { transform: [{ scale: circleScale }] }]}>
                        <Text
                          style={styles.focusDhikrText}
                          numberOfLines={4}
                          adjustsFontSizeToFit
                          minimumFontScale={0.5}
                        >
                          {focusDhikr?.sub ?? ''}
                        </Text>
                        <Animated.Text style={[styles.focusCount, { transform: [{ scale: countScale }] }]}>
                          {toArabicDigits(focusCount)}
                        </Animated.Text>
                        <Text style={styles.focusTarget}>
                          الهدف {toArabicDigits(focusDhikr?.target ?? 0)}
                        </Text>
                      </Animated.View>
                    </TouchableOpacity>
                    <Text style={styles.focusHint}>تاب = عدّة يدوية  ·  ضغطة مطوّلة = تراجع وحدة</Text>

                    <TouchableOpacity
                      style={[styles.voiceBtn, isListening && styles.voiceBtnActive, { marginTop: 16 }]}
                      onPress={toggleListening}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={isListening ? 'mic' : 'mic-outline'} size={18} color={C.white} />
                      <Text style={styles.voiceBtnText}>
                        {isListening ? 'إيقاف الاستماع' : 'ابدأ العدّ الصوتي'}
                      </Text>
                      {isListening && (
                        <Animated.View
                          style={[
                            styles.liveIndicator,
                            {
                              transform: [{
                                scale: micVolumeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }),
                              }],
                              opacity: micVolumeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
                            },
                          ]}
                        />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.focusExitBtn} onPress={closeFocusMode} activeOpacity={0.75}>
                      <Ionicons name="arrow-forward-circle-outline" size={16} color="rgba(255,255,255,0.75)" />
                      <Text style={styles.focusExitText}>الرجوع للتسبيح الأساسي</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>

              {/* تفصيل تسبيح اليوم - أي ذكر انقال وكم مرة اليوم */}
              <Modal
                visible={dailyModalOpen}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => setDailyModalOpen(false)}
              >
                <Pressable style={styles.modalOverlay} onPress={() => setDailyModalOpen(false)}>
                  <View style={styles.moreDropdown} onStartShouldSetResponder={() => true}>
                    <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={styles.moreDropdownHeader}>
                      <Text style={styles.moreDropdownTitle}>تفصيل تسبيح اليوم</Text>
                      <TouchableOpacity onPress={() => setDailyModalOpen(false)} style={styles.moreCloseBtn}>
                        <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                      {dhikrList.filter((d) => (dailyBreakdown[d.id] ?? 0) > 0).length === 0 ? (
                        <Text style={styles.dailyEmptyText}>لسا ما سبّحت اليوم</Text>
                      ) : (
                        dhikrList
                          .filter((d) => (dailyBreakdown[d.id] ?? 0) > 0)
                          .sort((a, b) => (dailyBreakdown[b.id] ?? 0) - (dailyBreakdown[a.id] ?? 0))
                          .map((d) => {
                            const tabGlow = d.isCustom ? '#9A9FAE' : getGlow(d.id);
                            const todayCount = dailyBreakdown[d.id] ?? 0;
                            return (
                              <View key={d.id} style={styles.moreItem}>
                                <View style={[styles.moreItemDot, { backgroundColor: tabGlow }]} />
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.moreItemLabel, { color: C.white }]}>{d.label}</Text>
                                  <Text style={styles.moreItemSub}>{d.sub}</Text>
                                </View>
                                <Text style={[styles.moreItemCount, { color: tabGlow }]}>
                                  {toArabicDigits(todayCount)}
                                </Text>
                              </View>
                            );
                          })
                      )}
                    </ScrollView>
                  </View>
                </Pressable>
              </Modal>

              {/* ===== ملاحظات لأول مرة - توضح الواجهة، تختفي بعد أول فتح ===== */}
              <Modal
                visible={onboardOpen}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={dismissOnboard}
              >
                <Pressable style={styles.modalOverlay} onPress={dismissOnboard}>
                  <View style={styles.onboardCard} onStartShouldSetResponder={() => true}>
                    <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={styles.moreDropdownHeader}>
                      <Text style={styles.onboardMainTitle}>أهلاً بيك 👋</Text>
                      <TouchableOpacity onPress={dismissOnboard} style={styles.moreCloseBtn}>
                        <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                      {ONBOARD_STEPS.map((step, i) => (
                        <View key={i} style={styles.onboardItem}>
                          <View style={styles.onboardIconWrap}>
                            <Ionicons name={step.icon} size={20} color={C.neonBlue} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.onboardTitle}>{step.title}</Text>
                            <Text style={styles.onboardDesc}>{step.desc}</Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>

                    <TouchableOpacity
                      onPress={dismissOnboard}
                      style={[styles.composerBtn, { marginHorizontal: 14, marginTop: 10 }]}
                    >
                      <Text style={styles.composerBtnText}>فهمت، يلا نبدي</Text>
                    </TouchableOpacity>
                  </View>
                </Pressable>
              </Modal>

              {/* ===== زر الصوت ===== */}
              <TouchableOpacity
                style={[styles.voiceBtn, isListening && styles.voiceBtnActive]}
                onPress={toggleListening}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isListening ? 'mic' : 'mic-outline'}
                  size={18}
                  color={C.white}
                />
                <Text style={styles.voiceBtnText}>
                  {isListening ? 'إيقاف الاستماع' : 'ابدأ التسبيح الصوتي'}
                </Text>
                {isListening && (
                  <Animated.View
                    style={[
                      styles.liveIndicator,
                      {
                        transform: [
                          {
                            scale: micVolumeAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.9],
                            }),
                          },
                        ],
                        opacity: micVolumeAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.55, 1],
                        }),
                      },
                    ]}
                  />
                )}
              </TouchableOpacity>

              {lastWord ? (
                <View style={styles.lastWordBox}>
                  <Text style={styles.lastWord}>{lastWord}</Text>
                </View>
              ) : null}

              {/* ===== إعادة تعيين ===== */}
              <View style={styles.resetRow}>
                <TouchableOpacity onPress={resetCurrent}>
                  <Text style={styles.resetBtn}>تصفير {current.label}</Text>
                </TouchableOpacity>
                <Text style={styles.resetDivider}>|</Text>
                <TouchableOpacity onPress={resetAll}>
                  <Text style={styles.resetBtn}>تصفير الكل</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ===== بطاقة التذكير ===== */}
            <View style={styles.rightPanel}>
              <View style={styles.quoteCard}>
                <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={styles.quoteHeader}>
                  <View style={styles.quoteLabelRow}>
                    <Ionicons name="book-outline" size={16} color={C.neonBlue} />
                    <Text style={styles.quoteLabel}>تذكير اليوم</Text>
                  </View>
                </View>
                <View style={styles.quoteDivider} />
                <View style={styles.verseBadgeRow}>
                  <Ionicons name="moon" size={12} color="#D9C45B" />
                  <Text style={styles.verseBadgeText}>آية قرآنية</Text>
                </View>
                <Text style={styles.verseText}>{`﴿ ${verse.text} ﴾`}</Text>
                <Text style={styles.quoteSource}>{verse.source}</Text>
                <View style={styles.quoteInnerDivider} />
                <View style={styles.verseBadgeRow}>
                  <Ionicons name="person-outline" size={12} color="rgba(255,255,255,0.5)" />
                  <Text style={[styles.verseBadgeText, { color: 'rgba(255,255,255,0.5)' }]}>كلمة اليوم</Text>
                </View>
                <Text style={styles.quoteText}>{quote.text}</Text>
                <Text style={styles.quoteSource}>{quote.author}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      
    </View>
  );

  // ===== إطار شكل الهاتف (موحّد بكل الشاشات عبر PhoneFrameWrapper المشترك) =====
  const wrapInPhoneFrame = (node: ReactElement) => <PhoneFrameWrapper>{node}</PhoneFrameWrapper>;

  // ===== خلفية الصورة - كاملة وتغطي الشاشة بسلاسة (هدف ٢) =====
  if (bgOption.image) {
    return wrapInPhoneFrame(
      <View style={[styles.bgFill, { backgroundColor: bgOption.color }]}>
        <ImageBackground
          source={bgOption.image}
          style={styles.bgImage}
          resizeMode="cover"
          imageStyle={styles.bgImageFull}
        >
          <View style={[styles.bgOverlay, { opacity: bgOption.overlayOpacity }]} />
          {screenContent}
        </ImageBackground>
      </View>
    );
  }

  return wrapInPhoneFrame(screenContent);
}

// ===== createStyles =====
function createStyles(
  scale: number,
  isTablet: boolean,
  isDesktop: boolean,
  circleSize: number,
  circleFont: number,
  windowHeight: number,
  FOCUS_CIRCLE_SIZE: number
) {
  const arcHeight = circleSize * 0.62;
  const arcWidth  = 34;

  return StyleSheet.create({
    container:   { flex: 1 },

    // الخلفية تغطي الشاشة كاملة بسلاسة (هدف ٢)
    bgFill:      { flex: 1 },
    bgImage:     { flex: 1, width: '100%', height: '100%' },
    bgImageFull: { width: '100%', height: '100%' },
    bgOverlay:   { ...StyleSheet.absoluteFill, backgroundColor: '#000' },

    scrollOuter: { paddingBottom: 100, alignItems: 'center' },
    scroll: {
      width: '100%',
      maxWidth: isDesktop ? 1080 : '100%',
      paddingHorizontal: isDesktop ? 32 : isTablet ? 28 : 18,
    },

    // ===== هيدر =====
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10, // كانت 22 ثابتة تحاول تعوّض غياب المنطقة الآمنة - هسه insets.top يتكفل بالمسافة الحقيقية
      marginBottom: 6,
    },
    logoBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.glass,
      borderWidth: 2.5,
      borderColor: C.neonBlue,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    logoImage: {
      width: 38,
      height: 38,
    },
    headerRightRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    soundToggleBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: C.glass,
      borderWidth: 1,
      borderColor: C.glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },

    dateBlock: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 6,
    },
    dateHijri: {
      color: C.white,
      fontSize: 17 * scale,
      fontWeight: '800',
      textAlign: 'center',
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    dateGregorian: {
      color: 'rgba(255,255,255,0.55)',
      fontSize: 12 * scale,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: 2,
    },
    occasionBadge: {
      fontSize: 10.5 * scale,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: 3,
      maxWidth: 130,
    },

    mainLayout: {
      flexDirection: isTablet ? 'row' : 'column',
      gap: isTablet ? 28 : 0,
      alignItems: isTablet ? 'flex-start' : 'center',
      marginTop: 14,
    },
    leftPanel: {
      alignItems: 'center',
      flex: isTablet ? 1 : undefined,
      width: isTablet ? undefined : '100%',
    },
    rightPanel: {
      flex: isTablet ? 1 : undefined,
      width: isTablet ? undefined : '100%',
      marginTop: isTablet ? 6 : 16,
    },

    // ===== الدائرة =====
    circleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 26,
    },

    circleWrapper: { alignItems: 'center', justifyContent: 'center' },

    outerRing: {
      width: circleSize,
      height: circleSize,
      borderRadius: circleSize / 2,
      backgroundColor: 'rgba(28,43,57,0.45)',
      borderWidth: 2.5,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      zIndex: 1,
    },

    dailyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginTop: -14,
      marginBottom: 14,
    },
    dailyText: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: 12 * scale,
      fontWeight: '600',
    },
    dailyEmptyText: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: 13 * scale,
      textAlign: 'center',
      paddingVertical: 24,
    },
    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(242,166,91,0.14)',
      borderWidth: 1,
      borderColor: 'rgba(242,166,91,0.35)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    streakText: {
      color: '#F2A65B',
      fontSize: 11 * scale,
      fontWeight: '700',
    },

    // مساحة آمنة أفقياً داخل الدائرة (وتر أقصر من القطر) حتى النص ما يفارق حدود الدائرة
    // المدورة وقت الأذكار المخصصة الطويلة - نفس المنطق ينطبق على الأذكار الثابتة القصيرة
    glassCircle: { alignItems: 'center', paddingHorizontal: 8 },

    dhikrText: {
      color: C.cream,
      fontSize: (isTablet ? 20 : 17) * scale,
      fontWeight: '600',
      marginBottom: 6,
      textAlign: 'center',
      width: circleSize * 0.68,
      lineHeight: (isTablet ? 24 : 21) * scale,
      textShadowColor: 'rgba(0,0,0,0.6)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    countText: {
      color: C.white,
      fontSize: circleFont,
      fontWeight: 'bold',
      lineHeight: circleFont + 6,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
    },
    targetText: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: 15 * scale,
      marginTop: 2,
    },

    // ===== تبويبات الأذكار =====
    tabRowWrap: {
      width: '100%',
      alignItems: 'center',
      position: 'relative',
      marginBottom: 20,
      zIndex: 5,
    },
    tabRow: {
      flexDirection: 'row-reverse',
      gap: 8,
      paddingHorizontal: 4,
    },
    tab: {
      backgroundColor: C.glass,
      borderWidth: 1,
      borderColor: C.glassBorder,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      minWidth: 90,
    },
    // الـ "Liquid Pill" المتحرك خلف التبويب النشط (فكرة Apple Liquid Navbar)
    liquidPill: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      borderRadius: 16,
      backgroundColor: C.blueDim,
      borderWidth: 1.5,
    },
    tabLabel:       { color: 'rgba(255,255,255,0.75)', fontSize: 15 * scale, fontWeight: '700' },
    tabLabelActive: { color: C.white },
    tabSub:         { color: 'rgba(255,255,255,0.4)',  fontSize: 10 * scale, marginTop: 3 },
    tabSubActive:   { color: 'rgba(255,255,255,0.85)' },

    // زر "المزيد" وقائمته المنسدلة الاحترافية (هدف ٥ - تحديث الحد الأقصى ٣)
    moreTab: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 70,
    },
    moreTabActive: {
      borderColor: C.neonBlue,
      backgroundColor: C.blueDim,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    moreDropdown: {
      width: '92%',
      maxWidth: 380,
      backgroundColor: 'rgba(15,30,48,0.6)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      borderRadius: 24,
      paddingBottom: 12,
      overflow: 'hidden',
    },
    moreDropdownHeader: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.09)',
    },
    moreDropdownTitle: { color: C.white, fontSize: 15, fontWeight: '800' },
    moreCloseBtn: {
      width: 28, height: 28, borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.08)',
      justifyContent: 'center', alignItems: 'center',
    },

    // ===== وضع التركيز (عداد منفصل للأذكار المضافة) =====
    focusOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    focusCard: {
      width: '92%',
      maxWidth: 380,
      backgroundColor: 'rgba(15,30,48,0.55)',
      borderWidth: 1,
      borderColor: C.glassBorder,
      borderRadius: 26,
      paddingBottom: 22,
      paddingTop: 4,
      overflow: 'hidden',
      alignItems: 'center',
    },
    focusCircleWrap: {
      width: FOCUS_CIRCLE_SIZE,
      height: FOCUS_CIRCLE_SIZE,
      marginTop: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    focusGlassCircle: {
      width: FOCUS_CIRCLE_SIZE - 22,
      height: FOCUS_CIRCLE_SIZE - 22,
      borderRadius: (FOCUS_CIRCLE_SIZE - 22) / 2,
      backgroundColor: C.glass,
      borderWidth: 1,
      borderColor: C.glassBorder,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 12,
    },
    focusDhikrText: {
      color: C.cream,
      fontSize: 15 * scale,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 20 * scale,
      width: '100%',
    },
    focusCount: {
      color: C.neonBlue,
      fontSize: 40 * scale,
      fontWeight: '800',
      marginTop: 4,
    },
    focusTarget: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: 11 * scale,
      marginTop: 1,
    },
    focusHint: {
      color: 'rgba(255,255,255,0.4)',
      fontSize: 11 * scale,
      marginTop: 10,
    },
    focusExitBtn: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 6,
      marginTop: 14,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    focusExitText: {
      color: 'rgba(255,255,255,0.75)',
      fontSize: 13 * scale,
      fontWeight: '600',
    },

    composerCard: {
      marginHorizontal: 14,
      marginTop: 4,
      marginBottom: 8,
      padding: 12,
      borderRadius: 16,
      backgroundColor: 'rgba(87,200,242,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(87,200,242,0.35)',
    },
    composerHeader: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    composerTitle: {
      color: C.white,
      fontSize: 13,
      fontWeight: '800',
    },
    composerInput: {
      backgroundColor: 'rgba(0,0,0,0.22)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      color: C.white,
      fontSize: 13,
      padding: 10,
      minHeight: 44,
      textAlignVertical: 'top',
      marginBottom: 10,
    },
    composerTargetRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
      paddingHorizontal: 2,
    },
    composerTargetLabel: {
      color: 'rgba(255,255,255,0.55)',
      fontSize: 12,
      fontWeight: '600',
    },
    composerTargetInput: {
      backgroundColor: 'rgba(0,0,0,0.22)',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      color: C.neonBlue,
      fontSize: 15,
      fontWeight: '800',
      width: 64,
      paddingVertical: 6,
    },
    composerBtn: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: C.neonBlue,
      borderRadius: 12,
      paddingVertical: 10,
    },
    composerBtnText: {
      color: C.navy,
      fontSize: 13,
      fontWeight: '800',
    },

    onboardCard: {
      width: '92%',
      maxWidth: 380,
      backgroundColor: 'rgba(15,30,48,0.55)',
      borderWidth: 1.5,
      borderColor: 'rgba(87,200,242,0.45)',
      borderRadius: 24,
      paddingBottom: 12,
      overflow: 'hidden',
    },
    onboardMainTitle: {
      color: C.white,
      fontSize: 18,
      fontWeight: '900',
    },
    onboardItem: {
      flexDirection: 'row-reverse',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    onboardIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: 'rgba(87,200,242,0.14)',
      borderWidth: 1,
      borderColor: 'rgba(87,200,242,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    onboardTitle: {
      color: C.white,
      fontSize: 15,
      fontWeight: '800',
      textAlign: 'right',
      marginBottom: 3,
    },
    onboardDesc: {
      color: 'rgba(255,255,255,0.75)',
      fontSize: 13,
      textAlign: 'right',
      lineHeight: 20,
    },

    moreSectionLabel: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 6,
    },
    moreSectionText: {
      color: 'rgba(255,255,255,0.32)',
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    moreItem: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: 0,
    },
    moreItemActive: {
      backgroundColor: 'rgba(63,169,217,0.12)',
    },
    moreItemDot: {
      width: 8, height: 8, borderRadius: 4,
      flexShrink: 0,
    },
    moreItemRemoveBtn: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: 'rgba(255,120,120,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,120,120,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    moreItemLabel: { fontSize: 14 * scale, fontWeight: '700' },
    moreItemSub:   { color: 'rgba(255,255,255,0.4)', fontSize: 11 * scale, marginTop: 2 },
    moreItemCount: { fontSize: 13 * scale, fontWeight: '800' },

    // ===== زر الصوت =====
    voiceBtn: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: C.glass,
      borderWidth: 1.5,
      borderColor: C.neonBlue,
      borderRadius: 50,
      paddingVertical: 13,
      paddingHorizontal: 28,
      marginBottom: 10,
      alignItems: 'center',
    },
    voiceBtnActive: {
      backgroundColor: 'rgba(63,169,217,0.25)',
    },
    voiceBtnText: { color: C.white, fontSize: 14 * scale, fontWeight: '600' },
    liveIndicator: {
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: '#ff4444',
      marginLeft: 4,
    },

    lastWordBox: {
      backgroundColor: C.glass,
      borderWidth: 1,
      borderColor: C.glassBorder,
      borderRadius: 12,
      paddingHorizontal: 18,
      paddingVertical: 8,
      marginBottom: 14,
    },
    lastWord: {
      color: C.neonBlue,
      fontSize: 15 * scale,
      fontWeight: '700',
      textShadowColor: C.neonGlow,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 6,
    },

    resetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
    },
    resetBtn: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: 13 * scale,
      fontWeight: '600',
    },
    resetDivider: { color: 'rgba(255,255,255,0.3)', fontSize: 14 * scale },

    // ===== بطاقة التذكير الزجاجية =====
    quoteCard: {
      backgroundColor: 'rgba(28,43,57,0.35)', // شفافة جزئياً حتى الـ BlurView يبين فعلياً (زجاجية حقيقية)
      borderWidth: 1,
      borderColor: C.glassBorder,
      borderRadius: 20,
      padding: 18,
      borderRightWidth: 3, // انتقل لليمين ليطابق اتجاه القراءة العربي (كان يسار)
      borderRightColor: C.neonBlue,
      overflow: 'hidden', // لازم حتى الزوايا المدورة تقص الـ BlurView صح
    },
    quoteHeader: {
      flexDirection: 'row-reverse',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    quoteLabelRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
    quoteLabel: { color: C.white, fontSize: 14 * scale, fontWeight: '700', textAlign: 'right' },
    quoteDivider: {
      height: 1,
      backgroundColor: C.glassBorder,
      marginVertical: 12,
    },
    quoteInnerDivider: {
      height: 1,
      backgroundColor: C.glassBorder,
      marginVertical: 14,
    },
    verseBadgeRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 5,
      marginBottom: 8,
    },
    verseBadgeText: {
      color: '#D9C45B',
      fontSize: 11 * scale,
      fontWeight: '700',
      textAlign: 'right',
    },
    verseText: {
      fontFamily: QURAN_FONT_FAMILY,
      color: '#F2E9CE',
      fontSize: 16 * scale,
      lineHeight: 30 * scale,
      fontWeight: '600',
      marginBottom: 6,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    quoteText: {
      color: 'rgba(255,255,255,0.88)',
      fontSize: 13 * scale,
      lineHeight: 22 * scale,
      fontWeight: '600',
      marginBottom: 6,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    quoteSource: {
      color: C.neonBlue,
      fontSize: 12 * scale,
      fontWeight: '500',
      marginBottom: 2,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
  });
}
