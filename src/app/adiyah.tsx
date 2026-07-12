import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState, type ReactElement } from 'react';
import {
  ImageBackground,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

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
const SAHIFA_SECTION = ALL_SECTIONS.find(s => s.id === 'sahifa')!;
const SAHIFA_CATEGORIES: SahifaCategory[] = SAHIFA_SECTION?.categories ?? [];

const FONT_SIZES = [
  { id: 'sm', label: 'صغير',   size: 16 },
  { id: 'md', label: 'متوسط',  size: 20 },
  { id: 'lg', label: 'كبير',   size: 25 },
];

// ===== النوع =====
type ViewState =
  | { screen: 'home' }
  | { screen: 'section'; sectionId: string }
  | { screen: 'sahifa_cats' }
  | { screen: 'sahifa_list'; catId: string }
  | { screen: 'dua'; sectionId: string; index: number; items: any[] };

// ===== المكوّن الرئيسي =====
export default function AdiyahScreen() {
  const { fontScale, backgroundId } = useThemeContext();
  const { width, height } = useWindowDimensions();
  const bgOption  = getSelectedBackground(backgroundId);
  const isTablet  = width >= 700;
  const isDesktop = Platform.OS === 'web' && width > 520;

  const [viewState,     setViewState]     = useState<ViewState>({ screen: 'home' });
  const [fontSizeId,    setFontSizeId]    = useState('md');
  const [fontId,        setFontId]        = useState('system');
  const [tashkeel,      setTashkeel]      = useState(true);
  const [readingMode,   setReadingMode]   = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);

  const scale      = fontScale ?? 1;
  const fontFamily = fontId === 'amiri' ? 'Amiri' : undefined;
  const duaFontSize = (FONT_SIZES.find(f => f.id === fontSizeId)?.size ?? 20) * scale;

  const styles = useMemo(() => createStyles(scale, isTablet), [scale, isTablet]);

  const allSections = ALL_SECTIONS;

  // ===== تجريد التشكيل =====
  const stripTashkeel = (text: string) =>
    text.replace(/[\u064B-\u065F\u0670]/g, '');

  const displayText = (text: string) =>
    tashkeel ? text : stripTashkeel(text);

  // ===== تنقل =====
  const openDua = (items: any[], index: number, sectionId: string) =>
    setViewState({ screen: 'dua', sectionId, index, items });

  const goNext = () => {
    if (viewState.screen !== 'dua') return;
    if (viewState.index < viewState.items.length - 1)
      setViewState({ ...viewState, index: viewState.index + 1 });
  };
  const goPrev = () => {
    if (viewState.screen !== 'dua') return;
    if (viewState.index > 0)
      setViewState({ ...viewState, index: viewState.index - 1 });
  };
  const goBack = () => {
    if (viewState.screen === 'home') return;
    setReadingMode(false);
    if (viewState.screen === 'section')      setViewState({ screen: 'home' });
    else if (viewState.screen === 'sahifa_cats') setViewState({ screen: 'home' });
    else if (viewState.screen === 'sahifa_list') setViewState({ screen: 'sahifa_cats' });
    else if (viewState.screen === 'dua') {
      const sec = allSections.find(s => s.id === viewState.sectionId);
      if (sec?.id === 'sahifa') {
        const cat = SAHIFA_CATEGORIES.find(c => c.items.some(i => i.id === viewState.items[0]?.id));
        if (cat) setViewState({ screen: 'sahifa_list', catId: cat.id });
        else setViewState({ screen: 'sahifa_cats' });
      } else {
        setViewState({ screen: 'section', sectionId: viewState.sectionId });
      }
    }
  };

  const currentDua  = viewState.screen === 'dua' ? viewState.items[viewState.index] : null;
  const currentSec  = viewState.screen === 'dua' ? allSections.find(s => s.id === viewState.sectionId) : null;
  const accentColor = currentSec ? (SECTION_META[currentSec.id]?.color ?? C.neonBlue) : C.neonBlue;
  const hasNext = viewState.screen === 'dua' && viewState.index < viewState.items.length - 1;
  const hasPrev = viewState.screen === 'dua' && viewState.index > 0;

  const headerTitle =
    viewState.screen === 'home'         ? 'الأدعية' :
    viewState.screen === 'sahifa_cats'  ? 'الصحيفة السجادية' :
    viewState.screen === 'sahifa_list'  ? (SAHIFA_CATEGORIES.find(c => c.id === (viewState as any).catId)?.title ?? '') :
    viewState.screen === 'section'      ? (allSections.find(s => s.id === (viewState as any).sectionId)?.title ?? '') :
    viewState.screen === 'dua'          ? (currentDua?.title ?? '') : '';

  // ===== الخلفية مثل التسبيح تماماً =====
  const screenContent = (
    <SafeAreaView style={[styles.container, !bgOption?.image && { backgroundColor: bgOption?.color ?? C.navy }]}>

      {/* الهيدر — يختفي في وضع القراءة */}
      {!readingMode && (
        <View style={styles.header}>
          {viewState.screen !== 'home' ? (
            <TouchableOpacity onPress={goBack} style={styles.headerBtn}>
              <Ionicons name="arrow-forward" size={22} color={C.neonBlue} />
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
            <Ionicons name="options-outline" size={22} color={C.neonBlue} />
          </TouchableOpacity>
        </View>
      )}

      {/* ===== الرئيسية ===== */}
      {viewState.screen === 'home' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.homeContent}>
          {/* بطاقة البسملة */}
          <View style={styles.bismillahCard}>
            <Text style={styles.bismillahCardText}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</Text>
            <Text style={styles.bismillahCardSub}>اختر قسماً للبدء بالدعاء</Text>
          </View>

          {/* ٢. بطاقات أفقية احترافية */}
          {allSections.map(section => {
            const meta  = SECTION_META[section.id] ?? { color: C.neonBlue, icon: 'bookmark-outline', grad: C.glass };
            return (
              <TouchableOpacity
                key={section.id}
                style={styles.sectionCard}
                onPress={() => {
                  if (section.id === 'sahifa') setViewState({ screen: 'sahifa_cats' });
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
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
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

      {/* ===== تصنيفات الصحيفة ===== */}
      {viewState.screen === 'sahifa_cats' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          <View style={[styles.sahifaBanner, { borderColor: SECTION_META.sahifa.color + '55' }]}>
            <Ionicons name="book-outline" size={32} color={SECTION_META.sahifa.color} />
            <Text style={styles.sahifaBannerTitle}>الصحيفة السجادية</Text>
            <Text style={styles.sahifaBannerSub}>الإمام زين العابدين ع • زبور آل محمد</Text>
          </View>
          {SAHIFA_CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.duaListCard, { borderColor: SECTION_META.sahifa.color + '44' }]}
              onPress={() => setViewState({ screen: 'sahifa_list', catId: cat.id })}
              activeOpacity={0.8}
            >
              <View style={[styles.catIconBox, { backgroundColor: SECTION_META.sahifa.color + '22', borderColor: SECTION_META.sahifa.color + '44' }]}>
                <Text style={{ fontSize: 18 }}>{cat.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.duaListTitle}>{cat.title}</Text>
                <Text style={[styles.duaListSub, { color: SECTION_META.sahifa.color }]}>{cat.items.length} دعاء</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={SECTION_META.sahifa.color} />
            </TouchableOpacity>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ===== قائمة أدعية صحيفة ===== */}
      {viewState.screen === 'sahifa_list' && (() => {
        const cat = SAHIFA_CATEGORIES.find(c => c.id === (viewState as any).catId);
        if (!cat) return null;
        const color = SECTION_META.sahifa.color;
        return (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
            {cat.items.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.duaListCard, { borderColor: color + '44' }]}
                onPress={() => openDua(cat.items, index, 'sahifa')}
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

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.duaContent}>

            {/* البسملة */}
            <Text style={[styles.bismillahDua, { color: accentColor, fontFamily }]}>
              بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
            </Text>

            {/* نص الدعاء */}
            <View style={[styles.duaTextCard, { borderColor: accentColor + '44' }]}>
              <Text style={[styles.duaText, { fontSize: duaFontSize, fontFamily }]}>
                {displayText(currentDua.text)}
              </Text>
            </View>

            {/* المصدر */}
            {currentDua.source && !readingMode && (
              <View style={[styles.sourceBox, { borderColor: accentColor + '44' }]}>
                <Ionicons name="book-outline" size={13} color={accentColor} />
                <Text style={[styles.sourceText, { color: accentColor }]}>{currentDua.source}</Text>
              </View>
            )}

            {/* زر وضع القراءة */}
            {!readingMode && (
              <TouchableOpacity style={styles.readingModeBtn} onPress={() => setReadingMode(true)}>
                <Ionicons name="expand-outline" size={16} color={C.neonBlue} />
                <Text style={styles.readingModeBtnText}>وضع القراءة</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 110 }} />
          </ScrollView>

          {/* زر الخروج من وضع القراءة */}
          {readingMode && (
            <TouchableOpacity style={styles.exitReadingBtn} onPress={() => setReadingMode(false)}>
              <Ionicons name="contract-outline" size={18} color={C.white} />
            </TouchableOpacity>
          )}

          {/* أزرار التنقل */}
          <View style={styles.navBar}>
            <TouchableOpacity
              disabled={!hasPrev}
              onPress={goPrev}
              style={[styles.navBtn, !hasPrev && styles.navBtnDisabled, { borderColor: accentColor + '66' }]}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-forward" size={18} color={hasPrev ? accentColor : '#444'} />
              <Text style={[styles.navBtnText, !hasPrev && styles.navBtnTextDisabled]}>السابق</Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={!hasNext}
              onPress={goNext}
              style={[styles.navBtn, styles.navBtnPrimary, !hasNext && styles.navBtnDisabled,
                hasNext ? { backgroundColor: accentColor, borderColor: accentColor } : {}]}
              activeOpacity={0.8}
            >
              <Text style={[styles.navBtnText, hasNext && { color: '#fff' }, !hasNext && styles.navBtnTextDisabled]}>التالي</Text>
              <Ionicons name="chevron-back" size={18} color={hasNext ? '#fff' : '#444'} />
            </TouchableOpacity>
          </View>
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
                onPress={() => setFontSizeId(opt.id)}
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
            {[{ id: 'system', label: 'النظام', preview: 'بِسْمِ الله' },
              { id: 'amiri',  label: 'أميري',  preview: 'بِسْمِ الله' }].map(opt => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.fontOption, fontId === opt.id && styles.fontOptionActive]}
                onPress={() => setFontId(opt.id)}
              >
                <Text style={[styles.fontOptionPreview,
                  { fontFamily: opt.id === 'amiri' ? 'Amiri' : undefined },
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
              onPress={() => setTashkeel(true)}
            >
              <Text style={[styles.toggleText, tashkeel && styles.toggleTextActive]}>بِالتَّشْكِيلِ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleOption, !tashkeel && styles.toggleOptionActive]}
              onPress={() => setTashkeel(false)}
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
      shadowColor: C.neonBlue,
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 0 },
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
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
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
    listContent: { padding: 16 },

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
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 4,
      elevation: 3,
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

    duaContent: { paddingHorizontal: 18, paddingTop: 8 },

    bismillahDua: {
      fontSize: 16 * scale,
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
      top: 50,
      left: 16,
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderWidth: 1, borderColor: C.glassBorder,
      alignItems: 'center', justifyContent: 'center',
      zIndex: 99,
    },

    navBar: {
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      flexDirection: 'row',
      gap: 10,
      padding: 14,
      paddingBottom: 28,
      backgroundColor: 'rgba(28,43,57,0.92)',
      borderTopWidth: 1,
      borderTopColor: C.glassBorder,
    },
    navBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 13,
      borderRadius: 14,
      backgroundColor: C.glass,
      borderWidth: 1.5,
    },
    navBtnPrimary: { borderWidth: 0 },
    navBtnDisabled: { opacity: 0.3, backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' },
    navBtnText: { color: C.white, fontSize: 15 * scale, fontWeight: '600' },
    navBtnTextDisabled: { color: '#555' },

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
