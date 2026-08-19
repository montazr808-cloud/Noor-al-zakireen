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
// قائمة المراجع الصالحة حالياً - نستخدمها للتحقق من القيمة المحفوظة، حتى لو
// انحذف مرجع قديم من الأنواع (زي حالة الفياض سابقاً) ما نرجع قيمة تالفة
// تكسر MARJA_SYSTEM[marja] بصمت (كانت ترجع undefined بدون أي تنبيه)
const VALID_MARJAS: Marja[] = ['sistani', 'khamenei', 'najafi', 'sadr', 'yaqoubi', 'general'];

export async function getSelectedMarja(): Promise<Marja | null> {
  try {
    const saved = await AsyncStorage.getItem(MARJA_KEY);
    if (saved && (VALID_MARJAS as string[]).includes(saved)) {
      return saved as Marja;
    }
    return null;
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
- أجب على السؤال باللغة العربية فقط، بدون أي استثناء
- ممنوع منعاً باتاً استخدام أي حرف أو كلمة من لغة غير عربية بالرد (إنكليزية،
  فرنسية، أو أي لغة أخرى)، حتى المصطلحات أو أسماء الأعلام أو المصادر -
  اكتبها بالعربية دائماً (مثال: "سيستاني" وليس "Sistani"، "حديث" وليس "Hadith")
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
// مهلة أقصر للمحاولة الثانية (retry بسبب أحرف أجنبية) - أسوأ حالة قبل
// هذا التعديل كانت 25 + 25 = 50 ثانية انتظار، وهذا طويل جداً على مستخدم
// ينتظر جواب سؤال ديني. نصف المهلة كافية عادةً لأن الاتصال أصلاً نجح
// بالمحاولة الأولى (المشكلة كانت بمحتوى الرد لا بسرعة الشبكة)
const RETRY_TIMEOUT_MS = 15000;

export type AskResult = { text: string; isError: boolean };

// أي حرف مو عربي (بما فيها الحركات والأرقام العربية وحروف فارسية/كردية
// المشتركة بنفس نطاق يونيكود) ومو من الرموز/الأرقام/علامات الترقيم الشائعة
// عالمياً - نعتبره "أجنبي" ونتعامل معه بنفس الأسلوب.
//
// هذا تعميم شامل بدل ما نضيف نطاق يونيكود جديد كل ما نكتشف لغة غريبة
// تسرّبت من رد النموذج (كنا نضيف الصيني لحاله، وبعدها الإنكليزي لحاله -
// الآن نغطي أي لغة بضربة وحدة، بما فيها أي لغة ثالثة نكتشفها مستقبلاً
// تلقائياً بدون أي تعديل كود إضافي)
const FOREIGN_CHAR_REGEX =
  /[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF0-9\s.,!?:;()[\]{}"'\-–—…%*/+=@#&_٪]/;
// نسخة تحذف الكلمة الأجنبية كاملة (مو حرف حرف) - حذف حرف بس من كلمة أجنبية
// بيخلي بقايا مبعثرة وسط الجملة العربية
const FOREIGN_WORD_REGEX_GLOBAL =
  /\S*[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF0-9\s.,!?:;()[\]{}"'\-–—…%*/+=@#&_٪]+\S*/g;

function hasForeignChars(text: string): boolean {
  return FOREIGN_CHAR_REGEX.test(text);
}

// كلمة "أجنبية" ممكن تكون فعلياً مرجع رقمي مشروع (مثل "٢:٢٥٥" أو "3-4")
// يحتوي رمز مو من نطاق الأرقام العربية الأساسي لكنه مو أجنبي فعلياً -
// نستثنيها من الحذف حتى ما نقطع مرجع آية أو حديث بالخطأ
const NUMERIC_REFERENCE_REGEX = /^[0-9\u0660-\u0669:\-.,]+$/;

function stripForeignChars(text: string): string {
  return text
    .replace(FOREIGN_WORD_REGEX_GLOBAL, (match) =>
      NUMERIC_REFERENCE_REGEX.test(match) ? match : ''
    )
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function callGroqOnce(question: string, systemPrompt: string, signal: AbortSignal): Promise<AskResult> {
  const PROXY_URL = process.env.EXPO_PUBLIC_GROQ_PROXY_URL as string;
  const APP_SECRET = process.env.EXPO_PUBLIC_APP_SHARED_SECRET ?? '';

  const response = await fetch(PROXY_URL, {
    method: 'POST',
    signal,
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

  // نتحقق من حالة الرد قبل محاولة قراءته كـ JSON - لو السيرفر رجّع خطأ
  // (503، 429، أو حتى صفحة HTML من خدمة وسيطة) بدل جواب سليم، لا نريد
  // نعامله على إنه "خطأ شبكة" عام بالـ catch الخارجي بينما المشكلة
  // فعلياً بالخدمة نفسها - كل حالة تستاهل رسالة تشخّص المشكلة صح
  if (!response.ok) {
    console.error('askSheikh: رد الخدمة بحالة غير ناجحة', response.status);
    if (response.status === 429) {
      return { text: 'الخدمة مزدحمة حالياً، حاول بعد دقيقة.', isError: true };
    }
    if (response.status >= 500) {
      return { text: 'الخدمة غير متوفرة حالياً، حاول بعد شوي.', isError: true };
    }
    return { text: 'صار خطأ بالاتصال، حاول مرة ثانية بعد شوي.', isError: true };
  }

  let data: any;
  try {
    data = await response.json();
  } catch (parseErr) {
    console.error('askSheikh: تعذّرت قراءة رد الخدمة', parseErr);
    return { text: 'صار خطأ بالاتصال، حاول مرة ثانية بعد شوي.', isError: true };
  }

  const content = data?.choices?.[0]?.message?.content;
  const finishReason = data?.choices?.[0]?.finish_reason;

  // نتحقق إن المحتوى نص فعلي وليس فارغ، مو بس "موجود" - نص فارغ "" يمر
  // من فحص وجود بسيط لكنه مو جواب صالح نعرضه للمستخدم
  if (typeof content !== 'string' || content.trim().length === 0) {
    console.error('askSheikh: رد غير متوقع من الخدمة', data);
    return { text: 'صار خطأ بالاتصال، حاول مرة ثانية بعد شوي.', isError: true };
  }

  // لو النموذج قطع الجواب بسبب الوصول لأقصى عدد رموز (max_tokens)، نسجل
  // تنبيه واضح بالـ logs - جواب ديني مقطوع بمنتصف آية أو حديث أخطر من
  // تطبيق عادي، حتى لو ما نقدر نصلحه تلقائياً هسه، الأقل نعرف إنه صاير
  if (finishReason === 'length') {
    console.error('askSheikh: الجواب انقطع بسبب الوصول لأقصى عدد رموز (max_tokens)');
  }

  return { text: content, isError: false };
}

// كل محاولة (أصلية أو إعادة) تاخذ مهلتها الخاصة بدل ما تتشارك مؤقت واحد -
// سابقاً لو المحاولة الأولى نجحت لكن قريبة من نهاية الـ٢٥ ثانية، الإعادة
// كانت تنقطع فوراً برسالة "استغرق الطلب وقتاً أطول من المعتاد" رغم إن
// العلة كانت رموز غريبة بالرد، مو بطء فعلي بالشبكة
async function callGroqWithTimeout(
  question: string,
  systemPrompt: string,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<AskResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await callGroqOnce(question, systemPrompt, controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function askSheikh(question: string): Promise<AskResult> {
  const PROXY_URL = process.env.EXPO_PUBLIC_GROQ_PROXY_URL;

  if (!PROXY_URL) {
    return { text: 'رابط الخدمة مفقود، تأكد من إعدادات الخدمة.', isError: true };
  }
  if (!question || question.trim().length === 0) {
    return { text: 'تفضل اكتب سؤالك.', isError: true };
  }
  if (question.trim().length > 400) {
    return { text: 'سؤالك طويل شوي، حاول تختصره أكثر.', isError: true };
  }

  const marja = await getSelectedMarja();

  // لا نسمح بتحويل السؤال تلقائياً إلى الرأي العام إذا المستخدم ما اختار مرجعه
  if (!marja) {
    return { text: 'اختر مرجعك الكريم أولاً حتى أقدر أجيبك وفق فتواه.', isError: true };
  }

  const systemPrompt = MARJA_SYSTEM[marja] + RULES;

  try {
    let result = await callGroqWithTimeout(question, systemPrompt);

    // لو الرد فيه أي حرف/كلمة مو عربية (أي لغة كانت) وسط النص العربي (خلل
    // معروف بنماذج اللغة أحياناً) - نعيد الطلب مرة وحدة إضافية عسى الرد يجي نظيف
    if (!result.isError && hasForeignChars(result.text)) {
      console.error('askSheikh: رد فيه أحرف/كلمات أجنبية، إعادة محاولة مرة وحدة');
      const retry = await callGroqWithTimeout(question, systemPrompt, RETRY_TIMEOUT_MS);
      if (!retry.isError && !hasForeignChars(retry.text)) {
        result = retry;
      } else if (!retry.isError) {
        // لسا فيها أحرف/كلمات أجنبية حتى بعد الإعادة - نحذفها كحل أخير حتى ما
        // توصل للمستخدم، بدل ما نعرض نص فيه كلمات من لغة ثانية بمنتصف جواب
        // ديني عربي
        result = { text: stripForeignChars(retry.text), isError: false };
      }
    }

    return result;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.error('askSheikh: انتهت مهلة الانتظار');
      return { text: 'استغرق الطلب وقتاً أطول من المعتاد، تأكد من سرعة النت وحاول مرة ثانية.', isError: true };
    }
    console.error('askSheikh: خطأ شبكة', err);
    return { text: 'صار خطأ بالشبكة، تأكد من النت وحاول مرة ثانية.', isError: true };
  }
}