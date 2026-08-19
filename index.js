// index.js — نقطة الدخول الحقيقية للتطبيق (بديل عن "expo-router/entry" المباشر
// بملف package.json). لازم نسجل خدمة الأذان بالخلفية (notifee foreground
// service) هنا بالضبط - خارج أي React component، قبل أي شي ثاني بالكود.
//
// هذا موثق رسمياً من notifee كمتطلب أساسي (https://notifee.app/react-native/docs/android/foreground-service):
// "It should be registered outside of any React components as early as
// possible in your code (e.g. within the project index.js file)."
//
// السبب: لما أندرويد يحاول يفتح التطبيق بالخلفية بس (التطبيق مقفول تماماً،
// مو المستخدم فاتحه) عشان يشغّل تنبيه الأذان المجدول، ما يشغّل React ولا
// app/_layout.tsx إطلاقاً - يشغّل بس هذا الملف. فتسجيل الخدمة جوه useEffect
// بـ_layout.tsx (كان الوضع السابق) ما يوصله هذا السيناريو أبد، وهذا بالضبط
// سبب "الأذان يشتغل بس لما افتح التطبيق" + "الإشعار يضل عالق" (الخدمة
// الحقيقية أصلاً ما بدأت، فماكو شي يقفل الإشعار).

import { registerAzanForegroundService } from '@/utils/notifeeAzan';
import { registerAllNotificationEventListeners } from '@/utils/notificationEvents';
import { Text, TextInput } from 'react-native';

registerAzanForegroundService();
registerAllNotificationEventListeners();

// ===== تعطيل تأثير "حجم الخط" بإعدادات نظام الهاتف على كامل التطبيق =====
// ⚠️ السبب: التطبيق أصلاً عنده إعداد حجم خط خاص فيه (صغير/عادي/كبير من داخل
// إعدادات التطبيق نفسه). لو تركنا React Native يطبّق أيضاً مضاعف حجم الخط
// من إعدادات نظام أندرويد (خصوصاً على أجهزة اقتصادية/قديمة اللي غالباً
// المستخدم يكبّر الخط منها للقراءة)، الاثنين يتراكبون فوق بعض ويخرّبون كل
// تصميم الواجهة (نصوص ضخمة تكسر التخطيط بكل شاشة). تعطيل هذا هنا (نقطة
// الدخول، قبل أي شاشة تترندر) يخلي حجم الخط يعتمد فقط على إعداد التطبيق
// الداخلي، بغض النظر شنو إعداد نظام الهاتف - حل موحّد لكل الشاشات دفعة وحدة
// بدل تعديل allowFontScaling يدوياً بكل ملف لحاله.
// ===== تحديد حد أقصى معقول لتكبير الخط من إعدادات نظام الهاتف (مو تعطيل كامل) =====
// ⚠️ نسمح بتكبير محدود (حتى 1.3× الحجم الأصلي) بدل قفل حجم الخط تماماً - هذا
// يحترم جزئياً مستخدمين يعتمدون على "تكبير خط النظام" كإعداد إتاحة (accessibility)
// معتاد بكل تطبيقاتهم، بينما يمنع بنفس الوقت انكسار التصميم الكامل (دوائر
// وحلقات ومقاسات محسوبة بالبكسل) اللي كان يصير مع تكبير غير محدود على أجهزة
// اقتصادية/قديمة. المستخدم لسه عنده بديل كامل التحكم من داخل إعدادات التطبيق
// نفسه (صغير/عادي/كبير) لو يريد تكبير أكثر من هذا الحد.
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.maxFontSizeMultiplier = 1.3;
TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.maxFontSizeMultiplier = 1.3;

// بعد التسجيل، نكمل بنفس نقطة دخول Expo Router العادية
import 'expo-router/entry';
