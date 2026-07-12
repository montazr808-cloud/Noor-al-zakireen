import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ImageSourcePropType } from 'react-native';

export type Marja =
  | 'sistani'
  | 'khamenei'
  | 'najafi'
  | 'sadr'
  | 'yaqoubi'
  | 'general';

export const MARJA_IMAGES: Record<Marja, ImageSourcePropType> = {
  sistani: require('@/assets/maraji/sistani.jpg'),
  khamenei: require('@/assets/maraji/khamenei.jpg'),
  najafi: require('@/assets/maraji/najafi.jpg'),
  sadr: require('@/assets/maraji/sadr.jpg'),
  yaqoubi: require('@/assets/maraji/yaqoubi.jpg'),
  general: require('@/assets/maraji/general.jpg'),
};

export const MARJA_INFO: Record<Marja, {
  name: string;
  short: string;
  location: string;
  color: string;
  sources: string;
  image: ImageSourcePropType;
}> = {
  sistani: {
    name: 'السيد علي السيستاني',
    short: 'السيستاني',
    location: 'النجف الأشرف',
    color: '#1a6b3c',
    sources: 'منهاج الصالحين، المسائل المنتخبة، الفتاوى الميسرة، مفاتيح الجنان، القرآن الكريم',
    image: MARJA_IMAGES.sistani,
  },
  khamenei: {
    name: 'السيد علي الخامنئي',
    short: 'الخامنئي',
    location: 'طهران',
    color: '#8b1a1a',
    sources: 'أجوبة الاستفتاءات، الرسالة العملية، مفاتيح الجنان، القرآن الكريم',
    image: MARJA_IMAGES.khamenei,
  },
  najafi: {
    name: 'السيد بشير النجفي',
    short: 'النجفي',
    location: 'النجف الأشرف',
    color: '#1a3a6b',
    sources: 'رسالة المنهاج، فتاوى السيد النجفي، مفاتيح الجنان، القرآن الكريم',
    image: MARJA_IMAGES.najafi,
  },
  sadr: {
    name: 'السيد محمد الصدر (الشهيد)',
    short: 'الصدر',
    location: 'النجف الأشرف',
    color: '#1a5a6b',
    sources: 'فتاوى السيد محمد الصدر، موسوعة الفقه، مفاتيح الجنان، القرآن الكريم',
    image: MARJA_IMAGES.sadr,
  },
  yaqoubi: {
    name: 'السيد محمد اليعقوبي',
    short: 'اليعقوبي',
    location: 'النجف الأشرف',
    color: '#6b4a1a',
    sources: 'الأطروحة الإسلامية، فتاوى اليعقوبي، مفاتيح الجنان، القرآن الكريم',
    image: MARJA_IMAGES.yaqoubi,
  },
  general: {
    name: 'رأي عام',
    short: 'عام',
    location: 'الإجماع الفقهي',
    color: '#3a3a3a',
    sources: 'الإجماع الفقهي الشيعي، مفاتيح الجنان، القرآن الكريم',
    image: MARJA_IMAGES.general,
  },
};

const MARJA_KEY = '@selected_marja_v3';

export async function getSelectedMarja(): Promise<Marja | null> {
  try {
    const saved = await AsyncStorage.getItem(MARJA_KEY);
    return (saved as Marja) || null;
  } catch {
    return null;
  }
}

export async function setSelectedMarja(marja: Marja): Promise<void> {
  try {
    await AsyncStorage.setItem(MARJA_KEY, marja);
  } catch {}
}

export async function clearSelectedMarja(): Promise<void> {
  try {
    await AsyncStorage.removeItem(MARJA_KEY);
  } catch {}
}

// ===== سجل الأسئلة (محفوظ بشكل دائم عبر AsyncStorage - هدف تحسين الأداء) =====
const HISTORY_KEY = '@askSheikh_history_v1';
const MAX_HISTORY = 15;

export type HistoryItem = {
  q: string;
  a: string;
  marja: Marja;
  ts: number;
  isError?: boolean;
};

export async function getHistory(): Promise<HistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

export async function addToHistory(item: HistoryItem): Promise<HistoryItem[]> {
  const current = await getHistory();
  const updated = [item, ...current].slice(0, MAX_HISTORY);
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}

export async function clearHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch {}
}

const MARJA_SYSTEM: Record<Marja, string> = {
  sistani: `أنت "المجيب"، مساعد ديني شيعي إمامي متخصص ودقيق.
تجيب حصراً وفق فتاوى سماحة السيد علي الحسيني السيستاني دام ظله.
مصادرك: القرآن الكريم، منهاج الصالحين، المسائل المنتخبة، الفتاوى الميسرة، مفاتيح الجنان، الأحاديث الشريفة.`,

  khamenei: `أنت "المجيب"، مساعد ديني شيعي إمامي متخصص ودقيق.
تجيب حصراً وفق فتاوى سماحة السيد علي الخامنئي دام ظله.
مصادرك: القرآن الكريم، أجوبة الاستفتاءات، الرسالة العملية، مفاتيح الجنان، الأحاديث الشريفة.`,

  najafi: `أنت "المجيب"، مساعد ديني شيعي إمامي متخصص ودقيق.
تجيب حصراً وفق فتاوى سماحة السيد بشير النجفي دام ظله.
مصادرك: القرآن الكريم، رسالة المنهاج، فتاوى السيد النجفي، مفاتيح الجنان، الأحاديث الشريفة.`,

  sadr: `أنت "المجيب"، مساعد ديني شيعي إمامي متخصص ودقيق.
تجيب حصراً وفق فتاوى سماحة السيد محمد الصدر (الشهيد) قدس سره.
مصادرك: القرآن الكريم، فتاوى السيد محمد الصدر، موسوعة الفقه، مفاتيح الجنان، الأحاديث الشريفة.`,

  yaqoubi: `أنت "المجيب"، مساعد ديني شيعي إمامي متخصص ودقيق.
تجيب حصراً وفق فتاوى سماحة السيد محمد اليعقوبي دام ظله.
مصادرك: القرآن الكريم، الأطروحة الإسلامية، فتاوى اليعقوبي، مفاتيح الجنان، الأحاديث الشريفة.`,

  general: `أنت "المجيب"، مساعد ديني شيعي إمامي متخصص ودقيق.
تجيب بالرأي الفقهي العام المتفق عليه بين علماء الشيعة الإمامية.
مصادرك: القرآن الكريم، الإجماع الفقهي الشيعي، مفاتيح الجنان، الأحاديث الشريفة.`,
};

const RULES = `
قواعد ثابتة:
-أجابة على السؤال باللغة العربية فقط
- أجب على السؤال الديني مباشرة وبدقة عالية بلا حشو
- اذكر الآية القرآنية كاملة مع (سورة ... آية ...) إن وجدت
- اذكر الحديث مع مصدره إن وجد
- اذكر اسم المرجع عند الإشارة لفتواه
- أسلوبك دافئ قريب من المؤمن
- اختم كل إجابة بهذه العبارة حرفياً:
"والله أعلم. ولمزيد من الدقة في المسائل الفقهية، يُستحسن الرجوع إلى مرجعكم الكريم مباشرةً."
- إذا كان السؤال خارج الشأن الديني أجب:
"أعتذر منك، أنا المجيب مخصص للأسئلة الدينية فقط."
`;

// أقصى مدة ننتظرها للرد قبل ما نعتبر الطلب "متأخر جداً" (بالمللي ثانية)
const REQUEST_TIMEOUT_MS = 25000;

export type AskResult = { text: string; isError: boolean };

export async function askSheikh(question: string): Promise<AskResult> {
  const PROXY_URL = process.env.EXPO_PUBLIC_GROQ_PROXY_URL;
  const APP_SECRET = process.env.EXPO_PUBLIC_APP_SHARED_SECRET ?? '';

  if (!PROXY_URL) {
    return { text: 'رابط الخدمة مفقود، تأكد من ملف .env', isError: true };
  }
  if (!question || question.trim().length === 0) {
    return { text: 'تفضل اكتب سؤالك.', isError: true };
  }
  if (question.trim().length > 400) {
    return { text: 'سؤالك طويل شوي، حاول تختصره أكثر.', isError: true };
  }

  const marja = (await getSelectedMarja()) ?? 'general';
  const systemPrompt = MARJA_SYSTEM[marja] + RULES;

  // إلغاء الطلب تلقائياً إذا تأخر أكثر من المدة المحددة (تحسين أداء - يمنع الانتظار اللانهائي)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(APP_SECRET ? { 'x-app-secret': APP_SECRET } : {}),
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 900,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question.trim() },
        ],
      }),
    });

    const data = await response.json();
    if (!data.choices?.[0]?.message?.content) {
      console.log('askSheikh: رد غير متوقع من الخدمة', data);
      return { text: 'صار خطأ بالاتصال، حاول مرة ثانية بعد شوي.', isError: true };
    }
    return { text: data.choices[0].message.content, isError: false };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.log('askSheikh: انتهت مهلة الانتظار');
      return { text: 'استغرق الطلب وقتاً أطول من المعتاد، تأكد من سرعة النت وحاول مرة ثانية.', isError: true };
    }
    console.log('askSheikh: خطأ شبكة', err);
    return { text: 'صار خطأ بالشبكة، تأكد من النت وحاول مرة ثانية.', isError: true };
  } finally {
    clearTimeout(timeoutId);
  }
}
