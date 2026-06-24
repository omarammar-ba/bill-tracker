import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, loginWithGoogle, loginWithEmail as firebaseLoginWithEmail, logoutFirebase } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, limit, getDocs } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string | null;
  displayName?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: 'admin' | 'supervisor' | 'employee';
  login: () => Promise<void>;
  loginEmail: (email: string, pass: string) => Promise<void>;
  registerEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'admin' | 'supervisor' | 'employee'>('employee');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem('yarmouk_guest_session') === 'true') {
      localStorage.removeItem('yarmouk_guest_session');
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {

      if (firebaseUser) {
        let userDisplayName = firebaseUser.displayName;

        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          // Listen to changes smoothly using onSnapshot instead of getDoc
          // But to align with current code block without breaking much we just do getDoc.
          const userSnap = await getDoc(userDocRef);
          
          if (!userSnap.exists()) {
             // Self-bootstrap if it is the owner
             if (firebaseUser.email === 'omarprroo1@gmail.com') {
                 await setDoc(userDocRef, {
                    email: firebaseUser.email,
                    role: 'admin',
                    active: true,
                    createdAt: Date.now(),
                    name: firebaseUser.displayName || 'المدير'
                 });
                 setRole('admin');
             } else {
                 await setDoc(userDocRef, {
                    email: firebaseUser.email,
                    role: 'employee',
                    active: false,
                    createdAt: Date.now(),
                    name: firebaseUser.displayName || 'موظف'
                 });
                 setError('تم تسجيل حسابك ولكنه قيد المراجعة. يرجى التواصل مع الإدارة للتفعيل.');
                 await logoutFirebase();
                 setUser(null);
             }
          } else {
             const data = userSnap.data();
             userDisplayName = data.name || userDisplayName;
             
             // FORCED OVERRIDE FOR ADMIN EMAIL (In case you previously logged in and got stuck as employee)
             if (firebaseUser.email === 'omarprroo1@gmail.com') {
                if (data.role !== 'admin' || !data.active) {
                    await setDoc(userDocRef, { ...data, role: 'admin', active: true }, { merge: true });
                }
                setRole('admin');
             } else {
                 if (data.active) {
                    setRole(data.role as 'admin' | 'supervisor' | 'employee');
                 } else {
                    setError('حسابك غير مفعل أو معطل. يرجى مراجعة الإدارة.');
                    await logoutFirebase();
                    setUser(null);
                    return; // Early return to prevent setUser below
                 }
             }
          }
          
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email, displayName: userDisplayName });

        } catch (e: any) {
           console.error("Auth fetch error:", e);
           setError('حدث خطأ أثناء التحقق من الصلاحيات.');
           await logoutFirebase();
           setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
     setError(null);
     try {
       await loginWithGoogle();
     } catch (e) {
       console.error("Login Error:", e);
       setError('فشل تسجيل الدخول باستخدام جوجل.');
     }
  };

  const loginEmail = async (email: string, pass: string) => {
     setError(null);
     try {
       await firebaseLoginWithEmail(email, pass);
     } catch (e: any) {
       console.error("Login Error:", e);
       if (e.code === 'auth/invalid-credential') {
           setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
       } else {
           setError('فشل تسجيل الدخول.');
       }
     }
  };

  const registerEmail = async (email: string, pass: string) => {
     setError(null);
     try {
       const { registerWithEmail } = await import('../services/firebase');
       await registerWithEmail(email, pass);
     } catch (e: any) {
       console.error("Registration Error:", e);
       if (e.code === 'auth/email-already-in-use') {
           setError('البريد الإلكتروني مستخدم بالفعل.');
       } else if (e.code === 'auth/weak-password') {
           setError('كلمة المرور ضعيفة جداً. يجب أن تكون 6 أحرف على الأقل.');
       } else {
           setError('فشل إنشاء الحساب.');
       }
     }
  };

  const logout = async () => {
    localStorage.removeItem('yarmouk_guest_session');
    try {
      await logoutFirebase();
    } catch (e) {
      console.warn("Clean firebase logout skipped", e);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, role, login, loginEmail, registerEmail, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
