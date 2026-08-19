// src/app/settings/calendar.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// ⚠️ SafeAreaView من react-native نفسها ما تشتغل بالاندرويد (بس بالآيفون) — لازم من هذي المكتبة
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeContext } from '@/contexts/theme-contexts';
import { getSelectedBackground } from '@/utils/backgroundSettings';
// نفس المصدر المستخدم بالإشعارات بالضبط - حساب هجري موثوق (يشتغل صح بالاندرويد
// بعكس Intl.DateTimeFormat اللي كان يفشل بصمت على Hermes) + قائمة مناسبات وحيدة
// دقيقة، بدل نسخة محلية قديمة كانت فيها أخطاء بتواريخ بعض المعصومين
import { getHijriParts, getOccasion, HIJRI_OCCASIONS } from '@/utils/hijriOccasions';

export const CALENDAR_PREF_KEY = '@calendar_display_pref';
export type CalendarPref = 'both' | 'hijri' | 'gregorian';

const OPTIONS: { id: CalendarPref; title: string; desc: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'both',      title: 'هجري وميلادي',  desc: 'يعرض التاريخين معاً',         icon: 'calendar' },
  { id: 'hijri',     title: 'هجري فقط',      desc: 'يعرض التاريخ الهجري فقط',     icon: 'moon' },
  { id: 'gregorian', title: 'ميلادي فقط',    desc: 'يعرض التاريخ الميلادي فقط',   icon: 'sunny' },
];

const GREG_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const WEEKDAYS = ['أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];
const C = { neonBlue: '#57C8F2', glass: 'rgba(255,255,255,0.10)', glassBorder: 'rgba(255,255,255,0.22)' };

function toArabicDigits(num: number | string): string {
  const ar = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  return String(num).replace(/[0-9]/g, (d) => ar[parseInt(d, 10)]);
}

export default function CalendarSettingsScreen() {
  const router = useRouter();
  const { backgroundId } = useThemeContext();
  const bgOption = getSelectedBackground(backgroundId);
  const [selected, setSelected] = useState<CalendarPref>('both');

  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);
  const [occasionsExpanded, setOccasionsExpanded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CALENDAR_PREF_KEY).then((v) => { if (v) setSelected(v as CalendarPref); });
  }, []);

  const select = async (pref: CalendarPref) => {
    setSelected(pref);
    await AsyncStorage.setItem(CALENDAR_PREF_KEY, pref);
  };

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth     = new Date(year, month + 1, 0).getDate();
  const startWeekday    = firstDayOfMonth.getDay();
  const hijriHeader     = getHijriParts(new Date(year, month, 15));

  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const goPrevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const goNextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday     = () => { setViewDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(today); };

  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const isSelected = (day: number) =>
    day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();

  const selH   = getHijriParts(selectedDate);
  const selOcc = getOccasion(selH.month, selH.day);

  const content = (
    <SafeAreaView style={[s.container, !bgOption.image && { backgroundColor: bgOption.color }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>التقويم</Text>
          <TouchableOpacity onPress={goToday} style={s.backBtn}>
            <Ionicons name="today-outline" size={17} color={C.neonBlue} />
          </TouchableOpacity>
        </View>

        {/* طريقة العرض */}
        <Text style={s.sectionLabel}>طريقة عرض التاريخ</Text>
        <View style={s.card}>
          <View style={s.glassOverlay} />
          {OPTIONS.map((opt, i) => (
            <TouchableOpacity
              key={opt.id}
              style={[s.row, i < OPTIONS.length - 1 && s.rowBorder]}
              onPress={() => select(opt.id)}
              activeOpacity={0.7}
            >
              <View style={[s.iconCircle, selected === opt.id && s.iconCircleActive]}>
                <Ionicons name={opt.icon} size={18} color={selected === opt.id ? C.neonBlue : 'rgba(255,255,255,0.6)'} />
              </View>
              <View style={s.rowContent}>
                <Text style={s.rowTitle}>{opt.title}</Text>
                <Text style={s.rowDesc}>{opt.desc}</Text>
              </View>
              <View style={[s.radio, selected === opt.id && s.radioActive]}>
                {selected === opt.id && <View style={s.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* التقويم الكامل - شهر بالهجري والميلادي */}
        <Text style={s.sectionLabel}>الشهر الحالي</Text>
        <View style={s.monthCard}>
          <View style={s.glassOverlay} />

          <View style={s.monthNavRow}>
            <TouchableOpacity onPress={goNextMonth} style={s.navArrow}>
              <Ionicons name="chevron-back" size={20} color={C.neonBlue} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={s.monthGregorian}>{GREG_MONTHS[month]} {toArabicDigits(year)}</Text>
              <Text style={s.monthHijri}>{hijriHeader.month} {toArabicDigits(hijriHeader.year)} هـ</Text>
            </View>
            <TouchableOpacity onPress={goPrevMonth} style={s.navArrow}>
              <Ionicons name="chevron-forward" size={20} color={C.neonBlue} />
            </TouchableOpacity>
          </View>

          <View style={s.weekRow}>
            {WEEKDAYS.map((w) => <Text key={w} style={s.weekdayLabel}>{w}</Text>)}
          </View>

          <View style={s.grid}>
            {cells.map((day, idx) => {
              if (day === null) return <View key={idx} style={s.cell} />;
              const cellDate = new Date(year, month, day);
              const hijri = getHijriParts(cellDate);
              const occ = getOccasion(hijri.month, hijri.day);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[s.cell, s.dayCell, isToday(day) && s.dayCellToday, !isToday(day) && isSelected(day) && s.dayCellSelected]}
                  onPress={() => setSelectedDate(cellDate)}
                >
                  <Text style={[s.dayGregorian, isToday(day) && s.dayTextToday]}>{toArabicDigits(day)}</Text>
                  <Text style={[s.dayHijri, isToday(day) && s.dayHijriToday]}>{toArabicDigits(hijri.day)}</Text>
                  {occ && <View style={[s.occasionDot, { backgroundColor: occ.type === 'sorrow' ? '#9CA3AF' : C.neonBlue }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* تفاصيل اليوم المحدد */}
        <View style={s.selCard}>
          <View style={s.glassOverlay} />
          <Ionicons name={selOcc ? 'sparkles' : 'calendar-outline'} size={16} color={C.neonBlue} />
          <View style={{ flex: 1 }}>
            <Text style={s.selDateText}>
              {WEEKDAYS[selectedDate.getDay()]} {toArabicDigits(selectedDate.getDate())} {GREG_MONTHS[selectedDate.getMonth()]} {toArabicDigits(selectedDate.getFullYear())} م
              {'  •  '}{toArabicDigits(selH.day)} {selH.month} {toArabicDigits(selH.year)} هـ
            </Text>
            {selOcc && <Text style={[s.selOccText, { color: selOcc.type === 'sorrow' ? '#9CA3AF' : C.neonBlue }]}>{selOcc.name}</Text>}
          </View>
        </View>

        {/* كل المناسبات الهجرية الشيعية - مدمجة بالشاشة */}
        <TouchableOpacity style={s.occHeaderRow} onPress={() => setOccasionsExpanded((v) => !v)} activeOpacity={0.7}>
          <Text style={s.sectionLabel}>كل المناسبات الهجرية</Text>
          <Ionicons name={occasionsExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>

        {occasionsExpanded && (
          <View style={s.occListCard}>
            <View style={s.glassOverlay} />
            {HIJRI_OCCASIONS.map((o, i) => {
              const [m, d] = o.key.split('-');
              return (
                <View key={o.key} style={[s.occRow, i < HIJRI_OCCASIONS.length - 1 && s.rowBorder]}>
                  <View style={[s.occDotBig, { backgroundColor: o.type === 'sorrow' ? '#9CA3AF' : C.neonBlue }]} />
                  <Text style={s.occRowName}>{o.name}</Text>
                  <Text style={s.occRowDate}>{toArabicDigits(d)} {m}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={s.previewCard}>
          <View style={s.glassOverlay} />
          <Text style={s.previewLabel}>معاينة عرض التاريخ بالواجهة الرئيسية</Text>
          <Text style={s.previewText}>{getPreview(selected)}</Text>
        </View>
      </ScrollView>
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

function getPreview(pref: CalendarPref): string {
  const d = new Date();
  const days = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const gregorian = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} م`;
  const hParts = getHijriParts(d);
  const hijri = hParts.day ? `${toArabicDigits(hParts.day)} ${hParts.month} ${toArabicDigits(hParts.year)} هـ` : '';
  const day = days[d.getDay()];
  if (pref === 'hijri')     return hijri ? `${day} | ${hijri}` : `${day} | ${gregorian}`;
  if (pref === 'gregorian') return `${day} | ${gregorian}`;
  return hijri ? `${day} | ${gregorian}  •  ${hijri}` : `${day} | ${gregorian}`;
}

const s = StyleSheet.create({
  container: { flex: 1 },
  bgFill: { flex: 1 },
  bgImage: { flex: 1, width: '100%', height: '100%' },
  bgOverlay: { ...StyleSheet.absoluteFill, backgroundColor: '#000' },
  scroll: { paddingHorizontal: 16, paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, marginBottom: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  sectionLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '600', textAlign: 'right', marginBottom: 8, marginRight: 4 },

  card: { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder, marginBottom: 20 },
  glassOverlay: { ...StyleSheet.absoluteFill, backgroundColor: C.glass },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  iconCircleActive: { backgroundColor: 'rgba(63,169,217,0.22)' },
  rowContent: { flex: 1 },
  rowTitle: { color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'right', marginBottom: 2 },
  rowDesc: { color: 'rgba(255,255,255,0.38)', fontSize: 12, textAlign: 'right' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  radioActive: { borderColor: '#3FA9D9' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3FA9D9' },

  monthCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder, padding: 16, marginBottom: 14 },
  monthNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  navArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(63,169,217,0.18)', alignItems: 'center', justifyContent: 'center' },
  monthGregorian: { color: '#fff', fontSize: 17, fontWeight: '700' },
  monthHijri: { color: C.neonBlue, fontSize: 12, fontWeight: '600', marginTop: 2 },
  weekRow: { flexDirection: 'row-reverse', marginBottom: 6 },
  weekdayLabel: { flex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap' },
  cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCell: { borderRadius: 12, marginVertical: 1 },
  dayCellToday: { backgroundColor: 'rgba(63,169,217,0.25)', borderWidth: 1, borderColor: C.neonBlue },
  dayCellSelected: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  dayGregorian: { color: '#fff', fontSize: 14, fontWeight: '700' },
  dayHijri: { color: 'rgba(255,255,255,0.4)', fontSize: 9, marginTop: 1 },
  dayTextToday: { color: C.neonBlue },
  dayHijriToday: { color: 'rgba(87,200,242,0.85)' },
  occasionDot: { position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2 },

  selCard: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 20 },
  selDateText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', textAlign: 'right' },
  selOccText: { fontSize: 12, fontWeight: '700', textAlign: 'right', marginTop: 3 },

  occHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  occListCard: { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder, marginBottom: 20 },
  occRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  occDotBig: { width: 8, height: 8, borderRadius: 4 },
  occRowName: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  occRowDate: { color: C.neonBlue, fontSize: 11.5, fontWeight: '700' },

  previewCard: { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder, padding: 20, alignItems: 'center' },
  previewLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginBottom: 10 },
  previewText: { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});