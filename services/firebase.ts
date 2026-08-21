import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { showError } from './notifications';
import { addDiagnosticLog } from './diagnostics';

// ----------- قم بوضع بيانات حسابك هنا -----------
// يتم قراءة هذه القيم من ملف .env حصراً للحفاظ على الأمان
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};
// ------------------------------------------------

let app: any;
let firestoreInstance: any;
let authInstance: any;

try {
  app = initializeApp(firebaseConfig);
  try {
    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({})
    });
  } catch (e) {
    firestoreInstance = getFirestore(app);
  }
  authInstance = getAuth(app);
} catch (e) {
  console.warn('Firebase config incomplete or not provided in .env');
}

export const db = firestoreInstance;
export const auth = authInstance;
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
};

export const registerWithEmail = async (email: string, pass: string) => {
    try {
        await createUserWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        console.error('Email Register error:', error);
        throw error;
    }
};

export const loginWithEmail = async (email: string, pass: string) => {
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        console.error('Email Login error:', error);
        throw error;
    }
};

// Create a secondary app so we can create a user without signing out the admin
const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

export const createEmployeeAccount = async (email: string, pass: string) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
        await signOut(secondaryAuth);
        return userCredential.user.uid;
    } catch (error) {
        console.error("Employee Creation Error:", error);
        throw error;
    }
};

export const logoutFirebase = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error('Logout error:', error);
    }
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const originalErrorMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: originalErrorMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  
  // Format neat user-friendly descriptions based on Firebase error messages
  let userFriendlyTitle = 'خطأ في العملية';
  let userFriendlyMsg = 'حدث خطأ غير متوقع أثناء معالجة البيانات.';
  let remedy = 'يرجى التحقق من اتصال شبكة الإنترنت الخاصة بك وإعادة المحاولة. إذا تكررت المشكلة، يرجى تصفير التخزين المؤقت للأمان.';

  if (originalErrorMsg.includes('permission-denied') || originalErrorMsg.includes('insufficient permissions')) {
    // If the user is logging out or already logged out, ignore these lingering listener errors silently
    if (!auth.currentUser) return;
    
    userFriendlyTitle = 'صلاحية غير كافية';
    userFriendlyMsg = 'ليست لديك الصلاحيات الكافية للقيام بهذا الإجراء على خادم البيانات.';
    remedy = 'المستخدم النشط حالياً لا يملك صلاحيات تعديل هذه السجلات. قم بتسجيل الخروج والدخول مجدداً بالحساب الأعلى (مدير النظام) للقيام بذلك.';
  } else if (originalErrorMsg.includes('quota-exceeded')) {
    userFriendlyTitle = 'تجاوز الحد الأقصى (الكوتا)';
    userFriendlyMsg = 'تم تجاوز حصة العمليات اليومية المجانية لقاعدة البيانات بحساب Spark. سيتم التصفير غداً.';
    remedy = 'تجاوز مشروع Firebase الحالي حاجز الاستفسارات السحابية اليومية المجانية (Spark tier quota limit). يرجى ترقيتها في كونسول Firebase أو الانتظار لتحديث الحصص.';
  } else if (originalErrorMsg.includes('offline') || originalErrorMsg.includes('internet')) {
    userFriendlyTitle = 'نمط غير متصل بالإنترنت';
    userFriendlyMsg = 'يتعذر الاتصال بالخادم الآن. يعمل التطبيق في نمط العمل غير المتصل.';
    remedy = 'تأكد من تفعيل الواي فاي أو خط البيانات الخلوي والاقتراب من تغطية شبكة قوية. سيقوم التطبيق بحفظ الحركات ذاتياً في جهازك وسينقلها للسحابة فور عودة التغطية.';
  }

  // Record in centralized diagnostic logger
  addDiagnosticLog(
    'error',
    'DATABASE',
    userFriendlyTitle,
    `${userFriendlyMsg} (العملية: ${operationType})`,
    `الخطأ الأصلي: ${originalErrorMsg}\nالاتصال بقاعدة البيانات على المسار: ${path || 'مجهول'}`,
    remedy
  );

  // Display highly descriptive, elegant floating toast notifications
  showError(
    userFriendlyTitle, 
    `${userFriendlyMsg}\nالعملية: (${operationType === 'list' ? 'استعراض القائمة' : operationType === 'write' ? 'حفظ/تعديل' : operationType})`, 
    `تفاصيل فنية للخطأ:\n${originalErrorMsg}\nالمسار: ${path || 'مجهول'}`
  );

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  if (operationType !== 'list') {
    throw new Error(JSON.stringify(errInfo));
  }
}
