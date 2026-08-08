import React, { useState, useEffect } from 'react';
import { Palette, Store, Phone, DollarSign, FileText, Check, Moon, Sun, Globe, Lock, Wrench, ShieldCheck } from 'lucide-react';
import { getStoredTheme, applyTheme, ThemeMode } from '../services/theme';
import { BusinessInfo } from '../types';

export const Settings: React.FC = () => {
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(() => {
    try {
      const saved = localStorage.getItem('yarmouk_business_info');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      companyName: 'اليرموك',
      defaultCurrency: 'د.أ',
      phone: '079XXXXXXX',
      invoiceFooter: 'شكراً لتعاملكم معنا'
    };
  });

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const handleSaveBusinessInfo = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('yarmouk_business_info', JSON.stringify(businessInfo));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Header */}
      <div className="flex items-center gap-4 bg-white dark:bg-[#121212] p-6 rounded-3xl border border-gray-100 dark:border-[#262626] shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-[#3B5BDB]/10 dark:bg-[#3B5BDB]/20 text-[#3B5BDB] flex items-center justify-center shrink-0">
          <Palette size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">الإعدادات</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">تخصيص مظهر التطبيق، معلومات المعرض، والطباعة</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Theme Appearance Card */}
        <div className="bg-white dark:bg-[#121212] p-6 md:p-8 rounded-3xl border border-gray-100 dark:border-[#262626] shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-[#262626]">
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">مظهر التطبيق</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">اختر المظهر المناسب للعين</p>
            </div>
            <button
              onClick={() => handleThemeChange(theme === 'dark' ? 'light' : 'dark')}
              className="p-3 rounded-2xl bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-[#262626] hover:scale-105 transition-all"
              title="تبديل سريع للمظهر"
            >
              {theme === 'dark' ? <Moon size={20} className="text-[#4F75FF]" /> : <Sun size={20} className="text-amber-500" />}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Dark Theme Option */}
            <div
              onClick={() => handleThemeChange('dark')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                theme === 'dark'
                  ? 'bg-[#1A1D2D]/60 border-[#3B5BDB] ring-2 ring-[#3B5BDB]/20'
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-indigo-400 flex items-center justify-center">
                  <Moon size={16} />
                </div>
                {theme === 'dark' && (
                  <div className="w-5 h-5 rounded-full bg-[#3B5BDB] text-white flex items-center justify-center">
                    <Check size={12} />
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-black text-sm text-gray-900 dark:text-white mb-1">المظهر الداكن</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  خلفية كحلية داكنة ليلية مريحة للعين بتباين عالٍ
                </p>
              </div>
              <div className="mt-4 p-2 bg-[#000000] rounded-xl border border-[#262626] space-y-1">
                <div className="h-1.5 w-full bg-[#3B5BDB] rounded"></div>
                <div className="h-1.5 w-3/4 bg-[#262626] rounded"></div>
              </div>
            </div>

            {/* Light Theme Option */}
            <div
              onClick={() => handleThemeChange('light')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                theme === 'light'
                  ? 'bg-indigo-50/60 border-[#3B5BDB] ring-2 ring-[#3B5BDB]/20'
                  : 'bg-gray-50 dark:bg-[#1A1A1A] border-gray-200 dark:border-[#262626]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                  <Sun size={16} />
                </div>
                {theme === 'light' && (
                  <div className="w-5 h-5 rounded-full bg-[#3B5BDB] text-white flex items-center justify-center">
                    <Check size={12} />
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-black text-sm text-gray-900 dark:text-white mb-1">المظهر الفاتح</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  خلفية فاتحة مريحة للعمل النهاري في المعرض
                </p>
              </div>
              <div className="mt-4 p-2 bg-[#F4F6FA] rounded-xl border border-gray-200 space-y-1">
                <div className="h-1.5 w-full bg-[#3B5BDB] rounded"></div>
                <div className="h-1.5 w-3/4 bg-gray-300 rounded"></div>
              </div>
            </div>
          </div>

          {/* System Language */}
          <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-[#262626]">
            <div className="flex items-center gap-2 text-xs font-black text-gray-700 dark:text-gray-300">
              <Globe size={16} className="text-[#3B5BDB]" />
              <span>لغة النظام (Language)</span>
              <span className="text-[10px] text-gray-400 font-normal">غير مفعل حالياً</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-[#1A1D2D] border border-[#3B5BDB] flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-gray-900 dark:text-white">العربية (الافتراضية)</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">اللغة المعتمدة حالياً</p>
                </div>
                <div className="w-4 h-4 rounded-full bg-[#3B5BDB] text-white flex items-center justify-center">
                  <Check size={10} />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#262626] flex items-center justify-between opacity-60 cursor-not-allowed">
                <div>
                  <p className="text-xs font-black text-gray-500 dark:text-gray-400">English</p>
                  <p className="text-[10px] text-gray-400">قريباً في التحديث القادم</p>
                </div>
                <Lock size={14} className="text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Gallery & Printing Info Card */}
        <div className="bg-white dark:bg-[#121212] p-6 md:p-8 rounded-3xl border border-gray-100 dark:border-[#262626] shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-[#262626]">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-[#3B5BDB]">
              <Store size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">معلومات المعرض والطباعة</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">البيانات التي تظهر أعلى الفواتير المطبوعة</p>
            </div>
          </div>

          <form onSubmit={handleSaveBusinessInfo} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-2">اسم المعرض / الشركة</label>
              <input
                type="text"
                value={businessInfo.companyName}
                onChange={(e) => setBusinessInfo({ ...businessInfo, companyName: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#262626] text-gray-900 dark:text-white text-sm font-bold focus:outline-none focus:border-[#3B5BDB]"
                placeholder="دفترك للسيراميك والأدوات الصحية"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-2">العملة الافتراضية</label>
                <input
                  type="text"
                  value={businessInfo.defaultCurrency}
                  onChange={(e) => setBusinessInfo({ ...businessInfo, defaultCurrency: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#262626] text-gray-900 dark:text-white text-sm font-bold focus:outline-none focus:border-[#3B5BDB]"
                  placeholder="د.أ"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-2">رقم الهاتف للتواصل</label>
                <input
                  type="text"
                  value={businessInfo.phone}
                  onChange={(e) => setBusinessInfo({ ...businessInfo, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#262626] text-gray-900 dark:text-white text-sm font-bold focus:outline-none focus:border-[#3B5BDB]"
                  placeholder="079XXXXXXXX"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-2">تذييل أسفل الفاتورة</label>
              <input
                type="text"
                value={businessInfo.invoiceFooter}
                onChange={(e) => setBusinessInfo({ ...businessInfo, invoiceFooter: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#262626] text-gray-900 dark:text-white text-sm font-bold focus:outline-none focus:border-[#3B5BDB]"
                placeholder="شكراً لتعاملكم معنا"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-2xl bg-[#3B5BDB] hover:bg-[#2B44A8] text-white font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 mt-4"
            >
              <Check size={18} />
              <span>{savedSuccess ? 'تم حفظ الإعدادات بنجاح!' : 'حفظ الإعدادات'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Diagnostics Center Card */}
      <div className="bg-white dark:bg-[#121212] p-6 rounded-3xl border border-gray-100 dark:border-[#262626] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <Wrench size={24} />
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white">مركز الفحص والدعم الفني</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">إصلاح المشاكل وإتاحة فحص الأذونات والميكروفون والشبكة</p>
          </div>
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-diagnostics-center'))}
          className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 shrink-0"
        >
          <Wrench size={16} />
          <span>فتح مركز الفحص</span>
        </button>
      </div>
    </div>
  );
};

export default Settings;
