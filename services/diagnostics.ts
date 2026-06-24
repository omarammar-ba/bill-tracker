import { auth, db } from './firebase';
import { collection, limit, query, getDocs } from 'firebase/firestore';

export type LogCategory = 'AUTH' | 'DATABASE' | 'SPEECH' | 'NETWORK' | 'SYSTEM';
export type LogSeverity = 'info' | 'success' | 'warning' | 'error';

export interface DiagnosticLog {
  id: string;
  timestamp: number;
  type: LogSeverity;
  category: LogCategory;
  title: string;
  message: string;
  details?: string;
  remedy?: string;
}

let logs: DiagnosticLog[] = [];
let listeners: ((logs: DiagnosticLog[]) => void)[] = [];

// Load existing session logs if any
if (typeof window !== 'undefined') {
  try {
    const saved = sessionStorage.getItem('yarmouk_diagnostic_logs');
    if (saved) {
      logs = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load saved diagnostics:', e);
  }
}

const saveLogsToSession = () => {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('yarmouk_diagnostic_logs', JSON.stringify(logs.slice(0, 100)));
    } catch {}
  }
};

const notifyListeners = () => {
  listeners.forEach(cb => cb([...logs]));
};

export const subscribeToDiagnostics = (callback: (logs: DiagnosticLog[]) => void) => {
  listeners.push(callback);
  callback([...logs]);
  return () => {
    listeners = listeners.filter(cb => cb !== callback);
  };
};

export const addDiagnosticLog = (
  type: LogSeverity,
  category: LogCategory,
  title: string,
  message: string,
  details?: string,
  remedy?: string
) => {
  const id = Math.random().toString(36).substring(2, 9);
  const newLog: DiagnosticLog = {
    id,
    timestamp: Date.now(),
    type,
    category,
    title,
    message,
    details,
    remedy
  };

  // Keep up to 200 logs
  logs = [newLog, ...logs].slice(0, 200);
  console.log(`[Diagnostic Log - ${category}] ${title}: ${message}`, details || '');
  notifyListeners();
  saveLogsToSession();
  return id;
};

export const clearDiagnosticLogs = () => {
  logs = [];
  notifyListeners();
  saveLogsToSession();
  addDiagnosticLog('info', 'SYSTEM', 'تفريغ سجل التتبع 🧹', 'تم مسح جميع السجلات والملخصات الفنية السابقة بشكل يدوي.');
};

// --- AUTOMATIC ENV DIAGNOSTIC CHECKS ---

export interface EnvHealthResult {
  isInIframe: boolean;
  userAgent: string;
  hasSpeechSupport: boolean;
  localStorageWorking: boolean;
  onlineStatus: boolean;
  firebaseConnected: boolean;
  serviceWorkersCleaned: boolean;
  assetsLoadedCorrectly: boolean;
  versionMatch: boolean;
  currentVersion: string;
  errorsDetected: string[];
}

export interface GeminiErrorAnalysis {
  arabicTitle: string;
  arabicExplanation: string;
  arabicReason: string;
  arabicRemedySteps: string[];
  canRetry: boolean;
}

// Stated app version to guard against stale files loading from HTTP cache
export const APP_VERSION = "2.1.0";

// Server-side Gemini AI Call Proxy for Arabic Error Analysis
export const analyzeErrorWithGemini = async (
  errorName: string,
  errorMessage: string,
  errorStack?: string,
  context?: string
): Promise<GeminiErrorAnalysis | null> => {
  try {
    const response = await fetch('/api/analyze-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ errorName, errorMessage, errorStack, context })
    });
    
    if (!response.ok) {
      throw new Error('فشل نظام الدعم الذكي في تحليل الخطأ بشكل مباشر.');
    }
    
    const data: GeminiErrorAnalysis = await response.json();
    
    // Log the AI analyze outcome securely inside our tracer
    addDiagnosticLog(
      data.canRetry ? 'warning' : 'error',
      'SYSTEM',
      data.arabicTitle,
      data.arabicExplanation,
      `الخطأ الأصلي: [${errorName}] ${errorMessage}\nسياق الحدوث: ${context || 'غير محدد'}`,
      `التفسير: ${data.arabicReason}\n\nخطوات الحل الآمنة:\n${data.arabicRemedySteps.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}`
    );

    // Broadcast event so UI overlays or notification banners can render it
    const event = new CustomEvent('gemini-error-analyzed', { detail: data });
    window.dispatchEvent(event);

    return data;
  } catch (err: any) {
    console.error('Gemini error analysis proxy error:', err);
    return null;
  }
};

// 1. Run environment check
export const checkSystemEnvironment = async (): Promise<EnvHealthResult> => {
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const hasSpeechSupport = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  
  let localStorageWorking = false;
  try {
    localStorage.setItem('__diagnostic_test', '1');
    localStorage.removeItem('__diagnostic_test');
    localStorageWorking = true;
  } catch (e) {}

  const onlineStatus = typeof navigator !== 'undefined' ? navigator.onLine : true;
  let firebaseConnected = false;
  let serviceWorkersCleaned = false;
  let assetsLoadedCorrectly = true;
  let versionMatch = true;

  const errorsDetected: string[] = [];

  // 1. Delete and Unregister any active Service Workers to avoid rigid stale file caching
  if (typeof window !== 'undefined' && navigator.serviceWorker) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        for (let registration of registrations) {
          await registration.unregister();
        }
        serviceWorkersCleaned = true;
        addDiagnosticLog(
          'success', 
          'SYSTEM', 
          'تنظيف خلايا الكاش النشط (Service Worker) 🧹', 
          'تم كشف وإيقاف تشغيل ملفات Service Worker بنجاح لمنع تداخل التصميم والكاش القديم.'
        );
      } else {
        serviceWorkersCleaned = true;
      }
    } catch (e: any) {
      errorsDetected.push(`فشل تنظيف ملفات الخدمة: ${e.message || String(e)}`);
    }
  }

  // 2. Validate CSS and JavaScript static assets
  if (typeof window !== 'undefined') {
    try {
      // Check performance entry sources to ensure no script failures
      const resources = performance.getEntriesByType('resource');
      const failedAssets = resources.filter((r: any) => r.duration === 0 && (r.name.endsWith('.js') || r.name.endsWith('.css')));
      if (failedAssets.length > 0) {
        assetsLoadedCorrectly = false;
        errorsDetected.push(`تم كشف ملفات تصميم أو جافاسكريبت قد فشل تحميلها في المتصفح.`);
      }
    } catch {}
  }

  // 3. Cache Version Alignment Safety Guard
  if (typeof window !== 'undefined') {
    try {
      const savedVersion = localStorage.getItem('yarmouk_app_version');
      if (savedVersion && savedVersion !== APP_VERSION) {
        versionMatch = false;
        addDiagnosticLog(
          'warning', 
          'SYSTEM', 
          'تحديث إصدار التطبيق مكتشف 🔄', 
          `تم كشف إصدار أقدم (${savedVersion}) في التخزين الموضعي بينما الإصدار الحالي هو (${APP_VERSION}). تم تحديث المؤشر لمنع تعارض التصاميم.`
        );
      }
      localStorage.setItem('yarmouk_app_version', APP_VERSION);
    } catch {}
  }

  if (isInIframe) {
    errorsDetected.push('التطبيق مدمج داخل إطار (IFrame). المتصفحات تحظر أذونات المايك وحفظ الكوكيز للجهات غير الموثوقة افتراضياً.');
  }
  if (!hasSpeechSupport) {
    errorsDetected.push('المتصفح الحالي لا يدعم ميزة التعرف على الصوت (Web Speech API). يوصى باستخدام Chrome أو Safari.');
  }
  if (!onlineStatus) {
    errorsDetected.push('جهازك غير متصل بالإنترنت حالياً.');
  }

  // Quick check read from Firestore collection to test connection
  if (onlineStatus && auth.currentUser) {
    try {
      const q = query(collection(db, 'customers'), limit(1));
      await getDocs(q);
      firebaseConnected = true;
    } catch (e: any) {
      errorsDetected.push(`خطأ في الاتصال بـ Firebase: ${e.message || String(e)}`);
    }
  }

  return {
    isInIframe,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    hasSpeechSupport,
    localStorageWorking,
    onlineStatus,
    firebaseConnected,
    serviceWorkersCleaned,
    assetsLoadedCorrectly,
    versionMatch,
    currentVersion: APP_VERSION,
    errorsDetected
  };
};

// 2. Real-time test of Microphone and detailed error categorization
export interface MicTestResult {
  success: boolean;
  errorName?: string;
  errorMessage?: string;
  remedy?: string;
}

export const testMicrophoneAccess = async (): Promise<MicTestResult> => {
  addDiagnosticLog('info', 'SPEECH', 'بدء فحص عتاد المايكروفون 🎙️', 'جاري التواصل مع موجز خدمات الإدخال الصوتي بالمتصفح...');
  
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const msg = 'مستعرض الويب لا يعرض منافذ لقط الصوت في سياقه الحالي.';
    const rem = 'قد يكون هذا بسبب تصفح الموقع عبر بروتوكول HTTP غير آمن عوضاً عن HTTPS المجهر للتشفير، أو بسبب تصفحك من متصفح داخل تطبيقات التواصل (مثل ويب فيسبوك/إنستغرام). يرجى نسخ الرابط كاملاً وفتحه بمتصفح Chrome الرسمي.';
    addDiagnosticLog('error', 'SPEECH', 'عتاد غير متوفر 🎙️', msg, undefined, rem);
    return { success: false, errorName: 'NotSupported', errorMessage: msg, remedy: rem };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop tracks instantly to avoid keeping mic light active
    stream.getTracks().forEach(track => track.stop());
    
    const successMsg = 'تم التقاط إشارة الصوت وتأكيد الأذونات بنجاح كبير!';
    addDiagnosticLog('success', 'SPEECH', 'نجاح الاتصال بالمايك ✅', successMsg, 'تم التحقق من عتاد الصوت وجاهزية المتصفح.');
    return { success: true };
  } catch (error: any) {
    let errorName = error.name || 'UnknownError';
    let errorMessage = error.message || 'خطأ مجهول';
    let remedy = 'تأكد من إعدادات الصوت في جهازك.';

    if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
      errorMessage = 'تم رفض استخدام المخطط الصوتي بشكل قاطع (Permission Denied).';
      remedy = `1. في المتصفح، انقر فوق أيقونة القفل أو لوحة تحكم الخصوصية 🔒 بجوار شريط العنوان بالأعلى.\n2. ابحث عن خيار الميكروفون (Microphone) وحدد "سماح" (Allow).\n3. أعد تحميل الصفحة ليتم التفعيل.\n\n* تنبيه للمعاينة: إذا كنت تستعرض من داخل واجهة الاستوديو المدمجة، يجب عليك فتح الرابط في متصفح خارجي مستقل (علامة تبويب جديدة) لتتمكن من تخطي الحماية الأمنية للإطار.`;
    } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
      errorMessage = 'لم نجد أي جهاز مايكروفون موصول بنظام التشغيل حالياً.';
      remedy = 'تحقق من كابل المايكروفون أو سماعة الرأس، وتأكد من أن جهاز المايك الافتراضي مفعل ويعمل من لوحة التحكم بنظام التشغيل الخاص بك.';
    } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
      errorMessage = 'المايك موصول لكنه مشغول في عملية أخرى حالياً أو معطل مادياً.';
      remedy = 'أغلق أي برامج أخرى قد تستغل المايك حالياً بالخلفية (مثل مكالمة زوم، تيمز، ديسكورد، أو الكاميرا) ثم أنعش الصفحة.';
    }

    addDiagnosticLog('error', 'SPEECH', 'فشل الوصول للمايك 🎙️❌', `نوع العطل: [${errorName}] - ${errorMessage}`, error.stack, remedy);
    return { success: false, errorName, errorMessage, remedy };
  }
};

// 3. Test Database and detailed metrics
export interface DbTestResult {
  success: boolean;
  latencyMs?: number;
  authStatus: string;
  errorMessage?: string;
  remedy?: string;
}

export const testDatabaseConnectivity = async (): Promise<DbTestResult> => {
  addDiagnosticLog('info', 'DATABASE', 'بدء فحص قاعدة البيانات 🔥', 'جاري التحقق من حالة المزامنة وحساب المستخدم النشط حالياً...');
  
  const user = auth.currentUser;
  const authStatus = user ? `متصل بالحساب: ${user.email} (UID: ${user.uid})` : 'غير متصل (زائر مؤقت)';

  const startTime = Date.now();
  try {
    const q = query(collection(db, 'customers'), limit(1));
    await getDocs(q);
    const latency = Date.now() - startTime;
    addDiagnosticLog('success', 'DATABASE', 'قاعدة البيانات مستجيبة ✅', `تم الاتصال بنجاح وزمن الاستجابة: ${latency}ms`, `حالة التوثيق: ${authStatus}`);
    return { success: true, latencyMs: latency, authStatus };
  } catch (error: any) {
    const originalErrorMsg = error.message || String(error);
    let remedy = 'يرجى مراجعة حالة الاتصال بالإنترنت لديك.';

    if (originalErrorMsg.includes('permission-denied') || originalErrorMsg.includes('insufficient permissions')) {
      remedy = 'حسابك الحالي لا يمتلك الصلاحيات المصادق عليها لقراءة هذه المجموعة. ربما انتهت صلاحية جلستك الأمنية، يرجى تسجيل الخروج والولوج مجدداً بالحساب المخول.';
    } else if (originalErrorMsg.includes('quota-exceeded')) {
      remedy = 'لقد تجاوزت الكوتا السحابية اليومية المجانية لقاعدة البيانات Firestore. يرجى الانتظار حتى تصفير العداد غداً أو التواصل مع الدعم الفني لترقية باقة السحاب.';
    }

    addDiagnosticLog('error', 'DATABASE', 'فشل في الاتصال بقاعدة البيانات ❌', `تفصيل العطل: ${originalErrorMsg}`, error.stack, remedy);
    return { success: false, errorMessage: originalErrorMsg, authStatus, remedy };
  }
};

// Global error hook listener for real-time automatic support
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    const lowerMsg = msg.toLowerCase();
    // Skip extension/benign UI loop noise, and platform HMR websocket connection warnings
    if (
      lowerMsg.includes('extension') || 
      lowerMsg.includes('resizeobserver') || 
      lowerMsg.includes('websocket') || 
      lowerMsg.includes('is not a function') ||
      lowerMsg.includes('hmr') ||
      lowerMsg.includes('vite')
    ) return;
    
    // Send to Gemini AI for helpful non-disruptive feedback
    analyzeErrorWithGemini(
      event.error?.name || 'RuntimeError',
      msg,
      event.error?.stack,
      'مراقب الأخطاء التلقائي للواجهة'
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reasonValue = event.reason;
    const msg = reasonValue?.message || String(reasonValue);
    const lowerMsg = msg.toLowerCase();
    if (
      lowerMsg.includes('extension') || 
      lowerMsg.includes('resizeobserver') || 
      lowerMsg.includes('websocket') || 
      lowerMsg.includes('is not a function') ||
      lowerMsg.includes('hmr') ||
      lowerMsg.includes('vite')
    ) return;

    analyzeErrorWithGemini(
      reasonValue?.name || 'PromiseRejection',
      msg,
      reasonValue?.stack,
      'مستكشف الصلاحيات وعمليات الخلفية المعلقة'
    );
  });
}
