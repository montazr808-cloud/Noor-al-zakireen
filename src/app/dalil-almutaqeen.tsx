import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// ⚠️ SafeAreaView من react-native نفسها ما تشتغل بالاندرويد (بس بالآيفون) — لازم من هذي المكتبة
// (نفس السبب اللي خلى عنوان "المجيب" ملازق بشريط الحالة/الشبكة بدل ما ينعزل عنه متل باقي الشاشات)
import { SafeAreaView } from 'react-native-safe-area-context';

import PhoneFrameWrapper from '@/components/PhoneFrameWrapper';
import { useThemeContext } from '@/contexts/theme-contexts';
import { getSelectedBackground } from '@/utils/backgroundSettings';

import {
  addToHistory,
  askSheikh,
  clearHistory,
  getHistory,
  getSelectedMarja,
  MARJA_INFO,
  setSelectedMarja,
  type HistoryItem,
  type Marja,
} from '@/utils/askSheikh';

const MARJAS: { id: Marja }[] = [
  { id: 'sistani' },
  { id: 'khamenei' },
  { id: 'najafi' },
  { id: 'sadr' },
  { id: 'yaqoubi' },
  { id: 'general' },
];

// ===== باليت موحّدة مع باقي الشاشات (نفس منطق tasbih.tsx) =====
const C = {
  navy: '#1C2B39',
  cream: '#EFE3C8',
  blue: '#3FA9D9',
  neonBlue: '#57C8F2',
  neonGlow: 'rgba(87,200,242,0.55)',
  white: '#FFFFFF',
  glass: 'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(255,255,255,0.22)',
  glassDark: 'rgba(0,0,0,0.28)',
  muted: 'rgba(255,255,255,0.55)',
  error: '#e74c3c',
  errorGlass: 'rgba(231,76,60,0.14)',
  errorBorder: 'rgba(231,76,60,0.45)',
};

// جملة مؤشر الكتابة الحية (يعطي إحساس أن الجواب يُكتب أمام المستخدم)
const TYPE_CHARS_PER_TICK = 3;
const TYPE_TICK_MS = 12;

export default function DalilScreen() {
  const { fontScale, backgroundId } = useThemeContext();
  const bgOption = getSelectedBackground(backgroundId);
  const styles = useMemo(() => createStyles(fontScale ?? 1), [fontScale]);

  const [marja, setMarja] = useState<Marja | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [question, setQuestion] = useState('');

  const [answer, setAnswer] = useState('');
  const [displayedAnswer, setDisplayedAnswer] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isError, setIsError] = useState(false);

  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const typeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getSelectedMarja().then((m) => {
      if (m) setMarja(m);
      else setShowPicker(true);
    });
    getHistory().then(setHistory);
  }, []);

  // يحدّث المرجع المعروض كل ما ترجع لهذي الشاشة - يحل مشكلة بقاء الاسم القديم
  // بعد تغيير المرجع من شاشة الإعدادات (الشاشة ما تنعاد mount بس تستعيد التركيز)
  useFocusEffect(
    useCallback(() => {
      getSelectedMarja().then((m) => { if (m) setMarja(m); });
    }, [])
  );

  // تأثير الكتابة التدريجية - يوقف نفسه لو تغيّر الجواب بسرعة (تحسين أداء)
  useEffect(() => {
    if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);

    if (!answer) {
      setDisplayedAnswer('');
      setIsTyping(false);
      return;
    }

    setDisplayedAnswer('');
    setIsTyping(true);
    let i = 0;
    typeIntervalRef.current = setInterval(() => {
      i += TYPE_CHARS_PER_TICK;
      setDisplayedAnswer(answer.slice(0, i));
      if (i >= answer.length) {
        if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
        setIsTyping(false);
      }
    }, TYPE_TICK_MS);

    return () => {
      if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
    };
  }, [answer]);

  const handleSelectMarja = async (m: Marja) => {
    await setSelectedMarja(m);
    setMarja(m);
    setShowPicker(false);
  };

  // إذا المستخدم فرّغ صندوق السؤال بالكامل، نخفي الجواب القديم معه -
  // يبقى معلّق فقط طول ما السؤال المرتبط فيه موجود بالصندوق
  const handleQuestionChange = (text: string) => {
    setQuestion(text);
    if (text.trim().length === 0 && answer) {
      setAnswer('');
      setIsError(false);
    }
  };

  const handleAsk = async () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setAnswer('');
    setIsError(false);

    const result = await askSheikh(question);
    setAnswer(result.text);
    setIsError(result.isError);
    setLoading(false);

    if (marja) {
      const updated = await addToHistory({
        q: question.trim(),
        a: result.text,
        marja,
        ts: Date.now(),
        isError: result.isError,
      });
      setHistory(updated);
    }
  };

  const handleSkipTyping = () => {
    if (!isTyping) return;
    if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
    setDisplayedAnswer(answer);
    setIsTyping(false);
  };

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: answer });
    } catch {}
  };

  const handleHistoryTap = (item: HistoryItem) => {
    setQuestion(item.q);
    setAnswer(item.a);
    setIsError(!!item.isError);
  };

  const handleClearHistory = async () => {
    await clearHistory();
    setHistory([]);
  };

  const marjaInfo = marja ? MARJA_INFO[marja] : null;
  const accentColor = marjaInfo?.color ?? C.blue;

  const screenContent = (
    <SafeAreaView style={styles.container}>
      {/* Modal اختيار المرجع - زجاجي حقيقي (BlurView) بما إنه Overlay */}
      <Modal visible={showPicker} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={styles.pickerCard}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
            <Text style={styles.bismillah}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</Text>
            <Text style={styles.pickerTitle}>المجيب</Text>
            <Text style={styles.pickerSub}>مساعدك الديني الشيعي الإمامي</Text>
            <View style={styles.divider} />
            <Text style={styles.pickerQ}>اختر مرجعك الكريم</Text>

            {marja && (
              <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.pickerCloseBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={16} color={C.white} />
              </TouchableOpacity>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
              {MARJAS.map((m) => {
                const info = MARJA_INFO[m.id];
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.marjaBtn, { borderColor: info.color }]}
                    onPress={() => handleSelectMarja(m.id)}
                    activeOpacity={0.8}
                  >
                    <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
                    {info.image ? (
                      <Image source={info.image} style={styles.marjaBtnAvatar} resizeMode="cover" />
                    ) : (
                      <View style={[styles.marjaBtnAvatarFallback, { borderColor: info.color }]}>
                        <Ionicons name="person-outline" size={22} color={info.color} />
                      </View>
                    )}
                    <View style={styles.marjaTextBox}>
                      <Text style={[styles.marjaName, { color: info.color }]}>{info.name}</Text>
                      <View style={styles.marjaLocationRow}>
                        <Ionicons name="location-outline" size={11} color={C.muted} />
                        <Text style={styles.marjaLocation}>{info.location}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* الهيدر */}
      <View style={styles.header}>
        <View style={{ width: 60 }} />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>المجيب</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {/* اختيار المرجع - مرتب وظاهر بصورته، بدون الحاجة للرجوع للإعدادات */}
      <TouchableOpacity
        style={[styles.marjaBar, { borderColor: accentColor }]}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.8}
      >
        {marjaInfo?.image && (
          <Image source={marjaInfo.image} style={styles.marjaBarAvatar} resizeMode="cover" />
        )}
        <View style={styles.marjaBarTextBox}>
          <Text style={styles.marjaBarLabel}>المرجع المختار</Text>
          <Text style={[styles.marjaBarName, { color: accentColor }]}>
            {marjaInfo?.name ?? 'اختر مرجعاً'}
          </Text>
        </View>
        <Ionicons name="chevron-back" size={20} color={C.muted} />
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* حالة فارغة قبل أول سؤال */}
        {!answer && !loading && !question && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyBismillah}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</Text>
            <Text style={styles.emptyText}>
              اسأل عن أي أمر ديني أو فقهي يخطر ببالك، وسيجيبك المجيب وفق فتاوى
              {marjaInfo ? ` سماحة ${marjaInfo.short}` : ' مرجعك'}.
            </Text>
          </View>
        )}

        {/* مربع السؤال */}
        <TextInput
          style={[styles.input, { borderColor: 'rgba(255,255,255,0.18)' }]}
          placeholder="اكتب سؤالك الديني هنا..."
          placeholderTextColor={C.muted}
          value={question}
          onChangeText={handleQuestionChange}
          multiline
          textAlign="right"
        />

        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: accentColor }, loading && styles.sendBtnDisabled]}
          onPress={handleAsk}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendBtnText}>إرسال السؤال ←</Text>
          )}
        </TouchableOpacity>

        {/* الجواب (أو رسالة الخطأ بتصميم منفصل واضح) */}
        {answer ? (
          <Pressable
            onPress={handleSkipTyping}
            style={[styles.answerBox, isError && styles.answerBoxError]}
          >
            <View style={styles.answerHeader}>
              <View style={styles.answerLabelRow}>
                <Ionicons
                  name={isError ? 'warning-outline' : 'sparkles-outline'}
                  size={16}
                  color={isError ? C.error : C.neonBlue}
                />
                <Text style={[styles.answerLabel, isError && styles.answerLabelError]}>
                  {isError ? 'تنبيه' : 'الجواب'}
                </Text>
              </View>
              {!isError && marjaInfo && (
                <Text style={[styles.answerMarja, { color: marjaInfo.color }]}>
                  وفق {marjaInfo.short}
                </Text>
              )}
            </View>
            <View style={[styles.answerDivider, isError && { backgroundColor: C.errorBorder }]} />
            <Text style={[styles.answerText, isError && styles.answerTextError]}>
              {displayedAnswer}
              {isTyping ? ' ▌' : ''}
            </Text>

            {!isError && !isTyping && answer.length > 0 && (
              <View style={styles.answerActions}>
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnRow]} onPress={handleCopy} activeOpacity={0.7}>
                  <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={14} color={copied ? '#4ade80' : C.white} />
                  <Text style={[styles.actionBtnText, copied && { color: '#4ade80' }]}>{copied ? 'تم النسخ' : 'نسخ'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnRow]} onPress={handleShare} activeOpacity={0.7}>
                  <Ionicons name="share-social-outline" size={14} color={C.white} />
                  <Text style={styles.actionBtnText}>مشاركة</Text>
                </TouchableOpacity>
              </View>
            )}

            {!isError && !isTyping && marjaInfo && (
              <View style={styles.sourcesBox}>
                <View style={styles.sourcesLabelRow}>
                  <Ionicons name="library-outline" size={13} color="#c9a84c" />
                  <Text style={styles.sourcesLabel}>المصادر المعتمدة</Text>
                </View>
                <Text style={styles.sourcesText}>{marjaInfo.sources}</Text>
              </View>
            )}
          </Pressable>
        ) : null}

        {/* السجل (محفوظ بشكل دائم) */}
        {history.length > 0 && !answer && (
          <View style={styles.historySection}>
            <View style={styles.historyHeaderRow}>
              <Text style={styles.historyTitle}>أسئلة سابقة</Text>
              <TouchableOpacity onPress={handleClearHistory} activeOpacity={0.7}>
                <Text style={styles.historyClear}>مسح الكل</Text>
              </TouchableOpacity>
            </View>
            {history.map((h, i) => (
              <TouchableOpacity
                key={i}
                style={styles.historyCard}
                onPress={() => handleHistoryTap(h)}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back" size={16} color={C.neonBlue} />
                <Text style={styles.historyQ} numberOfLines={2}>
                  {h.q}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );

  // ===== إطار شكل الهاتف (موحّد بكل الشاشات) =====
  const wrapInPhoneFrame = (node: ReactElement) => <PhoneFrameWrapper>{node}</PhoneFrameWrapper>;

  // ===== خلفية الصورة الموحّدة - نفس نظام باقي الشاشات (يقرأ اختيار المستخدم من الإعدادات العامة) =====
  if (bgOption.image) {
    return wrapInPhoneFrame(
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

  return wrapInPhoneFrame(screenContent);
}

function createStyles(scale: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },

    bgFill: { flex: 1 },
    bgImage: { flex: 1, width: '100%', height: '100%' },
    bgImageFull: { width: '100%', height: '100%' },
    bgOverlay: { ...StyleSheet.absoluteFill, backgroundColor: '#000' },

    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    pickerCard: {
      backgroundColor: C.glassDark,
      borderRadius: 20,
      padding: 22,
      width: '100%',
      maxHeight: '90%',
      borderWidth: 1,
      borderColor: C.glassBorder,
      alignItems: 'center',
      overflow: 'hidden',
    },
    bismillah: { color: '#c9a84c', fontSize: 14 * scale, marginBottom: 8, textAlign: 'center' },
    pickerTitle: { color: C.white, fontSize: 26 * scale, fontWeight: 'bold', marginBottom: 4 },
    pickerSub: { color: C.neonBlue, fontSize: 12 * scale, marginBottom: 12 },
    divider: { height: 1, backgroundColor: C.glassBorder, width: '100%', marginBottom: 12 },
    pickerQ: { color: C.white, fontSize: 16 * scale, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
    pickerHint: { color: C.error, fontSize: 11 * scale, marginBottom: 14, textAlign: 'center' },

    marjaBtn: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      overflow: 'hidden',
      gap: 10,
    },
    marjaBtnAvatar: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.2)',
    },
    marjaBtnAvatarFallback: {
      width: 44, height: 44, borderRadius: 22,
      borderWidth: 1.5,
      backgroundColor: 'rgba(0,0,0,0.2)',
      alignItems: 'center', justifyContent: 'center',
    },
    marjaTextBox: { flex: 1 },
    marjaName: { fontSize: 15 * scale, fontWeight: '700', marginBottom: 2, textAlign: 'right' },
    marjaLocationRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
    marjaLocation: { color: C.muted, fontSize: 11 * scale },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.glassBorder,
      backgroundColor: 'rgba(0,0,0,0.15)',
    },
    headerCenter: { alignItems: 'center' },
    headerTitle: { color: C.white, fontSize: 18 * scale, fontWeight: 'bold' },
    headerMarja: { fontSize: 11 * scale, marginTop: 2 },

    marjaBar: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 16,
      marginTop: 12,
      backgroundColor: C.glass,
      borderWidth: 1.5,
      borderRadius: 14,
      padding: 10,
    },
    marjaBarAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.2)',
    },
    marjaBarTextBox: { flex: 1 },
    marjaBarLabel: { color: C.muted, fontSize: 10 * scale, textAlign: 'right', marginBottom: 2 },
    marjaBarName: { fontSize: 15 * scale, fontWeight: '700', textAlign: 'right' },

    pickerCloseBtn: {
      position: 'absolute',
      top: 14,
      left: 14,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: { padding: 16 },

    emptyState: {
      backgroundColor: C.glass,
      borderWidth: 1,
      borderColor: C.glassBorder,
      borderRadius: 18,
      padding: 20,
      alignItems: 'center',
      marginBottom: 18,
    },
    emptyBismillah: { color: '#c9a84c', fontSize: 15 * scale, marginBottom: 10, textAlign: 'center' },
    emptyText: {
      color: 'rgba(255,255,255,0.75)',
      fontSize: 13 * scale,
      lineHeight: 22 * scale,
      textAlign: 'center',
    },

    input: {
      backgroundColor: C.glass,
      borderRadius: 14,
      padding: 16,
      fontSize: 16 * scale,
      minHeight: 120,
      color: C.white,
      borderWidth: 1,
      textAlignVertical: 'top',
      marginBottom: 12,
    },

    sendBtn: { padding: 15, borderRadius: 14, alignItems: 'center', marginBottom: 20 },
    sendBtnDisabled: { opacity: 0.6 },
    sendBtnText: { color: '#fff', fontSize: 16 * scale, fontWeight: 'bold' },

    answerBox: {
      backgroundColor: C.glass,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: C.glassBorder,
      marginBottom: 20,
    },
    answerBoxError: {
      backgroundColor: C.errorGlass,
      borderColor: C.errorBorder,
    },
    answerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    answerLabelRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
    answerLabel: { color: C.neonBlue, fontSize: 15 * scale, fontWeight: 'bold' },
    answerLabelError: { color: C.error },
    answerMarja: { fontSize: 12 * scale, fontWeight: '600' },
    answerDivider: { height: 1, backgroundColor: C.glassBorder, marginBottom: 14 },
    answerText: { color: '#ddeeff', fontSize: 16 * scale, lineHeight: 30 * scale, textAlign: 'right' },
    answerTextError: { color: '#ffd8d2' },

    answerActions: {
      flexDirection: 'row-reverse',
      gap: 10,
      marginTop: 16,
    },
    actionBtn: {
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: C.glassBorder,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    actionBtnRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
    actionBtnText: { color: C.white, fontSize: 12 * scale, fontWeight: '600' },

    sourcesBox: {
      marginTop: 16,
      backgroundColor: 'rgba(0,0,0,0.22)',
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: C.glassBorder,
    },
    sourcesLabelRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginBottom: 4 },
    sourcesLabel: { color: '#c9a84c', fontSize: 12 * scale, fontWeight: '700', textAlign: 'right' },
    sourcesText: { color: C.muted, fontSize: 11 * scale, textAlign: 'right', lineHeight: 18 * scale },

    historySection: { marginTop: 10 },
    historyHeaderRow: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    historyTitle: { color: C.muted, fontSize: 13 * scale, textAlign: 'right' },
    historyClear: { color: C.error, fontSize: 12 * scale, fontWeight: '600' },
    historyCard: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.glass,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: C.glassBorder,
    },
    historyQ: { flex: 1, color: '#889aaa', fontSize: 14 * scale, textAlign: 'right' },
  });
}