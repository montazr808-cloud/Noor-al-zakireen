import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  BackHandler,
  ImageBackground,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
// ⚠️ SafeAreaView من react-native نفسها ما تشتغل بالاندرويد (بس بالآيفون) — لازم من هذي المكتبة
// (نفس الإصلاح المطبق بـ athkar.tsx و dalil-almutaqeen.tsx)
import { SafeAreaView } from 'react-native-safe-area-context';

import PhoneFrameWrapper from '@/components/PhoneFrameWrapper';
import { useThemeContext } from '@/contexts/theme-contexts';
import { getSelectedBackground } from '@/utils/backgroundSettings';

// ===== باليت =====
const C = {
  navy:        '#1C2B39',
  navyLight:   '#27394A',
  cream:       '#EFE3C8',
  neonBlue:    '#57C8F2',
  neonGlow:    'rgba(87,200,242,0.55)',
  white:       '#FFFFFF',
  glass:       'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(255,255,255,0.22)',
  overlay:     'rgba(28,43,57,0.55)',
  blueDim:     'rgba(63,169,217,0.18)',
};

// ===== ألوان + أيقونات Ionicons للأقسام =====
const SECTION_META: Record<string, { color: string; icon: string; grad: string }> = {
  days:    { color: '#4da8da', icon: 'sunny-outline',       grad: 'rgba(77,168,218,0.18)' },
  general: { color: '#10b981', icon: 'leaf-outline',        grad: 'rgba(16,185,129,0.18)' },
  prayers: { color: '#c9a84c', icon: 'moon-outline',        grad: 'rgba(201,168,76,0.18)'  },
  sahifa:  { color: '#a78bfa', icon: 'book-outline',        grad: 'rgba(167,139,250,0.18)' },
  major:   { color: '#f87171', icon: 'star-outline',        grad: 'rgba(248,113,113,0.18)' },
  ziyarat: { color: '#fb923c', icon: 'location-outline',    grad: 'rgba(251,146,60,0.18)'  },
};

// ===== بيانات الصحيفة السجادية كاملة =====

// ===== بيانات من JSON =====
import ADIYAH_DATA from '@/data/adiyah-data.json';

type DuaItem = { id: string; title: string; source?: string; text: string };
type SahifaCategory = { id: string; title: string; icon: string; items: DuaItem[] };
type Section = {
  id: string; title: string; icon: string; subtitle: string;
  items?: DuaItem[];
  categories?: SahifaCategory[];
};

const ALL_SECTIONS: Section[] = ADIYAH_DATA.sections as Section[];

// أي قسم غير الصحيفة ممكن يجي مقسّم بفئات (categories) بدل قائمة مباشرة (items) —
// مثل قسم الزيارات (عامة / أيام). هذي الدالة تجيب فئات أي قسم بالمعرّف، مو بس الصحيفة
const getSectionCategories = (sectionId: string): SahifaCategory[] =>
  ALL_SECTIONS.find(s => s.id === sectionId)?.categories ?? [];

// أيقونات متناسقة مع أسلوب التطبيق لتصنيفات الصحيفة السجادية (بدل الإيموجي)
const SAHIFA_CAT_ICONS = [
  'book-outline', 'moon-outline', 'heart-outline', 'sunny-outline',
  'star-outline', 'leaf-outline', 'rose-outline', 'shield-checkmark-outline',
  'water-outline', 'flame-outline', 'sparkles-outline', 'flower-outline',
];

const FONT_SIZES = [
  { id: 'sm', label: 'صغير',   size: 16 },
  { id: 'md', label: 'متوسط',  size: 22},
  { id: 'lg', label: 'كبير',   size: 28},
];

// ===== النوع =====
type ViewState =
  | { screen: 'home' }
  | { screen: 'section'; sectionId: string }
  | { screen: 'sahifa_cats'; sectionId: string }
  | { screen: 'sahifa_list'; sectionId: string; catId: string }
  | { screen: 'favorites' }
  | { screen: 'dua'; sectionId: string; index: number; items: any[] };

// ===== المكوّن الرئيسي =====
export default function AdiyahScreen() {
  const { fontScale, backgroundId } = useThemeContext();
  const { width, height } = useWindowDimensions();
  const bgOption  = getSelectedBackground(backgroundId);
  const isTablet  = width >= 700;
  const isDesktop = Platform.OS === 'web' && width > 520;

  const [viewState,     setViewState]     = useState<ViewState>({ screen: 'home' });
  // يتذكر آخر موضع تمرير وصل له المستخدم بكل قائمة أدعية (حسب معرفها) - حتى إذا فتح
  // دعاء بنص القائمة ورجع، يرجعله بنفس المكان بدل ما يرجعه لأول القائمة
  const scrollOffsetsRef = useRef<Record<string, number>>({});
  // مراجع الـ ScrollView الفعلية - نستعملها لنعيد موضع التمرير يدوياً بعد رسم المحتوى
  // (خاصية contentOffset وحدها ما تشتغل بثبات على أندرويد)
  const sectionScrollRef = useRef<ScrollView>(null);
  const sahifaListScrollRef = useRef<ScrollView>(null);
  const [fontSizeId,    setFontSizeId]    = useState('md');
  const [fontId,        setFontId]        = useState('uthmani');
  const [tashkeel,      setTashkeel]      = useState(true);
  const [readingMode,   setReadingMode]   = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [favorites,     setFavorites]     = useState<string[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showFavorites, setShowFavorites]   = useState(false);
  // نسبة السكرول داخل الدعاء المفتوح حالياً (0 إلى 1) - يفيد بالأدعية الطويلة
  // مثل الندبة والناحية المقدسة حتى يعرف القارئ أي مكان وصل بالنص
  const [duaScrollProgress, setDuaScrollProgress] = useState(0);

  const scale      = fontScale ?? 1;
  const fontFamily =
    fontId === 'amiri' ? 'Amiri' :
    fontId === 'uthmani' ? 'UthmanicHafs' : // ⚠️ تأكد الاسم يطابق اسم الخط المسجل بـ useFonts
    undefined;
  const duaFontSize = (FONT_SIZES.find(f => f.id === fontSizeId)?.size ?? 22) * scale;

  const styles = useMemo(() => createStyles(scale, isTablet), [scale, isTablet]);

  // ترتيب الأقسام حسب الأولوية بالاستخدام اليومي: الأيام أول شي (يومية)،
  // بعدها عام، صلوات، الصحيفة، الكبار، وآخرشي الزيارات
  const SECTION_ORDER = ['days', 'general', 'prayers', 'sahifa', 'major', 'ziyarat'];
  const allSections = useMemo(
    () => [...ALL_SECTIONS].sort(
      (a, b) => SECTION_ORDER.indexOf(a.id) - SECTION_ORDER.indexOf(b.id)
    ),
    []
  );

  // ===== قائمة مسطحة لكل الأدعية (للبحث) =====
  type FlatDua = { item: DuaItem; sectionId: string; items: DuaItem[]; index: number };
  const searchableItems = useMemo<FlatDua[]>(() => {
    const list: FlatDua[] = [];
    allSections.forEach(sec => {
      if (sec.items) {
        sec.items.forEach((item, index) => list.push({ item, sectionId: sec.id, items: sec.items!, index }));
      }
      if (sec.categories) {
        sec.categories.forEach(cat => {
          cat.items.forEach((item, index) => list.push({ item, sectionId: sec.id, items: cat.items, index }));
        });
      }
    });
    return list;
  }, [allSections]);

  const normalize = (s: string) => s.replace(/[\u064B-\u065F\u0670]/g, '').trim();
  const searchResults = useMemo(() => {
    const q = normalize(searchQuery);
    if (!q) return [];
    return searchableItems.filter(f => normalize(f.item.title).includes(q)).slice(0, 25);
  }, [searchQuery, searchableItems]);

  // ===== المفضلة + التعليمات الأولى + إعدادات الخط: تحميل من التخزين =====
  useEffect(() => {
    (async () => {
      try {
        const savedFav = await AsyncStorage.getItem('adiyah_favorites');
        if (savedFav) setFavorites(JSON.parse(savedFav));
        const seenOnboarding = await AsyncStorage.getItem('adiyah_onboarding_seen');
        if (!seenOnboarding) setShowOnboarding(true);
        // إعدادات القراءة (نوع الخط، حجمه، التشكيل) - تضل ثابتة بين الجلسات
        // بدل ما ترجع للافتراضي كل ما يفتح المستخدم الشاشة من جديد
        const savedFontId = await AsyncStorage.getItem('adiyah_font_id');
        if (savedFontId) setFontId(savedFontId);
        const savedFontSizeId = await AsyncStorage.getItem('adiyah_font_size_id');
        if (savedFontSizeId) setFontSizeId(savedFontSizeId);
        const savedTashkeel = await AsyncStorage.getItem('adiyah_tashkeel');
        if (savedTashkeel !== null) setTashkeel(savedTashkeel === '1');
      } catch {}
    })();
  }, []);

  // نحفظ فوراً كل ما المستخدم يغيّر أي إعداد قراءة
  const changeFontId = (id: string) => {
    setFontId(id);
    AsyncStorage.setItem('adiyah_font_id', id).catch(() => {});
  };
  const changeFontSizeId = (id: string) => {
    setFontSizeId(id);
    AsyncStorage.setItem('adiyah_font_size_id', id).catch(() => {});
  };
  const changeTashkeel = (value: boolean) => {
    setTashkeel(value);
    AsyncStorage.setItem('adiyah_tashkeel', value ? '1' : '0').catch(() => {});
  };

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    AsyncStorage.setItem('adiyah_onboarding_seen', '1').catch(() => {});
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      AsyncStorage.setItem('adiyah_favorites', JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const favoriteDuas = useMemo(
    () => searchableItems.filter(f => favorites.includes(f.item.id)),
    [searchableItems, favorites]
  );


  const stripTashkeel = (text: string) =>
    text.replace(/[\u064B-\u065F\u0670]/g, '');

  const displayText = (text: string) =>
    tashkeel ? text : stripTashkeel(text);

  // خط "العثماني" مصحفي مخصص لرسم القرآن فقط، وما عنده رسمة لحرف الفاصلة
  // العربية "،" ولا النقطة "."، فيطلعها كدائرة افتراضية (tofu) بدل علامة الترقيم.
  // نفصل علامات الترقيم ونعرضها بخط آخر (بدون fontFamily مخصص) بينما تبقى
  // بقية الكلمات بنفس الخط المختار.
  const renderPunctFixed = (text: string, family: string | undefined, key: string) => {
    const parts = text.split(/([،.])/);
    return parts.map((part, i) =>
      part === '،' || part === '.'
        ? <Text key={`${key}-${i}`} style={{ fontFamily: undefined }}>{part}</Text>
        : <Text key={`${key}-${i}`} style={{ fontFamily: family }}>{part}</Text>
    );
  };

  // أسطر التعليمات ("ثمّ ادخل فانكبّ على القبر وقلْ:"، "روي عن الإمام الصادق ع...:")
  // تنعرض غالباً كسطر مستقل ينتهي بـ ":" قبل نص الدعاء الفعلي. نميّزها بلون ومظهر
  // مختلفين حتى يفرّق القارئ بسهولة بين "افعل كذا" وبين كلام الدعاء نفسه
  const renderDuaText = (text: string, family: string | undefined, accent: string, baseFontSize: number) => {
    const lines = displayText(text).split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <Text key={idx}>{'\n'}</Text>;
      const isInstruction = trimmed.endsWith(':') && trimmed.length < 120;
      if (isInstruction) {
        return (
          <Text key={idx} style={{ color: accent, fontWeight: '700', fontSize: baseFontSize * 0.82 }}>
            {'\n'}{trimmed}{'\n'}
          </Text>
        );
      }
      return (
        <Text key={idx}>
          {renderPunctFixed(trimmed, family, String(idx))}{'\n'}
        </Text>
      );
    });
  };

  // ===== تنقل =====
  const openDua = (items: any[], index: number, sectionId: string) => {
    setDuaScrollProgress(0);
    setViewState({ screen: 'dua', sectionId, index, items });
  };

  const goBack = () => {
    if (viewState.screen === 'home') return;
    setReadingMode(false);
    if (viewState.screen === 'section')      setViewState({ screen: 'home' });
    else if (viewState.screen === 'sahifa_cats') setViewState({ screen: 'home' });
    else if (viewState.screen === 'favorites')   setViewState({ screen: 'home' });
    else if (viewState.screen === 'sahifa_list') setViewState({ screen: 'sahifa_cats', sectionId: viewState.sectionId });
    else if (viewState.screen === 'dua') {
      const sec = allSections.find(s => s.id === viewState.sectionId);
      const cats = sec ? getSectionCategories(sec.id) : [];
      if (cats.length > 0) {
        const cat = cats.find(c => c.items.some(i => i.id === viewState.items[0]?.id));
        if (cat) setViewState({ screen: 'sahifa_list', sectionId: sec!.id, catId: cat.id });
        else setViewState({ screen: 'sahifa_cats', sectionId: sec!.id });
      } else {
        setViewState({ screen: 'section', sectionId: viewState.sectionId });
      }
    }
  };

  const currentDua  = viewState.screen === 'dua' ? viewState.items[viewState.index] : null;
  const currentSec  = viewState.screen === 'dua' ? allSections.find(s => s.id === viewState.sectionId) : null;
  const accentColor = currentSec ? (SECTION_META[currentSec.id]?.color ?? C.neonBlue) : C.neonBlue;

  // ===== زر الرجوع الفيزيائي بالأندرويد (وسحبة الرجوع) - قبل هذا التعديل ما
  // كان مربوط بمنطق goBack إطلاقاً، فيطلع مباشرة من الشاشة كاملة بدل ما يرجع
  // خطوة وحدة بالداخل (نفس مبدأ الإصلاح المطبق أصلاً بـ athkar.tsx) =====
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (viewState.screen === 'home') return false; // نسمح بالسلوك الافتراضي (يطلع من التبويب)
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [viewState]);

  // نص الدعاء بعد تقسيمه وتلوينه (فواصل، أسطر تعليمات...) - عملية شبه ثقيلة على
  // الأدعية الطويلة، فنخزنها بذاكرة مؤقتة (useMemo) حتى ما تتكرر مع كل حركة سكرول
  // (شريط تقدّم القراءة يحدّث الحالة باستمرار أثناء التمرير)
  const renderedDuaText = useMemo(() => {
    if (!currentDua) return null;
    return renderDuaText(currentDua.text, fontFamily, accentColor, duaFontSize);
  }, [currentDua?.id, currentDua?.text, fontFamily, accentColor, duaFontSize, tashkeel]);

  const headerTitle =
    viewState.screen === 'home'         ? 'الأدعية' :
    viewState.screen === 'favorites'    ? 'المفضلة' :
    viewState.screen === 'sahifa_cats'  ? (allSections.find(s => s.id === viewState.sectionId)?.title ?? '') :
    viewState.screen === 'sahifa_list'  ? (getSectionCategories(viewState.sectionId).find(c => c.id === viewState.catId)?.title ?? '') :
    viewState.screen === 'section'      ? (allSections.find(s => s.id === (viewState as any).sectionId)?.title ?? '') :
    viewState.screen === 'dua'          ? (currentDua?.title ?? '') : '';

  // ===== الخلفية مثل التسبيح تماماً =====
  const screenContent = (
    <SafeAreaView style={[styles.container, !bgOption?.image && { backgroundColor: bgOption?.color ?? C.navy }]}>
      <StatusBar hidden={readingMode} style="light" animated />


      {/* الهيدر — يختفي في وضع القراءة */}
      {!readingMode && (
        <View style={styles.header}>
          {viewState.screen !== 'home' ? (
            <TouchableOpacity onPress={goBack} style={styles.headerBtn}>
              <Ionicons name="arrow-forward" size={22} color={accentColor} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 38 }} />
          )}

          {/* ٥. اسم "الأدعية" بخط قرآني وخلفية زجاجية */}
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
          </View>

          {/* ٤. أيقونة إعدادات القراءة */}
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.headerBtn}>
            <Ionicons name="options-outline" size={22} color={accentColor} />
          </TouchableOpacity>
        </View>
      )}

      {/* ===== الرئيسية ===== */}
      {viewState.screen === 'home' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.homeContent} keyboardShouldPersistTaps="handled">
          {/* بطاقة البسملة */}
          <View style={styles.bismillahCard}>
            <Text style={styles.bismillahCardText}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</Text>
            <Text style={styles.bismillahCardSub}>اختر قسماً للبدء بالدعاء</Text>
          </View>

          {/* شريط البحث */}
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.5)" />
            <TextInput
              style={styles.searchInput}
              placeholder="ابحث باسم الدعاء، مثال: دعاء كميل"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              textAlign="right"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            )}
          </View>

          {/* زر المفضلة */}
          {!searchQuery && (
            <TouchableOpacity
              style={styles.favoritesEntry}
              onPress={() => setViewState({ screen: 'favorites' })}
              activeOpacity={0.8}
            >
              <Ionicons name="heart" size={18} color="#f87171" />
              <Text style={styles.favoritesEntryText}>المفضلة</Text>
              <Text style={styles.favoritesEntryCount}>{favorites.length}</Text>
            </TouchableOpacity>
          )}

          {/* نتائج البحث */}
          {searchQuery.length > 0 && (
            <>
              {searchResults.length === 0 ? (
                <Text style={styles.noResultsText}>ما لكيت نتائج لـ "{searchQuery}"</Text>
              ) : (
                searchResults.map(res => (
                  <TouchableOpacity
                    key={res.item.id}
                    style={[styles.duaListCard, { borderColor: (SECTION_META[res.sectionId]?.color ?? C.neonBlue) + '44' }]}
                    onPress={() => openDua(res.items, res.index, res.sectionId)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={(SECTION_META[res.sectionId]?.icon ?? 'bookmark-outline') as any} size={18} color={SECTION_META[res.sectionId]?.color ?? C.neonBlue} />
                    <Text style={styles.duaListTitle}>{res.item.title}</Text>
                    <Ionicons name="chevron-back" size={18} color={SECTION_META[res.sectionId]?.color ?? C.neonBlue} />
                  </TouchableOpacity>
                ))
              )}
              <View style={{ height: 32 }} />
            </>
          )}

          {/* ٢. بطاقات أفقية احترافية */}
          {!searchQuery && allSections.map(section => {
            const meta  = SECTION_META[section.id] ?? { color: C.neonBlue, icon: 'bookmark-outline', grad: C.glass };
            return (
              <TouchableOpacity
                key={section.id}
                style={styles.sectionCard}
                onPress={() => {
                  if (section.categories) setViewState({ screen: 'sahifa_cats', sectionId: section.id });
                  else setViewState({ screen: 'section', sectionId: section.id });
                }}
                activeOpacity={0.8}
              >
                {/* خلفية زجاجية موحدة */}
                <View style={styles.sectionCardGrad} />

                {/* أيقونة Ionicons */}
                <View style={[styles.sectionIconBox, { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.3)' }]}>
                  <Ionicons name={meta.icon as any} size={28} color="rgba(255,255,255,0.9)" />
                </View>

                {/* النص */}
                <View style={styles.sectionCardText}>
                  <Text style={[styles.sectionCardTitle, { color: '#F5E6B8' }]}>{section.title}</Text>
                  <Text style={styles.sectionCardSub}>{section.subtitle}</Text>
                </View>

                {/* سهم */}
                <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ===== قسم عادي ===== */}
      {viewState.screen === 'section' && (() => {
        const sec = allSections.find(s => s.id === viewState.sectionId);
        if (!sec || !sec.items) return null;
        const items = sec.items;
        const meta = SECTION_META[sec.id] ?? { color: C.neonBlue, icon: 'bookmark-outline', grad: C.glass };
        return (
          <ScrollView
            ref={sectionScrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            onScroll={(e) => { scrollOffsetsRef.current[`section:${sec.id}`] = e.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={16}
            onContentSizeChange={() => {
              const saved = scrollOffsetsRef.current[`section:${sec.id}`];
              if (saved) sectionScrollRef.current?.scrollTo({ y: saved, animated: false });
            }}
          >
            {items.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.duaListCard, { borderColor: meta.color + '44' }]}
                onPress={() => openDua(items, index, sec.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.duaNumber, { backgroundColor: meta.color + '22', borderColor: meta.color + '55' }]}>
                  <Text style={[styles.duaNumberText, { color: meta.color }]}>{index + 1}</Text>
                </View>
                <Text style={styles.duaListTitle}>{item.title}</Text>
                <Ionicons name="chevron-back" size={18} color={meta.color} />
              </TouchableOpacity>
            ))}
            <View style={{ height: 32 }} />
          </ScrollView>
        );
      })()}

      {/* ===== المفضلة ===== */}
      {viewState.screen === 'favorites' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {favoriteDuas.length === 0 ? (
            <Text style={styles.noResultsText}>ما ضفت أدعية للمفضلة لحد الآن{'\n'}اضغط على أيقونة القلب داخل أي دعاء</Text>
          ) : (
            favoriteDuas.map(res => (
              <TouchableOpacity
                key={res.item.id}
                style={[styles.duaListCard, { borderColor: (SECTION_META[res.sectionId]?.color ?? C.neonBlue) + '44' }]}
                onPress={() => openDua(res.items, res.index, res.sectionId)}
                activeOpacity={0.8}
              >
                <Ionicons name="heart" size={18} color="#f87171" />
                <Text style={styles.duaListTitle}>{res.item.title}</Text>
                <Ionicons name="chevron-back" size={18} color={SECTION_META[res.sectionId]?.color ?? C.neonBlue} />
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ===== تصنيفات القسم (الصحيفة، الزيارات، ...) ===== */}
      {viewState.screen === 'sahifa_cats' && (() => {
        const sec = allSections.find(s => s.id === viewState.sectionId);
        const cats = getSectionCategories(viewState.sectionId);
        const color = (SECTION_META as any)[viewState.sectionId]?.color ?? SECTION_META.sahifa.color;
        const icon = (SECTION_META as any)[viewState.sectionId]?.icon ?? 'book-outline';
        return (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
            {viewState.sectionId === 'sahifa' && (
              <View style={[styles.sahifaBanner, { borderColor: color + '55' }]}>
                <Ionicons name="book-outline" size={32} color={color} />
                <Text style={styles.sahifaBannerTitle}>الصحيفة السجادية</Text>
                <Text style={styles.sahifaBannerSub}>الإمام زين العابدين ع • زبور آل محمد</Text>
              </View>
            )}
            {cats.map((cat, index) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.duaListCard, { borderColor: color + '44' }]}
                onPress={() => setViewState({ screen: 'sahifa_list', sectionId: viewState.sectionId, catId: cat.id })}
                activeOpacity={0.8}
              >
                <View style={[styles.catIconBox, { backgroundColor: color + '22', borderColor: color + '44' }]}>
                  <Ionicons
                    name={SAHIFA_CAT_ICONS[index % SAHIFA_CAT_ICONS.length] as any}
                    size={18}
                    color={color}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.duaListTitle}>{cat.title}</Text>
                  <Text style={[styles.duaListSub, { color }]}>{cat.items.length} دعاء</Text>
                </View>
                <Ionicons name="chevron-back" size={18} color={color} />
              </TouchableOpacity>
            ))}
            <View style={{ height: 32 }} />
          </ScrollView>
        );
      })()}

      {/* ===== قائمة أدعية فئة داخل قسم (الصحيفة، الزيارات، ...) ===== */}
      {viewState.screen === 'sahifa_list' && (() => {
        const cats = getSectionCategories(viewState.sectionId);
        const cat = cats.find(c => c.id === viewState.catId);
        if (!cat) return null;
        const color = (SECTION_META as any)[viewState.sectionId]?.color ?? SECTION_META.sahifa.color;
        const scrollKey = `${viewState.sectionId}:${cat.id}`;
        return (
          <ScrollView
            ref={sahifaListScrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            onScroll={(e) => { scrollOffsetsRef.current[scrollKey] = e.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={16}
            onContentSizeChange={() => {
              const saved = scrollOffsetsRef.current[scrollKey];
              if (saved) sahifaListScrollRef.current?.scrollTo({ y: saved, animated: false });
            }}
          >
            {cat.items.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.duaListCard, { borderColor: color + '44' }]}
                onPress={() => openDua(cat.items, index, viewState.sectionId)}
                activeOpacity={0.8}
              >
                <View style={[styles.duaNumber, { backgroundColor: color + '22', borderColor: color + '55' }]}>
                  <Text style={[styles.duaNumberText, { color }]}>{index + 1}</Text>
                </View>
                <Text style={styles.duaListTitle}>{item.title}</Text>
                <Ionicons name="chevron-back" size={18} color={color} />
              </TouchableOpacity>
            ))}
            <View style={{ height: 32 }} />
          </ScrollView>
        );
      })()}

      {/* ===== عرض الدعاء ===== */}
      {viewState.screen === 'dua' && currentDua && (
        <>
          {/* شريط التقدم */}
          {!readingMode && (
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, {
                  width: `${((viewState.index + 1) / viewState.items.length) * 100}%` as any,
                  backgroundColor: accentColor,
                }]} />
              </View>
              <Text style={styles.progressText}>{viewState.index + 1} / {viewState.items.length}</Text>
            </View>
          )}

          {/* شريط رفيع يبين أي مكان وصل له القارئ داخل نص الدعاء نفسه - يفيد بالأدعية الطويلة */}
          <View style={styles.readProgressTrack}>
            <View style={[styles.readProgressFill, {
              width: `${duaScrollProgress * 100}%` as any,
              backgroundColor: accentColor,
            }]} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.duaContent}
            scrollEventThrottle={64}
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              const max = contentSize.height - layoutMeasurement.height;
              const raw = max > 0 ? Math.min(1, Math.max(0, contentOffset.y / max)) : 0;
              // نقرّب لأقرب 2% حتى ما نحدّث الحالة (state) على كل بكسل سكرول -
              // هذا يقلل عدد إعادة الرسم (re-renders) بشكل كبير بالأدعية الطويلة
              const rounded = Math.round(raw * 50) / 50;
              setDuaScrollProgress(prev => (prev === rounded ? prev : rounded));
            }}
          >

            {/* البسملة */}
            <Text style={[styles.bismillahDua, { color: accentColor, fontFamily }]}>
              بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
            </Text>

            {/* نص الدعاء */}
            <View style={[styles.duaTextCard, { borderColor: accentColor + '44' }]}>
              <Text style={[styles.duaText, { fontSize: duaFontSize }]}>
                {renderedDuaText}
              </Text>
            </View>

            {/* المصدر */}
            {currentDua.source && !readingMode && (
              <View style={[styles.sourceBox, { borderColor: accentColor + '44' }]}>
                <Ionicons name="book-outline" size={13} color={accentColor} />
                <Text style={[styles.sourceText, { color: accentColor }]}>{currentDua.source}</Text>
              </View>
            )}

            {/* زر المفضلة + وضع القراءة */}
            {!readingMode && (
              <View style={styles.duaActionsRow}>
                <TouchableOpacity
                  style={[styles.readingModeBtn, { flex: 1, borderColor: accentColor + '44' }]}
                  onPress={() => toggleFavorite(currentDua.id)}
                >
                  <Ionicons
                    name={favorites.includes(currentDua.id) ? 'heart' : 'heart-outline'}
                    size={16}
                    color={favorites.includes(currentDua.id) ? '#f87171' : accentColor}
                  />
                  <Text style={[styles.readingModeBtnText, { color: accentColor }]}>
                    {favorites.includes(currentDua.id) ? 'بالمفضلة' : 'أضف للمفضلة'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.readingModeBtn, { flex: 1, borderColor: accentColor + '44' }]}
                  onPress={() => setReadingMode(true)}
                >
                  <Ionicons name="expand-outline" size={16} color={accentColor} />
                  <Text style={[styles.readingModeBtnText, { color: accentColor }]}>وضع القراءة</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>

          {/* زر الخروج من وضع القراءة */}
          {readingMode && (
            <TouchableOpacity style={styles.exitReadingBtn} onPress={() => setReadingMode(false)}>
              <Ionicons name="contract-outline" size={18} color={C.white} />
            </TouchableOpacity>
          )}

        </>
      )}

      {/* ===== Modal الإعدادات — زجاجي مع الخلفية ===== */}
      <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
        <TouchableOpacity style={styles.settingsOverlay} activeOpacity={1} onPress={() => setShowSettings(false)} />
        <View style={styles.settingsSheet}>
          <View style={styles.settingsHandle} />
          <Text style={styles.settingsTitle}>إعدادات القراءة</Text>

          {/* حجم الخط — ٣ خيارات */}
          <Text style={styles.settingsLabel}>حجم الخط</Text>
          <View style={styles.fontSizeRow}>
            {FONT_SIZES.map(opt => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.fontSizeOption, fontSizeId === opt.id && styles.fontSizeOptionActive]}
                onPress={() => changeFontSizeId(opt.id)}
              >
                <Text style={[styles.fontSizeOptionText, { fontSize: opt.size * 0.7 }, fontSizeId === opt.id && styles.fontSizeOptionTextActive]}>
                  أ
                </Text>
                <Text style={[styles.fontSizeLabel, fontSizeId === opt.id && styles.fontSizeOptionTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* نوع الخط */}
          <Text style={styles.settingsLabel}>نوع الخط</Text>
          <View style={styles.fontRow}>
            {[{ id: 'system',  label: 'النظام',  preview: 'بِسْمِ الله' },
              { id: 'amiri',   label: 'أميري',   preview: 'بِسْمِ الله' },
              { id: 'uthmani', label: 'عثماني',  preview: 'بِسْمِ الله' }].map(opt => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.fontOption, fontId === opt.id && styles.fontOptionActive]}
                onPress={() => changeFontId(opt.id)}
              >
                <Text style={[styles.fontOptionPreview,
                  { fontFamily: opt.id === 'amiri' ? 'Amiri' : opt.id === 'uthmani' ? 'UthmanicHafs' : undefined },
                  fontId === opt.id && { color: C.neonBlue }]}>
                  {opt.preview}
                </Text>
                <Text style={[styles.fontOptionLabel, fontId === opt.id && { color: C.neonBlue }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* التشكيل */}
          <Text style={styles.settingsLabel}>التشكيل</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleOption, tashkeel && styles.toggleOptionActive]}
              onPress={() => changeTashkeel(true)}
            >
              <Text style={[styles.toggleText, tashkeel && styles.toggleTextActive]}>بِالتَّشْكِيلِ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleOption, !tashkeel && styles.toggleOptionActive]}
              onPress={() => changeTashkeel(false)}
            >
              <Text style={[styles.toggleText, !tashkeel && styles.toggleTextActive]}>بدون تشكيل</Text>
            </TouchableOpacity>
          </View>

          {/* معاينة */}
          <View style={styles.previewBox}>
            <Text style={[styles.previewText, { fontSize: duaFontSize * 0.85, fontFamily }]}>
              {displayText('اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَآلِهِ')}
            </Text>
          </View>

          <TouchableOpacity style={styles.doneBtn} onPress={() => setShowSettings(false)}>
            <Text style={styles.doneBtnText}>تم</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ===== تعليمات أول استخدام ===== */}
      <Modal visible={showOnboarding} transparent animationType="fade" onRequestClose={dismissOnboarding}>
        <View style={styles.onboardingOverlay}>
          <View style={styles.onboardingCard}>
            <Text style={styles.onboardingTitle}>مرحباً بك في قسم الأدعية</Text>

            <View style={styles.onboardingRow}>
              <Ionicons name="search-outline" size={20} color={C.neonBlue} />
              <Text style={styles.onboardingRowText}>
                استعمل شريط البحث أعلى الصفحة للوصول مباشرة إلى أي دعاء عبر كتابة اسمه.
              </Text>
            </View>

            <View style={styles.onboardingRow}>
              <Ionicons name="heart-outline" size={20} color={C.neonBlue} />
              <Text style={styles.onboardingRowText}>
                اضغط على أيقونة القلب داخل الدعاء لإضافته إلى المفضلة، والرجوع إليه لاحقاً من الصفحة الرئيسية.
              </Text>
            </View>

            <View style={styles.onboardingRow}>
              <Ionicons name="expand-outline" size={20} color={C.neonBlue} />
              <Text style={styles.onboardingRowText}>
                فعّل وضع القراءة لعرض نص الدعاء بشاشة كاملة خالية من المشتتات.
              </Text>
            </View>

            <View style={styles.onboardingRow}>
              <Ionicons name="options-outline" size={20} color={C.neonBlue} />
              <Text style={styles.onboardingRowText}>
                من أيقونة الإعدادات أعلى الصفحة يمكنك تغيير حجم الخط ونوعه وإظهار التشكيل أو إخفاؤه.
              </Text>
            </View>

            <TouchableOpacity style={styles.onboardingBtn} onPress={dismissOnboarding}>
              <Text style={styles.onboardingBtnText}>حسناً، فهمت</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );

  // ===== إطار الهاتف (موحّد بكل الشاشات عبر PhoneFrameWrapper المشترك) =====
  const wrapInFrame = (node: ReactElement) => <PhoneFrameWrapper>{node}</PhoneFrameWrapper>;

  // ===== الخلفية مثل التسبيح =====
  if (bgOption?.image) {
    return wrapInFrame(
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
  return wrapInFrame(screenContent);
}

// ===== الستايلات =====
function createStyles(scale: number, isTablet: boolean) {
  return StyleSheet.create({
    container:   { flex: 1 },
    bgFill:      { flex: 1 },
    bgImage:     { flex: 1, width: '100%', height: '100%' },
    bgImageFull: { width: '100%', height: '100%' },
    bgOverlay:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },

    // ===== هيدر =====
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.glassBorder,
    },
    headerBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: C.glass,
      borderWidth: 1, borderColor: C.glassBorder,
      alignItems: 'center', justifyContent: 'center',
    },
    // ٥. صندوق العنوان بخلفية زجاجية وخط قرآني
    headerTitleBox: {
      flex: 1,
      marginHorizontal: 10,
      backgroundColor: 'rgba(255,255,255,0.07)',
      borderWidth: 1,
      borderColor: 'rgba(212,175,95,0.35)',
      borderRadius: 14,
      paddingVertical: 7,
      paddingHorizontal: 12,
      alignItems: 'center',
    },
    headerTitle: {
      color: '#F5E6B8',
      fontSize: 22 * scale,
      fontWeight: '700',
      fontFamily: 'Amiri',
      textAlign: 'center',
      letterSpacing: 1.5,
      textShadowColor: 'rgba(212,175,95,0.7)',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 14,
    },

    // ===== الرئيسية =====
    homeContent: { padding: 16, paddingTop: 12 },

    bismillahCard: {
      backgroundColor: C.glass,
      borderWidth: 1.5,
      borderColor: C.neonBlue + '55',
      borderRadius: 20,
      padding: 18,
      alignItems: 'center',
      marginBottom: 16,
    },
    bismillahCardText: {
      color: C.cream,
      fontSize: 17 * scale,
      fontFamily: 'Amiri',
      textAlign: 'center',
      marginBottom: 4,
    },
    bismillahCardSub: {
      color: 'rgba(255,255,255,0.45)',
      fontSize: 12 * scale,
      textAlign: 'center',
    },

    // شريط البحث
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.glass,
      borderWidth: 1.5,
      borderColor: C.glassBorder,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 12 : 6,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      color: C.white,
      fontSize: 14 * scale,
    },
    noResultsText: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: 13 * scale,
      textAlign: 'center',
      marginTop: 24,
      lineHeight: 22,
    },

    // زر المفضلة السريع
    favoritesEntry: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(248,113,113,0.12)',
      borderWidth: 1.5,
      borderColor: 'rgba(248,113,113,0.35)',
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 16,
    },
    favoritesEntryText: {
      color: C.white,
      fontSize: 14 * scale,
      fontWeight: '600',
      flex: 1,
    },
    favoritesEntryCount: {
      color: '#f87171',
      fontSize: 13 * scale,
      fontWeight: 'bold',
    },

    duaActionsRow: {
      flexDirection: 'row',
      gap: 8,
    },

    // ===== تعليمات أول استخدام =====
    onboardingOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    onboardingCard: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: 'rgba(28,43,57,0.92)',
      borderWidth: 1.5,
      borderColor: C.glassBorder,
      borderRadius: 22,
      padding: 22,
    },
    onboardingTitle: {
      color: C.cream,
      fontSize: 18 * scale,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 14,
      fontFamily: 'Amiri',
    },
    onboardingRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 14,
    },
    onboardingRowText: {
      flex: 1,
      color: 'rgba(255,255,255,0.85)',
      fontSize: 13.5 * scale,
      lineHeight: 21,
      textAlign: 'right',
    },
    onboardingBtn: {
      backgroundColor: C.neonBlue,
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: 'center',
      marginTop: 6,
    },
    onboardingBtnText: {
      color: '#fff',
      fontSize: 15 * scale,
      fontWeight: 'bold',
    },

    // ٢. بطاقات أفقية
    sectionCard: {
      backgroundColor: 'rgba(255,255,255,0.13)',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 14,
      gap: 14,
      overflow: 'hidden',
    },
    sectionCardGrad: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    sectionIconBox: {
      width: 54, height: 54, borderRadius: 16,
      borderWidth: 1.5,
      alignItems: 'center', justifyContent: 'center',
    },
    sectionCardText: { flex: 1 },
    sectionCardTitle: {
      fontSize: 16 * scale,
      fontWeight: 'bold',
      marginBottom: 4,
      fontFamily: 'Amiri',
    },
    sectionCardSub: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: 12 * scale,
    },

    // ===== القوائم =====
    listContent: { padding: 16, paddingBottom: 100 },

    duaListCard: {
      backgroundColor: C.glass,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 14,
      marginBottom: 10,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    duaNumber: {
      width: 34, height: 34, borderRadius: 17,
      borderWidth: 1,
      alignItems: 'center', justifyContent: 'center',
    },
    duaNumberText: { fontSize: 13 * scale, fontWeight: 'bold' },
    duaListTitle: {
      color: C.white,
      fontSize: 15 * scale,
      fontWeight: '600',
      flex: 1,
      textAlign: 'right',
      fontFamily: 'Amiri',
    },
    duaListSub: { fontSize: 11 * scale, marginTop: 2 },

    // ===== الصحيفة =====
    sahifaBanner: {
      backgroundColor: C.glass,
      borderRadius: 18,
      padding: 18,
      alignItems: 'center',
      borderWidth: 1.5,
      marginBottom: 16,
      gap: 6,
    },
    sahifaBannerTitle: {
      color: C.cream,
      fontSize: 20 * scale,
      fontWeight: 'bold',
      fontFamily: 'Amiri',
    },
    sahifaBannerSub: {
      color: SECTION_META.sahifa.color,
      fontSize: 12 * scale,
    },
    catIconBox: {
      width: 40, height: 40, borderRadius: 20,
      borderWidth: 1,
      alignItems: 'center', justifyContent: 'center',
    },

    // ===== عرض الدعاء =====
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 10,
    },
    progressTrack: {
      flex: 1, height: 3,
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderRadius: 2, overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 2 },
    progressText: { color: 'rgba(255,255,255,0.4)', fontSize: 12 * scale },

    // شريط رفيع جداً (يختلف عن شريط ترتيب الدعاء بالقائمة) يبين نسبة القراءة
    // داخل نص الدعاء الحالي نفسه
    readProgressTrack: {
      height: 2,
      backgroundColor: 'rgba(255,255,255,0.08)',
      overflow: 'hidden',
    },
    readProgressFill: { height: '100%' },

    duaContent: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 170 },

    bismillahDua: {
      fontSize: 20 * scale,
      textAlign: 'center',
      marginBottom: 16,
      fontWeight: '700',
      fontFamily: 'Amiri',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
    },

    duaTextCard: {
      backgroundColor: C.glass,
      borderWidth: 1,
      borderRadius: 20,
      padding: 20,
      marginBottom: 12,
    },
    duaText: {
      color: C.cream,
      lineHeight: 38,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    sourceBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.glass,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 9,
      marginBottom: 10,
    },
    sourceText: { fontSize: 13 * scale, fontWeight: '500' },

    readingModeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: C.glass,
      borderWidth: 1,
      borderColor: C.glassBorder,
      borderRadius: 12,
      paddingVertical: 10,
      marginBottom: 6,
    },
    readingModeBtnText: {
      color: C.neonBlue,
      fontSize: 13 * scale,
      fontWeight: '600',
    },

    exitReadingBtn: {
      position: 'absolute',
      top: 20,
      left: 16,
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderWidth: 1, borderColor: C.glassBorder,
      alignItems: 'center', justifyContent: 'center',
      zIndex: 99,
    },

    // ===== إعدادات زجاجية =====
    settingsOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    settingsSheet: {
      backgroundColor: 'rgba(20,35,50,0.72)',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingBottom: 44,
      borderTopWidth: 1.5,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
    },
    settingsHandle: {
      width: 40, height: 4,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 18,
    },
    settingsTitle: {
      color: C.white,
      fontSize: 18 * scale,
      fontWeight: 'bold',
      textAlign: 'center',
      fontFamily: 'Amiri',
      marginBottom: 22,
    },
    settingsLabel: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: 12 * scale,
      marginBottom: 10,
      textAlign: 'right',
      letterSpacing: 0.5,
    },

    // حجم الخط — ٣ خيارات
    fontSizeRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 20,
      justifyContent: 'center',
    },
    fontSizeOption: {
      flex: 1,
      backgroundColor: C.glass,
      borderWidth: 1.5,
      borderColor: C.glassBorder,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      gap: 4,
    },
    fontSizeOptionActive: {
      backgroundColor: 'rgba(87,200,242,0.15)',
      borderColor: C.neonBlue,
    },
    fontSizeOptionText: {
      color: 'rgba(255,255,255,0.7)',
      fontWeight: 'bold',
    },
    fontSizeOptionTextActive: { color: C.neonBlue },
    fontSizeLabel: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: 11 * scale,
    },

    // نوع الخط
    fontRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 20,
    },
    fontOption: {
      flex: 1,
      backgroundColor: C.glass,
      borderWidth: 1.5,
      borderColor: C.glassBorder,
      borderRadius: 16,
      paddingVertical: 12,
      alignItems: 'center',
      gap: 4,
    },
    fontOptionActive: {
      backgroundColor: 'rgba(87,200,242,0.15)',
      borderColor: C.neonBlue,
    },
    fontOptionPreview: {
      color: C.cream,
      fontSize: 18 * scale,
    },
    fontOptionLabel: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: 11 * scale,
    },

    // التشكيل
    toggleRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 20,
    },
    toggleOption: {
      flex: 1,
      backgroundColor: C.glass,
      borderWidth: 1.5,
      borderColor: C.glassBorder,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
    },
    toggleOptionActive: {
      backgroundColor: 'rgba(87,200,242,0.15)',
      borderColor: C.neonBlue,
    },
    toggleText: {
      color: 'rgba(255,255,255,0.55)',
      fontSize: 14 * scale,
      fontFamily: 'Amiri',
    },
    toggleTextActive: { color: C.neonBlue },

    // معاينة
    previewBox: {
      backgroundColor: C.glass,
      borderRadius: 14,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: C.glassBorder,
      minHeight: 60,
      justifyContent: 'center',
    },
    previewText: {
      color: C.cream,
      textAlign: 'center',
      lineHeight: 32,
      fontWeight: '500',
    },

    doneBtn: {
      backgroundColor: C.neonBlue,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
    },
    doneBtnText: { color: '#fff', fontSize: 16 * scale, fontWeight: 'bold' },
  });
}