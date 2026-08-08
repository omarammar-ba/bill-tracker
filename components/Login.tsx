
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
    <div className="min-h-screen flex items-center justify-center bg-[#F4F6FA] dark:bg-[#000000] font-['Cairo'] p-4" dir="rtl">
      <div className="bg-white dark:bg-[#121212] p-6 md:p-10 rounded-2xl shadow-xl shadow-[#3B5BDB]/5 dark:shadow-none border-2 border-gray-100 dark:border-[#222222] max-w-md w-full text-center transition-colors">
        <div className="w-20 h-20 bg-gray-50 dark:bg-[#1A1A1A] text-[#3B5BDB] rounded-2xl flex items-center justify-center mx-auto mb-6 border-2 border-dashed border-gray-200 dark:border-[#2A2A2A] transition-colors">
          <LogIn size={36} strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2 transition-colors">معرض اليرموك</h1>
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-8 transition-colors">
          سجل الدخول لإدارة الحسابات والفواتير
        </p>
        
        {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-start gap-3 text-right border border-rose-100 dark:border-rose-900/50 transition-colors">
               <AlertCircle className="shrink-0 mt-0.5" size={16} />
               <span>{error}</span>
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mb-8">
          <div className="relative flex items-center">
             <div className="absolute right-3 p-2 rounded-lg bg-gray-50 dark:bg-[#1A1A1A] text-gray-400 dark:text-gray-500 pointer-events-none transition-colors">
                <Mail size={18} strokeWidth={2.5} />
             </div>
             <input 
               type="email" 
               value={email}
               onChange={e => setEmail(e.target.value)}
               placeholder="البريد الإلكتروني" 
               className="w-full pr-14 pl-4 py-3.5 rounded-xl border-2 border-gray-100 dark:border-[#262626] focus:border-[#3B5BDB] dark:focus:border-[#3B5BDB] bg-white dark:bg-[#121212] text-gray-900 dark:text-white shadow-sm focus:outline-none transition-all font-bold text-sm text-right"
               required
             />
          </div>
          <div className="relative flex items-center">
             <div className="absolute right-3 p-2 rounded-lg bg-gray-50 dark:bg-[#1A1A1A] text-gray-400 dark:text-gray-500 pointer-events-none transition-colors">
                <Lock size={18} strokeWidth={2.5} />
             </div>
             <input 
               type="password" 
               value={password}
               onChange={e => setPassword(e.target.value)}
               placeholder="كلمة المرور" 
               className="w-full pr-14 pl-4 py-3.5 rounded-xl border-2 border-gray-100 dark:border-[#262626] focus:border-[#3B5BDB] dark:focus:border-[#3B5BDB] bg-white dark:bg-[#121212] text-gray-900 dark:text-white shadow-sm focus:outline-none transition-all font-bold text-sm text-right"
               required
               minLength={6}
             />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#3B5BDB] hover:bg-[#2B44A8] text-white font-black py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-3 text-sm disabled:opacity-70 shadow-md active:scale-95 mt-2"
          >
            {isSubmitting ? 'يرجى الانتظار...' : 'تسجيل الدخول'}
          </button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
             <div className="w-full border-t-2 border-gray-100 dark:border-[#262626] transition-colors"></div>
          </div>
          <div className="relative flex justify-center text-xs font-bold">
             <span className="px-3 bg-white dark:bg-[#121212] text-gray-400 dark:text-gray-500 transition-colors">أو</span>
          </div>
        </div>

        <button
          onClick={login}
          className="w-full bg-white dark:bg-[#1A1A1A] border-2 border-gray-100 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#222222] text-gray-700 dark:text-gray-300 font-bold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-3 text-sm mb-6 active:scale-95 shadow-sm"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 object-contain" />
          <span>الدخول بواسطة حساب جوجل</span>
        </button>

        <p className="mt-8 text-[11px] font-bold text-gray-400 dark:text-gray-600 transition-colors">
          هذا النظام محمي بطبقة أمان عالية ولا يُسمح بالوصول إلا للمصرح لهم. 
        </p>
      </div>
    </div>
  );
};

export default Login;
