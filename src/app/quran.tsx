import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import { useFonts } from 'expo-font';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  View,
} from 'react-native';
import {
  BackgroundId,
  getSavedBackgroundId,
  getSelectedBackground,
} from '../utils/backgroundSettings';

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

interface Bookmark {
  surahId: number;
  verseId: number;
}

interface LastPosition {
  surahId: number;
  surahName: string;
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
const NO_BISMILLAH_SURAHS = [9];

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

const SCREEN_WIDTH = Dimensions.get('window').width;
const BOOKMARKS_KEY = 'quran_bookmarks';
const FONT_SIZE_KEY = 'quran_font_size_v2';
const FONT_FAMILY_KEY = 'quran_font_family_v2';
const TASHKEEL_KEY = 'quran_show_tashkeel';
const LAST_POSITION_KEY = 'quran_last_position';
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

const neonGlowShadow = {
  shadowColor: C.neonBlue,
  shadowOpacity: 0.35,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 0 },
  elevation: 4,
};

// أحجام الخط
const FONT_SIZES: { [key: string]: number } = { small: 18, medium: 24, large: 30 };

// خلفيات شاشة قراءة السورة - 8 (5 الأصلية + 3 اللي كانت للصفحة الرئيسية)
const READING_BACKGROUNDS = [
  { id: 'bg_01', label: 'خلفية 1', color: '#0b2a3a', overlayOpacity: 0.55, image: require('../assets/backgrounds/bg_01.jpg') },
  { id: 'bg_02', label: 'خلفية 2', color: '#04202a', overlayOpacity: 0.55, image: require('../assets/backgrounds/bg_02.jpg') },
  { id: 'bg_03', label: 'خلفية 3', color: '#000814', overlayOpacity: 0.6, image: require('../assets/backgrounds/bg_03.jpg') },
  { id: 'bg_04', label: 'خلفية 4', color: '#0a2430', overlayOpacity: 0.55, image: require('../assets/backgrounds/bg_04.jpg') },
  { id: 'bg_05', label: 'خلفية 5', color: '#3a0a0a', overlayOpacity: 0.6, image: require('../assets/backgrounds/bg_05.jpg') },
  { id: 'main_bg_01', label: 'القبة النيونية', color: '#0d1420', overlayOpacity: 0.45, image: require('../assets/backgrounds/main_bg_01.jpg') },
  { id: 'main_bg_02', label: 'المحراب الذهبي', color: '#12141c', overlayOpacity: 0.4, image: require('../assets/backgrounds/main_bg_02.jpg') },
  { id: 'main_bg_03', label: 'فسيفساء رمادية', color: '#1a1a1a', overlayOpacity: 0.55, image: require('../assets/backgrounds/main_bg_03.jpg') },
];

// إزالة رموز التشكيل من النص العربي
const stripTashkeel = (text: string) => text.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');

// سورة الفاتحة: آيتها الأولى هي نص البسملة نفسه، وبما أننا نعرض البسملة كعنوان منفصل
// نشيل تكرارها من بداية نص الآية الأولى فقط لهذي السورة
const getVerseDisplayText = (verse: { surahId: number; id: number; text: string }) => {
  if (verse.surahId === 1 && verse.id === 0) {
    const words = verse.text.trim().split(/\s+/);
    return words.slice(4).join(' ');
  }
  return verse.text;
};

export default function QuranScreen() {
  const [fontsLoaded] = useFonts({
    'Amiri-Regular': require('../assets/fonts/Amiri-Regular.ttf'),
    'Amiri-Bold': require('../assets/fonts/Amiri-Bold.ttf'),
  });
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [fontSizeKey, setFontSizeKey] = useState<'small' | 'medium' | 'large'>('medium');
  const [fontFamilyChoice, setFontFamilyChoice] = useState<'amiri' | 'system'>('amiri');
  const [showTashkeel, setShowTashkeel] = useState(true);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [lastPosition, setLastPosition] = useState<LastPosition | null>(null);
  const [todayCount, setTodayCount] = useState(0);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [readingMode, setReadingMode] = useState(false);

  const [readingBgId, setReadingBgId] = useState('bg_01');
  const [sharedBgId, setSharedBgId] = useState<BackgroundId>('quran');
  const [showSettings, setShowSettings] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);

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
  const readerListRef = useRef<FlatList>(null);
  const [readerAreaHeight, setReaderAreaHeight] = useState(0);

  const allPages = useMemo(() => buildAllPages(surahs), [surahs]);

  const readingBg = READING_BACKGROUNDS.find((b) => b.id === readingBgId) ?? READING_BACKGROUNDS[0];
  const sharedBg = getSelectedBackground(sharedBgId);
  const fontSize = FONT_SIZES[fontSizeKey];
  const activeFontFamily = fontFamilyChoice === 'amiri' ? 'Amiri-Regular' : undefined;

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
      const savedBookmarks = await AsyncStorage.getItem(BOOKMARKS_KEY);
      if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks));

      const savedFontSize = await AsyncStorage.getItem(FONT_SIZE_KEY);
      if (savedFontSize && FONT_SIZES[savedFontSize]) setFontSizeKey(savedFontSize as any);

      const savedFontFamily = await AsyncStorage.getItem(FONT_FAMILY_KEY);
      if (savedFontFamily === 'amiri' || savedFontFamily === 'system') setFontFamilyChoice(savedFontFamily);

      const savedTashkeel = await AsyncStorage.getItem(TASHKEEL_KEY);
      if (savedTashkeel !== null) setShowTashkeel(savedTashkeel === '1');

      const savedLastPosition = await AsyncStorage.getItem(LAST_POSITION_KEY);
      if (savedLastPosition) setLastPosition(JSON.parse(savedLastPosition));

      const savedStats = await AsyncStorage.getItem(STATS_KEY);
      const today = new Date().toISOString().split('T')[0];
      if (savedStats) {
        const stats = JSON.parse(savedStats);
        setTodayCount(stats.date === today ? stats.count : 0);
      }

      const savedReadingBg = await AsyncStorage.getItem(READING_BG_KEY);
      if (savedReadingBg) setReadingBgId(savedReadingBg);

      const seenOnboarding = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!seenOnboarding) setShowOnboarding(true);
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  };

  const openSurah = async (surah: Surah, targetVerseId: number = 1) => {
    setSelectedSurah(surah);
    setReadProgress(0);

    // نجيب رقم الصفحة الصحيح بالمصفوفة الشاملة (كل القرآن) حتى تبدأ القراءة من مكانها الصح
    let targetPage = 0;
    for (let i = 0; i < allPages.length; i++) {
      if (allPages[i].some((v) => v.surahId === surah.id && v.id === targetVerseId)) {
        targetPage = i;
        break;
      }
    }
    setCurrentPageIndex(targetPage);
    // ننتظر رندر الـ FlatList قبل القفز للصفحة المطلوبة
    setTimeout(() => {
      readerListRef.current?.scrollToIndex({ index: targetPage, animated: false });
    }, 50);

    const position: LastPosition = { surahId: surah.id, surahName: surah.name };
    setLastPosition(position);

    try {
      await AsyncStorage.setItem(LAST_POSITION_KEY, JSON.stringify(position));

      const today = new Date().toISOString().split('T')[0];
      const newCount = todayCount + 1;
      setTodayCount(newCount);
      await AsyncStorage.setItem(STATS_KEY, JSON.stringify({ date: today, count: newCount }));
    } catch (error) {
      console.error('Error saving position/stats:', error);
    }
  };

  const openSurahById = (surahId: number, verseId: number = 1) => {
    const s = surahs.find((x) => x.id === surahId);
    if (s) {
      setShowVerseSearch(false);
      openSurah(s, verseId);
    }
  };

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

  const toggleBookmark = async (surahId: number, verseId: number) => {
    const exists = bookmarks.some((b) => b.surahId === surahId && b.verseId === verseId);
    const updated = exists
      ? bookmarks.filter((b) => !(b.surahId === surahId && b.verseId === verseId))
      : [...bookmarks, { surahId, verseId }];

    setBookmarks(updated);
    try {
      await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving bookmark:', error);
    }
  };

  const isBookmarked = (surahId: number, verseId: number) =>
    bookmarks.some((b) => b.surahId === surahId && b.verseId === verseId);

  const changeFontSizeKey = async (key: 'small' | 'medium' | 'large') => {
    setFontSizeKey(key);
    try {
      await AsyncStorage.setItem(FONT_SIZE_KEY, key);
    } catch (error) {
      console.error('Error saving font size:', error);
    }
  };

  const changeFontFamilyChoice = async (choice: 'amiri' | 'system') => {
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

  const getBookmarkDetails = (b: Bookmark) => {
    const surah = surahs.find((s) => s.id === b.surahId);
    const verse = surah?.verses.find((v) => v.id === b.verseId);
    return { surahName: surah?.name || '', verseText: verse?.text || '' };
  };

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', marginTop: 12 }}>جاري التحميل...</Text>
      </View>
    );
  }

  const filteredSurahs = surahs.filter((s) => s.name.includes(searchQuery));

  const getJuzData = (): JuzSection[] => {
    const juzMap: { [key: number]: JuzSection } = {};
    for (let j = 1; j <= 30; j++) {
      juzMap[j] = { juz: j, surahs: [] };
    }

    surahs.forEach((surah) => {
      for (let i = 0; i < JUZ_START_POINTS.length; i++) {
        const current = JUZ_START_POINTS[i];
        const next = JUZ_START_POINTS[i + 1];

        if (surah.id === current.surah) {
          juzMap[current.juz].surahs.push({
            id: surah.id,
            name: surah.name,
            verses: surah.total_verses + ' آية',
          });
          break;
        } else if (surah.id > current.surah && (!next || surah.id < next.surah)) {
          juzMap[current.juz].surahs.push({
            id: surah.id,
            name: surah.name,
            verses: surah.total_verses + ' آية',
          });
          break;
        }
      }
    });

    return Object.values(juzMap).filter((j) => j.surahs.length > 0);
  };

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
        <StatusBar barStyle="light-content" />

        <BlurView intensity={65} tint="dark" style={styles.header}>
          <View style={styles.headerGlass} />
          <View style={styles.headerTopRow}>
            <View style={{ width: 34 }} />
            <Text style={styles.headerTitle}>۞ المصحف الشريف ۞</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => setShowVerseSearch(true)} style={styles.headerIconBtn} activeOpacity={0.75}>
                <Ionicons name="search" size={18} color={C.neonBlue} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowSettings(true)}
                style={styles.headerIconBtn}
                activeOpacity={0.75}
              >
                <Ionicons name="options-outline" size={18} color={C.neonBlue} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => setShowBookmarks(true)} style={styles.headerBtn} activeOpacity={0.7}>
              <Ionicons name="bookmark" size={13} color={C.neonBlue} />
              <Text style={styles.headerBtnText}>المحفوظات</Text>
            </TouchableOpacity>
            <Text style={styles.statsText}>قرأت اليوم {todayCount} سورة</Text>
          </View>
        </BlurView>

        {lastPosition && (
          <TouchableOpacity
            style={styles.lastPositionBanner}
            activeOpacity={0.8}
            onPress={() => {
              const s = surahs.find((s) => s.id === lastPosition.surahId);
              if (s) openSurah(s);
            }}
          >
            <Text style={styles.lastPositionText}>
              استمر من حيث توقفت: سورة {lastPosition.surahName}
            </Text>
          </TouchableOpacity>
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
          <>
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
            <FlatList
              data={filteredSurahs}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.surahCard}
                  onPress={() => openSurah(item)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.surahName}>{item.id}. {item.name}</Text>
                  <Text style={styles.surahInfo}>{item.total_verses} آية</Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}

        {activeTab === 1 && (
          <FlatList
            data={getJuzData()}
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
                    <Text style={styles.juzSurahName}>{surah.id}. {surah.name}</Text>
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
                <BlurView intensity={60} tint="dark" style={styles.modalHeader}>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setSelectedSurah(null)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-forward" size={22} color={C.neonBlue} />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>{allPages[currentPageIndex]?.[0]?.surahName ?? selectedSurah?.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
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

              {/* شريط تقدم القراءة (حسب رقم الصفحة، على مستوى القرآن كامل) */}
              {!readingMode && (
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round(((currentPageIndex + 1) / Math.max(1, allPages.length)) * 100)}%` },
                    ]}
                  />
                </View>
              )}

              <View style={{ flex: 1 }} onLayout={(e) => setReaderAreaHeight(e.nativeEvent.layout.height)}>
                <FlatList<TaggedVerse[]>
                  ref={readerListRef}
                  style={{ flex: 1 }}
                  data={allPages}
                  keyExtractor={(_, idx) => `page-${idx}`}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
                  initialScrollIndex={currentPageIndex}
                  onScrollToIndexFailed={() => {}}
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                    setCurrentPageIndex(idx);
                    setReadProgress((idx + 1) / Math.max(1, allPages.length));
                  }}
                  renderItem={({ item: pageVerses }) => {
                    const firstVerse = pageVerses[0];
                    const pageStartsNewSurah = firstVerse?.id === 1;
                    return (
                      <View style={{ width: SCREEN_WIDTH, height: readerAreaHeight || undefined, flex: readerAreaHeight ? undefined : 1 }}>
                      {/* شارة الجزء - إطار نيوني خفيف بدل الشريط الزجاجي الكامل */}
                      {firstVerse?.juz && (
                        <View style={styles.juzBadge} pointerEvents="none">
                          <Text style={styles.juzBadgeText}>الجزء {firstVerse.juz}</Text>
                        </View>
                      )}

                      {/* لافتة اسم السورة + البسملة - ثابتة أعلى الصفحة إذا السورة تبدأ بأول الصفحة */}
                      {pageStartsNewSurah && (
                        <View style={styles.surahBannerFixed}>
                          <Text style={styles.surahHeaderArabic}>
                            {'سورة ' + firstVerse.surahName}
                          </Text>
                          {!NO_BISMILLAH_SURAHS.includes(firstVerse.surahId) && (
                            <Text style={[styles.bismillah, { fontFamily: activeFontFamily }]}>{BISMILLAH}</Text>
                          )}
                        </View>
                      )}

                      <ScrollView
                        style={styles.versesContainer}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.versesContentCentered}
                      >
                        <Text style={styles.versesFlow}>
                          {pageVerses.map((verse, idx) => (
                            <Text key={`${verse.surahId}-${verse.id}`}>
                              {/* لو سورة جديدة تبدأ بمنتصف الصفحة (مو أول آية بالصفحة) نعرض اللافتة هنا بمكانها */}
                              {verse.id === 1 && idx !== 0 && (
                                <Text>
                                  {'\n'}
                                  <Text style={styles.surahHeaderArabic}>{'سورة ' + verse.surahName}</Text>
                                  {'\n'}
                                  {!NO_BISMILLAH_SURAHS.includes(verse.surahId) && (
                                    <Text style={[styles.bismillah, { fontFamily: activeFontFamily }]}>
                                      {'\n'}{BISMILLAH}{'\n'}
                                    </Text>
                                  )}
                                </Text>
                              )}
                              <Text style={[styles.verseText, { fontSize, fontFamily: activeFontFamily }]}>
                                {showTashkeel ? getVerseDisplayText(verse) : stripTashkeel(getVerseDisplayText(verse))}
                              </Text>
                              <Text
                                style={[
                                  styles.verseNumberInline,
                                  isBookmarked(verse.surahId, verse.id) && styles.verseNumberBookmarked,
                                ]}
                                onPress={() => toggleBookmark(verse.surahId, verse.id)}
                                onLongPress={() =>
                                  setShareVerse({ surahName: verse.surahName, verseId: verse.id, text: verse.text })
                                }
                              >
                                {' '}{'۝'}{verse.id}{' '}
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
                      </ScrollView>

                      {/* شارة الحزب + رقم الصفحة داخل دائرة مزخرفة */}
                      <View style={styles.bottomBadgesRow} pointerEvents="none">
                        {firstVerse?.hizb ? (
                          <View style={styles.hizbBadge}>
                            <Text style={styles.hizbBadgeText}>الحزب {firstVerse.hizb}</Text>
                          </View>
                        ) : <View />}
                        <View style={styles.pageCircle}>
                          <Text style={styles.pageCircleText}>{firstVerse?.page ?? ''}</Text>
                        </View>
                        <View style={{ width: 70 }} />
                      </View>
                    </View>
                  );
                }}
              />
              </View>
            </SafeAreaView>
          </ImageBackground>
        </Modal>

        <Modal
          visible={showBookmarks}
          animationType="slide"
          onRequestClose={() => setShowBookmarks(false)}
          transparent={false}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowBookmarks(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>الآيات المحفوظة</Text>
              <View style={{ width: 40 }} />
            </View>
            <View style={styles.hintBar}>
              <Ionicons name="information-circle-outline" size={15} color="rgba(255,255,255,0.65)" />
              <Text style={styles.hintBarText}>لحفظ آية، اضغط على رقمها أثناء القراءة</Text>
            </View>
            <FlatList
              data={bookmarks}
              keyExtractor={(item, index) => `${item.surahId}-${item.verseId}-${index}`}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const details = getBookmarkDetails(item);
                return (
                  <TouchableOpacity
                    style={styles.bookmarkCard}
                    activeOpacity={0.8}
                    onPress={() => {
                      const s = surahs.find((s) => s.id === item.surahId);
                      if (s) {
                        setShowBookmarks(false);
                        openSurah(s);
                      }
                    }}
                  >
                    <Text style={styles.bookmarkSurahName}>
                      سورة {details.surahName} - آية {item.verseId}
                    </Text>
                    <Text style={styles.bookmarkVerseText} numberOfLines={2}>
                      {details.verseText}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={styles.emptyText}>لا توجد آيات محفوظة بعد</Text>}
            />
          </SafeAreaView>
        </Modal>

        <Modal
          visible={showSettings}
          animationType="fade"
          transparent
          onRequestClose={() => (showBgPicker ? setShowBgPicker(false) : setShowSettings(false))}
        >
          <View style={styles.settingsOverlay}>
            <BlurView intensity={50} tint="dark" style={styles.settingsCard}>
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

                  <Text style={styles.settingsLabel}>نوع الخط</Text>
                  <View style={styles.chipsRow}>
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
          animationType="slide"
          transparent
          onRequestClose={() => setShowVerseSearch(false)}
        >
          <View style={styles.settingsOverlay}>
            <BlurView intensity={50} tint="dark" style={[styles.settingsCard, { maxHeight: '90%' }]}>
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
                <Text style={styles.searchResultsCount}>{verseSearchResults.length} نتيجة{verseSearchResults.length >= 80 ? '+' : ''}</Text>
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
                    <Text style={styles.verseResultHeader}>سورة {item.surahName} - آية {item.verseId}</Text>
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
                style={styles.randomBtn}
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
  container: { flex: 1, backgroundColor: '#0a0e27' },
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
    overflow: 'hidden',
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
  modalContainer: { flex: 1, backgroundColor: '#000' },
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
  surahHeaderArabic: {
    fontSize: 27,
    color: '#fff',
    fontFamily: 'Amiri-Bold',
    textAlign: 'center',
    textShadowColor: C.neonGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  versesContainer: { flex: 1 },
  versesContentCentered: { flexGrow: 1, justifyContent: 'flex-start', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 60 },
  surahBannerFixed: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 10,
  },
  versesFlow: {
    fontSize: 24,
    color: '#e8f0ff',
    lineHeight: 52,
    textAlign: 'center',
    fontFamily: 'Amiri-Regular',
  },
  verseText: {
    color: '#e8f0ff',
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
  randomBtnSecondary: {
    backgroundColor: '#2a3d5d',
  },
  randomBtnText: {
    color: '#0a0e27',
    fontWeight: 'bold',
    fontFamily: 'Amiri-Bold',
  },
  settingsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
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
