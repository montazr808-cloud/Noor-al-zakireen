// src/app/settings/qibla.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Line, Text as SvgText } from 'react-native-svg';

import { useThemeContext } from '@/contexts/theme-contexts';
import { getSelectedBackground } from '@/utils/backgroundSettings';

const { width: W } = Dimensions.get('window');
const COMPASS_SIZE = Math.min(W - 64, 300);

// نفس باليت الزجاج النيوني المستخدمة بالتسبيح بالضبط
const C = {
  white: '#FFFFFF',
  neonBlue: '#57C8F2',
  neonGlow: 'rgba(87,200,242,0.55)',
  glass: 'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(255,255,255,0.22)',
  blueDim: 'rgba(63,169,217,0.18)',
  aligned: '#3ddc84',
};

const LOCATION_CACHE_KEY = '@app_location_cache_v1'; // صلاحية/موقع مشترك لكل التطبيق

// مدن للاختيار اليدوي بدون GPS (مفيد للمسافرين أو لو الموقع غير دقيق)
const CITIES = [
  { name: 'بغداد',        lat: 33.3152, lon: 44.3661 },
  { name: 'النجف',         lat: 32.0286, lon: 44.3489 },
  { name: 'كربلاء',        lat: 32.6160, lon: 44.0249 },
  { name: 'البصرة',        lat: 30.5085, lon: 47.7835 },
  { name: 'أربيل',         lat: 36.1900, lon: 44.0090 },
  { name: 'مكة المكرمة',   lat: 21.4225, lon: 39.8262 },
  { name: 'المدينة المنورة', lat: 24.4672, lon: 39.6024 },
  { name: 'القاهرة',       lat: 30.0444, lon: 31.2357 },
  { name: 'بيروت',         lat: 33.8886, lon: 35.4955 },
  { name: 'عمّان',         lat: 31.9544, lon: 35.9106 },
  { name: 'الكويت',        lat: 29.3759, lon: 47.9774 },
  { name: 'إسطنبول',       lat: 41.0082, lon: 28.9784 },
];

function calcQiblaAngle(lat: number, lon: number): number {
  const makkahLat = 21.4225 * (Math.PI / 180);
  const makkahLon = 39.8262 * (Math.PI / 180);
  const userLat   = lat * (Math.PI / 180);
  const dLon      = makkahLon - lon * (Math.PI / 180);
  const y = Math.sin(dLon) * Math.cos(makkahLat);
  const x = Math.cos(userLat) * Math.sin(makkahLat) - Math.sin(userLat) * Math.cos(makkahLat) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function calcDistanceKm(lat: number, lon: number): number {
  const R = 6371;
  const makkahLat = 21.4225, makkahLon = 39.8262;
  const dLat = (makkahLat - lat) * (Math.PI / 180);
  const dLon = (makkahLon - lon) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat * (Math.PI / 180)) * Math.cos(makkahLat * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function QiblaScreen() {
  const router = useRouter();
  const { backgroundId } = useThemeContext();
  const bgOption = getSelectedBackground(backgroundId);

  const [heading, setHeading]       = useState(0);
  const [coords, setCoords]         = useState<{ lat: number; lon: number } | null>(null);
  const [accuracy, setAccuracy]     = useState<'low' | 'medium' | 'high'>('low');
  const [error, setError]           = useState('');
  const [locationName, setLocName]  = useState('');
  const [sensorSupported, setSensorSupported] = useState(Platform.OS !== 'web');
  const [cityPickerOpen, setCityPickerOpen]   = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);

  const rotateAnim   = useRef(new Animated.Value(0)).current;
  const needleAnim   = useRef(new Animated.Value(0)).current;
  const prevHeading  = useRef(0);
  const lowAccuracySince = useRef<number | null>(null);
  const lastHapticTime   = useRef(0);

  const qiblaAngle = coords ? calcQiblaAngle(coords.lat, coords.lon) : null;
  const distanceKm = coords ? calcDistanceKm(coords.lat, coords.lon) : null;

  // ===== الموقع - صلاحية واحدة مشتركة بكل التطبيق (تُحفظ وتُستخدم بدون إعادة طلب) =====
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.lat && parsed.lon) {
            setCoords({ lat: parsed.lat, lon: parsed.lon });
            setLocName(parsed.name ?? '');
          }
        }
      } catch {}
      await fetchLiveLocation();
    })();
  }, []);

  const fetchLiveLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('يرجى السماح بالوصول للموقع، أو اختر مدينتك يدوياً من الزر بالأسفل');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      setCoords({ lat: latitude, lon: longitude });
      setError('');
      let name = '';
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
        name = `${place.city ?? place.region ?? ''}, ${place.country ?? ''}`;
        setLocName(name);
      } catch {}
      await AsyncStorage.setItem(
        LOCATION_CACHE_KEY,
        JSON.stringify({ lat: latitude, lon: longitude, name, manual: false })
      );
    } catch {
      setError('تعذّر تحديد الموقع تلقائياً، اختر مدينتك يدوياً من الزر بالأسفل');
    }
  };

  const selectCityManually = async (city: typeof CITIES[number]) => {
    setCoords({ lat: city.lat, lon: city.lon });
    setLocName(city.name);
    setError('');
    setCityPickerOpen(false);
    await AsyncStorage.setItem(
      LOCATION_CACHE_KEY,
      JSON.stringify({ lat: city.lat, lon: city.lon, name: city.name, manual: true })
    );
  };

  // ===== حساس البوصلة - فقط على جهاز حقيقي (غير مدعوم بالويب) =====
  useEffect(() => {
    if (Platform.OS === 'web') {
      setSensorSupported(false);
      return;
    }
    let sub: any;
    try {
      const { Magnetometer } = require('expo-sensors');
      Magnetometer.setUpdateInterval(100);
      sub = Magnetometer.addListener(({ x, y }: { x: number; y: number }) => {
        let angle = (Math.atan2(y, x) * 180) / Math.PI;
        angle = (angle + 360) % 360;
        setHeading(angle);
        const strength = Math.abs(x) + Math.abs(y);
        setAccuracy(strength > 40 ? 'high' : strength > 20 ? 'medium' : 'low');
      });
    } catch {
      setSensorSupported(false);
    }
    return () => sub?.remove();
  }, []);

  // ===== المعايرة - تظهر تلقائياً لو الدقة ضعيفة لمدة مستمرة =====
  useEffect(() => {
    if (accuracy === 'low' && sensorSupported) {
      if (lowAccuracySince.current === null) lowAccuracySince.current = Date.now();
      const elapsed = Date.now() - lowAccuracySince.current;
      if (elapsed > 4000) setShowCalibration(true);
    } else {
      lowAccuracySince.current = null;
      setShowCalibration(false);
    }
  }, [accuracy, sensorSupported]);

  // ===== انيميشن إبرة القبلة =====
  useEffect(() => {
    if (qiblaAngle === null) return;
    const target = (qiblaAngle - heading + 360) % 360;
    let diff = target - prevHeading.current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    const next = prevHeading.current + diff;
    prevHeading.current = next;
    Animated.timing(needleAnim, { toValue: next, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [heading, qiblaAngle]);

  const needleRotate = needleAnim.interpolate({ inputRange: [-720, 720], outputRange: ['-720deg', '720deg'] });
  const diff = qiblaAngle !== null ? Math.abs(((qiblaAngle - heading + 540) % 360) - 180) : 999;
  const isAligned = diff < 5 && sensorSupported;

  // ===== تنبيه المطابقة: صوت + اهتزاز + تغيير لون (الثلاثة مع بعض) =====
  useEffect(() => {
    if (isAligned) {
      const now = Date.now();
      if (now - lastHapticTime.current > 1500) {
        lastHapticTime.current = now;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  }, [isAligned]);

  const accuracyColor = accuracy === 'high' ? C.aligned : accuracy === 'medium' ? '#d97706' : '#ef4444';
  const accuracyText  = accuracy === 'high' ? 'دقيق' : accuracy === 'medium' ? 'متوسط' : 'ضعيف';
  const ringColor = isAligned ? C.aligned : C.neonBlue;

  const content = (
    <SafeAreaView style={[s.container, !bgOption.image && { backgroundColor: bgOption.color }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollOuter}>
        <View style={s.wrap}>
          {/* الهيدر */}
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
              <Ionicons name="chevron-forward" size={20} color={C.white} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>اتجاه القبلة</Text>
            <View style={{ width: 38 }} />
          </View>

          {error && !coords ? (
            <View style={s.errorBox}>
              <Ionicons name="location-outline" size={40} color="rgba(255,255,255,0.4)" />
              <Text style={s.errorText}>{error}</Text>
              <TouchableOpacity style={s.manualBtn} onPress={() => setCityPickerOpen(true)}>
                <Ionicons name="map-outline" size={16} color={C.neonBlue} />
                <Text style={s.manualBtnText}>اختيار المدينة يدوياً</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.content}>
              {!sensorSupported && (
                <View style={s.webNotice}>
                  <Ionicons name="information-circle-outline" size={16} color="#d97706" />
                  <Text style={s.webNoticeText}>
                    البوصلة الحية تحتاج جهاز حقيقي. على المتصفح تظهر زاوية القبلة فقط بدون دوران تلقائي.
                  </Text>
                </View>
              )}

              {showCalibration && (
                <View style={s.calibBanner}>
                  <Ionicons name="sync-outline" size={18} color="#d97706" />
                  <Text style={s.calibText}>
                    دقة البوصلة ضعيفة - حرك هاتفك بشكل رقم ٨ بالهواء عدة مرات لمعايرتها
                  </Text>
                </View>
              )}

              {/* البوصلة الزجاجية */}
              <View style={[s.compassOuter, isAligned && s.compassOuterAligned]}>
                {/* الحلقة الخارجية بخطوط الدرجات */}
                <Svg
                  width={COMPASS_SIZE + 48}
                  height={COMPASS_SIZE + 48}
                  style={StyleSheet.absoluteFill}
                  viewBox={`0 0 ${COMPASS_SIZE + 48} ${COMPASS_SIZE + 48}`}
                >
                  {Array.from({ length: 72 }).map((_, i) => {
                    const angle = i * 5 - heading;
                    const rad   = (angle * Math.PI) / 180;
                    const cx    = (COMPASS_SIZE + 48) / 2;
                    const cy    = (COMPASS_SIZE + 48) / 2;
                    const outerR = (COMPASS_SIZE + 48) / 2 - 4;
                    const isMajor = i % 9 === 0;
                    const innerR  = outerR - (isMajor ? 12 : 5);
                    return (
                      <Line key={i}
                        x1={cx + Math.sin(rad) * outerR} y1={cy - Math.cos(rad) * outerR}
                        x2={cx + Math.sin(rad) * innerR} y2={cy - Math.cos(rad) * innerR}
                        stroke={isMajor ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.18)'}
                        strokeWidth={isMajor ? 2 : 1}
                      />
                    );
                  })}
                  {/* حروف الاتجاهات على الحلقة */}
                  {[
                    { label: 'ش', deg: 0,   color: '#ef4444' },
                    { label: 'ج', deg: 180, color: 'rgba(255,255,255,0.65)' },
                    { label: 'ر', deg: 90,  color: 'rgba(255,255,255,0.65)' },
                    { label: 'غ', deg: 270, color: 'rgba(255,255,255,0.65)' },
                  ].map((d) => {
                    const rad = ((d.deg - heading) * Math.PI) / 180;
                    const r   = (COMPASS_SIZE + 48) / 2 - 26;
                    const cx  = (COMPASS_SIZE + 48) / 2 + Math.sin(rad) * r;
                    const cy  = (COMPASS_SIZE + 48) / 2 - Math.cos(rad) * r;
                    return (
                      <SvgText key={d.label} x={cx} y={cy + 5} fontSize={13} fontWeight="bold"
                        fill={d.color} textAnchor="middle">{d.label}</SvgText>
                    );
                  })}
                </Svg>

                {/* الدائرة الداخلية الزجاجية */}
                <View style={[s.compassInner, isAligned && { borderColor: C.aligned }]}>
                  {/* توهج مركزي */}
                  <View style={[s.compassGlow, { backgroundColor: isAligned ? 'rgba(61,220,132,0.12)' : 'rgba(87,200,242,0.1)' }]} />

                  {/* الكعبة في الأعلى (ثابتة) */}
                  <View style={s.kaabaFixed}>
                    <Text style={{ fontSize: 26 }}>🕋</Text>
                  </View>

                  {/* الإبرة المتحركة */}
                  <Animated.View style={[s.needleContainer, { transform: [{ rotate: needleRotate }] }]}>
                    {/* الإبرة العلوية — ذهبية */}
                    <View style={s.needleUp} />
                    {/* الإبرة السفلية — شفافة */}
                    <View style={s.needleDown} />
                  </Animated.View>

                  {/* نقطة المركز */}
                  <View style={[s.needleDot, { borderColor: ringColor }]} />
                </View>

                {qiblaAngle !== null && (
                  <Text style={[s.angleText, { color: ringColor }]}>{Math.round(qiblaAngle)}°</Text>
                )}
              </View>

              {isAligned && (
                <View style={s.alignedBadge}>
                  <Ionicons name="checkmark-circle" size={18} color={C.aligned} />
                  <Text style={s.alignedText}>أنت تواجه القبلة</Text>
                </View>
              )}

              {/* بطاقات المعلومات */}
              <View style={s.infoRow}>
                <View style={s.infoCard}>
                  <View style={[s.accDot, { backgroundColor: accuracyColor }]} />
                  <Text style={s.infoLabel}>دقة الحساس</Text>
                  <Text style={[s.infoValue, { color: accuracyColor }]}>{sensorSupported ? accuracyText : '—'}</Text>
                </View>
                <View style={s.infoCard}>
                  <Ionicons name="compass-outline" size={16} color="rgba(255,255,255,0.5)" />
                  <Text style={s.infoLabel}>الاتجاه الحالي</Text>
                  <Text style={s.infoValue}>{Math.round(heading)}°</Text>
                </View>
                <View style={s.infoCard}>
                  <Ionicons name="navigate-outline" size={16} color="rgba(255,255,255,0.5)" />
                  <Text style={s.infoLabel}>المسافة لمكة</Text>
                  <Text style={s.infoValue}>{distanceKm ? `${distanceKm} كم` : '--'}</Text>
                </View>
              </View>

              {/* الموقع + التعديل اليدوي */}
              <TouchableOpacity style={s.locationBadge} onPress={() => setCityPickerOpen(true)}>
                <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.6)" />
                <Text style={s.locationText}>{locationName || 'تحديد الموقع...'}</Text>
                <Ionicons name="create-outline" size={14} color={C.neonBlue} />
              </TouchableOpacity>

              <Text style={s.hint}>أمسك الهاتف أفقياً وابتعد عن المعادن للحصول على أدق نتيجة</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal اختيار المدينة يدوياً - بنفس الشاشة بدون أي رجوع */}
      <Modal visible={cityPickerOpen} transparent animationType="fade" onRequestClose={() => setCityPickerOpen(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setCityPickerOpen(false)}>
          <View style={s.cityCard} onStartShouldSetResponder={() => true}>
            <View style={s.cityHeader}>
              <Text style={s.cityTitle}>اختر مدينتك</Text>
              <TouchableOpacity onPress={() => setCityPickerOpen(false)}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.cityRow} onPress={fetchLiveLocation}>
              <Ionicons name="locate" size={16} color={C.neonBlue} />
              <Text style={[s.cityRowText, { color: C.neonBlue }]}>استخدام موقعي الحالي (GPS)</Text>
            </TouchableOpacity>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {CITIES.map((city) => (
                <TouchableOpacity key={city.name} style={s.cityRow} onPress={() => selectCityManually(city)}>
                  <Ionicons name="business-outline" size={15} color="rgba(255,255,255,0.5)" />
                  <Text style={s.cityRowText}>{city.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );

  if (bgOption.image) {
    return (
      <View style={[s.bgFill, { backgroundColor: bgOption.color }]}>
        <ImageBackground source={bgOption.image} style={s.bgImage} resizeMode="cover">
          <View style={[s.bgOverlay, { opacity: bgOption.overlayOpacity }]} />
          {content}
        </ImageBackground>
      </View>
    );
  }
  return content;
}

const s = StyleSheet.create({
  container: { flex: 1 },
  bgFill: { flex: 1 },
  bgImage: { flex: 1, width: '100%', height: '100%' },
  bgOverlay: { ...StyleSheet.absoluteFill, backgroundColor: '#000' },

  scrollOuter: { alignItems: 'center', paddingBottom: 110 },
  wrap: { width: '100%', maxWidth: 480, paddingHorizontal: 16 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: C.white, fontSize: 18, fontWeight: '800' },

  errorBox: { alignItems: 'center', gap: 14, paddingVertical: 60 },
  errorText: { color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  manualBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder,
    borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10,
  },
  manualBtnText: { color: C.neonBlue, fontSize: 13, fontWeight: '700' },

  content: { alignItems: 'center', gap: 18 },

  webNotice: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(217,119,6,0.15)', borderWidth: 1, borderColor: 'rgba(217,119,6,0.35)',
    borderRadius: 12, padding: 10, width: '100%',
  },
  webNoticeText: { color: 'rgba(255,255,255,0.75)', fontSize: 11, flex: 1, textAlign: 'right' },

  calibBanner: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(217,119,6,0.15)', borderWidth: 1, borderColor: 'rgba(217,119,6,0.35)',
    borderRadius: 12, padding: 10, width: '100%',
  },
  calibText: { color: 'rgba(255,255,255,0.8)', fontSize: 11, flex: 1, textAlign: 'right' },

  compassOuter: {
    width: COMPASS_SIZE + 48,
    height: COMPASS_SIZE + 48,
    borderRadius: (COMPASS_SIZE + 48) / 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: C.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.neonBlue,
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  compassOuterAligned: {
    borderColor: C.aligned,
    shadowColor: C.aligned,
    shadowOpacity: 0.5,
  },
  compassInner: {
    width: COMPASS_SIZE - 10,
    height: COMPASS_SIZE - 10,
    borderRadius: (COMPASS_SIZE - 10) / 2,
    backgroundColor: 'rgba(87,200,242,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(87,200,242,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  compassGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: (COMPASS_SIZE - 10) / 2,
  },
  kaabaFixed: {
    position: 'absolute',
    top: COMPASS_SIZE * 0.08,
    alignSelf: 'center',
  },
  needleContainer: {
    position: 'absolute',
    width: 10,
    height: COMPASS_SIZE * 0.68,
    alignItems: 'center',
  },
  needleUp: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: COMPASS_SIZE * 0.34,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#c8a84b',
  },
  needleDown: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: COMPASS_SIZE * 0.34,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.22)',
  },
  needleDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.white,
    borderWidth: 2.5,
  },
  angleText: { position: 'absolute', bottom: 8, fontSize: 13, fontWeight: '800' },

  alignedBadge: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(61,220,132,0.15)', borderWidth: 1, borderColor: 'rgba(61,220,132,0.4)',
    borderRadius: 14, paddingHorizontal: 18, paddingVertical: 9,
  },
  alignedText: { color: C.aligned, fontSize: 13, fontWeight: '800' },

  infoRow: { flexDirection: 'row', gap: 10, width: '100%' },
  infoCard: {
    flex: 1, borderRadius: 14, backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder,
    padding: 12, alignItems: 'center', gap: 4,
  },
  accDot: { width: 9, height: 9, borderRadius: 5 },
  infoLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, textAlign: 'center' },
  infoValue: { color: C.white, fontSize: 14, fontWeight: '800' },

  locationBadge: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, width: '100%',
  },
  locationText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, flex: 1, textAlign: 'right' },

  hint: { color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  cityCard: {
    width: '88%', maxWidth: 360, backgroundColor: 'rgba(20,28,38,0.97)',
    borderWidth: 1, borderColor: C.glassBorder, borderRadius: 20, paddingVertical: 8,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 20,
  },
  cityHeader: {
    flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)',
    marginBottom: 4,
  },
  cityTitle: { color: C.white, fontSize: 14, fontWeight: '700' },
  cityRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16 },
  cityRowText: { color: C.white, fontSize: 13.5, fontWeight: '600' },
});
