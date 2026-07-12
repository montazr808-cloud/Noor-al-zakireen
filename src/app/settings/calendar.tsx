// src/app/settings/calendar.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ImageBackground, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

import { useThemeContext } from '@/contexts/theme-contexts';
import { getSelectedBackground } from '@/utils/backgroundSettings';
import {
  cancelHijriNotifications,
  getHijriNotifPrefs,
  HijriNotifPrefs,
  refreshHijriNotificationsIfNeeded,
  scheduleHijriNotifications,
  setHijriNotifPrefs,
} from '@/utils/hijriNotifications';
import { getHijriParts, getOccasion, toArabicDigits } from '@/utils/hijriOccasions';

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

function sameDate(a: Date, b: Date): boolean {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function getWeekDates(anchor: Date): Date[] {
  const dow = anchor.getDay();
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export default function CalendarSettingsScreen() {
  const router = useRouter();
  const { backgroundId } = useThemeContext();
  const bgOption = getSelectedBackground(backgroundId);
  const [selected, setSelected] = useState<CalendarPref>('both');

  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);
  const [monthExpanded, setMonthExpanded] = useState(false);

  const [notifOccasions, setNotifOccasions] = useState(false);
  const [notifWhiteDays, setNotifWhiteDays] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CALENDAR_PREF_KEY).then((v) => { if (v) setSelected(v as CalendarPref); });
  }, []);

  useEffect(() => {
    (async () => {
      const prefs = await getHijriNotifPrefs();
      setNotifOccasions(prefs.occasions);
      setNotifWhiteDays(prefs.whiteDays);
      await refreshHijriNotificationsIfNeeded(prefs);
    })();
  }, []);

  const select = async (pref: CalendarPref) => {
    setSelected(pref);
    await AsyncStorage.setItem(CALENDAR_PREF_KEY, pref);
  };

  const applyNotifPrefs = async (next: HijriNotifPrefs) => {
    setNotifOccasions(next.occasions);
    setNotifWhiteDays(next.whiteDays);
    await setHijriNotifPrefs(next);

    if (!next.occasions && !next.whiteDays) {
      await cancelHijriNotifications();
      return;
    }

    setNotifLoading(true);
    const res = await scheduleHijriNotifications(next);
    setNotifLoading(false);

    if (!res.success) {
      Alert.alert('التنبيهات', 'الرجاء تفعيل صلاحية الإشعارات من إعدادات الجهاز أولاً');
      setNotifOccasions(false);
      setNotifWhiteDays(false);
      await setHijriNotifPrefs({ occasions: false, whiteDays: false });
    }
  };

  const onToggleOccasions = (val: boolean) => applyNotifPrefs({ occasions: val, whiteDays: notifWhiteDays });
  const onToggleWhiteDays = (val: boolean) => applyNotifPrefs({ occasions: notifOccasions, whiteDays: val });

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth     = new Date(year, month + 1, 0).getDate();
  const startWeekday    = firstDayOfMonth.getDay();
  const hijriHeader     = getHijriParts(new Date(year, month, 15));
  const collapsedHijri  = getHijriParts(selectedDate);

  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

  const goPrevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const goNextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday     = () => { setViewDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(today); };

  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const isSelected = (day: number) =>
    day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();

  const selH   = getHijriParts(selectedDate);
  const selOcc = getOccasion(selH.month, selH.day);
  const isSelToday = sameDate(selectedDate, today);

  const content = (
    <SafeAreaView style={[s.container, !bgOption.image && { backgroundColor: bgOption.color }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.replace('/settings')} style={s.backBtn}>
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

        {/* التقويم - وضع مختصر (أسبوع) أو موسّع (شهر كامل) */}
        <Text style={s.sectionLabel}>{monthExpanded ? 'الشهر الحالي' : 'هذا الأسبوع'}</Text>
        <View style={s.monthCard}>
          <View style={s.glassOverlay} />

          <View style={s.monthNavRow}>
            {monthExpanded && (
              <TouchableOpacity onPress={goNextMonth} style={s.navArrow}>
                <Ionicons name="chevron-back" size={20} color={C.neonBlue} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={{ alignItems: 'center', flex: 1 }}
              onPress={() => setMonthExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              {monthExpanded ? (
                <>
                  <Text style={s.monthGregorian}>{GREG_MONTHS[month]} {toArabicDigits(year)}</Text>
                  <Text style={s.monthHijri}>{hijriHeader.month} {toArabicDigits(hijriHeader.year)} هـ</Text>
                </>
              ) : (
                <>
                  <Text style={s.monthGregorian}>{GREG_MONTHS[selectedDate.getMonth()]} {toArabicDigits(selectedDate.getFullYear())}</Text>
                  <Text style={s.monthHijri}>{collapsedHijri.month} {toArabicDigits(collapsedHijri.year)} هـ</Text>
                </>
              )}
            </TouchableOpacity>
            {monthExpanded && (
              <TouchableOpacity onPress={goPrevMonth} style={s.navArrow}>
                <Ionicons name="chevron-forward" size={20} color={C.neonBlue} />
              </TouchableOpacity>
            )}
          </View>

          <View style={s.weekRow}>
            {WEEKDAYS.map((w) => <Text key={w} style={s.weekdayLabel}>{w}</Text>)}
          </View>

          {monthExpanded ? (
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
          ) : (
            <View style={s.grid}>
              {weekDates.map((d, idx) => {
                const hijri = getHijriParts(d);
                const occ = getOccasion(hijri.month, hijri.day);
                const isTodayCell = sameDate(d, today);
                const isSelCell = sameDate(d, selectedDate);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[s.cell, s.dayCell, isTodayCell && s.dayCellToday, !isTodayCell && isSelCell && s.dayCellSelected]}
                    onPress={() => setSelectedDate(d)}
                  >
                    <Text style={[s.dayGregorian, isTodayCell && s.dayTextToday]}>{toArabicDigits(d.getDate())}</Text>
                    <Text style={[s.dayHijri, isTodayCell && s.dayHijriToday]}>{toArabicDigits(hijri.day)}</Text>
                    {occ && <View style={[s.occasionDot, { backgroundColor: occ.type === 'sorrow' ? '#9CA3AF' : C.neonBlue }]} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity style={s.expandToggle} onPress={() => setMonthExpanded((v) => !v)} activeOpacity={0.7}>
            <Ionicons name={monthExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        {/* تفاصيل اليوم المحدد - مناسبة هذا اليوم فقط إن وجدت */}
        <View style={s.selCard}>
          <View style={s.glassOverlay} />
          <Ionicons name={selOcc ? 'sparkles' : 'calendar-outline'} size={16} color={C.neonBlue} />
          <View style={{ flex: 1 }}>
            <Text style={s.selDateText}>
              <Text style={s.selDateLabel}>{isSelToday ? 'اليوم' : WEEKDAYS[selectedDate.getDay()]}</Text>
              {'  '}{toArabicDigits(selectedDate.getDate())} {GREG_MONTHS[selectedDate.getMonth()]} {toArabicDigits(selectedDate.getFullYear())} م
              {'  •  '}{toArabicDigits(selH.day)} {selH.month} {toArabicDigits(selH.year)} هـ
            </Text>
            {selOcc && <Text style={[s.selOccText, { color: selOcc.type === 'sorrow' ? '#9CA3AF' : C.neonBlue }]}>{selOcc.name}</Text>}
          </View>
        </View>

        {/* تنبيهات المناسبات الهجرية والأيام البيض */}
        <Text style={s.sectionLabel}>الإشعارات والتنبيهات</Text>
        <View style={s.card}>
          <View style={s.glassOverlay} />
          <View style={[s.row, s.rowBorder]}>
            <View style={[s.iconCircle, notifOccasions && s.iconCircleActive]}>
              <Ionicons name="notifications-outline" size={18} color={notifOccasions ? C.neonBlue : 'rgba(255,255,255,0.6)'} />
            </View>
            <View style={s.rowContent}>
              <Text style={s.rowTitle}>تنبيهات المناسبات الهجرية</Text>
              <Text style={s.rowDesc}>إشعار في يوم كل مناسبة دينية (وفيات، أعياد، مواليد)</Text>
            </View>
            <Switch
              value={notifOccasions}
              onValueChange={onToggleOccasions}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(87,200,242,0.5)' }}
              thumbColor={notifOccasions ? C.neonBlue : '#ccc'}
            />
          </View>
          <View style={s.row}>
            <View style={[s.iconCircle, notifWhiteDays && s.iconCircleActive]}>
              <Ionicons name="moon-outline" size={18} color={notifWhiteDays ? C.neonBlue : 'rgba(255,255,255,0.6)'} />
            </View>
            <View style={s.rowContent}>
              <Text style={s.rowTitle}>تنبيهات الأيام البيض</Text>
              <Text style={s.rowDesc}>١٣ - ١٤ - ١٥ من كل شهر هجري، وتنبيه خاص برجب وشعبان</Text>
            </View>
            <Switch
              value={notifWhiteDays}
              onValueChange={onToggleWhiteDays}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(87,200,242,0.5)' }}
              thumbColor={notifWhiteDays ? C.neonBlue : '#ccc'}
            />
          </View>
        </View>
        {notifLoading && <Text style={s.notifLoadingText}>...جاري جدولة التنبيهات</Text>}

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
  let hijri = '';
  try {
    hijri = new Intl.DateTimeFormat('ar', { calendar: 'islamic-civil', day: 'numeric', month: 'long', year: 'numeric' }).format(d).replace(/\s*هـ\.?\s*/g, '').trim() + ' هـ';
  } catch { hijri = ''; }
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
  expandToggle: { alignItems: 'center', paddingTop: 8 },

  selCard: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 20 },
  selDateText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', textAlign: 'right' },
  selDateLabel: { color: '#fff', fontWeight: '800', fontSize: 13 },
  selOccText: { fontSize: 12, fontWeight: '700', textAlign: 'right', marginTop: 3 },

  notifLoadingText: { color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginTop: -12, marginBottom: 16 },

  previewCard: { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.glassBorder, padding: 20, alignItems: 'center' },
  previewLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginBottom: 10 },
  previewText: { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
