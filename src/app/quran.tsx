import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  BackgroundId,
  getSavedBackgroundId,
  getSelectedBackground,
} from '../utils/backgroundSettings';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  ImageBackground,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

interface Verse {
  id: number;
  text: string;
  juz?: number;
  hizb?: number;
  page?: number;
}

interface Surah {
  id: number;
  name: string;
  total_verses: number;
  verses: Verse[];
}

interface JuzSection {
  juz: number;
  surahs: Array<{ id: number; name: string; verses: string }>;
}

interface LastPosition {
  surahId: number;
  surahName: string;
  verseId?: number;
}

const JUZ_START_POINTS = [
  { juz: 1, surah: 1, verse: 1 }, { juz: 2, surah: 2, verse: 142 },
  { juz: 3, surah: 2, verse: 253 }, { juz: 4, surah: 3, verse: 93 },
  { juz: 5, surah: 4, verse: 24 }, { juz: 6, surah: 4, verse: 148 },
  { juz: 7, surah: 5, verse: 82 }, { juz: 8, surah: 6, verse: 111 },
  { juz: 9, surah: 7, verse: 88 }, { juz: 10, surah: 8, verse: 41 },
  { juz: 11, surah: 9, verse: 93 }, { juz: 12, surah: 11, verse: 6 },
  { juz: 13, surah: 12, verse: 53 }, { juz: 14, surah: 15, verse: 1 },
  { juz: 15, surah: 17, verse: 1 }, { juz: 16, surah: 18, verse: 75 },
  { juz: 17, surah: 21, verse: 1 }, { juz: 18, surah: 23, verse: 1 },
  { juz: 19, surah: 25, verse: 21 }, { juz: 20, surah: 27, verse: 56 },
  { juz: 21, surah: 29, verse: 46 }, { juz: 22, surah: 33, verse: 31 },
  { juz: 23, surah: 36, verse: 28 }, { juz: 24, surah: 39, verse: 32 },
  { juz: 25, surah: 41, verse: 47 }, { juz: 26, surah: 46, verse: 1 },
  { juz: 27, surah: 51, verse: 31 }, { juz: 28, surah: 58, verse: 1 },
  { juz: 29, surah: 67, verse: 1 }, { juz: 30, surah: 78, verse: 1 },
];

const JUZ_NAMES = [
  'الجزء الأول', 'الجزء الثاني', 'الجزء الثالث', 'الجزء الرابع', 'الجزء الخامس',
  'الجزء السادس', 'الجزء السابع', 'الجزء الثامن', 'الجزء التاسع', 'الجزء العاشر',
  'الجزء الحادي عشر', 'الجزء الثاني عشر', 'الجزء الثالث عشر', 'الجزء الرابع عشر', 'الجزء الخامس عشر',
  'الجزء السادس عشر', 'الجزء السابع عشر', 'الجزء الثامن عشر', 'الجزء التاسع عشر', 'الجزء العشرون',
  'الجزء الحادي والعشرون', 'الجزء الثاني والعشرون', 'الجزء الثالث والعشرون', 'الجزء الرابع والعشرون', 'الجزء الخامس والعشرون',
  'الجزء السادس والعشرون', 'الجزء السابع والعشرون', 'الجزء الثامن والعشرون', 'الجزء التاسع والعشرون', 'الجزء الثلاثون',
];

const BISMILLAH = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
// سورة التوبة (٩) الوحيدة التي لا تبدأ بالبسملة
// سورة التوبة (٩) لا تبدأ بالبسملة، وسورة الفاتحة (١) آيتها الأولى هي نفسها البسملة
// سورة التوبة فقط بلا بسملة؛ كل باقي السور (وفيهم الفاتحة) تظهر البسملة كلافتة قبل أول آية
const NO_BISMILLAH_SURAHS = [9];

// مواضع السجدة الـ 15 بالقرآن (رواية حفص) — obligatory: true تعني سجدة واجبة (٣٢، ٤١، ٥٣، ٩٦)
const SAJDA_VERSES: { surah: number; verse: number; obligatory: boolean }[] = [
  { surah: 7, verse: 206, obligatory: false },
  { surah: 13, verse: 15, obligatory: false },
  { surah: 16, verse: 50, obligatory: false },
  { surah: 17, verse: 109, obligatory: false },
  { surah: 19, verse: 58, obligatory: false },
  { surah: 22, verse: 18, obligatory: false },
  { surah: 22, verse: 77, obligatory: false },
  { surah: 25, verse: 60, obligatory: false },
  { surah: 27, verse: 26, obligatory: false },
  { surah: 32, verse: 15, obligatory: true },
  { surah: 38, verse: 24, obligatory: false },
  { surah: 41, verse: 38, obligatory: true },
  { surah: 53, verse: 62, obligatory: true },
  { surah: 84, verse: 21, obligatory: false },
  { surah: 96, verse: 19, obligatory: true },
];

const isSajdaVerse = (surahId: number, verseId: number) =>
  SAJDA_VERSES.some((s) => s.surah === surahId && s.verse === verseId);

const isObligatorySajda = (surahId: number, verseId: number) =>
  SAJDA_VERSES.some((s) => s.surah === surahId && s.verse === verseId && s.obligatory);

// إيجاد اسم الجزء الذي تبدأ فيه سورة معيّنة (تقريب على مستوى السورة - احتياطي فقط)
function getJuzNameForSurah(surahId: number): string {
  let juz = 1;
  for (let i = 0; i < JUZ_START_POINTS.length; i++) {
    const current = JUZ_START_POINTS[i];
    const next = JUZ_START_POINTS[i + 1];
    if (surahId === current.surah || (surahId > current.surah && (!next || surahId < next.surah))) {
      juz = current.juz;
      break;
    }
  }
  return JUZ_NAMES[juz - 1];
}

interface TaggedVerse extends Verse {
  surahId: number;
  surahName: string;
}

// تجميع كل آيات القرآن (كل السور) إلى صفحات مصحف متصلة حسب حقل page
function buildAllPages(surahs: Surah[]): TaggedVerse[][] {
  const flat: TaggedVerse[] = [];
  for (const surah of surahs) {
    for (const verse of surah.verses) {
      flat.push({ ...verse, surahId: surah.id, surahName: surah.name });
    }
  }
  const hasPageData = flat.length > 0 && flat.every((v) => typeof v.page === 'number');
  if (!hasPageData) {
    // احتياطي: صفحة واحدة لكل سورة إذا البيانات ناقصة
    return surahs.map((s) => s.verses.map((v) => ({ ...v, surahId: s.id, surahName: s.name })));
  }
  const pages: TaggedVerse[][] = [];
  let currentPage: TaggedVerse[] = [];
  let currentPageNum: number | undefined;
  for (const verse of flat) {
    if (currentPageNum === undefined) currentPageNum = verse.page;
    if (verse.page !== currentPageNum) {
      pages.push(currentPage);
      currentPage = [];
      currentPageNum = verse.page;
    }
    currentPage.push(verse);
  }
  if (currentPage.length) pages.push(currentPage);
  return pages;
}

// توسيم كل آيات سورة وحدة بمعلومات السورة - يُستخدم بوضع القراءة المتصل (سكرول واحد للسورة كاملة)
function tagSurahVerses(surah: Surah): TaggedVerse[] {
  return surah.verses.map((v) => ({ ...v, surahId: surah.id, surahName: surah.name }));
}

const FONT_SIZE_KEY = 'quran_font_size_v2';
const FONT_FAMILY_KEY = 'quran_font_family_v2';
const TASHKEEL_KEY = 'quran_show_tashkeel';
const LAST_POSITION_KEY = 'quran_last_position';
const READER_VIEW_MODE_KEY = 'quran_reader_view_mode';
const STATS_KEY = 'quran_stats';
const READING_BG_KEY = 'quran_reading_background_id';
const ONBOARDING_KEY = 'quran_onboarding_seen';

// نظام الألوان (مطابق لـ tasbih.tsx)
const C = {
  navy: '#0a0e27',
  neonBlue: '#57C8F2',
  neonGlow: 'rgba(87,200,242,0.55)',
  neonBorder: 'rgba(87,200,242,0.4)',
  white: '#FFFFFF',
  glass: 'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(255,255,255,0.22)',
  glassDark: 'rgba(0,0,0,0.28)',
};

// ظل زجاجي نيوني متوافق بين iOS وأندرويد - على أندرويد shadowColor ما ينقرا مع elevation
// فنعتمد فوق أندرويد على إضاءة داخلية خفيفة عبر borderColor أوضح بدل ظل elevation رمادي نشاز
// شدة تأثير الضبابية (BlurView) ثقيلة على أداء أندرويد بالذات - نخففها هناك بدون ما نأثر على شكلها بـ iOS
const blurIntensity = (base: number) => (Platform.OS === 'android' ? Math.round(base * 0.5) : base);

// SafeAreaView الأساسية من react-native ما تحسب مساحة شريط الحالة على أندرويد (تشتغل صح بـ iOS بس)
// فبدونها المحتوى يطلع ملازق بشريط الحالة وكأنه ملء شاشة كامل - نعوضها يدوياً بمسافة فوق على أندرويد
const ANDROID_STATUS_BAR_PADDING = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;

const neonGlowShadow = Platform.select({
  ios: {
    shadowColor: C.neonBlue,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  android: {
    borderColor: 'rgba(87,200,242,0.55)',
  },
  default: {
    shadowColor: C.neonBlue,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
}) as object;

// أحجام الخط
const FONT_SIZES: { [key: string]: number } = { small: 18, medium: 24, large: 30 };

// خلفيات شاشة قراءة السورة - 8 (5 الأصلية + 3 اللي كانت للصفحة الرئيسية)
const READING_BACKGROUNDS = [
  { id: 'bg_01', label: 'خلفية 1', color: '#0b2a3a', overlayOpacity: 0.55, image: require('../assets/backgrounds/bg_01.jpg') },
  { id: 'bg_02', label: 'خلفية 2', color: '#04202a', overlayOpacity: 0.55, image: require('../assets/backgrounds/bg_02.jpg') },
  { id: 'bg_03', label: 'خلفية 3', color: '#000814', overlayOpacity: 0.6, image: require('../assets/backgrounds/bg_03.jpg') },
  { id: 'bg_04', label: 'خلفية 4', color: '#0a2430', overlayOpacity: 0.55, image: require('../assets/backgrounds/bg_04.jpg') },
  { id: 'bg_05', label: 'خلفية 5', color: '#3a0a0a', overlayOpacity: 0.6, image: require('../assets/backgrounds/bg_05.jpg') },
  { id: 'main_bg_01', label: 'رصاصي ', color: '#0d1420', overlayOpacity: 0.45, image: require('../assets/backgrounds/main_bg_01.jpg') },
  { id: 'main_bg_02', label: 'المحراب الذهبي', color: '#12141c', overlayOpacity: 0.4, image: require('../assets/backgrounds/main_bg_02.jpg') },
  { id: 'main_bg_03', label: 'فسيفساء رمادية', color: '#1a1a1a', overlayOpacity: 0.55, image: require('../assets/backgrounds/main_bg_03.jpg') },
];

// إزالة رموز التشكيل من النص العربي
const stripTashkeel = (text: string) => text.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');

// تحويل رقم الآية لأرقام عربية-هندية (٠-٩) بدل الأرقام الإنكليزية
const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const toArabicDigits = (num: number) => String(num).replace(/[0-9]/g, (d) => ARABIC_INDIC_DIGITS[Number(d)]);

// نعرض نص الآية كما هو دائماً بدون أي حذف أو قص - أي تعديل هنا معرض لحذف أول آية بالسورة
const getVerseDisplayText = (verse: { surahId: number; id: number; text: string }) => verse.text;

// لافتة اسم السورة الموحّدة - بنفس هوية التطبيق الزجاجية النيونية، تُستخدم بأعلى كل صفحة
// وفي منتصف الصفحة إذا بدأت سورة جديدة هناك، حتى يكون الشكل متناسق بكل مكان
const SurahBanner = memo(function SurahBanner({
  surahId,
  surahName,
  activeFontFamily,
}: {
  surahId: number;
  surahName: string;
  activeFontFamily: string | undefined;
}) {
  return (
    <View style={styles.surahBannerFixed}>
      <View style={styles.surahBannerRow}>
        <View style={styles.surahBannerLine} />
        <Ionicons name="sparkles" size={13} color="#57C8F2" style={styles.surahBannerIcon} />
        <Text style={styles.surahHeaderArabic}>{'سورة ' + surahName}</Text>
        <Ionicons name="sparkles" size={13} color="#57C8F2" style={styles.surahBannerIcon} />
        <View style={styles.surahBannerLine} />
      </View>
      {!NO_BISMILLAH_SURAHS.includes(surahId) && (
        <Text style={[styles.bismillah, { fontFamily: activeFontFamily }]}>{BISMILLAH}</Text>
      )}
    </View>
  );
});

// تقسيم آيات الصفحة إلى مقاطع: نص متصل، أو لافتة بداية سورة جديدة (لعرضها بشكل موحّد بمنتصف الصفحة أيضاً)
function buildPageSegments(pageVerses: TaggedVerse[]) {
  const segments: Array<
    { type: 'banner'; surahId: number; surahName: string } | { type: 'verses'; verses: TaggedVerse[] }
  > = [];
  let group: TaggedVerse[] = [];
  pageVerses.forEach((verse, idx) => {
    if (verse.id === 1 && idx !== 0) {
      if (group.length) segments.push({ type: 'verses', verses: group });
      group = [];
      segments.push({ type: 'banner', surahId: verse.surahId, surahName: verse.surahName });
    }
    group.push(verse);
  });
  if (group.length) segments.push({ type: 'verses', verses: group });
  return segments;
}

// القارئ المتصل: يعرض كل آيات السورة المفتوحة بقائمة عمودية واحدة (بدون تقسيم صفحات)
// يشتغل بنفس الطريقة على الموبايل والتابلت والمتصفح (لمس، عجلة الماوس، تراك باد)
const ContinuousReader = memo(function ContinuousReader({
  verses,
  activeFontFamily,
  fontSize,
  showTashkeel,
  setShareVerse,
  listRef,
  initialVerseIndex,
  onPositionChange,
  autoScrollActive,
  setAutoScrollActive,
  autoScrollSpeed,
  setAutoScrollSpeed,
  scrollOffsetRef,
  jumpSignal,
  jumpTargetVerseId,
}: {
  verses: TaggedVerse[];
  activeFontFamily: string | undefined;
  fontSize: number;
  showTashkeel: boolean;
  setShareVerse: (v: { surahName: string; verseId: number; text: string } | null) => void;
listRef: React.RefObject<ScrollView | null>;
initialVerseIndex: number;
onPositionChange: (verseId: number) => void;
  autoScrollActive: boolean;
  setAutoScrollActive: (v: boolean) => void;
  autoScrollSpeed: 'slow' | 'medium' | 'fast';
  setAutoScrollSpeed: (v: 'slow' | 'medium' | 'fast') => void;
  scrollOffsetRef: React.MutableRefObject<number>;
  jumpSignal: number;
  jumpTargetVerseId: number;
}) {
  const contentHeightRef = useRef(0);
  const containerHeightRef = useRef(0);
  const lastPositionUpdateRef = useRef(0);
  const didInitialScrollRef = useRef(false);
  const currentSurahIdRef = useRef<number | undefined>(undefined);

  if (verses[0]?.surahId !== currentSurahIdRef.current) {
    currentSurahIdRef.current = verses[0]?.surahId;
    didInitialScrollRef.current = false;
  }

  // نحسب رقم الآية التقريبي المعروض حالياً حسب نسبة التمرير (بدون تقطيع النص لعناصر منفصلة)
  const reportApproxPosition = (offsetY: number) => {
    const scrollable = Math.max(1, contentHeightRef.current - containerHeightRef.current);
    const ratio = Math.min(1, Math.max(0, offsetY / scrollable));
    const idx = Math.round(ratio * (verses.length - 1));
    const verse = verses[idx];
    if (verse) onPositionChange(verse.id);
  };

  const handleContentSizeChange = (_w: number, h: number) => {
    contentHeightRef.current = h;
    // نقفز لموضع القراءة المحفوظ (مرة وحدة بس عند فتح السورة) بمجرد ما نعرف طول المحتوى
    if (!didInitialScrollRef.current && initialVerseIndex > 0 && h > 0) {
      didInitialScrollRef.current = true;
      const targetY = (initialVerseIndex / Math.max(1, verses.length)) * h;
      setTimeout(() => listRef.current?.scrollTo({ y: targetY, animated: false }), 30);
    }
  };

  // القفز اليدوي لموضع معين (زر "آخر موضع توقفت فيه") - يشتغل حتى لو إحنا أصلاً بنفس السورة
  useEffect(() => {
    if (jumpSignal === 0) return; // القيمة الابتدائية، تجاهل
    const idx = verses.findIndex((v) => v.id === jumpTargetVerseId);
    if (idx < 0) return;
    const h = contentHeightRef.current;
    if (h > 0) {
      const targetY = (idx / Math.max(1, verses.length)) * h;
      listRef.current?.scrollTo({ y: targetY, animated: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpSignal]);

  // التمرير التلقائي - إصلاح مهم: كان يحرك مسافة *ثابتة* كل نبضة setInterval (كل ٣٠
  // مللي ثانية بالضبط افتراضياً)، بس لو الخيط الرئيسي (JS thread) انشغل لحظة (رندر آية،
  // لمسة، إلخ) والنبضة تأخرت فعلياً، الكود كان يتحرك نفس المسافة رغم إنه مرّ وقت أطول -
  // هذا بالضبط يسبب الإحساس بالتقطيع (يوقف-يتحرك-يوقف). الحل: نحسب المسافة حسب الزمن
  // الفعلي المنقضي (delta time) عبر requestAnimationFrame بدل setInterval، فالحركة تضل
  // ناعمة ومتناسبة مع الزمن الحقيقي حتى لو توقيت النبضات نفسه مو منتظم ١٠٠٪.
  useEffect(() => {
    if (!autoScrollActive) return;
    const pxPerMs = (autoScrollSpeed === 'slow' ? 0.5 : autoScrollSpeed === 'fast' ? 2.2 : 1.1) / 30;
    let rafId: number;
    let lastTs = 0;
    const tick = (ts: number) => {
      if (!lastTs) lastTs = ts;
      const dt = ts - lastTs;
      lastTs = ts;
      const scrollable = Math.max(0, contentHeightRef.current - containerHeightRef.current);
      const next = Math.min(scrollable, scrollOffsetRef.current + pxPerMs * dt);
      scrollOffsetRef.current = next;
      listRef.current?.scrollTo({ y: next, animated: false });
      // نفس منطق الـ throttle المستخدم بالتمرير اليدوي (٤٠٠ ملي) - بدونه كانت
      // reportApproxPosition (وبالتالي setLastPosition + كتابة AsyncStorage) تنستدعى
      // كل فريم (٦٠ مرة/ثانية) طول مدة التمرير التلقائي، وهذا يسبب إعادة ريندر
      // وكتابة تخزين مفرطة تحس متل تقطيع، خصوصاً بسور طويلة
      const now = Date.now();
      if (now - lastPositionUpdateRef.current > 400) {
        lastPositionUpdateRef.current = now;
        reportApproxPosition(next);
      }
      if (next >= scrollable) { setAutoScrollActive(false); return; }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [autoScrollActive, autoScrollSpeed, verses.length]);

  const speedLabel = autoScrollSpeed === 'slow' ? 'بطيء' : autoScrollSpeed === 'fast' ? 'سريع' : 'متوسط';

  return (
    <View style={{ flex: 1 }} onLayout={(e) => { containerHeightRef.current = e.nativeEvent.layout.height; }}>
      <View style={styles.versesPanelBg} pointerEvents="none" />
      <ScrollView
        ref={listRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.continuousContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={handleContentSizeChange}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          scrollOffsetRef.current = y;
          const now = Date.now();
          if (now - lastPositionUpdateRef.current > 400) {
            lastPositionUpdateRef.current = now;
            reportApproxPosition(y);
          }
        }}
        scrollEventThrottle={32}
        onScrollBeginDrag={() => setAutoScrollActive(false)}
      >
        {verses[0] && (
          <SurahBanner surahId={verses[0].surahId} surahName={verses[0].surahName} activeFontFamily={activeFontFamily} />
        )}

        {/* نص السورة كاملاً كفقرة واحدة متدفقة ومحاذاة مصحفية - مو كل آية سطر منفصل */}
        <Text style={styles.versesFlow}>
          {verses.map((verse) => (
            <Text key={`${verse.surahId}-${verse.id}`}>
              <Text style={[styles.verseText, { fontSize, fontFamily: activeFontFamily }]}>
                {showTashkeel ? getVerseDisplayText(verse) : stripTashkeel(getVerseDisplayText(verse))}
              </Text>
              <Text
                style={styles.verseNumberInline}
                onLongPress={() => setShareVerse({ surahName: verse.surahName, verseId: verse.id, text: verse.text })}
              >
                {' '}{'﴿'}{toArabicDigits(verse.id)}{'﴾'}{' '}
              </Text>
              {isSajdaVerse(verse.surahId, verse.id) && (
                <Text
                  style={[
                    styles.sajdaMark,
                    isObligatorySajda(verse.surahId, verse.id) && styles.sajdaMarkObligatory,
                  ]}
                >
                  {' '}۩{' '}
                </Text>
              )}
              {verse.surahId === 114 && verse.id === 6 && (
                <Text style={styles.khatmDua}>
                  {'\n\n'}«صَدَقَ اللَّهُ العَظِيمُ»{'\n\n'}
                  اللَّهُمَّ ارْحَمْنَا بِالقُرْآنِ، وَاجْعَلْهُ لَنَا إِمَامًا وَنُورًا وَهُدًى وَرَحْمَةً،{'\n'}
                  اللَّهُمَّ ذَكِّرْنَا مِنْهُ مَا نُسِّينَا، وَعَلِّمْنَا مِنْهُ مَا جَهِلْنَا،{'\n'}
                  وَارْزُقْنَا تِلَاوَتَهُ آنَاءَ اللَّيْلِ وَأَطْرَافَ النَّهَارِ،{'\n'}
                  وَاجْعَلْهُ لَنَا حُجَّةً يَا رَبَّ العَالَمِينَ،{'\n'}
                  وَتَقَبَّلْ مِنَّا هَذِهِ الخَتْمَةَ المُبَارَكَةَ، آمِين.
                </Text>
              )}
            </Text>
          ))}
        </Text>

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* زر التمرير التلقائي البطيء - عائم بأسفل الشاشة */}
      <View style={styles.autoScrollDock} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.autoScrollBtn}
          activeOpacity={0.8}
          onPress={() => setAutoScrollActive(!autoScrollActive)}
        >
          <Ionicons name={autoScrollActive ? 'pause' : 'play'} size={18} color="#fff" />
        </TouchableOpacity>
        {autoScrollActive && (
          <TouchableOpacity
            style={styles.autoScrollSpeedBtn}
            activeOpacity={0.8}
            onPress={() =>
              setAutoScrollSpeed(autoScrollSpeed === 'slow' ? 'medium' : autoScrollSpeed === 'medium' ? 'fast' : 'slow')
            }
          >
            <Text style={styles.autoScrollSpeedText}>{speedLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

export default function QuranScreen() {
  const [fontsLoaded] = useFonts({
    'Amiri-Regular': require('../assets/fonts/Amiri-Regular.ttf'),
    'Amiri-Bold': require('../assets/fonts/Amiri-Bold.ttf'),
    // خط الرسم العثماني (خط حفص الشائع بمصاحف السعودية/مجمع الملك فهد) - ضيف الملف بنفس هذا الاسم بمجلد الخطوط
    'UthmanicHafs': require('../assets/fonts/UthmanicHafs.ttf'),
  });
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [fontSizeKey, setFontSizeKey] = useState<'small' | 'medium' | 'large'>('medium');
  const [fontFamilyChoice, setFontFamilyChoice] = useState<'uthmani' | 'amiri' | 'system'>('uthmani');
  const [showTashkeel, setShowTashkeel] = useState(true);
  const [lastPosition, setLastPosition] = useState<LastPosition | null>(null);
  const [todayCount, setTodayCount] = useState(0);
  // مجموعة أرقام السور الفريدة اللي انفتحت اليوم - نعتمد عليها نحسب العدد الصحيح
  // بدل ما نزيد رقم بسيط بكل فتحة سورة (حتى لو نفس السورة انفتحت أكثر من مرة)
  const todaySurahIdsRef = useRef<Set<number>>(new Set());
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [readingMode, setReadingMode] = useState(false);

  const [readingBgId, setReadingBgId] = useState('bg_01');
  const [sharedBgId, setSharedBgId] = useState<BackgroundId>('quran');
  const [showSettings, setShowSettings] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);

  // رابط خارجي (إشعار آية بعد الصلاة، أو زر "سورة الجمعة" بجرد أعمال يوم
  // الجمعة) يوصل هذي الشاشة بمعطيات ?surah=X&ayah=Y - نفتح السورة تلقائياً
  // عليهن أول ما تنحمل قائمة السور (تحت بمعالج مستقل، مو هنا مباشرة، لأن
  // surahs لسه فاضية بهذا السطر بالتشغيل الأول)
  const deepLinkParams = useLocalSearchParams<{ surah?: string; ayah?: string }>();
  const handledDeepLinkRef = useRef(false);

  // بحث داخل نص الآيات
  const [showVerseSearch, setShowVerseSearch] = useState(false);
  const [verseSearchInput, setVerseSearchInput] = useState('');
  const [verseSearchQuery, setVerseSearchQuery] = useState('');
  const [verseSearchResults, setVerseSearchResults] = useState<
    Array<{ surahId: number; surahName: string; verseId: number; text: string }>
  >([]);

  // مشاركة آية
  const [shareVerse, setShareVerse] = useState<{ surahName: string; verseId: number; text: string } | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  // تقدم القراءة داخل السورة
  const [readProgress, setReadProgress] = useState(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  // طريقة عرض القراءة: صفحات مصحف مقسّمة، أو سكرول متصل لكل السورة دفعة وحدة
  const [readerViewMode, setReaderViewMode] = useState<'pages' | 'continuous'>('pages');
  const [autoScrollActive, setAutoScrollActive] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<'slow' | 'medium' | 'fast'>('medium');
  const continuousListRef = useRef<ScrollView>(null);
  const continuousScrollOffsetRef = useRef(0);
  const readerListRef = useRef<FlatList>(null);
  const [readerAreaHeight, setReaderAreaHeight] = useState(0);
  const [continuousVerseId, setContinuousVerseId] = useState(1);
  // إشارة قفز يدوية (تزيد رقمها كل مرة نريد نجبر القراءة المتصلة تقفز لموضع معين، حتى لو نفس السورة)
  const [continuousJumpSignal, setContinuousJumpSignal] = useState(0);
  // عرض الشاشة الفعلي بشكل تفاعلي (يتحدث تلقائياً عند تغيير حجم نافذة المتصفح)
  const { width: pageWidth } = useWindowDimensions();
  // مراجع التمرير العمودي لكل صفحة + آخر إزاحة تمرير معروفة (لدعم أسهم لوحة المفاتيح على الويب)
  const pageScrollRefs = useRef<Map<number, ScrollView>>(new Map());
  const pageScrollOffsets = useRef<Map<number, number>>(new Map());

  // صفحات المصحف الكاملة (٦٠٤ صفحة) - نبنيها مرة وحدة بس أول ما يفتح المستخدم أي سورة (مو فوراً عند فتح قائمة السور)
  // هذا يخفف الثقل الأولي لأن قائمة السور والأجزاء ما تحتاج هذا البناء الثقيل أصلاً
  const [allPages, setAllPages] = useState<TaggedVerse[][]>([]);
  const allPagesRef = useRef<TaggedVerse[][] | null>(null);
  const ensureAllPages = (): TaggedVerse[][] => {
    if (allPagesRef.current) return allPagesRef.current;
    const built = buildAllPages(surahs);
    allPagesRef.current = built;
    setAllPages(built);
    return built;
  };
  const currentSurahTaggedVerses = useMemo(
    () => (selectedSurah ? tagSurahVerses(selectedSurah) : []),
    [selectedSurah]
  );

  // إعادة محاذاة الصفحة الحالية كل ما يتغيّر عرض النافذة (مثلاً عند تغيير حجم المتصفح أو محاكي الهاتف)
  useEffect(() => {
    if (!selectedSurah) return;
    const t = setTimeout(() => {
      readerListRef.current?.scrollToIndex({ index: currentPageIndex, animated: false });
    }, 30);
    return () => clearTimeout(t);
  }, [pageWidth]);

  const readingBg = READING_BACKGROUNDS.find((b) => b.id === readingBgId) ?? READING_BACKGROUNDS[0];
  const sharedBg = getSelectedBackground(sharedBgId);
  const fontSize = FONT_SIZES[fontSizeKey];
  const activeFontFamily =
    fontFamilyChoice === 'uthmani' ? 'UthmanicHafs' : fontFamilyChoice === 'amiri' ? 'Amiri-Regular' : undefined;

  useEffect(() => {
    try {
      const data: Surah[] = require('../assets/quran-full.json');
      setSurahs(data);
    } catch (error) {
      console.error('Error loading Quran data:', error);
    } finally {
      setLoading(false);
    }
    loadSavedData();
  }, []);

  // خلفية الصفحة الرئيسية مرتبطة بنظام التطبيق المشترك - نعيد قراءتها كل ما ترجع لهذي الشاشة
  useFocusEffect(
    useCallback(() => {
      getSavedBackgroundId().then(setSharedBgId);
    }, [])
  );

  useEffect(() => {
    const t = setTimeout(() => setVerseSearchQuery(verseSearchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [verseSearchInput]);

  useEffect(() => {
    if (!verseSearchQuery || verseSearchQuery.length < 2) {
      setVerseSearchResults([]);
      return;
    }
    const results: Array<{ surahId: number; surahName: string; verseId: number; text: string }> = [];
    const q = stripTashkeel(verseSearchQuery);
    for (const surah of surahs) {
      for (const verse of surah.verses) {
        if (stripTashkeel(verse.text).includes(q)) {
          results.push({ surahId: surah.id, surahName: surah.name, verseId: verse.id, text: verse.text });
          if (results.length >= 80) break;
        }
      }
      if (results.length >= 80) break;
    }
    setVerseSearchResults(results);
  }, [verseSearchQuery, surahs]);

  const loadSavedData = async () => {
    try {
      const savedFontSize = await AsyncStorage.getItem(FONT_SIZE_KEY);
      if (savedFontSize && FONT_SIZES[savedFontSize]) setFontSizeKey(savedFontSize as any);

      const savedFontFamily = await AsyncStorage.getItem(FONT_FAMILY_KEY);
      if (savedFontFamily === 'uthmani' || savedFontFamily === 'amiri' || savedFontFamily === 'system') {
        setFontFamilyChoice(savedFontFamily);
      }

      const savedTashkeel = await AsyncStorage.getItem(TASHKEEL_KEY);
      if (savedTashkeel !== null) setShowTashkeel(savedTashkeel === '1');

      const savedLastPosition = await AsyncStorage.getItem(LAST_POSITION_KEY);
      if (savedLastPosition) setLastPosition(JSON.parse(savedLastPosition));

      const savedViewMode = await AsyncStorage.getItem(READER_VIEW_MODE_KEY);
      if (savedViewMode === 'pages' || savedViewMode === 'continuous') setReaderViewMode(savedViewMode);

      const savedStats = await AsyncStorage.getItem(STATS_KEY);
      const today = new Date().toISOString().split('T')[0];
      if (savedStats) {
        const stats = JSON.parse(savedStats);
        if (stats.date === today) {
          // الشكل الجديد: مصفوفة أرقام سور فريدة. الشكل القديم (count رقم فقط) نتجاهله
          // لأنه ما يميّز السور الفريدة - يبدأ العد من جديد بالشكل الصحيح
          const ids: number[] = Array.isArray(stats.surahIds) ? stats.surahIds : [];
          todaySurahIdsRef.current = new Set(ids);
          setTodayCount(ids.length);
        }
      }

      const savedReadingBg = await AsyncStorage.getItem(READING_BG_KEY);
      if (savedReadingBg) setReadingBgId(savedReadingBg);

      const seenOnboarding = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!seenOnboarding) setShowOnboarding(true);
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  };

  // دعم أسهم الكيبورد أثناء اختبار الشاشة على المتصفح (يمين/يسار لتقليب الصفحة بوضع الصفحات، أعلى/أسفل للتمرير بأي وضع)
  useEffect(() => {
    if (Platform.OS !== 'web' || !selectedSurah) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readerViewMode === 'pages' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const delta = e.key === 'ArrowLeft' ? 1 : -1; // يمين = صفحة سابقة، يسار = صفحة تالية (اتجاه المصحف)
        const newIndex = Math.min(allPages.length - 1, Math.max(0, currentPageIndex + delta));
        if (newIndex !== currentPageIndex) {
          readerListRef.current?.scrollToIndex({ index: newIndex, animated: true });
          setCurrentPageIndex(newIndex);
          setReadProgress((newIndex + 1) / Math.max(1, allPages.length));
        }
        e.preventDefault();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (readerViewMode === 'pages') {
          const ref = pageScrollRefs.current.get(currentPageIndex);
          if (ref) {
            const current = pageScrollOffsets.current.get(currentPageIndex) || 0;
            const next = Math.max(0, current + (e.key === 'ArrowDown' ? 140 : -140));
            ref.scrollTo({ y: next, animated: true });
          }
        } else {
          const next = Math.max(0, continuousScrollOffsetRef.current + (e.key === 'ArrowDown' ? 140 : -140));
          continuousScrollOffsetRef.current = next;
          continuousListRef.current?.scrollTo({ y: next, animated: true });
        }
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSurah, currentPageIndex, allPages.length, readerViewMode]);

  const updateContinuousPosition = (verseId: number) => {
    setContinuousVerseId(verseId);
  };

  const changeReaderViewMode = async (mode: 'pages' | 'continuous') => {
    setReaderViewMode(mode);
    setAutoScrollActive(false);
    try {
      await AsyncStorage.setItem(READER_VIEW_MODE_KEY, mode);
    } catch (error) {
      console.error('Error saving reader view mode:', error);
    }
  };

  const openSurah = async (surah: Surah, targetVerseId: number = 1) => {
    setSelectedSurah(surah);
    setReadProgress(0);
    setAutoScrollActive(false);
    setContinuousVerseId(targetVerseId);

    // نبني صفحات المصحف الآن (أول مرة بس، بعدها محفوظة) - نجيب رقم الصفحة الصحيح حتى تبدأ القراءة من مكانها الصح
    const pages = ensureAllPages();
    let targetPage = 0;
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].some((v) => v.surahId === surah.id && v.id === targetVerseId)) {
        targetPage = i;
        break;
      }
    }
    setCurrentPageIndex(targetPage);
    // ننتظر رندر الـ FlatList قبل القفز للصفحة المطلوبة (بوضع الصفحات فقط؛ الوضع المتصل يتكفل بموضعه لحاله)
    if (readerViewMode === 'pages') {
      setTimeout(() => {
        readerListRef.current?.scrollToIndex({ index: targetPage, animated: false });
      }, 50);
    } else {
      continuousScrollOffsetRef.current = 0;
      continuousListRef.current?.scrollTo({ y: 0, animated: false });
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      // إذا التاريخ المحفوظ تغيّر (يوم جديد) نصفّر المجموعة قبل ما نضيف السورة الحالية
      const savedStatsRaw = await AsyncStorage.getItem(STATS_KEY);
      if (savedStatsRaw) {
        const savedStats = JSON.parse(savedStatsRaw);
        if (savedStats.date !== today) todaySurahIdsRef.current = new Set();
      }
      todaySurahIdsRef.current.add(surah.id);
      const newCount = todaySurahIdsRef.current.size;
      setTodayCount(newCount);
      await AsyncStorage.setItem(
        STATS_KEY,
        JSON.stringify({ date: today, surahIds: Array.from(todaySurahIdsRef.current) })
      );
    } catch (error) {
      console.error('Error saving position/stats:', error);
    }
  };

  // موضع القراءة الحالي (حسب الوضع: صفحات أو متصل) - نقارنه بالموضع المحفوظ لمعرفة
  // هل الأيقونة تكون معبأة (نفس الموضع المحفوظ بالضبط) أو إطار فارغ (موضع مختلف)
  const getCurrentReadingPosition = (): LastPosition | null => {
    if (readerViewMode === 'pages') {
      const firstVerse = allPages[currentPageIndex]?.[0];
      if (!firstVerse) return null;
      return { surahId: firstVerse.surahId, surahName: firstVerse.surahName, verseId: firstVerse.id };
    }
    if (!selectedSurah) return null;
    return { surahId: selectedSurah.id, surahName: selectedSurah.name, verseId: continuousVerseId };
  };

  const currentReadingPosition = getCurrentReadingPosition();
  const isCurrentPositionSaved = !!(
    currentReadingPosition &&
    lastPosition &&
    lastPosition.surahId === currentReadingPosition.surahId &&
    lastPosition.verseId === currentReadingPosition.verseId
  );

  // ضغطة وحدة: تحفظ موضع القراءة الحالي (وتملي الأيقونة). ضغطة ثانية بنفس الموضع
  // بالضبط: تلغي الحفظ (ترجع الأيقونة إطار فارغ). هذا هو المكان الوحيد المسؤول
  // عن حفظ آخر موضع الحين - ما فيه حفظ تلقائي بعد الآن
  const toggleSavedPosition = async () => {
    const current = getCurrentReadingPosition();
    if (!current) return;
    if (isCurrentPositionSaved) {
      setLastPosition(null);
      try {
        await AsyncStorage.removeItem(LAST_POSITION_KEY);
      } catch (error) {
        console.error('Error clearing last position:', error);
      }
    } else {
      setLastPosition(current);
      try {
        await AsyncStorage.setItem(LAST_POSITION_KEY, JSON.stringify(current));
      } catch (error) {
        console.error('Error saving last position:', error);
      }
    }
  };

  const openSurahById = (surahId: number, verseId: number = 1) => {
    const s = surahs.find((x) => x.id === surahId);
    if (s) {
      setShowVerseSearch(false);
      openSurah(s, verseId);
    }
  };

  // ===== فتح تلقائي من رابط خارجي (إشعار آية بعد الصلاة، أو ref نوعه
  // 'quran' بجرد أعمال يوم الجمعة) - يشتغل بس أول ما تجهز قائمة السور
  // (surahs.length > 0)، ومرة وحدة بس لكل دخول للشاشة (handledDeepLinkRef)
  // حتى ما يعيد فتح نفس السورة لو المستخدم رجع تصفح لسورة ثانية بعدين =====
  useEffect(() => {
    if (handledDeepLinkRef.current) return;
    if (surahs.length === 0) return;
    if (!deepLinkParams.surah) return;

    const surahId = parseInt(deepLinkParams.surah, 10);
    const ayahId = deepLinkParams.ayah ? parseInt(deepLinkParams.ayah, 10) : 1;
    if (!Number.isNaN(surahId)) {
      handledDeepLinkRef.current = true;
      openSurahById(surahId, Number.isNaN(ayahId) ? 1 : ayahId);
    }
  }, [surahs, deepLinkParams.surah, deepLinkParams.ayah]);

  const copyVerseText = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 1500);
    } catch (error) {
      console.error('Error copying verse:', error);
    }
  };

  const shareVerseNow = async (surahName: string, verseId: number, text: string) => {
    const message = `${text} ﴿${verseId}﴾\nسورة ${surahName}`;
    try {
      if (Platform.OS === 'web') {
        const nav: any = typeof navigator !== 'undefined' ? navigator : null;
        if (nav?.share) {
          await nav.share({ text: message });
          return;
        }
        await copyVerseText(message);
        return;
      }
      await Share.share({ message });
    } catch (error) {
      console.error('Error sharing verse:', error);
    }
  };

  const changeFontSizeKey = async (key: 'small' | 'medium' | 'large') => {
    setFontSizeKey(key);
    try {
      await AsyncStorage.setItem(FONT_SIZE_KEY, key);
    } catch (error) {
      console.error('Error saving font size:', error);
    }
  };

  const changeFontFamilyChoice = async (choice: 'uthmani' | 'amiri' | 'system') => {
    setFontFamilyChoice(choice);
    try {
      await AsyncStorage.setItem(FONT_FAMILY_KEY, choice);
    } catch (error) {
      console.error('Error saving font family:', error);
    }
  };

  const toggleTashkeel = async (value: boolean) => {
    setShowTashkeel(value);
    try {
      await AsyncStorage.setItem(TASHKEEL_KEY, value ? '1' : '0');
    } catch (error) {
      console.error('Error saving tashkeel setting:', error);
    }
  };

  const changeReadingBg = async (id: string) => {
    setReadingBgId(id);
    try {
      await AsyncStorage.setItem(READING_BG_KEY, id);
    } catch (error) {
      console.error('Error saving reading background:', error);
    }
  };

  // مفتاح ترتيب شامل (رقم السورة×١٠٠٠ + رقم الآية) يخلينا نقارن مواقع الآيات عبر كل السور بسهولة
  const juzOrderKey = (surahId: number, verseId: number) => surahId * 1000 + verseId;

  // تجميع بيانات الأجزاء - محفوظة بـ useMemo (تُحسب مرة وحدة فقط عند تغيّر بيانات السور)
  // يغطي كل الأجزاء من ١ إلى ٣٠ بدون نقص، حتى لو سورة وحدة امتدت على أكثر من جزء (متل البقرة)
  // ملاحظة: هذا الـ useMemo لازم يبقى قبل أي return شرطي بالكومبوننت (قاعدة الـ Hooks بـ React)
  const juzData = useMemo((): JuzSection[] => {
    const juzMap: { [key: number]: JuzSection } = {};
    for (let j = 1; j <= 30; j++) {
      juzMap[j] = { juz: j, surahs: [] };
    }
    if (surahs.length === 0) return [];

    // إذا بيانات القرآن فيها رقم جزء مسجل لكل آية، نعتمد عليه مباشرة (الأدق)
    const hasPerVerseJuz = surahs.every((s) => s.verses.length > 0 && s.verses.every((v) => typeof v.juz === 'number'));

    if (hasPerVerseJuz) {
      surahs.forEach((surah) => {
        const versesByJuz: { [j: number]: number[] } = {};
        surah.verses.forEach((v) => {
          const j = v.juz as number;
          if (!versesByJuz[j]) versesByJuz[j] = [];
          versesByJuz[j].push(v.id);
        });
        Object.keys(versesByJuz).forEach((jStr) => {
          const j = Number(jStr);
          if (!juzMap[j]) return;
          const ids = versesByJuz[j];
          const first = ids[0];
          const last = ids[ids.length - 1];
          const isFullSurah = ids.length === surah.total_verses;
          juzMap[j].surahs.push({
            id: surah.id,
            name: surah.name,
            verses: isFullSurah ? `${toArabicDigits(surah.total_verses)} آية` : `من الآية ${toArabicDigits(first)} إلى ${toArabicDigits(last)}`,
          });
        });
      });
    } else {
      // احتياطي: نعتمد نقاط بداية الأجزاء التقريبية، وندعم امتداد نفس السورة لأكثر من جزء
      for (let j = 1; j <= 30; j++) {
        const startPoint = JUZ_START_POINTS[j - 1];
        const nextPoint = JUZ_START_POINTS[j];
        const rangeStart = juzOrderKey(startPoint.surah, startPoint.verse);
        const rangeEnd = nextPoint ? juzOrderKey(nextPoint.surah, nextPoint.verse) : Infinity; // نهاية حصرية

        surahs.forEach((surah) => {
          const surahStart = juzOrderKey(surah.id, 1);
          const surahEnd = juzOrderKey(surah.id, surah.total_verses);
          const overlapStart = Math.max(rangeStart, surahStart);
          const overlapEnd = Math.min(rangeEnd - 1, surahEnd);
          if (overlapStart > overlapEnd) return;

          const firstVerse = overlapStart - surah.id * 1000;
          const lastVerse = overlapEnd - surah.id * 1000;
          const isFullSurah = firstVerse === 1 && lastVerse === surah.total_verses;
          juzMap[j].surahs.push({
            id: surah.id,
            name: surah.name,
            verses: isFullSurah ? `${toArabicDigits(surah.total_verses)} آية` : `من الآية ${toArabicDigits(firstVerse)} إلى ${toArabicDigits(lastVerse)}`,
          });
        });
      }
    }

    return Object.values(juzMap).filter((j) => j.surahs.length > 0);
  }, [surahs]);

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', marginTop: 12 }}>جاري التحميل...</Text>
      </View>
    );
  }

  const filteredSurahs = surahs.filter((s) => s.name.includes(searchQuery));

  return (
    <ImageBackground
      source={sharedBg.image}
      style={{ flex: 1, width: '100%', height: '100%' }}
      resizeMode="cover"
      imageStyle={{ width: '100%', height: '100%', opacity: sharedBg.image ? 1 : 0 }}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: sharedBg.color, opacity: sharedBg.image ? sharedBg.overlayOpacity : 1 },
        ]}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        <BlurView intensity={blurIntensity(65)} tint="dark" style={styles.header}>
          <View style={styles.headerGlass} />
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              onPress={() => setShowSettings(true)}
              style={styles.headerIconBtn}
              activeOpacity={0.75}
            >
              <Ionicons name="options-outline" size={18} color={C.neonBlue} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              <Text style={styles.headerTitleOrnament}>۞ </Text>
              المصحف الشريف
              <Text style={styles.headerTitleOrnament}> ۞</Text>
            </Text>
            <TouchableOpacity onPress={() => setShowVerseSearch(true)} style={styles.headerIconBtn} activeOpacity={0.75}>
              <Ionicons name="search" size={18} color={C.neonBlue} />
            </TouchableOpacity>
          </View>
          <View style={styles.headerRow}>
            {lastPosition ? (
              <TouchableOpacity
                onPress={() => openSurahById(lastPosition.surahId, lastPosition.verseId)}
                style={styles.headerBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="bookmark" size={13} color={C.neonBlue} />
                <Text style={styles.headerBtnText}>آخر موضع توقفت فيه</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}
            <Text style={styles.statsText}>قرأت اليوم {toArabicDigits(todayCount)} سورة</Text>
          </View>
        </BlurView>

        {/* شريط البحث صار هنا فوق التبويبات مباشرة (بدل تحتها) - نفس ترتيب شاشة
            الأدعية: عنوان -> مقدمة -> بحث -> قائمة. يبقى خاص بتبويب "السور" فقط. */}
        {activeTab === 0 && (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="بحث عن سورة..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              textAlign="right"
            />
          </View>
        )}

        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 1 && styles.tabActive]}
            onPress={() => setActiveTab(1)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 1 && styles.tabTextActive]}>الأجزاء</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 0 && styles.tabActive]}
            onPress={() => setActiveTab(0)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 0 && styles.tabTextActive]}>السور</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 0 && (
          <FlatList
            data={filteredSurahs}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.surahCard}
                onPress={() => openSurah(item)}
                activeOpacity={0.8}
              >
                  <Text style={styles.surahName}>{toArabicDigits(item.id)}. {item.name}</Text>
                  <Text style={styles.surahInfo}>{toArabicDigits(item.total_verses)} آية</Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
        )}

        {activeTab === 1 && (
          <FlatList
            data={juzData}
            keyExtractor={(item) => item.juz.toString()}
            renderItem={({ item: juz }) => (
              <View style={styles.juzSection}>
                <Text style={styles.juzTitle}>{JUZ_NAMES[juz.juz - 1]}</Text>
                {juz.surahs.map((surah) => (
                  <TouchableOpacity
                    key={surah.id}
                    style={styles.juzSurahCard}
                    onPress={() => {
                      const s = surahs.find((s) => s.id === surah.id);
                      if (s) openSurah(s);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.juzSurahName}>{toArabicDigits(surah.id)}. {surah.name}</Text>
                    <Text style={styles.juzSurahVerses}>{surah.verses}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        <Modal
          visible={!!selectedSurah}
          animationType="slide"
          onRequestClose={() => setSelectedSurah(null)}
          transparent={false}
        >
          <ImageBackground
            source={readingBg.image}
            style={{ flex: 1, width: '100%', height: '100%' }}
            resizeMode="cover"
            imageStyle={{ width: '100%', height: '100%', opacity: readingBg.image ? 1 : 0 }}
          >
            {/* بدون أي تعتيم أسود - زجاجي بحت */}
            {readingBg.image && <View style={[StyleSheet.absoluteFill, { backgroundColor: readingBg.color, opacity: 0.12 }]} />}
            <SafeAreaView style={[styles.modalContainer, { backgroundColor: 'transparent' }]}>
              {!readingMode && (
                <BlurView intensity={blurIntensity(60)} tint="dark" style={styles.modalHeader}>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setSelectedSurah(null)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-forward" size={22} color={C.neonBlue} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.modalTitle}>
                      {readerViewMode === 'pages'
                        ? allPages[currentPageIndex]?.[0]?.surahName ?? selectedSurah?.name
                        : selectedSurah?.name}
                    </Text>
                    {readerViewMode === 'pages' && allPages[currentPageIndex]?.[0]?.juz && (
                      <Text style={styles.modalJuzSubtitle}>
                        الجزء {toArabicDigits(allPages[currentPageIndex][0].juz as number)}
                      </Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={toggleSavedPosition}
                      style={styles.headerIconBtn}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={isCurrentPositionSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={C.neonBlue} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setReadingMode(true)}
                      style={styles.headerIconBtn}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="eye-outline" size={18} color={C.neonBlue} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setShowSettings(true)}
                      style={styles.headerIconBtn}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="options-outline" size={18} color={C.neonBlue} />
                    </TouchableOpacity>
                  </View>
                </BlurView>
              )}

              {readingMode && (
                <TouchableOpacity
                  style={styles.exitReadingModeBtn}
                  activeOpacity={0.8}
                  onPress={() => setReadingMode(false)}
                >
                  <Ionicons name="eye-off-outline" size={18} color={C.neonBlue} />
                </TouchableOpacity>
              )}

              {/* شريط تقدم القراءة: حسب رقم الصفحة بوضع الصفحات، أو حسب رقم الآية الحالية بالسورة بالوضع المتصل */}
              {!readingMode && (
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      readerViewMode === 'pages'
                        ? { width: `${Math.round(((currentPageIndex + 1) / Math.max(1, allPages.length)) * 100)}%` }
                        : {
                            width: `${Math.round(
                              (continuousVerseId / Math.max(1, selectedSurah?.verses.length ?? 1)) * 100
                            )}%`,
                          },
                    ]}
                  />
                </View>
              )}

              <View style={{ flex: 1 }} onLayout={(e) => setReaderAreaHeight(e.nativeEvent.layout.height)}>
                {readerViewMode === 'continuous' ? (
                  <ContinuousReader
                    verses={currentSurahTaggedVerses}
                    activeFontFamily={activeFontFamily}
                    fontSize={fontSize}
                    showTashkeel={showTashkeel}
                    setShareVerse={setShareVerse}
                    listRef={continuousListRef}
                    initialVerseIndex={Math.max(
                      0,
                      currentSurahTaggedVerses.findIndex((v) => v.id === continuousVerseId)
                    )}
                    onPositionChange={updateContinuousPosition}
                    autoScrollActive={autoScrollActive}
                    setAutoScrollActive={setAutoScrollActive}
                    autoScrollSpeed={autoScrollSpeed}
                    setAutoScrollSpeed={setAutoScrollSpeed}
                    scrollOffsetRef={continuousScrollOffsetRef}
                    jumpSignal={continuousJumpSignal}
                    jumpTargetVerseId={continuousVerseId}
                  />
                ) : (
                <FlatList<TaggedVerse[]>
                  ref={readerListRef}
                  style={{ flex: 1 }}
                  data={allPages}
                  keyExtractor={(_, idx) => `page-${idx}`}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  extraData={pageWidth}
                  getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
                  initialScrollIndex={currentPageIndex}
                  onScrollToIndexFailed={() => {}}
                  // تحسينات أداء - نخلي عدد الصفحات المحملة بالذاكرة بنفس اللحظة قليل جداً (صفحة قبل وبعد بس)
                  // حتى ما يثقل التطبيق كل ما تتنقل أكثر بين الصفحات والسور
                  initialNumToRender={2}
                  maxToRenderPerBatch={2}
                  windowSize={3}
                  removeClippedSubviews={Platform.OS === 'android'}
                  updateCellsBatchingPeriod={50}
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
                    setCurrentPageIndex(idx);
                    setReadProgress((idx + 1) / Math.max(1, allPages.length));
                  }}
                  renderItem={({ item: pageVerses, index: pageIndex }) => {
                    const firstVerse = pageVerses[0];
                    const pageStartsNewSurah = firstVerse?.id === 1;
                    return (
                      <View style={{ width: pageWidth, height: readerAreaHeight || undefined, flex: readerAreaHeight ? undefined : 1 }}>
                      {/* لافتة اسم السورة + البسملة - ثابتة أعلى الصفحة إذا السورة تبدأ بأول الصفحة */}
                      {pageStartsNewSurah && (
                        <SurahBanner
                          surahId={firstVerse.surahId}
                          surahName={firstVerse.surahName}
                          activeFontFamily={activeFontFamily}
                        />
                      )}

                      <ScrollView
                        ref={(r) => {
                          if (r) pageScrollRefs.current.set(pageIndex, r);
                          else pageScrollRefs.current.delete(pageIndex);
                        }}
                        onScroll={(e) => pageScrollOffsets.current.set(pageIndex, e.nativeEvent.contentOffset.y)}
                        scrollEventThrottle={16}
                        style={styles.versesContainer}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.versesContentCentered}
                      >
                        <View style={styles.versesPanel}>
                          {buildPageSegments(pageVerses).map((seg, si) => {
                            if (seg.type === 'banner') {
                              return (
                                <SurahBanner
                                  key={`banner-${seg.surahId}-${si}`}
                                  surahId={seg.surahId}
                                  surahName={seg.surahName}
                                  activeFontFamily={activeFontFamily}
                                />
                              );
                            }
                            return (
                              <Text key={`verses-${si}`} style={[styles.versesFlow, { fontSize, lineHeight: Math.round(fontSize * 2.2) }]}>
                                {seg.verses.map((verse) => (
                                  <Text key={`${verse.surahId}-${verse.id}`}>
                                    <Text style={[styles.verseText, { fontSize, fontFamily: activeFontFamily }]}>
                                      {showTashkeel ? getVerseDisplayText(verse) : stripTashkeel(getVerseDisplayText(verse))}
                                    </Text>
                                    <Text
                                      style={styles.verseNumberInline}
                                      onLongPress={() =>
                                        setShareVerse({ surahName: verse.surahName, verseId: verse.id, text: verse.text })
                                      }
                                    >
                                      {' '}{'﴿'}{toArabicDigits(verse.id)}{'﴾'}{' '}
                                    </Text>
                                    {verse.surahId === 114 && verse.id === 6 && (
                                      <Text style={styles.khatmDua}>
                                        {'\n\n'}«صَدَقَ اللَّهُ العَظِيمُ»{'\n\n'}
                                        اللَّهُمَّ ارْحَمْنَا بِالقُرْآنِ، وَاجْعَلْهُ لَنَا إِمَامًا وَنُورًا وَهُدًى وَرَحْمَةً،{'\n'}
                                        اللَّهُمَّ ذَكِّرْنَا مِنْهُ مَا نُسِّينَا، وَعَلِّمْنَا مِنْهُ مَا جَهِلْنَا،{'\n'}
                                        وَارْزُقْنَا تِلَاوَتَهُ آنَاءَ اللَّيْلِ وَأَطْرَافَ النَّهَارِ،{'\n'}
                                        وَاجْعَلْهُ لَنَا حُجَّةً يَا رَبَّ العَالَمِينَ،{'\n'}
                                        وَتَقَبَّلْ مِنَّا هَذِهِ الخَتْمَةَ المُبَارَكَةَ، آمِين.
                                      </Text>
                                    )}
                                  </Text>
                                ))}
                              </Text>
                            );
                          })}
                        </View>
                      </ScrollView>

                      {/* شارة الحزب + رقم الصفحة داخل دائرة مزخرفة */}
                      <View style={styles.bottomBadgesRow} pointerEvents="none">
                        {firstVerse?.hizb ? (
                          <View style={styles.hizbBadge}>
                            <Text style={styles.hizbBadgeText}>الحزب {toArabicDigits(firstVerse.hizb)}</Text>
                          </View>
                        ) : <View />}
                        <View style={styles.pageCircle}>
                          <Text style={styles.pageCircleText}>{firstVerse?.page ? toArabicDigits(firstVerse.page) : ''}</Text>
                        </View>
                        <View style={{ width: 70 }} />
                      </View>
                    </View>
                  );
                }}
              />
                )}
              </View>
            </SafeAreaView>
          </ImageBackground>
        </Modal>

        <Modal
          visible={showSettings}
          animationType="fade"
          transparent
          onRequestClose={() => (showBgPicker ? setShowBgPicker(false) : setShowSettings(false))}
        >
          <View style={styles.settingsOverlay}>
            <BlurView intensity={blurIntensity(50)} tint="dark" style={styles.settingsCard}>
              <View style={styles.settingsCardGlass} />

              {!showBgPicker ? (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.settingsHeader}>
                    <TouchableOpacity
                      style={styles.backArrowBtn}
                      onPress={() => setShowSettings(false)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="chevron-forward" size={20} color={C.white} />
                    </TouchableOpacity>
                    <Text style={styles.settingsTitle}>إعدادات القرآن</Text>
                    <View style={{ width: 32 }} />
                  </View>

                  <Text style={styles.settingsLabel}>حجم الخط</Text>
                  <View style={styles.chipsRow}>
                    {(['small', 'medium', 'large'] as const).map((key) => (
                      <TouchableOpacity
                        key={key}
                        onPress={() => changeFontSizeKey(key)}
                        style={[styles.chip, fontSizeKey === key && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, fontSizeKey === key && styles.chipTextActive]}>
                          {key === 'small' ? 'صغير' : key === 'medium' ? 'متوسط' : 'كبير'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.settingsLabel}>طريقة العرض</Text>
                  <View style={styles.chipsRow}>
                    <TouchableOpacity
                      onPress={() => changeReaderViewMode('pages')}
                      style={[styles.chip, readerViewMode === 'pages' && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, readerViewMode === 'pages' && styles.chipTextActive]}>صفحات</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => changeReaderViewMode('continuous')}
                      style={[styles.chip, readerViewMode === 'continuous' && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, readerViewMode === 'continuous' && styles.chipTextActive]}>متصل</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.settingsLabel}>نوع الخط</Text>
                  <View style={styles.chipsRow}>
                    <TouchableOpacity
                      onPress={() => changeFontFamilyChoice('uthmani')}
                      style={[styles.chip, fontFamilyChoice === 'uthmani' && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, fontFamilyChoice === 'uthmani' && styles.chipTextActive]}>عثماني</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => changeFontFamilyChoice('amiri')}
                      style={[styles.chip, fontFamilyChoice === 'amiri' && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, fontFamilyChoice === 'amiri' && styles.chipTextActive]}>أميري</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => changeFontFamilyChoice('system')}
                      style={[styles.chip, fontFamilyChoice === 'system' && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, fontFamilyChoice === 'system' && styles.chipTextActive]}>النظام</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.switchRow}>
                    <Switch
                      value={showTashkeel}
                      onValueChange={toggleTashkeel}
                      trackColor={{ false: 'rgba(255,255,255,0.2)', true: C.neonGlow }}
                      thumbColor={C.white}
                    />
                    <Text style={styles.settingsLabelInline}>إظهار التشكيل (الحركات)</Text>
                  </View>

                  <Text style={styles.settingsLabel}>خلفية قراءة السورة</Text>
                  <TouchableOpacity
                    style={styles.bgCard}
                    activeOpacity={0.8}
                    onPress={() => setShowBgPicker(true)}
                  >
                    <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.5)" />
                    <View style={styles.bgCardInfo}>
                      <Text style={styles.bgCardLabel}>{readingBg.label}</Text>
                      <View style={[styles.bgCardDot, { backgroundColor: readingBg.color }]} />
                    </View>
                  </TouchableOpacity>

                  <View style={{ height: 10 }} />
                </ScrollView>
              ) : (
                <View>
                  <View style={styles.settingsHeader}>
                    <TouchableOpacity
                      style={styles.backArrowBtn}
                      onPress={() => setShowBgPicker(false)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="chevron-forward" size={20} color={C.white} />
                    </TouchableOpacity>
                    <Text style={styles.settingsTitle}>خلفية قراءة السورة</Text>
                    <View style={{ width: 32 }} />
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '100%' }}>
                  <View style={styles.bgGrid}>
                    {READING_BACKGROUNDS.map((bg) => {
                      const isActive = readingBgId === bg.id;
                      return (
                        <TouchableOpacity
                          key={bg.id}
                          style={styles.bgGridItem}
                          activeOpacity={0.8}
                          onPress={() => changeReadingBg(bg.id)}
                        >
                          {bg.image ? (
                            <ImageBackground
                              source={bg.image}
                              style={[styles.bgGridThumb, isActive && styles.bgGridThumbActive]}
                              imageStyle={{ borderRadius: 14 }}
                            >
                              {isActive && (
                                <View style={styles.bgGridCheck}>
                                  <Ionicons name="checkmark-circle" size={20} color={C.neonBlue} />
                                </View>
                              )}
                            </ImageBackground>
                          ) : (
                            <View
                              style={[
                                styles.bgGridThumb,
                                { backgroundColor: bg.color },
                                isActive && styles.bgGridThumbActive,
                              ]}
                            >
                              {isActive && (
                                <View style={styles.bgGridCheck}>
                                  <Ionicons name="checkmark-circle" size={20} color={C.neonBlue} />
                                </View>
                              )}
                            </View>
                          )}
                          <Text style={styles.bgGridLabel}>{bg.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  </ScrollView>
                </View>
              )}
            </BlurView>
          </View>
        </Modal>

        {/* بحث داخل نص الآيات */}
        <Modal
          visible={showVerseSearch}
          animationType="fade"
          transparent
          onRequestClose={() => setShowVerseSearch(false)}
        >
          <View style={styles.verseSearchOverlay}>
            <SafeAreaView style={styles.verseSearchSafeArea}>
              <BlurView intensity={blurIntensity(65)} tint="dark" style={styles.verseSearchCard}>
                <View style={styles.settingsCardGlass} />
                <View style={styles.settingsHeader}>
                  <TouchableOpacity
                    style={styles.backArrowBtn}
                    onPress={() => setShowVerseSearch(false)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="chevron-forward" size={20} color={C.white} />
                  </TouchableOpacity>
                  <Text style={styles.settingsTitle}>البحث في الآيات</Text>
                  <View style={{ width: 32 }} />
                </View>
                <TextInput
                  style={styles.searchInput}
                  placeholder="اكتب كلمة أو جملة من الآية..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={verseSearchInput}
                  onChangeText={setVerseSearchInput}
                  textAlign="right"
                  autoFocus
                />
                {verseSearchResults.length > 0 && (
                  <Text style={styles.searchResultsCount}>{toArabicDigits(verseSearchResults.length)} نتيجة{verseSearchResults.length >= 80 ? '+' : ''}</Text>
                )}
                <FlatList
                  data={verseSearchResults}
                  keyExtractor={(item, i) => `${item.surahId}-${item.verseId}-${i}`}
                  style={{ marginTop: 10 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.verseResultCard}
                      activeOpacity={0.8}
                      onPress={() => openSurahById(item.surahId, item.verseId)}
                    >
                      <Text style={styles.verseResultHeader}>سورة {item.surahName} - آية {toArabicDigits(item.verseId)}</Text>
                      <Text style={styles.verseResultText} numberOfLines={2}>{item.text}</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    verseSearchQuery.length >= 2 ? (
                      <Text style={styles.emptyText}>لا توجد نتائج مطابقة</Text>
                    ) : (
                      <Text style={styles.emptyText}>اكتب حرفين على الأقل للبحث</Text>
                    )
                  }
                />
              </BlurView>
            </SafeAreaView>
          </View>
        </Modal>

        {/* مشاركة آية */}
        <Modal
          visible={!!shareVerse}
          animationType="fade"
          transparent
          onRequestClose={() => setShareVerse(null)}
        >
          <View style={styles.randomOverlay}>
            <View style={styles.shareCard}>
              <Text style={styles.ornamentMark}>۞</Text>
              <Text style={styles.shareVerseText}>
                {shareVerse?.text} ﴿{shareVerse?.verseId}﴾
              </Text>
              <Text style={styles.shareSurahName}>سورة {shareVerse?.surahName}</Text>
              <View style={styles.randomBtnRow}>
                <TouchableOpacity
                  style={styles.randomBtn}
                  activeOpacity={0.8}
                  onPress={() => shareVerse && shareVerseNow(shareVerse.surahName, shareVerse.verseId, shareVerse.text)}
                >
                  <Text style={styles.randomBtnText}>مشاركة</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.randomBtn, styles.randomBtnSecondary]}
                  activeOpacity={0.8}
                  onPress={() => shareVerse && copyVerseText(`${shareVerse.text} ﴿${shareVerse.verseId}﴾\nسورة ${shareVerse.surahName}`)}
                >
                  <Text style={styles.randomBtnText}>{copiedFeedback ? 'تم النسخ ✓' : 'نسخ النص'}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.shareCloseBtn} onPress={() => setShareVerse(null)}>
                <Text style={styles.shareCloseBtnText}>إغلاق</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* شرح تمهيدي - يظهر أول مرة بس */}
        <Modal
          visible={showOnboarding}
          animationType="fade"
          transparent
          onRequestClose={() => {}}
        >
          <View style={styles.randomOverlay}>
            <View style={styles.onboardingCard}>
              <Text style={styles.onboardingTitle}>مرحبًا بك</Text>
              <View style={styles.onboardingRow}>
                <Ionicons name="search" size={16} color={C.neonBlue} />
                <Text style={styles.onboardingText}>البحث: يدور بنص الآيات مباشرة</Text>
              </View>
              <View style={styles.onboardingRow}>
                <Ionicons name="options-outline" size={16} color={C.neonBlue} />
                <Text style={styles.onboardingText}>الإعدادات: حجم الخط، الخط، وخلفية القراءة</Text>
              </View>
              <View style={styles.onboardingRow}>
                <Ionicons name="bookmark" size={16} color={C.neonBlue} />
                <Text style={styles.onboardingText}>المحفوظات: اضغط رقم أي آية أثناء القراءة لحفظها</Text>
              </View>
              <View style={styles.onboardingRow}>
                <Ionicons name="eye-outline" size={16} color={C.neonBlue} />
                <Text style={styles.onboardingText}>وضع القراءة: يخفي الأشرطة العلوية للقراءة بلا تشتيت</Text>
              </View>
              <TouchableOpacity
                style={styles.onboardingConfirmBtn}
                activeOpacity={0.85}
                onPress={async () => {
                  setShowOnboarding(false);
                  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
                }}
              >
                <Text style={styles.randomBtnText}>فهمت</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27', paddingTop: ANDROID_STATUS_BAR_PADDING },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0e27',
  },
  header: {
    padding: 20,
    overflow: 'hidden',
  },
  headerGlass: {
    ...StyleSheet.absoluteFill,
    backgroundColor: C.glass,
    borderBottomWidth: 1,
    borderBottomColor: C.neonBorder,
  },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: {
    fontSize: 26,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: 'bold',
    fontFamily: 'Amiri-Bold',
    flex: 1,
  },
  headerTitleOrnament: {
    fontFamily: undefined,
    color: C.neonBlue,
    fontSize: 20,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.neonBorder,
    alignItems: 'center',
    justifyContent: 'center',
    ...neonGlowShadow,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.glass,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  headerBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Amiri-Regular',
  },
  statsText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontFamily: 'Amiri-Regular',
  },
  lastPositionBanner: {
    backgroundColor: C.glass,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.glassBorder,
  },
  lastPositionText: {
    color: '#4da8da',
    fontSize: 14,
    textAlign: 'right',
    fontFamily: 'Amiri-Regular',
  },
  savedPositionChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    marginTop: 8,
    marginRight: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(10,20,40,0.55)',
    borderWidth: 1,
    borderColor: C.neonBorder,
  },
  savedPositionChipText: {
    color: C.neonBlue,
    fontSize: 12,
    fontFamily: 'Amiri-Regular',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: C.glass,
    borderBottomWidth: 1,
    borderBottomColor: C.glassBorder,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#FFFFFF' },
  tabText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Amiri-Regular',
  },
  tabTextActive: { color: '#FFFFFF' },
  searchContainer: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  searchInput: {
    backgroundColor: C.glass,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    borderWidth: 1,
    borderColor: C.neonBorder,
    fontFamily: 'Amiri-Regular',
    fontSize: 15,
    writingDirection: 'rtl',
    ...neonGlowShadow,
  },
  listContent: { padding: 12, paddingBottom: 30 },
  surahCard: {
    backgroundColor: C.glass,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    minHeight: 62,
    borderWidth: 1,
    borderColor: C.neonBorder,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...neonGlowShadow,
  },
  surahName: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    fontFamily: 'Amiri-Bold',
    textAlign: 'right',
  },
  surahInfo: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Amiri-Regular',
    textAlign: 'left',
  },
  juzSection: { paddingHorizontal: 12, marginBottom: 20 },
  juzTitle: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'right',
    fontFamily: 'Amiri-Bold',
  },
  juzSurahCard: {
    backgroundColor: C.glass,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    minHeight: 54,
    borderWidth: 1,
    borderColor: C.neonBorder,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...neonGlowShadow,
  },
  juzSurahName: {
    fontSize: 16,
    color: '#fff',
    fontFamily: 'Amiri-Bold',
    textAlign: 'right',
  },
  juzSurahVerses: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Amiri-Regular',
    textAlign: 'left',
  },
  modalContainer: { flex: 1, backgroundColor: '#000', paddingTop: ANDROID_STATUS_BAR_PADDING },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderBottomWidth: 1,
    borderBottomColor: C.glassBorder,
  },
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  closeBtnText: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' },
  modalTitle: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
    fontFamily: 'Amiri-Bold',
  },
  modalJuzSubtitle: {
    fontSize: 12,
    color: C.neonBlue,
    fontFamily: 'Amiri-Bold',
    marginTop: 2,
  },
  surahHeaderArabic: {
    fontSize: 26,
    color: '#fff',
    fontFamily: 'Amiri-Bold',
    textAlign: 'center',
    textShadowColor: C.neonGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    marginHorizontal: 10,
  },
  versesContainer: { flex: 1 },
  versesContentCentered: { flexGrow: 1, justifyContent: 'flex-start', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 60 },
  // النص يطفو مباشرة على الخلفية - بدون لوحة أو حدود
  versesPanel: {
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  versesPanelBg: {
    display: 'none',
  },
  continuousContent: { paddingHorizontal: 18, paddingTop: 10 },
  // زر التمرير التلقائي البطيء العائم (وضع السكرول المتصل فقط)
  autoScrollDock: {
    position: 'absolute',
    bottom: 22,
    left: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoScrollBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(8,16,36,0.85)',
    borderWidth: 1.3,
    borderColor: C.neonBlue,
    alignItems: 'center',
    justifyContent: 'center',
    ...neonGlowShadow,
  },
  autoScrollSpeedBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(8,16,36,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(87,200,242,0.4)',
  },
  autoScrollSpeedText: { color: '#fff', fontSize: 12, fontFamily: 'Amiri-Bold' },
  // لافتة اسم السورة - شريط زجاجي نيوني موحّد (نفس الأسلوب أعلى الصفحة وبمنتصفها)
  surahBannerFixed: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  surahBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  surahBannerLine: {
    width: 26,
    height: 1,
    backgroundColor: 'rgba(87,200,242,0.5)',
  },
  surahBannerIcon: {
    marginHorizontal: 8,
    opacity: 0.85,
  },
  versesFlow: {
    fontSize: 24,
    color: '#f2f7ff',
    lineHeight: 54,
    textAlign: 'justify',
    writingDirection: 'rtl',
    fontFamily: 'Amiri-Regular',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  verseText: {
    color: '#f2f7ff',
    fontFamily: 'Amiri-Regular',
  },
  verseNumberInline: {
    fontSize: 19,
    color: C.neonBlue,
    fontFamily: 'Amiri-Bold',
    fontWeight: '700',
  },
  verseNumberBookmarked: {
    color: '#fbbf24',
  },
  sajdaMark: {
    fontSize: 20,
    color: '#22c55e',
    fontWeight: '700',
  },
  sajdaMarkObligatory: {
    color: '#ef4444',
  },
  bookmarkIconIdle: { color: 'rgba(255,255,255,0.55)', fontSize: 16 },
  bookmarkIconActive: { color: '#fbbf24', fontSize: 16 },
  bookmarkCard: {
    backgroundColor: C.glass,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.neonBorder,
    alignItems: 'flex-end',
    ...neonGlowShadow,
  },
  bookmarkSurahName: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Amiri-Bold',
    textAlign: 'right',
  },
  bookmarkVerseText: {
    fontSize: 15,
    color: '#e8f0ff',
    fontFamily: 'Amiri-Regular',
    textAlign: 'right',
    marginTop: 6,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
    fontFamily: 'Amiri-Regular',
  },
  randomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  randomBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  randomBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  // زر منفرد (مو جنب زر ثاني بصف) - بدون flex:1 حتى ما يتمدد بشكل غير طبيعي
  // ويدفع نصه خارج المكان المرئي (هذا كان سبب زر "فهمت" يبين شريط أبيض فاضي)
  onboardingConfirmBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 6,
  },
  randomBtnSecondary: {
    backgroundColor: '#2a3d5d',
  },
  randomBtnText: {
    color: '#0a0e27',
    fontWeight: 'bold',
    fontFamily: 'Amiri-Bold',
  },
  settingsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  verseSearchOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-start' },
  verseSearchSafeArea: { width: '100%', paddingTop: ANDROID_STATUS_BAR_PADDING },
  verseSearchCard: {
    padding: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    maxHeight: '92%',
  },
  settingsCard: {
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  settingsCardGlass: {
    ...StyleSheet.absoluteFill,
    backgroundColor: C.glass,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: C.neonBorder,
  },
  settingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  settingsTitle: { color: C.white, fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center' },
  settingsLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 8, textAlign: 'right' },
  settingsLabelInline: { color: C.white, fontSize: 14, fontWeight: '600', textAlign: 'right', flex: 1 },
  chipsRow: { flexDirection: 'row', gap: 10 },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
    alignItems: 'center',
  },
  chipActive: { borderColor: C.neonBlue, backgroundColor: 'rgba(87,200,242,0.15)', ...neonGlowShadow },
  chipText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: C.white },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 12,
    padding: 12,
  },
  bgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.neonBorder,
    borderRadius: 12,
    padding: 12,
    ...neonGlowShadow,
  },
  bgCardInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bgCardLabel: { color: C.white, fontSize: 14, fontWeight: '600' },
  bgCardDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  bgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', paddingBottom: 10 },
  bgGridItem: { width: '28%', alignItems: 'center' },
  bgGridThumb: {
    width: '100%',
    aspectRatio: 0.65,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  bgGridThumbActive: { borderColor: C.neonBlue, ...neonGlowShadow },
  bgGridCheck: { margin: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10 },
  bgGridLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 6, textAlign: 'center' },

  backArrowBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },

  progressTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.1)' },
  exitReadingModeBtn: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.neonBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressFill: {
    height: 5,
    backgroundColor: C.neonBlue,
    shadowColor: C.neonBlue,
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },

  juzBadge: {
    position: 'absolute',
    top: 12,
    left: 14,
    zIndex: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(10,20,40,0.35)',
    borderWidth: 1,
    borderColor: C.neonBlue,
  },
  juzBadgeText: { color: C.neonBlue, fontSize: 12, fontFamily: 'Amiri-Bold' },
  bottomBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  hizbBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(10,20,40,0.35)',
    borderWidth: 1,
    borderColor: C.neonBlue,
  },
  hizbBadgeText: { color: C.neonBlue, fontSize: 12, fontFamily: 'Amiri-Bold' },
  pageCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: C.neonBlue,
    backgroundColor: 'rgba(10,20,40,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.neonBlue,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  pageCircleText: { color: C.neonBlue, fontSize: 13, fontFamily: 'Amiri-Bold' },

  onboardingCard: {
    backgroundColor: C.glass,
    borderRadius: 18,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: C.neonBorder,
    ...neonGlowShadow,
  },
  onboardingTitle: {
    fontSize: 22,
    color: '#FFFFFF',
    fontFamily: 'Amiri-Bold',
    textAlign: 'center',
    marginBottom: 18,
  },
  onboardingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
  },
  onboardingText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Amiri-Regular',
    flex: 1,
    textAlign: 'right',
    flexWrap: 'wrap',
  },
  khatmDua: {
    color: '#f5d97a',
    fontSize: 17,
    lineHeight: 30,
    fontFamily: 'Amiri-Regular',
    textAlign: 'center',
  },
  searchResultsCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontFamily: 'Amiri-Regular',
    textAlign: 'right',
    marginTop: 6,
  },
  hintBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: C.glass,
    borderBottomWidth: 1,
    borderBottomColor: C.glassBorder,
  },
  hintBarText: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontFamily: 'Amiri-Regular' },
  pageNumberText: { color: C.neonBlue, fontSize: 20, fontWeight: '800', fontFamily: 'Amiri-Bold' },
  ornamentMark: { color: C.neonBlue, fontSize: 16 },

  bismillah: {
    textAlign: 'center',
    color: '#e8f0ff',
    fontSize: 24,
    marginTop: 14,
    marginBottom: 8,
  },

  verseResultCard: {
    backgroundColor: C.glass,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.neonBorder,
    alignItems: 'flex-end',
  },
  verseResultHeader: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Amiri-Bold', textAlign: 'right' },
  verseResultText: { color: '#e8f0ff', fontSize: 14, fontFamily: 'Amiri-Regular', textAlign: 'right', marginTop: 4 },

  shareCard: {
    backgroundColor: '#0f1b3d',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: C.neonBorder,
    alignItems: 'center',
    ...neonGlowShadow,
  },
  shareVerseText: {
    fontSize: 20,
    color: '#e8f0ff',
    fontFamily: 'Amiri-Regular',
    textAlign: 'center',
    lineHeight: 38,
    marginVertical: 10,
  },
  shareSurahName: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Amiri-Bold', marginBottom: 16 },
  shareCloseBtn: { marginTop: 14, paddingVertical: 8 },
  shareCloseBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
});