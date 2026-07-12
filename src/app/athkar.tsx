import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  ImageBackground,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import PhoneFrameWrapper from '@/components/PhoneFrameWrapper';
import { useThemeContext } from '@/contexts/theme-contexts';
import { getSelectedBackground } from '@/utils/backgroundSettings';

// ===== باليت =====
const C = {
  navy: '#1C2B39',
  cream: '#EFE3C8',
  neonBlue: '#57C8F2',
  neonGold: '#F5D98A',
  white: '#FFFFFF',
  glass: 'rgba(255,255,255,0.16)',
  glassStrong: 'rgba(255,255,255,0.22)',
  glassBorder: 'rgba(255,255,255,0.30)',
};

type Dhikr = { id: string; text: string; repeat: number; fadl?: string };
type SubSection = { id: string; title: string; icon: string; color: string; time: string; items: Dhikr[] };
type TopSection = {
  id: string;
  title: string;
  icon: string;
  color: string;
  kind: 'group' | 'flat' | 'occasions';
  reason: string;
  subs?: SubSection[];
  items?: Dhikr[];
};

// ===== البيانات =====
const SECTIONS: TopSection[] = [
  {
    id: 'today',
    title: 'أذكار اليوم',
    icon: 'sunny-outline',
    color: '#c9a84c',
    kind: 'group',
    reason: 'وردك اليومي الثابت — صباح ومساء ونوم، يحفظ يومك من أوله لآخره.',
    subs: [
      {
        id: 'morning', title: 'أذكار الصباح', icon: 'sunny-outline', color: '#c9a84c', time: 'بعد صلاة الفجر',
        items: [
          { id: 'm1', text: 'آية الكرسي\n﴿اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ...﴾', repeat: 1 },
          { id: 'm2', text: 'قُلْ هُوَ اللَّهُ أَحَدٌ (سورة الإخلاص)', repeat: 3 },
          { id: 'm3', text: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ (سورة الفلق)', repeat: 3 },
          { id: 'm4', text: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ (سورة الناس)', repeat: 3 },
          { id: 'm5', text: 'اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ', repeat: 1 },
        ],
      },
      {
        id: 'evening', title: 'أذكار المساء', icon: 'partly-sunny-outline', color: '#4da8da', time: 'بعد صلاة العصر',
        items: [
          { id: 'e1', text: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ', repeat: 1 },
          { id: 'e2', text: 'آية الكرسي\n﴿اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ...﴾', repeat: 1 },
          { id: 'e3', text: 'قُلْ هُوَ اللَّهُ أَحَدٌ (سورة الإخلاص)', repeat: 3 },
          { id: 'e4', text: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ (سورة الفلق)', repeat: 3 },
          { id: 'e5', text: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ (سورة الناس)', repeat: 3 },
        ],
      },
      {
        id: 'sleep', title: 'أذكار النوم', icon: 'moon-outline', color: '#7c5cbf', time: 'عند النوم',
        items: [
          { id: 's1', text: 'بِاسْمِكَ رَبِّي وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ، فَإِنْ أَمْسَكْتَ نَفْسِي فَارْحَمْهَا، وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِمَا تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ', repeat: 1 },
          { id: 's2', text: 'سُبْحَانَ اللَّهِ', repeat: 33 },
          { id: 's3', text: 'الْحَمْدُ لِلَّهِ', repeat: 33 },
          { id: 's4', text: 'اللَّهُ أَكْبَرُ', repeat: 34 },
        ],
      },
    ],
  },
  {
    id: 'salah',
    title: 'أذكار الصلاة',
    icon: 'business-outline',
    color: '#10b981',
    kind: 'group',
    reason: 'تعقيبات وأذكار مرتبطة بالصلاة المفروضة، تثبّت أثرها بعد كل ركعة.',
    subs: [
      {
        id: 'taqibat', title: 'التعقيبات المشتركة', icon: 'hand-left-outline', color: '#10b981', time: 'بعد كل فريضة',
        items: [
          { id: 't1', text: 'سُبْحَانَ اللَّهِ', repeat: 34 },
          { id: 't2', text: 'الْحَمْدُ لِلَّهِ', repeat: 33 },
          { id: 't3', text: 'اللَّهُ أَكْبَرُ', repeat: 33 },
          { id: 't4', text: 'آية الكرسي\n﴿اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ...﴾', repeat: 1 },
        ],
      },
      {
        id: 'kahf', title: 'سورة الكهف', icon: 'book-outline', color: '#2fae8f', time: 'صباح يوم الجمعة',
        items: [
          { id: 'k1', text: 'تلاوة سورة الكهف كاملة', repeat: 1, fadl: 'من قرأها يوم الجمعة أضاء له من النور ما بين الجمعتين' },
        ],
      },
    ],
  },
  {
    id: 'occasions',
    title: 'أذكار المناسبات',
    icon: 'calendar-outline',
    color: '#e07856',
    kind: 'occasions',
    reason: 'أدعية وأذكار خاصة بأيام ومناسبات هجرية شيعية محددة، تربطك بالتقويم الإسلامي.',
    items: [
      { id: 'o1', text: 'دعاء يوم الجمعة (دعاء كميل)', repeat: 1, fadl: 'يُستحب قراءته ليلة الجمعة' },
      { id: 'o2', text: 'دعاء يوم عرفة للإمام الحسين ع', repeat: 1, fadl: 'من أعظم أدعية يوم عرفة' },
      { id: 'o3', text: 'زيارة عاشوراء', repeat: 1, fadl: 'تُقرأ يوم عاشوراء وأيام محرم' },
      { id: 'o4', text: 'دعاء الندبة', repeat: 1, fadl: 'يُستحب في الأعياد الأربعة وكل جمعة' },
    ],
  },
];

const FAV_KEY = '@athkar_favorites_v1';
const COUNT_KEY = '@athkar_counts_v4';
const FONT_KEY = '@athkar_font_scale_v1';
const ORDER_KEY = '@athkar_section_order_v1';

function findItem(id: string): { item: Dhikr; color: string; parentTitle: string } | null {
  for (const sec of SECTIONS) {
    if (sec.items) {
      const found = sec.items.find(i => i.id === id);
      if (found) return { item: found, color: sec.color, parentTitle: sec.title };
    }
    if (sec.subs) {
      for (const sub of sec.subs) {
        const found = sub.items.find(i => i.id === id);
        if (found) return { item: found, color: sub.color, parentTitle: sub.title };
      }
    }
  }
  return null;
}

type ViewState =
  | { screen: 'home' }
  | { screen: 'subs'; sectionId: string }
  | { screen: 'list'; color: string; title: string; items: Dhikr[] }
  | { screen: 'favorites' };

export default function AthkarScreen() {
  const { backgroundId } = useThemeContext();
  const bgOption = getSelectedBackground(backgroundId);

  const [fontScale, setFontScale] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [order, setOrder] = useState<string[]>(SECTIONS.map(s => s.id));
  const [viewState, setViewState] = useState<ViewState>({ screen: 'home' });

  const styles = useMemo(() => createStyles(fontScale), [fontScale]);

  useEffect(() => {
    AsyncStorage.getItem(FAV_KEY).then(raw => raw && setFavorites(JSON.parse(raw)));
    AsyncStorage.getItem(COUNT_KEY).then(raw => raw && setCounts(JSON.parse(raw)));
    AsyncStorage.getItem(FONT_KEY).then(raw => raw && setFontScale(JSON.parse(raw)));
    AsyncStorage.getItem(ORDER_KEY).then(raw => raw && setOrder(JSON.parse(raw)));
  }, []);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      AsyncStorage.setItem(FAV_KEY, JSON.stringify(next));
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const bump = (id: string, max: number) => {
    setCounts(prev => {
      const current = prev[id] ?? 0;
      const next = { ...prev, [id]: current >= max ? 0 : current + 1 };
      AsyncStorage.setItem(COUNT_KEY, JSON.stringify(next));
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const changeFontScale = (v: number) => {
    setFontScale(v);
    AsyncStorage.setItem(FONT_KEY, JSON.stringify(v));
  };

  const moveSection = (id: string, dir: -1 | 1) => {
    setOrder(prev => {
      const i = prev.indexOf(id);
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      AsyncStorage.setItem(ORDER_KEY, JSON.stringify(next));
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const orderedSections = order.map(id => SECTIONS.find(s => s.id === id)!).filter(Boolean);

  const favItems = favorites.map(id => findItem(id)).filter(Boolean) as { item: Dhikr; color: string; parentTitle: string }[];

  // ===== المحتوى =====
  const screenContent = (
    <SafeAreaView style={[styles.container, !bgOption?.image && { backgroundColor: bgOption?.color ?? C.navy }]}>
      {/* الهيدر */}
      <View style={styles.header}>
        {viewState.screen !== 'home' ? (
          <TouchableOpacity onPress={() => setViewState({ screen: 'home' })} style={styles.headerBtn}>
            <Ionicons name="arrow-forward" size={22} color={C.neonBlue} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 38 }} />
        )}
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {viewState.screen === 'home' && 'الأذكار'}
            {viewState.screen === 'subs' && SECTIONS.find(s => s.id === viewState.sectionId)?.title}
            {viewState.screen === 'list' && viewState.title}
            {viewState.screen === 'favorites' && 'المفضلة'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setSettingsOpen(true)} style={styles.headerBtn}>
          <Ionicons name="options-outline" size={22} color={C.neonBlue} />
        </TouchableOpacity>
      </View>

      {/* ===== الرئيسية ===== */}
      {viewState.screen === 'home' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.homeContent}>
          {/* المفضلة كقسم ثابت بالأعلى */}
          <TouchableOpacity style={styles.favSection} activeOpacity={0.85} onPress={() => setViewState({ screen: 'favorites' })}>
            <View style={[styles.sectionIconBox, { borderColor: '#e8546655', backgroundColor: '#e854661c' }]}>
              <Ionicons name="heart" size={24} color="#e85466" />
            </View>
            <View style={styles.sectionCardText}>
              <Text style={[styles.sectionCardTitle, { color: '#F5E6B8' }]}>المفضلة</Text>
              <Text style={styles.sectionCardSub}>{favorites.length > 0 ? `${favorites.length} ذكر محفوظ` : 'احفظ أذكارك المهمة هنا'}</Text>
            </View>
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>

          {orderedSections.map((sec, idx) => (
            <View key={sec.id} style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.sectionCardInner}
                activeOpacity={0.8}
                onPress={() => {
                  if (sec.kind === 'group') setViewState({ screen: 'subs', sectionId: sec.id });
                  else setViewState({ screen: 'list', color: sec.color, title: sec.title, items: sec.items! });
                }}
              >
                <View style={[styles.sectionIconBox, { borderColor: sec.color + '55', backgroundColor: sec.color + '1c' }]}>
                  <Ionicons name={sec.icon as any} size={26} color={sec.color} />
                </View>
                <View style={styles.sectionCardText}>
                  <Text style={[styles.sectionCardTitle, { color: '#F5E6B8' }]}>{sec.title}</Text>
                  <Text style={styles.sectionCardSub} numberOfLines={2}>{sec.reason}</Text>
                </View>
                <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>

              <View style={styles.reorderRow}>
                <TouchableOpacity disabled={idx === 0} onPress={() => moveSection(sec.id, -1)} style={[styles.reorderBtn, idx === 0 && { opacity: 0.25 }]}>
                  <Ionicons name="chevron-up" size={15} color={C.cream} />
                </TouchableOpacity>
                <TouchableOpacity disabled={idx === orderedSections.length - 1} onPress={() => moveSection(sec.id, 1)} style={[styles.reorderBtn, idx === orderedSections.length - 1 && { opacity: 0.25 }]}>
                  <Ionicons name="chevron-down" size={15} color={C.cream} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ===== الأقسام الفرعية (مثل: داخل أذكار اليوم) ===== */}
      {viewState.screen === 'subs' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.homeContent}>
          {SECTIONS.find(s => s.id === viewState.sectionId)?.subs?.map(sub => (
            <TouchableOpacity
              key={sub.id}
              style={[styles.sectionCard, { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14 }]}
              activeOpacity={0.8}
              onPress={() => setViewState({ screen: 'list', color: sub.color, title: sub.title, items: sub.items })}
            >
              <View style={[styles.sectionIconBox, { borderColor: sub.color + '55', backgroundColor: sub.color + '1c' }]}>
                <Ionicons name={sub.icon as any} size={26} color={sub.color} />
              </View>
              <View style={styles.sectionCardText}>
                <Text style={[styles.sectionCardTitle, { color: '#F5E6B8' }]}>{sub.title}</Text>
                <Text style={styles.sectionCardSub}>{sub.time}</Text>
              </View>
              <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ===== قائمة الأذكار النهائية ===== */}
      {viewState.screen === 'list' && (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {viewState.items.map(item => (
            <DhikrCard
              key={item.id}
              item={item}
              color={viewState.color}
              count={counts[item.id] ?? 0}
              isFav={favorites.includes(item.id)}
              onTap={() => item.repeat > 1 && bump(item.id, item.repeat)}
              onFav={() => toggleFavorite(item.id)}
              styles={styles}
            />
          ))}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}

      {/* ===== المفضلة ===== */}
      {viewState.screen === 'favorites' && (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {favItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={40} color="rgba(255,255,255,0.25)" />
              <Text style={styles.emptyText}>ما أضفت أي ذكر للمفضلة بعد</Text>
            </View>
          ) : (
            favItems.map(({ item, color, parentTitle }) => (
              <View key={item.id}>
                <Text style={styles.favParentLabel}>{parentTitle}</Text>
                <DhikrCard
                  item={item}
                  color={color}
                  count={counts[item.id] ?? 0}
                  isFav
                  onTap={() => item.repeat > 1 && bump(item.id, item.repeat)}
                  onFav={() => toggleFavorite(item.id)}
                  styles={styles}
                />
              </View>
            ))
          )}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}

      {/* ===== مودال الإعدادات الخاصة بالأذكار ===== */}
      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setSettingsOpen(false)}>
          <View style={styles.settingsSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.settingsTitle}>إعدادات الأذكار</Text>

            <Text style={styles.settingsLabel}>حجم الخط</Text>
            <View style={styles.fontRow}>
              {[0.85, 1, 1.15, 1.3].map(v => (
                <TouchableOpacity
                  key={v}
                  style={[styles.fontOption, fontScale === v && { borderColor: C.neonBlue, backgroundColor: C.neonBlue + '22' }]}
                  onPress={() => changeFontScale(v)}
                >
                  <Text style={[styles.fontOptionText, { fontSize: 13 * v }]}>أ</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.settingsHint}>ترتيب الأقسام يتغير بالأسهم بجانب كل قسم بالصفحة الرئيسية.</Text>

            <TouchableOpacity style={styles.settingsClose} onPress={() => setSettingsOpen(false)}>
              <Text style={styles.settingsCloseText}>تم</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );

  const wrapInFrame = (node: ReactElement) => <PhoneFrameWrapper>{node}</PhoneFrameWrapper>;

  if (bgOption?.image) {
    return wrapInFrame(
      <View style={[styles.bgFill, { backgroundColor: bgOption.color }]}>
        <ImageBackground source={bgOption.image} style={styles.bgImage} resizeMode="cover" imageStyle={styles.bgImageFull}>
          <View style={[styles.bgOverlay, { opacity: bgOption.overlayOpacity }]} />
          {screenContent}
        </ImageBackground>
      </View>
    );
  }
  return wrapInFrame(screenContent);
}

// ===== كرت ذكر مفرد (يحتوي القلب + العداد الدائري النيوني إذا التكرار أكثر من 1) =====
function DhikrCard({ item, color, count, isFav, onTap, onFav, styles }: {
  item: Dhikr; color: string; count: number; isFav: boolean;
  onTap: () => void; onFav: () => void; styles: any;
}) {
  const hasCounter = item.repeat > 1;
  const lit = count > 0;
  const isDone = count >= item.repeat;

  return (
    <View style={styles.dhikrCard}>
      <View style={styles.dhikrTopRow}>
        <TouchableOpacity onPress={onFav} hitSlop={8}>
          <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={20} color={isFav ? '#e85466' : 'rgba(255,255,255,0.4)'} />
        </TouchableOpacity>
        {isDone && <Ionicons name="checkmark-circle" size={18} color={color} />}
      </View>

      <Text style={styles.dhikrText}>{item.text}</Text>

      {item.fadl && (
        <View style={styles.fadlRow}>
          <Ionicons name="star-outline" size={12} color={C.cream} />
          <Text style={styles.fadlText}>{item.fadl}</Text>
        </View>
      )}

      {hasCounter && (
        <TouchableOpacity style={styles.counterWrap} onPress={onTap} activeOpacity={0.75}>
          <View style={[
            styles.counterRing,
            { borderColor: lit ? color : 'rgba(255,255,255,0.18)' },
            lit && { shadowColor: color, shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
          ]}>
            <Text style={[styles.counterText, { color: lit ? color : 'rgba(255,255,255,0.5)' }]}>{count}</Text>
            <Text style={styles.counterTotalText}>/{item.repeat}</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ===== الستايلات =====
function createStyles(scale: number) {
  return StyleSheet.create({
    container: { flex: 1 },
    bgFill: { flex: 1 },
    bgImage: { flex: 1, width: '100%', height: '100%' },
    bgImageFull: { width: '100%', height: '100%' },
    bgOverlay: { ...StyleSheet.absoluteFill, backgroundColor: '#000' },

    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: C.glassBorder,
    },
    headerBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder,
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitleBox: {
      flex: 1, marginHorizontal: 10,
      backgroundColor: 'rgba(255,255,255,0.10)',
      borderWidth: 1, borderColor: 'rgba(212,175,95,0.35)',
      borderRadius: 14, paddingVertical: 7, paddingHorizontal: 12, alignItems: 'center',
    },
    headerTitle: {
      color: '#F5E6B8', fontSize: 20 * scale, fontWeight: '700', fontFamily: 'Amiri',
      textAlign: 'center', letterSpacing: 1,
      textShadowColor: 'rgba(212,175,95,0.7)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14,
    },

    homeContent: { padding: 16, paddingTop: 12 },

    favSection: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: 'rgba(232,84,102,0.10)', borderWidth: 1.5, borderColor: 'rgba(232,84,102,0.35)',
      borderRadius: 18, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 16,
    },

    sectionCard: {
      backgroundColor: C.glassStrong, borderRadius: 18, borderWidth: 1.5, borderColor: C.glassBorder,
      marginBottom: 12,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
    },
    sectionCardInner: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, gap: 14, flex: 1,
    },
    reorderRow: {
      position: 'absolute', left: 8, top: '50%', marginTop: -22, gap: 4,
    },
    reorderBtn: {
      width: 24, height: 20, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center', justifyContent: 'center',
    },
    sectionIconBox: { width: 52, height: 52, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    sectionCardText: { flex: 1 },
    sectionCardTitle: { fontSize: 16 * scale, fontWeight: 'bold', marginBottom: 4, fontFamily: 'Amiri' },
    sectionCardSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12 * scale, lineHeight: 17 * scale },

    list: { padding: 16, paddingTop: 10, gap: 14, paddingBottom: 40 },

    // كرت الذكر: زجاجية أقوى + طبقة خلفية غامقة خلف النص لوضوح أعلى
    dhikrCard: {
      backgroundColor: 'rgba(15,25,35,0.55)',
      borderRadius: 20, padding: 18,
      borderWidth: 1.5, borderColor: C.glassBorder,
      shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 6,
    },
    dhikrTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    dhikrText: { color: C.cream, fontSize: 17 * scale, lineHeight: 30 * scale, textAlign: 'center', fontFamily: 'Amiri' },

    fadlRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 6, marginTop: 12 },
    fadlText: { color: C.cream, fontSize: 11.5 * scale, lineHeight: 18 * scale, textAlign: 'right', flex: 1, opacity: 0.7 },

    counterWrap: { alignItems: 'center', marginTop: 16 },
    counterRing: {
      width: 64, height: 64, borderRadius: 32,
      borderWidth: 2.5,
      backgroundColor: 'rgba(255,255,255,0.06)',
      alignItems: 'center', justifyContent: 'center',
    },
    counterText: { fontSize: 18 * scale, fontWeight: '800' },
    counterTotalText: { fontSize: 10 * scale, color: 'rgba(255, 255, 255, 0.46)', marginTop: -2 },

    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
    emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
    favParentLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11.5 * scale, marginBottom: 6, textAlign: 'right' },

    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    settingsSheet: {
      backgroundColor: '#1C2B39', borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 22, gap: 14, borderWidth: 1, borderColor: C.glassBorder,
    },
    settingsTitle: { color: '#F5E6B8', fontSize: 17, fontWeight: '700', textAlign: 'center', fontFamily: 'Amiri' },
    settingsLabel: { color: C.cream, fontSize: 13, fontWeight: '600' },
    fontRow: { flexDirection: 'row', gap: 10 },
    fontOption: {
      flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: C.glassBorder,
      backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center',
    },
    fontOptionText: { color: C.cream, fontWeight: '700' },
    settingsHint: { color: 'rgba(255,255,255,0.4)', fontSize: 11.5, lineHeight: 17, textAlign: 'right' },
    settingsClose: { backgroundColor: C.neonBlue, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
    settingsCloseText: { color: '#0d2230', fontWeight: '800', fontSize: 14 },
  });
}
