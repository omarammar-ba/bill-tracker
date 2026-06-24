
import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { LogIn, AlertCircle, Mail, Lock } from 'lucide-react';

const Login: React.FC = () => {
  const { login, loginEmail, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsSubmitting(true);
    await loginEmail(email, password);
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-['Cairo']" dir="rtl">
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <LogIn size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">معرض اليرموك</h1>
        <p className="text-sm text-slate-500 mb-6">
          سجل الدخول لإدارة الحسابات والفواتير
        </p>
        
        {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm flex items-start gap-3 text-right">
               <AlertCircle className="shrink-0 mt-0.5" size={18} />
               <span>{error}</span>
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <div className="relative">
             <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"><Mail size={18} /></span>
             <input 
               type="email" 
               value={email}
               onChange={e => setEmail(e.target.value)}
               placeholder="البريد الإلكتروني" 
               className="w-full pr-12 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:bg-white outline-none font-bold text-sm text-right dir-rtl"
               required
             />
          </div>
          <div className="relative">
             <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"><Lock size={18} /></span>
             <input 
               type="password" 
               value={password}
               onChange={e => setPassword(e.target.value)}
               placeholder="كلمة المرور" 
               className="w-full pr-12 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:bg-white outline-none font-bold text-sm text-right dir-rtl"
               required
               minLength={6}
             />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-3 text-sm disabled:opacity-70"
          >
            {isSubmitting ? 'يرجى الانتظار...' : 'تسجيل الدخول'}
          </button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">أو</span>
          </div>
        </div>

        <button
          onClick={login}
          className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-slate-700 font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-3 text-sm mb-4"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 object-contain" />
          <span>الدخول بواسطة حساب جوجل</span>
        </button>

        <p className="mt-6 text-xs text-slate-400">
          هذا النظام محمي بطبقة أمان عالية ولا يُسمح بالوصول إلا للمصرح لهم. 
        </p>
      </div>
    </div>
  );
};

export default Login;
