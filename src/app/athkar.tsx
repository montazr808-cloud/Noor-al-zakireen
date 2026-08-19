import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  BackHandler,
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// ⚠️ SafeAreaView من react-native نفسها ما تشتغل بالاندرويد (بس بالآيفون) — لازم من هذي المكتبة
import { SafeAreaView } from 'react-native-safe-area-context';

import PhoneFrameWrapper from '@/components/PhoneFrameWrapper';
import { useThemeContext } from '@/contexts/theme-contexts';
import adiyahDataRaw from '@/data/adiyah-data.json';
import athkarDataRaw from '@/data/athkar-data.json';
import { getSelectedBackground } from '@/utils/backgroundSettings';
import {
  DEFAULT_ATHKAR_NOTIFICATION_SETTINGS,
  DEFAULT_ATHKAR_OFFSETS,
  disableAthkarNotifications,
  getAthkarNotificationSettings,
  getAthkarOffsets,
  saveAthkarNotificationSettings,
  saveAthkarOffsets,
  scheduleAthkarNotifications,
  type AthkarNotifOffsets,
  type AthkarNotificationSettings,
} from '@/utils/notificationScheduler';
import * as Location from 'expo-location';
// ⚠️ تأكد المسار هذا مطابق لمكان notificationScheduler.ts الفعلي بمشروعك
import { DAY_AMAL_MANIFEST, type DayAmalRef } from '@/utils/notificationScheduler';

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

// ===== أنواع البيانات =====
type AdiyahRef = { section: string; category?: string; item: string };

type Dhikr = {
  id: string;
  text?: string | null;
  title?: string;
  repeat: number;
  fadl?: string;
  ref?: AdiyahRef;
  quranSurah?: number;
  quranSurahName?: string;
  linkedDuaText?: string;
  linkedDuaFadl?: string;
  linkedDuaTitle?: string;
  // لمناسبة فيها أكثر من عمل بترتيب معين (مثل ليلة القدر: صلاة، ثم سور معينة،
  // ثم دعاء) - إذا موجودة، تُعرض كبطاقات متسلسلة بدل بطاقة وحدة تحتوي المناسبة نفسها
  steps?: Dhikr[];
};

// عنصر "بطاقة" داخل قسم التسبيح/المناجاة — له عنوان ولون خاص به قبل ما يفتح
type LinkedCardItem = Dhikr & { title: string; icon: string; color: string };

type SubSection = { id: string; title: string; icon: string; color: string; time?: string; items: Dhikr[] };

type AthkarGroup = {
  id: string;
  title: string;
  icon: string;
  color: string;
  kind: 'group' | 'flat' | 'occasions';
  reason: string;
  subs?: SubSection[];
  items?: Dhikr[];
};

// ===== حل الروابط المشتركة مع بيانات الأدعية (مصدر بيانات واحد) =====
type AdiyahItemRaw = { id: string; title: string; source?: string; text: string };
type AdiyahCategoryRaw = { id: string; title: string; items: AdiyahItemRaw[] };
type AdiyahSectionRaw = { id: string; title: string; items?: AdiyahItemRaw[]; categories?: AdiyahCategoryRaw[] };
type AdiyahDataRoot = { sections: AdiyahSectionRaw[] };

const ADIYAH_SECTIONS: AdiyahSectionRaw[] = (adiyahDataRaw as unknown as AdiyahDataRoot).sections;

function resolveAdiyahRef(ref: AdiyahRef): { title: string; text: string; fadl?: string } | null {
  const sec = ADIYAH_SECTIONS.find(s => s.id === ref.section);
  if (!sec) return null;
  if (ref.category && sec.categories) {
    const cat = sec.categories.find(c => c.id === ref.category);
    const it = cat?.items.find(i => i.id === ref.item);
    if (it) return { title: it.title, text: it.text, fadl: it.source };
  }
  if (sec.items) {
    const it = sec.items.find(i => i.id === ref.item);
    if (it) return { title: it.title, text: it.text, fadl: it.source };
  }
  return null;
}

function resolveLinkedItems(rawItems: LinkedCardItem[]): LinkedCardItem[] {
  return rawItems.map(it => {
    if (it.ref) {
      const resolved = resolveAdiyahRef(it.ref);
      if (resolved) return { ...it, text: resolved.text, fadl: resolved.fadl };
    }
    return it;
  });
}

// ===== البيانات (من src/data/athkar-data.json) =====
type AthkarDataRoot = {
  tasbih: { id: string; title: string; icon: string; color: string; kind: string; reason: string; items: LinkedCardItem[] };
  athkar: { id: string; title: string; icon: string; color: string; groups: AthkarGroup[] };
  munajat: { id: string; title: string; icon: string; color: string; kind: string; reason: string; items: LinkedCardItem[] };
};

const RAW_DATA = athkarDataRaw as unknown as AthkarDataRoot;

const TASBIH_ITEMS: LinkedCardItem[] = resolveLinkedItems(RAW_DATA.tasbih.items);
const MUNAJAT_ITEMS: LinkedCardItem[] = resolveLinkedItems(RAW_DATA.munajat.items);

function resolveItemDirectRef(it: Dhikr): Dhikr {
  if (it.text || !it.ref) return it;
  const resolved = resolveAdiyahRef(it.ref);
  if (!resolved) return it;
  return { ...it, text: resolved.text, fadl: it.fadl ?? resolved.fadl, title: it.title ?? resolved.title };
}

// أذكار المناسبات: أي مناسبة عندها دعاء مرتبط بالأدعية تنعرض معه (نفس مصدر البيانات)
// وأي عنصر ثاني (بقسم رئيسي أو فرعي) نصّه فاضي ومرتبط بمرجع — نعوّض نصّه مباشرة (دعاء كميل، دعاء الندبة...)
function withLinkedDua(groups: AthkarGroup[]): AthkarGroup[] {
  return groups.map(g => {
    const withResolvedSubs = g.subs
      ? { ...g, subs: g.subs.map(sub => ({ ...sub, items: sub.items.map(resolveItemDirectRef) })) }
      : g;

    if (g.id === 'occasions' && g.items) {
      const resolveOccItem = (it: Dhikr): Dhikr => {
        const withSteps = it.steps ? { ...it, steps: it.steps.map(resolveOccItem) } : it;
        if (!withSteps.ref) return withSteps;
        const resolved = resolveAdiyahRef(withSteps.ref);
        if (!resolved) return withSteps;
        return { ...withSteps, linkedDuaText: resolved.text, linkedDuaFadl: resolved.fadl, linkedDuaTitle: resolved.title } as Dhikr;
      };
      return {
        ...withResolvedSubs,
        items: g.items.map(resolveOccItem),
      };
    }

    if (withResolvedSubs.items) {
      return { ...withResolvedSubs, items: withResolvedSubs.items.map(resolveItemDirectRef) };
    }
    return withResolvedSubs;
  });
}

const ATHKAR_GROUPS: AthkarGroup[] = withLinkedDua(RAW_DATA.athkar.groups);

// الأقسام الثلاثة الرئيسية بالشاشة الرئيسية
const MEGA_SECTIONS = [
  { id: 'tasbih', title: RAW_DATA.tasbih.title, icon: RAW_DATA.tasbih.icon, color: RAW_DATA.tasbih.color, reason: RAW_DATA.tasbih.reason },
  { id: 'athkar', title: RAW_DATA.athkar.title, icon: RAW_DATA.athkar.icon, color: RAW_DATA.athkar.color, reason: 'التعقيبات، أذكار اليوم، المناسبات، والنوافل والأذكار اليومية كاملة.' },
  { id: 'munajat', title: RAW_DATA.munajat.title, icon: RAW_DATA.munajat.icon, color: RAW_DATA.munajat.color, reason: RAW_DATA.munajat.reason },
] as const;

// تسميات كل نوع تذكير للاشعارات (تُعرض بمودال الإعدادات لما تكون الاشعارات مفعّلة)
const NOTIF_SETTING_LABELS: { key: keyof AthkarNotificationSettings; label: string }[] = [
  { key: 'fajr', label: 'أذكار الصباح' },
  { key: 'dhuhr', label: 'تعقيبات الظهر' },
  { key: 'asr', label: 'تعقيبات العصر' },
  { key: 'maghrib', label: 'أذكار المساء' },
  { key: 'isha', label: 'تعقيبات العشاء' },
  { key: 'friday', label: 'سورة الكهف (الجمعة)' },
  { key: 'kumayl', label: 'دعاء كميل (ليلة الجمعة)' },
  // "المناسبات الهجرية" انحذفت من هذي القائمة - نظامها القديم انحذف من
  // notificationScheduler.ts، والمناسبات + الأيام البيض صارت مستقلة بنظامها
  // الخاص (hijriNotifications.ts) اللي إعداداته منفصلة (بشاشة التقويم)
];

const FAV_KEY = '@athkar_favorites_v1';
const COUNT_KEY = '@athkar_counts_v4';
// تاريخ اليوم بصيغة yyyy-mm-dd - نفس الفكرة المستخدمة بـ tasbih.tsx لتصفير العداد اليومي تلقائياً
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const FONT_KEY = '@athkar_font_scale_v1';
const NOTIF_MASTER_KEY = '@athkar_notif_master_enabled_v1';
const SEARCH_HISTORY_KEY = '@athkar_search_history_v1';
const SEARCH_HISTORY_MAX = 10;

function findItem(id: string): { item: Dhikr; color: string; parentTitle: string } | null {
  for (const it of TASBIH_ITEMS) {
    if (it.id === id) return { item: it, color: it.color, parentTitle: RAW_DATA.tasbih.title };
  }
  for (const it of MUNAJAT_ITEMS) {
    if (it.id === id) return { item: it, color: it.color, parentTitle: RAW_DATA.munajat.title };
  }
  for (const sec of ATHKAR_GROUPS) {
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
  | { screen: 'megaHome' }
  | { screen: 'linkedList'; sectionId: 'tasbih' | 'munajat' }
  | { screen: 'athkarGroups' }
  | { screen: 'subs'; sectionId: string }
  | { screen: 'subItems'; sectionId: string; subId: string }
  | { screen: 'occasionsGrid' }
  | { screen: 'dayAmal'; dayId: string }
  | { screen: 'search' }
  | { screen: 'list'; color: string; title: string; items: Dhikr[] }
  | { screen: 'favorites' };

export default function AthkarScreen() {
  const { backgroundId } = useThemeContext();
  const bgOption = getSelectedBackground(backgroundId);

  const [fontScale, setFontScale] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifMsg, setNotifMsg] = useState<string | null>(null);
  const [notifSettings, setNotifSettings] = useState<AthkarNotificationSettings>(DEFAULT_ATHKAR_NOTIFICATION_SETTINGS);
  const [notifOffsets, setNotifOffsets] = useState<AthkarNotifOffsets>(DEFAULT_ATHKAR_OFFSETS);
  const [lastCoords, setLastCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [viewState, setViewState] = useState<ViewState>({ screen: 'megaHome' });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // لما يدوس المستخدم على إشعار (تعقيب، يوم جمعة، مناسبة...)، التطبيق يفتح
  // هذي الشاشة برابط فيه ?dayId=xxx — نلتقطه هنا
  const params = useLocalSearchParams<{ dayId?: string }>();

  // تتبّع الشاشات اللي زارها المستخدم عشان الرجوع (بزر الواجهة أو زر الجهاز) يرجع
  // بالضبط للشاشة السابقة، مو دايماً لنفس الشاشة الافتراضية.
  const [history, setHistory] = useState<ViewState[]>([]);

  // نفتح جرد أعمال اليوم تلقائياً إذا وصل المستخدم من ضغطة إشعار
  useEffect(() => {
    if (params.dayId) {
      setHistory(prev => [...prev, { screen: 'megaHome' }]);
      setViewState({ screen: 'dayAmal', dayId: params.dayId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.dayId]);

  // عرض النافذة الحالي — يتحدث تلقائياً مع تدوير الجهاز أو تغيير حجم نافذة المتصفح
  // (يفرّق بين موبايل / آيباد وتابلت / لابتوب وديسكتوب وماك)
  // عرض المساحة الفعلية المتاحة للمحتوى — نقيسها بأنفسنا (onLayout) بدل الاعتماد على
  // عرض الشاشة الخام، لأن PhoneFrameWrapper يحشر المحتوى داخل إطار هاتف ثابت العرض
  // بالويب (لابتوب/ماك). القياس الفعلي يضمن إن الشبكة ما تنكسر لو كنا جوة الإطار.
  const [contentWidth, setContentWidth] = useState(390);
  const styles = useMemo(() => createStyles(fontScale, contentWidth), [fontScale, contentWidth]);

  // نتذكر آخر موضع تمرير لكل شاشة قائمة (بمفتاح خاص فيها) عشان لما ننتقل لدعاء
  // ونرجع، نرجع بالضبط لنفس المكان بدل ما نصعد لأول القائمة من جديد.
  const scrollOffsets = useState(() => ({} as Record<string, number>))[0];
  const screenScrollKey = (v: ViewState): string => {
    if (v.screen === 'subs') return `subs:${v.sectionId}`;
    if (v.screen === 'occasionsGrid') return 'occasionsGrid';
    if (v.screen === 'athkarGroups') return 'athkarGroups';
    if (v.screen === 'linkedList') return `linkedList:${v.sectionId}`;
    if (v.screen === 'list') return `list:${v.title}`;
    if (v.screen === 'dayAmal') return `dayAmal:${v.dayId}`;
    return v.screen;
  };
  const makeScrollProps = (v: ViewState) => {
    const key = screenScrollKey(v);
    return {
      contentOffset: { x: 0, y: scrollOffsets[key] ?? 0 },
      scrollEventThrottle: 32,
      onScroll: (e: any) => { scrollOffsets[key] = e.nativeEvent.contentOffset.y; },
    };
  };

  useEffect(() => {
    AsyncStorage.getItem(FAV_KEY).then(raw => raw && setFavorites(JSON.parse(raw)));
    AsyncStorage.getItem(COUNT_KEY).then(raw => {
      if (!raw) return;
      const data = JSON.parse(raw);
      // نفس التحقق المستخدم بـ tasbih.tsx: لو التاريخ المحفوظ مو نفس اليوم الحالي،
      // نصفر العداد بدل ما نحمّل أذكار خلصانة من أمس وكأنها لسا "مسوّاة" اليوم
      if (data && data.date === todayKey()) {
        setCounts(data.counts ?? {});
      } else {
        setCounts({});
        AsyncStorage.setItem(COUNT_KEY, JSON.stringify({ date: todayKey(), counts: {} }));
      }
    });
    AsyncStorage.getItem(FONT_KEY).then(raw => raw && setFontScale(JSON.parse(raw)));
    AsyncStorage.getItem(NOTIF_MASTER_KEY).then(raw => setNotifEnabled(raw === 'true'));
    AsyncStorage.getItem(SEARCH_HISTORY_KEY).then(raw => raw && setSearchHistory(JSON.parse(raw)));
    getAthkarNotificationSettings().then(setNotifSettings);
    getAthkarOffsets().then(setNotifOffsets);
  }, []);

  // اختفاء رسالة حالة الاشعارات تلقائياً بعد فترة بدل ما تضل معروضة لين يسكر المودال
  useEffect(() => {
    if (!notifMsg) return;
    const t = setTimeout(() => setNotifMsg(null), 4000);
    return () => clearTimeout(t);
  }, [notifMsg]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      AsyncStorage.setItem(FAV_KEY, JSON.stringify(next));
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // نحفظ كلمة البحث بالسجل لما المستخدم يدوس على نتيجة (يعني لكاها فعلاً)،
  // مو كل ضغطة حرف — أحدث كلمة تطلع فوق، بدون تكرار، وسقف 10 كلمات
  const addToSearchHistory = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSearchHistory(prev => {
      const next = [trimmed, ...prev.filter(h => h !== trimmed)].slice(0, SEARCH_HISTORY_MAX);
      AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify([]));
  };

  const bump = (id: string, max: number) => {
    setCounts(prev => {
      const current = prev[id] ?? 0;
      const next = { ...prev, [id]: current >= max ? 0 : current + 1 };
      AsyncStorage.setItem(COUNT_KEY, JSON.stringify({ date: todayKey(), counts: next }));
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const changeFontScale = (v: number) => {
    setFontScale(v);
    AsyncStorage.setItem(FONT_KEY, JSON.stringify(v));
  };

  // ===== تعديل: دالة مشتركة لجلب الموقع مع تمييز خطأ GPS تحديداً =====
  // سابقاً كل نقطة (toggleNotifications / toggleNotifSetting / changeOffset) كانت
  // تنادي Location.getCurrentPositionAsync مباشرة بدون try/catch خاص بيها، فأي فشل
  // (الأشيع: GPS الجهاز نفسه مطفي أو ما وصل "تثبيت" بعد، حتى لو صلاحية الموقع
  // للتطبيق ممنوحة) كان يوصل كاستثناء عام لحد الـ catch الخارجي ويطلع "صار خطأ"
  // بدون أي توضيح للمستخدم شنو بالضبط المطلوب يسويه. هسه نميّزه برسالة واضحة.
  //
  // ⚠️ تعديل إضافي: كانت toggleNotifSetting وchangeOffset تنادون getCoordsOrThrow
  // مباشرة بدون أي تحقق من صلاحية الموقع أول (بعكس toggleNotifications اللي
  // تتحقق منها). فلو المستخدم أصلاً ما عطى صلاحية الموقع للتطبيق وضغط على تفعيل
  // تذكير فرعي معين، الكود يوصل لـ getCurrentPositionAsync مباشرة، يفشل بسبب رفض
  // الصلاحية، وتظهر رسالة "تأكد GPS مفعّل" الخاطئة - رغم إن GPS فعلاً مفعّل
  // بالجهاز والمشكلة الحقيقية هي صلاحية الموقع للتطبيق نفسه غير ممنوحة. الحل:
  // getCoordsOrThrow صارت تتحقق من الصلاحية أول وترمي نوع خطأ مختلف ومميّز.
  class LocationUnavailableError extends Error {}
  class LocationPermissionDeniedError extends Error {}

  const getCoordsOrThrow = async (): Promise<{ latitude: number; longitude: number }> => {
    if (lastCoords) return lastCoords;

    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new LocationPermissionDeniedError();
    }

    try {
      const pos = await Location.getCurrentPositionAsync({});
      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setLastCoords(coords);
      return coords;
    } catch (e) {
      console.error('[athkar] فشل الحصول على الموقع (GPS):', e);
      throw new LocationUnavailableError();
    }
  };

  const toggleNotifications = async (next: boolean) => {
    setNotifBusy(true);
    setNotifMsg(null);
    try {
      if (next) {
        const { status: existing } = await Location.getForegroundPermissionsAsync();
        let granted = existing === 'granted';
        if (!granted) {
          const { status } = await Location.requestForegroundPermissionsAsync();
          granted = status === 'granted';
        }
        if (!granted) {
          setNotifMsg('لازم تسمح بالوصول للموقع عشان نحسب أوقات الصلاة للاشعارات');
          setNotifBusy(false);
          return;
        }
        const coords = await getCoordsOrThrow();
        const count = await scheduleAthkarNotifications(coords, notifSettings);
        await saveAthkarNotificationSettings(notifSettings);
        setNotifEnabled(true);
        await AsyncStorage.setItem(NOTIF_MASTER_KEY, 'true');
        setNotifMsg(count > 0 ? `تم تفعيل ${count} تذكير` : 'ما كدرنا نجدول الاشعارات، تأكد من صلاحية الاشعارات بالجهاز');
      } else {
        await disableAthkarNotifications();
        setNotifEnabled(false);
        await AsyncStorage.setItem(NOTIF_MASTER_KEY, 'false');
        setNotifMsg('تم إيقاف تذكيرات الأذكار');
      }
    } catch (e) {
      console.error('[athkar] فشل تفعيل/تعطيل تذكيرات الأذكار:', e);
      if (e instanceof LocationPermissionDeniedError) {
        setNotifMsg('لازم تسمح بالوصول للموقع من صلاحيات التطبيق عشان نحسب أوقات الصلاة');
      } else if (e instanceof LocationUnavailableError) {
        setNotifMsg('تعذّر تحديد موقعك — تأكد إن خدمة الموقع (GPS) مفعّلة بالجهاز');
      } else {
        setNotifMsg('صار خطأ، حاول مرة ثانية');
      }
    } finally {
      setNotifBusy(false);
    }
  };

  // تفعيل/تعطيل نوع تذكير واحد لحاله (مثلاً بس تعقيبات الظهر)، وإعادة جدولة
  // الاشعارات فوراً لو التذكيرات مفعّلة أصلاً عشان التغيير يطبّق بلحظته
  const toggleNotifSetting = async (key: keyof AthkarNotificationSettings) => {
    const nextSettings = { ...notifSettings, [key]: !notifSettings[key] };
    setNotifSettings(nextSettings);
    await saveAthkarNotificationSettings(nextSettings);

    if (!notifEnabled) return;

    setNotifBusy(true);
    try {
      const coords = await getCoordsOrThrow();
      const count = await scheduleAthkarNotifications(coords, nextSettings);
      setNotifMsg(`تم تحديث التذكيرات (${count})`);
    } catch (e) {
      console.error('[athkar] فشل تحديث تذكير:', e);
      if (e instanceof LocationPermissionDeniedError) {
        setNotifMsg('لازم تسمح بالوصول للموقع من صلاحيات التطبيق');
      } else if (e instanceof LocationUnavailableError) {
        setNotifMsg('تعذّر تحديد موقعك — تأكد إن خدمة الموقع (GPS) مفعّلة بالجهاز');
      } else {
        setNotifMsg('صار خطأ بتحديث الاشعارات');
      }
    } finally {
      setNotifBusy(false);
    }
  };

  const favItems = favorites.map(id => findItem(id)).filter(Boolean) as { item: Dhikr; color: string; parentTitle: string }[];

  // تعديل الفرق بالدقائق (موجب = بعد وقت الصلاة، سالب = قبله) لتذكير معين -
  // step عادةً ٥ دقايق بكل ضغطة، بحد أقصى معقول حتى ما يطلع رقم غريب بالغلط
  const changeOffset = async (key: keyof AthkarNotifOffsets, delta: number) => {
    const current = notifOffsets[key] ?? 0;
    const next = Math.max(-120, Math.min(120, current + delta));
    const nextOffsets = { ...notifOffsets, [key]: next };
    setNotifOffsets(nextOffsets);
    await saveAthkarOffsets(nextOffsets);

    if (!notifEnabled) return;

    setNotifBusy(true);
    try {
      const coords = await getCoordsOrThrow();
      const count = await scheduleAthkarNotifications(coords, notifSettings, nextOffsets);
      setNotifMsg(`تم تحديث التذكيرات (${count})`);
    } catch (e) {
      console.error('[athkar] فشل تحديث فرق دقائق التذكير:', e);
      if (e instanceof LocationPermissionDeniedError) {
        setNotifMsg('لازم تسمح بالوصول للموقع من صلاحيات التطبيق');
      } else if (e instanceof LocationUnavailableError) {
        setNotifMsg('تعذّر تحديد موقعك — تأكد إن خدمة الموقع (GPS) مفعّلة بالجهاز');
      } else {
        setNotifMsg('صار خطأ بتحديث الاشعارات');
      }
    } finally {
      setNotifBusy(false);
    }
  };

  // تنقّل للأمام: نحفظ الشاشة الحالية بالـ history قبل ما ننتقل، عشان الرجوع
  // (بزر الواجهة أو بزر الرجوع الفيزيائي بالأندرويد) يرجع بالضبط لنفس المكان.
  const navigate = (next: ViewState) => {
    setHistory(prev => [...prev, viewState]);
    setViewState(next);
  };

  // تترجم بند من "جرد أعمال اليوم" (dhikr/dua/quran/info) إلى تنقل فعلي بالتطبيق
  const openDayAmalItem = (ref: DayAmalRef, label: string) => {
    if (ref.type === 'dhikr') {
      const sec = ATHKAR_GROUPS.find(s => s.id === ref.section);
      const sub = sec?.subs?.find(s => s.id === ref.item);
      if (sub) navigate({ screen: 'list', color: sub.color, title: sub.title, items: sub.items });
      return;
    }
    if (ref.type === 'dua') {
      const resolved = resolveAdiyahRef({ section: ref.section, category: (ref as any).category, item: ref.item } as AdiyahRef);
      if (resolved) {
        navigate({
          screen: 'list',
          color: C.neonBlue,
          title: label,
          items: [{ id: `${ref.section}-${ref.item}`, text: resolved.text, fadl: resolved.fadl } as Dhikr],
        });
      }
      return;
    }
    if (ref.type === 'quran') {
      router.push({ pathname: '/quran', params: { surah: String(ref.surah) } } as any);
      return;
    }
    // 'info': ما إلها صفحة، بند تذكيري بس (مثل: صلاة ركعتين) — لا نسوي شي
  };

  // ===== فهرس البحث: بس عناوين (مو محتوى الذكر الداخلي) — أقسام، أقسام فرعية،
  // بطاقات التسبيح/المناجاة، وكل مناسبة على حدة =====
  const searchIndex = useMemo(() => {
    const rows: { id: string; title: string; subtitle?: string; onPress: () => void }[] = [];

    MEGA_SECTIONS.forEach(sec => {
      rows.push({
        id: `mega-${sec.id}`,
        title: sec.title,
        onPress: () => {
          if (sec.id === 'athkar') navigate({ screen: 'athkarGroups' });
          else navigate({ screen: 'linkedList', sectionId: sec.id as 'tasbih' | 'munajat' });
        },
      });
    });

    TASBIH_ITEMS.forEach(card => {
      rows.push({
        id: `tasbih-${card.id}`,
        title: card.title,
        subtitle: 'التسبيح',
        onPress: () => navigate({ screen: 'list', color: card.color, title: card.title, items: [card] }),
      });
    });
    MUNAJAT_ITEMS.forEach(card => {
      rows.push({
        id: `munajat-${card.id}`,
        title: card.title,
        subtitle: 'المناجاة',
        onPress: () => navigate({ screen: 'list', color: card.color, title: card.title, items: [card] }),
      });
    });

    ATHKAR_GROUPS.forEach(sec => {
      rows.push({
        id: `group-${sec.id}`,
        title: sec.title,
        subtitle: 'الأذكار',
        onPress: () => {
          if (sec.kind === 'group') navigate({ screen: 'subs', sectionId: sec.id });
          else if (sec.kind === 'occasions') navigate({ screen: 'occasionsGrid' });
          else navigate({ screen: 'list', color: sec.color, title: sec.title, items: sec.items! });
        },
      });
      sec.subs?.forEach(sub => {
        rows.push({
          id: `sub-${sub.id}`,
          title: sub.title,
          subtitle: sec.title,
          onPress: () => navigate({ screen: 'list', color: sub.color, title: sub.title, items: sub.items }),
        });
      });
      if (sec.kind === 'occasions') {
        sec.items?.forEach(occ => {
          rows.push({
            id: `occ-${occ.id}`,
            title: occ.text ?? '',
            subtitle: 'أذكار المناسبات',
            onPress: () => navigate({ screen: 'list', color: sec.color, title: occ.text ?? '', items: [occ] }),
          });
        });
      }
    });

    return rows;
  }, [viewState]);

  const searchResults = searchQuery.trim().length === 0
    ? []
    : searchIndex.filter(r => r.title.includes(searchQuery.trim()));

  const backOneLevel = () => {
    setHistory(prev => {
      if (prev.length === 0) {
        setViewState({ screen: 'megaHome' });
        return prev;
      }
      const nextHistory = [...prev];
      const last = nextHistory.pop()!;
      setViewState(last);
      return nextHistory;
    });
  };

  // ربط زر الرجوع الفيزيائي بالأندرويد بنفس منطق الرجوع داخل الشاشة، بدل ما
  // يطلع المستخدم من التبويب كامل وهو لسا جوه شاشات فرعية بالأذكار
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (viewState.screen === 'megaHome') return false; // نسمح بالسلوك الافتراضي (يطلع من التبويب)
      backOneLevel();
      return true;
    });
    return () => sub.remove();
  }, [viewState, history]);

  // ===== المحتوى =====
  const screenContent = (
    <SafeAreaView
      style={[styles.container, !bgOption?.image && { backgroundColor: bgOption?.color ?? C.navy }]}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && w !== contentWidth) setContentWidth(w);
      }}
    >
    <StatusBar style="light" />
    <View style={styles.pageShell}>
      {/* الهيدر */}
      <View style={styles.header}>
        {viewState.screen !== 'megaHome' ? (
          <TouchableOpacity onPress={backOneLevel} style={styles.headerBtn}>
            <Ionicons name="arrow-forward" size={22} color={C.neonBlue} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => navigate({ screen: 'favorites' })} style={styles.headerBtn}>
            <Ionicons name={favorites.length > 0 ? 'heart' : 'heart-outline'} size={20} color="#e85466" />
          </TouchableOpacity>
        )}
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {viewState.screen === 'megaHome' && 'الأذكار'}
            {viewState.screen === 'linkedList' && MEGA_SECTIONS.find(s => s.id === viewState.sectionId)?.title}
            {viewState.screen === 'athkarGroups' && 'الأذكار'}
            {viewState.screen === 'occasionsGrid' && ATHKAR_GROUPS.find(s => s.id === 'occasions')?.title}
            {viewState.screen === 'dayAmal' && (DAY_AMAL_MANIFEST[viewState.dayId]?.title ?? 'جرد الأعمال')}
            {viewState.screen === 'subs' && ATHKAR_GROUPS.find(s => s.id === viewState.sectionId)?.title}
            {viewState.screen === 'subItems' && ATHKAR_GROUPS.find(s => s.id === viewState.sectionId)?.subs?.find(s => s.id === viewState.subId)?.title}
            {viewState.screen === 'search' && 'بحث'}
            {viewState.screen === 'list' && viewState.title}
            {viewState.screen === 'favorites' && 'المفضلة'}
          </Text>
        </View>
        {viewState.screen === 'megaHome' && (
          <TouchableOpacity onPress={() => navigate({ screen: 'search' })} style={styles.headerBtn}>
            <Ionicons name="search-outline" size={20} color={C.neonBlue} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setSettingsOpen(true)} style={styles.headerBtn}>
          <Ionicons name="options-outline" size={22} color={C.neonBlue} />
        </TouchableOpacity>
      </View>

      {/* ===== الرئيسية: الأقسام الثلاثة (تسبيح / أذكار / مناجاة) ===== */}
      {viewState.screen === 'megaHome' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.homeContent}>
          {MEGA_SECTIONS.map(sec => (
            <TouchableOpacity
              key={sec.id}
              style={[styles.sectionCard, styles.sectionCardInner]}
              activeOpacity={0.8}
              onPress={() => {
                if (sec.id === 'athkar') navigate({ screen: 'athkarGroups' });
                else navigate({ screen: 'linkedList', sectionId: sec.id as 'tasbih' | 'munajat' });
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
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ===== شاشة البحث: تبحث بعنوان الذكر/القسم بس، مو بالنص الداخلي ===== */}
      {viewState.screen === 'search' && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.5)" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="اكتب اسم الذكر أو القسم..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              autoFocus
              textAlign="right"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.homeContent}>
            {searchQuery.trim().length === 0 && searchHistory.length > 0 && (
              <>
                <View style={styles.searchHistoryHeader}>
                  <Text style={styles.searchHistoryTitle}>عمليات البحث الأخيرة</Text>
                  <TouchableOpacity onPress={clearSearchHistory}>
                    <Text style={styles.searchHistoryClear}>مسح السجل</Text>
                  </TouchableOpacity>
                </View>
                {searchHistory.map((h, idx) => (
                  <TouchableOpacity
                    key={`${h}-${idx}`}
                    style={[styles.sectionCard, styles.sectionCardInner]}
                    activeOpacity={0.8}
                    onPress={() => setSearchQuery(h)}
                  >
                    <Ionicons name="time-outline" size={18} color="rgba(255,255,255,0.45)" />
                    <View style={styles.sectionCardText}>
                      <Text style={[styles.sectionCardTitle, { color: '#F5E6B8' }]}>{h}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
            {searchQuery.trim().length === 0 && searchHistory.length === 0 && (
              <Text style={styles.searchHint}>اكتب اسم الذكر أو الدعاء أو القسم اللي تدور عليه</Text>
            )}
            {searchQuery.trim().length > 0 && searchResults.length === 0 && (
              <Text style={styles.searchHint}>ما لكيت نتيجة بهذا الاسم</Text>
            )}
            {searchResults.map(r => (
              <TouchableOpacity
                key={r.id}
                style={[styles.sectionCard, { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14 }]}
                activeOpacity={0.8}
                onPress={() => {
                  addToSearchHistory(searchQuery);
                  r.onPress();
                }}
              >
                <View style={styles.sectionCardText}>
                  <Text style={[styles.sectionCardTitle, { color: '#F5E6B8' }]}>{r.title}</Text>
                  {r.subtitle && <Text style={styles.sectionCardSub}>{r.subtitle}</Text>}
                </View>
                <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            ))}
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      )}

      {/* ===== قسم التسبيح أو المناجاة: قائمة بطاقات (كل بطاقة = دعاء واحد) ===== */}
      {viewState.screen === 'linkedList' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.homeContent} {...makeScrollProps(viewState)}>
          {(viewState.sectionId === 'tasbih' ? TASBIH_ITEMS : MUNAJAT_ITEMS).map(card => (
            <TouchableOpacity
              key={card.id}
              style={[styles.sectionCard, { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14 }]}
              activeOpacity={0.8}
              onPress={() => navigate({ screen: 'list', color: card.color, title: card.title, items: [card] })}
            >
              <View style={[styles.sectionIconBox, { borderColor: card.color + '55', backgroundColor: card.color + '1c' }]}>
                <Ionicons name={card.icon as any} size={26} color={card.color} />
              </View>
              <View style={styles.sectionCardText}>
                <Text style={[styles.sectionCardTitle, { color: '#F5E6B8' }]}>{card.title}</Text>
              </View>
              <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ===== قسم الأذكار: نفس القائمة القديمة (المناسبات أولاً) ===== */}
      {viewState.screen === 'athkarGroups' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.homeContent} {...makeScrollProps(viewState)}>
          {ATHKAR_GROUPS.map((sec) => (
            <TouchableOpacity
              key={sec.id}
              style={[styles.sectionCard, styles.sectionCardInner]}
              activeOpacity={0.8}
              onPress={() => {
                if (sec.kind === 'group') navigate({ screen: 'subs', sectionId: sec.id });
                else if (sec.kind === 'occasions') navigate({ screen: 'occasionsGrid' });
                else navigate({ screen: 'list', color: sec.color, title: sec.title, items: sec.items! });
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
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ===== بطاقات المناسبات: كل مناسبة إلها بطاقة تفتح لصفحتها الخاصة ===== */}
      {viewState.screen === 'occasionsGrid' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.homeContent} {...makeScrollProps(viewState)}>
          {ATHKAR_GROUPS.find(s => s.id === 'occasions')?.items?.map(occ => (
            <TouchableOpacity
              key={occ.id}
              style={[styles.sectionCard, styles.sectionCardInner]}
              activeOpacity={0.8}
              onPress={() => navigate({
                screen: 'list',
                color: ATHKAR_GROUPS.find(s => s.id === 'occasions')!.color,
                title: occ.text ?? '',
                items: occ.steps && occ.steps.length > 0 ? occ.steps : [occ],
              })}
            >
              <View style={[
                styles.sectionIconBox,
                { borderColor: ATHKAR_GROUPS.find(s => s.id === 'occasions')!.color + '55', backgroundColor: ATHKAR_GROUPS.find(s => s.id === 'occasions')!.color + '1c' },
              ]}>
                <Ionicons name="calendar-outline" size={24} color={ATHKAR_GROUPS.find(s => s.id === 'occasions')!.color} />
              </View>
              <View style={styles.sectionCardText}>
                <Text style={[styles.sectionCardTitle, { color: '#F5E6B8' }]}>{occ.text}</Text>
                {occ.fadl && <Text style={styles.sectionCardSub} numberOfLines={2}>{occ.fadl}</Text>}
              </View>
              <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ===== جرد أعمال اليوم: يفتح من ضغطة إشعار (تعقيب/جمعة/مناسبة) ===== */}
      {viewState.screen === 'dayAmal' && (() => {
        const entry = DAY_AMAL_MANIFEST[viewState.dayId];
        // احتياط: إذا الإشعار مناسبة هجرية ما إلها جرد مخصص بالمنشور، نلكيها
        // مباشرة بقائمة المناسبات ونفتحها كبطاقة وحدة (نفس شاشة occasionsGrid)
        const occFallback = !entry
          ? ATHKAR_GROUPS.find(s => s.id === 'occasions')?.items?.find(o => o.text === viewState.dayId)
          : null;

        if (!entry && !occFallback) {
          return <View style={styles.homeContent}><Text style={styles.searchHint}>ما لكيت جرد أعمال لهذا اليوم</Text></View>;
        }

        const rows = entry
          ? entry.items
          : [{ label: occFallback!.text ?? '', ref: { type: 'dua', section: '', item: '' } as DayAmalRef }];

        return (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.homeContent} {...makeScrollProps(viewState)}>
            {rows.map((row, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.sectionCard, styles.sectionCardInner]}
                activeOpacity={row.ref.type === 'info' ? 1 : 0.8}
                onPress={() => {
                  if (occFallback) {
                    navigate({
                      screen: 'list',
                      color: ATHKAR_GROUPS.find(s => s.id === 'occasions')!.color,
                      title: occFallback.text ?? '',
                      items: occFallback.steps && occFallback.steps.length > 0 ? occFallback.steps : [occFallback],
                    });
                  } else {
                    openDayAmalItem(row.ref, row.label);
                  }
                }}
              >
                <View style={styles.sectionCardText}>
                  <Text style={[styles.sectionCardTitle, { color: '#F5E6B8' }]}>{row.label}</Text>
                </View>
                {row.ref.type !== 'info' && <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.4)" />}
              </TouchableOpacity>
            ))}
            <View style={{ height: 32 }} />
          </ScrollView>
        );
      })()}

      {/* ===== الأقسام الفرعية (مثل: داخل أذكار اليوم) ===== */}
      {viewState.screen === 'subs' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.homeContent} {...makeScrollProps(viewState)}>
          {ATHKAR_GROUPS.find(s => s.id === viewState.sectionId)?.subs?.map(sub => (
            <TouchableOpacity
              key={sub.id}
              style={[styles.sectionCard, { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14 }]}
              activeOpacity={0.8}
              onPress={() => {
                // قسم "الصلاة ونوافلها" (salah) لحاله: يفتح كصفحة وحدة متواصلة
                // فيها كل عناصر الصلاة (النافلة + التعقيب) سوا، مو فهرس بطاقات
                // منفصلة توديك لكل عنصر لحاله
                if (viewState.sectionId === 'salah') {
                  navigate({ screen: 'list', color: sub.color, title: sub.title, items: sub.items });
                } else if (sub.items.length > 1) {
                  navigate({ screen: 'subItems', sectionId: viewState.sectionId, subId: sub.id });
                } else {
                  navigate({ screen: 'list', color: sub.color, title: sub.title, items: sub.items });
                }
              }}
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
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ===== بطاقات عناصر القسم الفرعي (مثل: كل دعاء بيوم الجمعة كرت لحاله) ===== */}
      {viewState.screen === 'subItems' && (() => {
        const sec = ATHKAR_GROUPS.find(s => s.id === viewState.sectionId);
        const sub = sec?.subs?.find(s => s.id === viewState.subId);
        if (!sub) return null;
        return (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.homeContent}>
            {sub.items.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.sectionCard, { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14 }]}
                activeOpacity={0.8}
                onPress={() => navigate({ screen: 'list', color: sub.color, title: item.title ?? sub.title, items: [item] })}
              >
                <View style={[styles.sectionIconBox, { borderColor: sub.color + '55', backgroundColor: sub.color + '1c' }]}>
                  <Text style={[styles.counterText, { color: sub.color }]}>{index + 1}</Text>
                </View>
                <View style={styles.sectionCardText}>
                  <Text style={[styles.sectionCardTitle, { color: '#F5E6B8' }]}>{item.title ?? sub.title}</Text>
                </View>
                <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            ))}
            <View style={{ height: 32 }} />
          </ScrollView>
        );
      })()}

      {/* ===== قائمة الأذكار النهائية ===== */}
      {viewState.screen === 'list' && (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} {...makeScrollProps(viewState)}>
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
    </View>

      {/* ===== مودال الإعدادات الخاصة بالأذكار ===== */}
      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setSettingsOpen(false)}>
          <View style={styles.settingsSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.settingsTitle}>إعدادات الأذكار</Text>

            <Text style={styles.settingsLabel}>حجم الخط</Text>
            <View style={styles.fontRow}>
              {[
                { v: 0.85, label: 'صغير' },
                { v: 1, label: 'عادي' },
                { v: 1.15, label: 'كبير' },
                { v: 1.3, label: 'كبير جداً' },
              ].map(({ v, label }) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.fontOption, fontScale === v && { borderColor: C.neonBlue, backgroundColor: C.neonBlue + '22' }]}
                  onPress={() => changeFontScale(v)}
                >
                  <Text style={styles.fontOptionText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.notifRow}>
              <TouchableOpacity
                disabled={notifBusy}
                style={[styles.notifToggle, notifEnabled && { borderColor: C.neonBlue, backgroundColor: C.neonBlue + '22' }]}
                onPress={() => toggleNotifications(!notifEnabled)}
              >
                <Ionicons name={notifEnabled ? 'notifications' : 'notifications-off-outline'} size={18} color={notifEnabled ? C.neonBlue : 'rgba(255,255,255,0.6)'} />
                <Text style={styles.notifToggleText}>{notifBusy ? 'جاري التفعيل...' : notifEnabled ? 'تذكيرات الأذكار مفعّلة' : 'فعّل تذكيرات الأذكار'}</Text>
              </TouchableOpacity>
              <Text style={styles.notifHint}>تذكير بأذكار الصباح/المساء وكل صلاة، وسورة الكهف يوم الجمعة، ودعاء كميل ليلة الجمعة، والمناسبات الهجرية — كلها مربوطة بأوقات صلاتك</Text>
              {notifMsg && <Text style={styles.notifMsg}>{notifMsg}</Text>}

              {/* تحكم دقيق بكل نوع تذكير لحاله — يظهر بس لما التذكيرات مفعّلة عموماً */}
              {notifEnabled && (
                <View style={styles.notifSettingsList}>
                  {NOTIF_SETTING_LABELS.map(({ key, label }) => {
                    const offsetKey = key as keyof AthkarNotifOffsets;
                    const offset = notifOffsets[offsetKey] ?? 0;
                    return (
                      <View key={key} style={[styles.notifSettingRow, notifSettings[key] && styles.notifSettingRowActive]}>
                        <TouchableOpacity
                          disabled={notifBusy}
                          style={styles.notifSettingRowMain}
                          onPress={() => toggleNotifSetting(key)}
                        >
                          <Ionicons
                            name={notifSettings[key] ? 'checkmark-circle' : 'ellipse-outline'}
                            size={16}
                            color={notifSettings[key] ? C.neonBlue : 'rgba(255,255,255,0.4)'}
                          />
                          <Text style={styles.notifSettingText}>{label}</Text>
                        </TouchableOpacity>

                        {/* الفرق بالدقائق عن وقت الصلاة المرتبط - موجب = بعده، سالب = قبله */}
                        {notifSettings[key] && (
                          <View style={styles.offsetControl}>
                            <TouchableOpacity
                              disabled={notifBusy}
                              style={styles.offsetBtn}
                              onPress={() => changeOffset(offsetKey, -5)}
                            >
                              <Ionicons name="remove" size={13} color={C.cream} />
                            </TouchableOpacity>
                            <Text style={styles.offsetText}>
                              {offset === 0 ? 'بوقت الصلاة' : `${offset > 0 ? '+' : ''}${offset} د`}
                            </Text>
                            <TouchableOpacity
                              disabled={notifBusy}
                              style={styles.offsetBtn}
                              onPress={() => changeOffset(offsetKey, 5)}
                            >
                              <Ionicons name="add" size={13} color={C.cream} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

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

      {item.title && <Text style={[styles.dhikrTitle, { color }]}>{item.title}</Text>}

      <Text style={styles.dhikrText}>{item.text}</Text>

      {item.fadl && (
        <View style={styles.fadlRow}>
          <Ionicons name="star-outline" size={12} color={C.cream} />
          <Text style={styles.fadlText}>{item.fadl}</Text>
        </View>
      )}

      {item.linkedDuaText && (
        <View style={styles.linkedDuaBox}>
          <Text style={styles.linkedDuaLabel}>{item.linkedDuaTitle ?? 'الدعاء المرتبط بهذه المناسبة'}</Text>
          <Text style={styles.linkedDuaText}>{item.linkedDuaText}</Text>
          {item.linkedDuaFadl && <Text style={styles.linkedDuaSource}>{item.linkedDuaFadl}</Text>}
        </View>
      )}

      {item.quranSurah != null && (
        <TouchableOpacity
          style={[styles.quranLinkBtn, { borderColor: color + '55', backgroundColor: color + '1c' }]}
          activeOpacity={0.8}
          onPress={() => router.push({ pathname: '/quran', params: { surah: String(item.quranSurah) } } as any)}
        >
          <Ionicons name="book-outline" size={16} color={color} />
          <Text style={[styles.quranLinkText, { color }]}>قراءة سورة {item.quranSurahName ?? ''}</Text>
        </TouchableOpacity>
      )}

      {hasCounter && (
        <TouchableOpacity style={styles.counterWrap} onPress={onTap} activeOpacity={0.75}>
          <View style={[
            styles.counterRing,
            { borderColor: lit ? color : 'rgba(255,255,255,0.18)' },
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
function createStyles(scale: number, width: number = 390) {
  // نقاط توقف: موبايل (أقل من 640) / آيباد وتابلت (640-999) / لابتوب وديسكتوب وماك (1000+)
  const isTablet = width >= 640;
  const isDesktop = width >= 1000;
  const columns = isDesktop ? 3 : isTablet ? 2 : 1;
  const cardWidthPct = columns === 3 ? '31.5%' : columns === 2 ? '48%' : '100%';

  return StyleSheet.create({
    container: { flex: 1 },
    pageShell: {
      flex: 1, width: '100%',
      maxWidth: isDesktop ? 960 : isTablet ? 700 : undefined,
      alignSelf: 'center',
    },
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
      color: '#F5E6B8', fontSize: 20 * scale, fontWeight: '700', fontFamily: 'Amiri-Regular',
      textAlign: 'center', letterSpacing: 1,
      textShadowColor: 'rgba(212,175,95,0.7)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14,
    },

    searchBox: {
      flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
      marginHorizontal: 16, marginTop: 4, marginBottom: 8,
      backgroundColor: C.glassStrong, borderRadius: 14, borderWidth: 1.5, borderColor: C.glassBorder,
      paddingHorizontal: 12, paddingVertical: 10,
    },
    searchInput: { flex: 1, color: '#F5E6B8', fontSize: 15 * scale, paddingVertical: 0 },
    searchHint: { color: 'rgba(255,255,255,0.5)', fontSize: 13 * scale, textAlign: 'center', marginTop: 24 },
    searchHistoryHeader: {
      flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 10, paddingHorizontal: 2,
    },
    searchHistoryTitle: { color: 'rgba(255,255,255,0.55)', fontSize: 12 * scale },
    searchHistoryClear: { color: '#e85466', fontSize: 12 * scale },

    homeContent: {
      padding: 16, paddingTop: 12,
      ...(columns > 1
        ? { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignContent: 'flex-start' }
        : null),
    },

    sectionCard: {
      backgroundColor: C.glassStrong, borderRadius: 18, borderWidth: 1.5, borderColor: C.glassBorder,
      marginBottom: 12,
      width: columns > 1 ? cardWidthPct : '100%',
    },
    sectionCardInner: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, gap: 14,
    },
    sectionIconBox: { width: 52, height: 52, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    sectionCardText: { flex: 1 },
    sectionCardTitle: { fontSize: 16 * scale, fontWeight: 'bold', marginBottom: 4, fontFamily: 'Amiri-Regular', textAlign: 'right' },
    sectionCardSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12 * scale, lineHeight: 17 * scale, textAlign: 'right' },

    list: {
      padding: 16, paddingTop: 10, gap: 14, paddingBottom: 40,
      width: '100%', maxWidth: isTablet ? 640 : undefined, alignSelf: 'center',
    },

    // كرت الذكر: زجاجية أقوى + طبقة خلفية غامقة خلف النص لوضوح أعلى
    dhikrCard: {
      backgroundColor: 'rgba(15,25,35,0.55)',
      borderRadius: 20, padding: 18,
      borderWidth: 1.5, borderColor: C.glassBorder,
    },
    dhikrTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    dhikrTitle: { fontSize: 15 * scale, fontWeight: '700', textAlign: 'center', fontFamily: 'Amiri', marginBottom: 6 },
    dhikrText: { color: C.cream, fontSize: 17 * scale, lineHeight: 30 * scale, textAlign: 'center', fontFamily: 'Amiri-Regular' },

    fadlRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 6, marginTop: 12 },
    fadlText: { color: C.cream, fontSize: 11.5 * scale, lineHeight: 18 * scale, textAlign: 'right', flex: 1, opacity: 0.7 },

    linkedDuaBox: {
      marginTop: 14, padding: 14, borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: C.glassBorder,
    },
    linkedDuaLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11 * scale, marginBottom: 8, textAlign: 'center' },
    linkedDuaText: { color: C.cream, fontSize: 15 * scale, lineHeight: 26 * scale, textAlign: 'center', fontFamily: 'Amiri-Regular' },
    linkedDuaSource: { color: 'rgba(255,255,255,0.45)', fontSize: 11 * scale, marginTop: 8, textAlign: 'center' },

    quranLinkBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      marginTop: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5,
    },
    quranLinkText: { fontSize: 13.5 * scale, fontWeight: '700', fontFamily: 'Amiri-Regular' },

    counterWrap: { alignItems: 'center', marginTop: 16 },
    counterRing: {
      width: 64, height: 64, borderRadius: 32,
      borderWidth: 2.5,
      backgroundColor: 'rgba(255,255,255,0.06)',
      alignItems: 'center', justifyContent: 'center',
    },
    counterText: { fontSize: 18 * scale, fontWeight: '800' },
    counterTotalText: { fontSize: 10 * scale, color: 'rgba(255,255,255,0.4)', marginTop: -2 },

    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
    emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
    favParentLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11.5 * scale, marginBottom: 6, textAlign: 'right' },

    modalBg: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: isTablet ? 'center' : 'flex-end',
      alignItems: isTablet ? 'center' : 'stretch',
    },
    settingsSheet: {
      backgroundColor: '#1C2B39',
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      borderBottomLeftRadius: isTablet ? 24 : 0, borderBottomRightRadius: isTablet ? 24 : 0,
      padding: 22, gap: 14, borderWidth: 1, borderColor: C.glassBorder,
      width: isTablet ? 460 : '100%', maxWidth: '92%',
    },
    settingsTitle: { color: '#F5E6B8', fontSize: 17, fontWeight: '700', textAlign: 'center', fontFamily: 'Amiri-Regular' },
    settingsLabel: { color: C.cream, fontSize: 13, fontWeight: '600' },
    fontRow: { flexDirection: 'row', gap: 10 },
    notifRow: { gap: 8, marginTop: 6 },
    notifToggle: {
      flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
      paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
      borderWidth: 1.5, borderColor: C.glassBorder, backgroundColor: 'rgba(255,255,255,0.05)',
    },
    notifToggleText: { color: C.cream, fontSize: 13.5 * scale, fontWeight: '700' },
    notifHint: { color: 'rgba(255,255,255,0.45)', fontSize: 11 * scale, lineHeight: 17 * scale, textAlign: 'right' },
    notifMsg: { color: C.neonBlue, fontSize: 11.5 * scale, textAlign: 'center' },
    notifSettingsList: {
      marginTop: 10, gap: 6, borderTopWidth: 1, borderTopColor: C.glassBorder, paddingTop: 10,
    },
    notifSettingRow: {
      flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.03)',
    },
    notifSettingRowActive: { backgroundColor: C.neonBlue + '14' },
    notifSettingRowMain: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flex: 1 },
    notifSettingText: { color: C.cream, fontSize: 12.5 * scale },
    offsetControl: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
    offsetBtn: {
      width: 20, height: 20, borderRadius: 6,
      backgroundColor: 'rgba(255,255,255,0.08)',
      justifyContent: 'center', alignItems: 'center',
    },
    offsetText: { color: 'rgba(255,255,255,0.65)', fontSize: 10.5 * scale, minWidth: 62, textAlign: 'center' },
    fontOption: {
      flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: C.glassBorder,
      backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center',
    },
    fontOptionText: { color: C.cream, fontWeight: '700', fontSize: 12, textAlign: 'center' },
    settingsClose: { backgroundColor: C.neonBlue, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
    settingsCloseText: { color: '#0d2230', fontWeight: '800', fontSize: 14 },
  });
}