// src/app/settings/phone-wallpapers.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Image as RNImage,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
// ⚠️ SafeAreaView من react-native نفسها ما تشتغل بالاندرويد (بس بالآيفون) — لازم من هذي المكتبة
import { SafeAreaView } from 'react-native-safe-area-context';

const LIKES_KEY = 'wallpaper_liked_ids';

const { width: W } = Dimensions.get('window');
const COLS = 2;
const THUMB = (W - 48) / COLS;

// ===== باليت مطابقة لشاشة التسبيح =====
const C = {
  neonBlue: '#57C8F2',
  white: '#FFFFFF',
  glass: 'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(255,255,255,0.22)',
  muted: 'rgba(255,255,255,0.55)',
};

type WallpaperItem = {
  id: string;
  title: string;
  uri: any;
  category: string;
};

const WALLPAPERS: WallpaperItem[] = [
  { id: '1', title: 'مدينة منورة',   uri: require('../../assets/backgrounds/medina.jpg'),         category: 'مقدسات' },
  { id: '2', title: 'مكة المكرمة',   uri: require('../../assets/backgrounds/mecca.jpg'),          category: 'مقدسات' },
  { id: '3', title: 'كربلاء',        uri: require('../../assets/backgrounds/karbala.jpg'),        category: 'مقدسات' },
  { id: '4', title: 'النجف الأشرف',  uri: require('../../assets/backgrounds/najef.jpg'),          category: 'مقدسات' },
  { id: '5', title: 'القرآن الكريم', uri: require('../../assets/backgrounds/quran.jpg'),          category: 'روحانيات' },
  { id: '6', title: 'أزهار بنفسجية', uri: require('../../assets/backgrounds/purple_flowers.jpg'), category: 'طبيعة' },
  { id: '7',  title: 'ليلة القمر الريفي',     uri: require('../../assets/backgrounds/nature_01.jpg'), category: 'طبيعة' },
  { id: '8',  title: 'يا مقلب القلوب',        uri: require('../../assets/backgrounds/nature_02.jpg'), category: 'طبيعة' },
  { id: '9',  title: 'غروب الشاطئ',           uri: require('../../assets/backgrounds/nature_03.jpg'), category: 'طبيعة' },
  { id: '10', title: 'ولسوف يعطيك ربك',       uri: require('../../assets/backgrounds/nature_04.jpg'), category: 'طبيعة' },
  { id: '11', title: 'قمر الغيوم الوردية',    uri: require('../../assets/backgrounds/nature_05.jpg'), category: 'طبيعة' },
  { id: '12', title: 'إن مع العسر يسرا',      uri: require('../../assets/backgrounds/nature_06.jpg'), category: 'طبيعة' },
  { id: '13', title: 'أزهار الكرز',           uri: require('../../assets/backgrounds/nature_07.jpg'), category: 'طبيعة' },
  { id: '14', title: 'أزهار وقمر',            uri: require('../../assets/backgrounds/nature_08.jpg'), category: 'طبيعة' },
  { id: '15', title: 'حقل النجوم',            uri: require('../../assets/backgrounds/nature_09.jpg'), category: 'طبيعة' },
  { id: '16', title: 'قبة كربلاء والراية الحمراء',   uri: require('../../assets/backgrounds/holy_01.jpg'), category: 'مقدسات' },
  { id: '17', title: 'صحن الروضة',                   uri: require('../../assets/backgrounds/holy_02.jpg'), category: 'مقدسات' },
  { id: '18', title: 'اللهم صل على الحسين',          uri: require('../../assets/backgrounds/holy_03.jpg'), category: 'مقدسات' },
  { id: '20', title: 'برج ساعة مكة',                 uri: require('../../assets/backgrounds/holy_05.jpg'), category: 'مقدسات' },
  { id: '21', title: 'القبة الذهبية والأشجار',       uri: require('../../assets/backgrounds/holy_06.jpg'), category: 'مقدسات' },
  { id: '22', title: 'إطلالة الحرم عند الغروب',      uri: require('../../assets/backgrounds/holy_07.jpg'), category: 'مقدسات' },
  { id: '23', title: 'ومن يتوكل على الله فهو حسبه',  uri: require('../../assets/backgrounds/spiritual_02.jpg'), category: 'روحانيات' },
  { id: '24', title: 'اللهم صل على محمد وآل محمد',    uri: require('../../assets/backgrounds/spiritual_03.jpg'), category: 'روحانيات' },
  { id: '25', title: 'وأن ليس للإنسان إلا ما سعى',    uri: require('../../assets/backgrounds/spiritual_04.jpg'), category: 'روحانيات' },
  { id: '26', title: 'لا تخاف حسين للخائف أمان',      uri: require('../../assets/backgrounds/spiritual_05.jpg'), category: 'روحانيات' },
  { id: '27', title: 'الله وعلي',                     uri: require('../../assets/backgrounds/spiritual_06.jpg'), category: 'روحانيات' },
  { id: '28', title: 'يغيثني الله مهما أضلمت سبلي',   uri: require('../../assets/backgrounds/spiritual_07.jpg'), category: 'روحانيات' },
  { id: '29', title: 'يأت بها الله إن الله لطيف خبير', uri: require('../../assets/backgrounds/spiritual_08.jpg'), category: 'روحانيات' },
  { id: '30', title: 'وجهت وجهي نحو بابك راجياً',     uri: require('../../assets/backgrounds/spiritual_09.jpg'), category: 'روحانيات' },
  { id: '31', title: 'فعسى أن تكرهوا شيئاً',          uri: require('../../assets/backgrounds/spiritual_10.jpg'), category: 'روحانيات' },
];

const CATEGORIES = ['الكل', 'مقدسات', 'روحانيات', 'طبيعة'];

// expo-media-library غير مدعومة على الويب إطلاقاً، لذا نستوردها فقط على الموبايل
// ⚠️ نستورد من "expo-media-library/legacy" بدل "expo-media-library" مباشرة -
// النسخة المركّبة بالمشروع صار فيها createAssetAsync بالمسار الجديد deprecated.
let MediaLibrary: typeof import('expo-media-library/legacy') | null = null;
if (Platform.OS !== 'web') {
  MediaLibrary = require('expo-media-library/legacy');
}

// resolveAssetSource يرجع مسار موزّع/مصدر أصل (asset resource) مو مسار ملف
// حقيقي بنسخة الإنتاج (خصوصاً أندرويد) - MediaLibrary وSharing يحتاجون مسار
// file:// حقيقي، فلازم ننزّل الصورة محلياً أول عبر expo-asset قبل أي عملية عليها
//
// ⚠️ إصلاح (٢٠٢٦-٠٩-٠٢، "الصورة المحفوظة صايرة حيل وايكة/ثقيلة"): قبل، هذي
// الدالة كانت تنسخ الملف الأصلي بدقته الكاملة كما هو للمعرض بدون أي تصغير أو
// ضغط - يعني الصورة المحفوظة هي نفس ملف الخلفية الخام (أحياناً بأبعاد كبيرة
// جداً لخلفية هاتف عادية). هسه نمرر الصورة عبر expo-image-manipulator: نصغّرها
// لعرض أقصى ١٤٤٠px (يغطي حتى أعلى دقة شاشات الهواتف الحالية) ونضغطها بجودة
// ٨٢٪ قبل الحفظ/المشاركة. لو الصورة الأصلية أصلاً أصغر من هذا العرض، ما نكبّرها.
// ImageManipulator نفسه يرجع مسار file:// صالح بامتداد صحيح (jpg)، فيحل بنفس
// الوقت مشكلة الامتداد اللي كانت محلولة سابقاً بالنسخ اليدوي.
async function resolveLocalUri(uri: any): Promise<string> {
  const asset = Asset.fromModule(uri);
  if (!asset.localUri) {
    await asset.downloadAsync();
  }
  const resolved = asset.localUri ?? asset.uri;

  if (!resolved) {
    throw new Error('resolveLocalUri: ماكو مسار صورة صالح بعد التحميل');
  }

  const MAX_WIDTH = 1440;
  const actions =
    asset.width && asset.width > MAX_WIDTH ? [{ resize: { width: MAX_WIDTH } }] : [];

  try {
    const manipulated = await ImageManipulator.manipulateAsync(resolved, actions, {
      compress: 0.82,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return manipulated.uri;
  } catch (e) {
    // فشل التصغير (نادر) - نرجع للأسلوب القديم (نسخ الملف الأصلي كما هو) بدل
    // ما نكسر الحفظ/المشاركة بالكامل بسبب ميزة تحسين الحجم فقط
    console.log('[resolveLocalUri] فشل ImageManipulator، رجعنا للنسخ المباشر:', e);
    const ext = (asset.type || 'jpg').replace(/^\./, '');
    const destination = `${FileSystem.cacheDirectory}wallpaper_${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: resolved, to: destination });
    return destination;
  }
}

// يحول أي خطأ ملتقط لنص مختصر مفهوم - نعرضه مباشرة بالتنبيه على الشاشة نفسها
// (مؤقتاً للتشخيص) بدل ما يضيع بالكونسول ويحتاج adb لمشاهدته
function describeError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as any;
    const code = e.code ? `[${e.code}] ` : '';
    const message = e.message || String(err);
    return `${code}${message}`;
  }
  return String(err);
}

export default function PhoneWallpapersScreen() {
  const router = useRouter();
  const [cat, setCat]         = useState('الكل');
  const [saving, setSaving]   = useState<string | null>(null);
  const [selected, setSelected] = useState<WallpaperItem | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  // بطاقة "تم الحفظ" — توست زجاجي متناسق مع تصميم التطبيق بدل Alert نظام
  const [toastShow, setToastShow] = useState(false);
  const [toastTitle, setToastTitle] = useState('');
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(LIKES_KEY).then(raw => {
      if (raw) setLikedIds(new Set(JSON.parse(raw)));
    });
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showSavedToast = (title: string) => {
    setToastTitle(title);
    setToastShow(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastAnim.stopAnimation();
    Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setToastShow(false);
      });
    }, 2000);
  };

  const toggleLike = async (id: string) => {
    const next = new Set(likedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setLikedIds(next);
    await AsyncStorage.setItem(LIKES_KEY, JSON.stringify([...next]));
  };

  const shareWallpaper = async (item: WallpaperItem) => {
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('غير متاح', 'المشاركة غير مدعومة على هذا الجهاز');
        return;
      }
      const localUri = await resolveLocalUri(item.uri);
      await Sharing.shareAsync(localUri);
    } catch (err) {
      console.log('shareWallpaper error:', err);
      Alert.alert('خطأ بالمشاركة', describeError(err));
    }
  };

  const filtered = cat === 'الكل' ? WALLPAPERS : WALLPAPERS.filter(w => w.category === cat);

  const saveToGallery = async (item: WallpaperItem) => {
    if (Platform.OS === 'web' || !MediaLibrary) {
      try {
        const resolved = RNImage.resolveAssetSource?.(item.uri)?.uri ?? item.uri;
        const link = document.createElement('a');
        link.href = resolved;
        link.download = `${item.title || 'wallpaper'}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch {
        Alert.alert('خطأ', 'تعذّر تحميل الصورة');
      }
      return;
    }

    // ⚠️ writeOnly=true: التطبيق يحتاج بس يضيف صور للمعرض، مو يقرأ صور المستخدم
    // الموجودة مسبقاً - هذا يطلب صلاحية أضيق (وأسهل موافقة) خصوصاً على أندرويد
    // ١٣+ حيث صلاحية القراءة الكاملة (READ_MEDIA_IMAGES) منفصلة وأصعب موافقة
    let status: string;
    try {
      const result = await MediaLibrary.requestPermissionsAsync(true);
      status = result.status;
    } catch (err) {
      console.log('requestPermissionsAsync error:', err);
      Alert.alert('خطأ بالصلاحية', describeError(err));
      return;
    }
    if (status !== 'granted') {
      Alert.alert('تنبيه', 'يرجى السماح بالوصول للصور');
      return;
    }
    setSaving(item.id);
    try {
      const localUri = await resolveLocalUri(item.uri);
      const asset = await MediaLibrary.createAssetAsync(localUri);

      // لو الألبوم موجود مسبقاً، createAlbumAsync ينكسر على بعض إصدارات أندرويد
      // بدل ما يضيف الصورة له - لازم نتأكد أول ونستخدم addAssetsToAlbumAsync
      const existingAlbum = await MediaLibrary.getAlbumAsync('نور الذاكرين');
      if (existingAlbum) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], existingAlbum, false);
      } else {
        await MediaLibrary.createAlbumAsync('نور الذاكرين', asset, false);
      }

      showSavedToast(item.title);
    } catch (err) {
      console.log('saveToGallery error:', err);
      Alert.alert('خطأ بالحفظ', describeError(err));
    } finally {
      setSaving(null);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.bgGlow1} />
      <View style={s.bgGlow2} />
      <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />

      {toastShow && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.toast,
            {
              opacity: toastAnim,
              transform: [
                { translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
              ],
            },
          ]}
        >
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={s.toastGlass} />
          <View style={s.toastIconWrap}>
            <Ionicons name="checkmark" size={16} color="#10b981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.toastTitle}>تم الحفظ</Text>
            <Text style={s.toastSubtitle} numberOfLines={1}>{toastTitle}</Text>
          </View>
        </Animated.View>
      )}

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.replace('/settings')} style={s.backBtn}>
          <Ionicons name="chevron-forward" size={20} color={C.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>خلفيات الهاتف</Text>
        <View style={{ width: 34 }} />
      </View>

      <View style={s.filterRow}>
        {CATEGORIES.map(c => (
          <TouchableOpacity
            key={c}
            style={[s.filterBtn, cat === c && s.filterBtnActive]}
            onPress={() => setCat(c)}
          >
            <Text style={[s.filterText, cat === c && s.filterTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        numColumns={COLS}
        keyExtractor={i => i.id}
        contentContainerStyle={s.grid}
        columnWrapperStyle={{ gap: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card} activeOpacity={0.9} onPress={() => setSelected(item)}>
            <Image source={item.uri} style={s.thumb} contentFit="cover" />
            {likedIds.has(item.id) && (
              <View style={s.likedBadge}>
                <Ionicons name="heart" size={12} color="#ff5c7a" />
              </View>
            )}
            {Platform.OS !== 'web' && (
              <View style={s.cardInfo}>
                <TouchableOpacity style={s.saveBtn} onPress={() => saveToGallery(item)} activeOpacity={0.75}>
                  <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                  <View style={s.saveBtnGlass} />
                  <Ionicons name={saving === item.id ? 'checkmark' : 'download-outline'} size={14} color={saving === item.id ? '#10b981' : '#fff'} />
                  <Text style={s.saveBtnText}>{saving === item.id ? 'تم' : 'حفظ'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={s.modalRoot}>
            <Image source={selected.uri} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} />
            <View style={s.modalDimOverlay} />

            <SafeAreaView style={s.modalHeader}>
              <TouchableOpacity style={s.modalCloseBtn} onPress={() => setSelected(null)}>
                <Ionicons name="close" size={22} color={C.white} />
              </TouchableOpacity>
            </SafeAreaView>

            <Image source={selected.uri} style={s.modalImage} contentFit="contain" />

            <View style={s.modalFooter}>
              <View style={s.modalActions}>
                <TouchableOpacity style={s.modalActionBtn} onPress={() => toggleLike(selected.id)} activeOpacity={0.7}>
                  <Ionicons
                    name={likedIds.has(selected.id) ? 'heart' : 'heart-outline'}
                    size={26}
                    color={likedIds.has(selected.id) ? '#ff5c7a' : C.white}
                  />
                </TouchableOpacity>

                <TouchableOpacity style={s.modalActionBtn} onPress={() => shareWallpaper(selected)} activeOpacity={0.7}>
                  <Ionicons name="share-social-outline" size={24} color={C.white} />
                </TouchableOpacity>

                <TouchableOpacity style={s.modalActionBtn} onPress={() => saveToGallery(selected)} activeOpacity={0.7}>
                  <Ionicons
                    name={saving === selected.id ? 'checkmark' : 'download-outline'}
                    size={24}
                    color={saving === selected.id ? '#10b981' : C.white}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Modal>

      <Text style={s.hint}>
        {Platform.OS === 'web'
          ? 'حفظ الخلفيات بمعرض الصور متاح داخل تطبيق الموبايل فقط'
          : 'اضغط "حفظ" لتنزيل الصورة في معرض الهاتف'}
      </Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1f2d' },
  bgGlow1: {
    position: 'absolute', top: -80, right: -60,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(87,200,242,0.12)',
  },
  bgGlow2: {
    position: 'absolute', bottom: -100, left: -80,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16 },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    color: C.white, fontSize: 18, fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.glassBorder, backgroundColor: C.glass },
  filterBtnActive: { backgroundColor: 'rgba(87,200,242,0.22)', borderColor: C.neonBlue },
  filterText: { color: C.muted, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: C.neonBlue },
  grid: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  card: { flex: 1, height: THUMB * 1.5, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder },
  thumb: { ...StyleSheet.absoluteFill },
  cardInfo: { position: 'absolute', bottom: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'flex-end' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 5 },
  saveBtnGlass: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.08)' },
  saveBtnText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  hint: { color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'center', paddingBottom: 16 },

  likedBadge: {
    position: 'absolute', top: 8, left: 8,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },

  modalRoot: { flex: 1, backgroundColor: '#0d1f2d' },
  modalDimOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(13,31,45,0.55)' },
  modalHeader: { paddingHorizontal: 16, paddingTop: 8 },
  modalCloseBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  modalImage: { flex: 1, width: '100%' },
  modalFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'center', gap: 36 },
  modalActionBtn: {
    width: 44, height: 44,
    justifyContent: 'center', alignItems: 'center',
  },

  toast: {
    position: 'absolute', top: 12, left: 16, right: 16, zIndex: 999,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: C.glassBorder,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  toastGlass: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.06)' },
  toastIconWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(16,185,129,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  toastTitle: { color: C.white, fontSize: 13, fontWeight: '800' },
  toastSubtitle: { color: C.muted, fontSize: 11, fontWeight: '600', marginTop: 1 },
});
