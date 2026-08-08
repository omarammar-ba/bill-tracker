
import React, { useEffect } from 'react';
import { ViewState } from '../types';
import { Users, FileText, Menu, X, LogOut, Home, Receipt, Banknote, List, BarChart3, Settings, Printer, Landmark, Wrench, Database, UserCheck, ShieldCheck, Palette } from 'lucide-react';
import { useAuth } from './AuthContext';
import QuickActionsFab from './QuickActionsFab';
import { initTheme } from '../services/theme';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  changeView: (view: ViewState) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentView, changeView }) => {
  const [isSidebarOpen, setSidebarOpen] = React.useState(false);
  const [panicLevel, setPanicLevel] = React.useState(0);
  const [restoreLevel, setRestoreLevel] = React.useState(0);
  const [businessName, setBusinessName] = React.useState('دفترك');
  const { logout, role, user } = useAuth();

  useEffect(() => {
    initTheme();
    try {
      const saved = localStorage.getItem('yarmouk_business_info');
      if (saved) {
        const info = JSON.parse(saved);
        if (info && info.companyName) {
          setBusinessName(info.companyName);
        }
      }
    } catch (e) {}
  }, []);
  
  const handlePanicClick = () => {
    const newLevel = panicLevel + 1;
    setPanicLevel(newLevel);
    if (newLevel >= 5) {
      localStorage.setItem('__hide_all', 'true');
      window.location.reload();
    }
  };

  const handleRestoreClick = () => {
    const newLevel = restoreLevel + 1;
    setRestoreLevel(newLevel);
    if (newLevel >= 5) {
      localStorage.removeItem('__hide_all');
      window.location.reload();
    }
  };

  const isHidden = localStorage.getItem('__hide_all') === 'true';

  if (isHidden) {
      return (
        <div className="min-h-screen bg-white w-full h-screen cursor-default" onClick={handleRestoreClick}>
          {/* شاشة بيضاء فارغة للإخفاء، اكبس 5 مرات للعودة */}
        </div>
      );
  }

  const viewColors: Record<string, string> = {
    HOME: 'text-[#3B82F6]',
    CUSTOMERS: 'text-[#818CF8]',
    INVOICES: 'text-[#10B981]',
    PAYMENTS: 'text-[#06B6D4]',
    LEDGER: 'text-[#C084FC]',
    CHEQUES: 'text-[#F97316]',
    REPORTS: 'text-[#38BDF8]',
    STAFF: 'text-[#A855F7]',
    BACKUP: 'text-[#FBBF24]',
    SETTINGS: 'text-orange-500 dark:text-orange-400',
  };

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState; icon: any; label: string }) => {
    const colorClasses = viewColors[view] || 'text-[#3B5BDB]';
    return (
      <button
        onClick={() => {
          changeView(view);
          setSidebarOpen(false);
        }}
        className={`flex items-center w-full gap-4 px-4 py-3 rounded-2xl transition-[background-color,color,border-color,box-shadow] active:scale-[0.97] duration-150 border ${
          currentView === view
            ? 'bg-[#EEF2FF]/80 dark:bg-[#1E1E24] text-[#3B5BDB] dark:text-white font-black border-[#3B5BDB]/10 dark:border-white/10 shadow-lg shadow-[#3B5BDB]/5 dark:shadow-black/20'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/40 dark:hover:bg-[#1A1A1F]/50 border-transparent'
        }`}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-inner transition-colors duration-150 ${
          currentView === view
            ? 'bg-white dark:bg-[#2A2A35] border-transparent dark:border-white/10 text-[#3B5BDB] dark:text-[#7A98FF]'
            : `bg-gray-100/80 dark:bg-[#1C1C1E] border-gray-200/40 dark:border-white/5 ${colorClasses}`
        }`}>
          <Icon size={18} />
        </div>
        <span className="text-sm font-black tracking-wide">{label}</span>
      </button>
    );
  };

  const userName = user?.displayName || (user?.email ? user?.email?.split('@')[0] : (role === 'admin' ? 'Dollarix' : (role === 'supervisor' ? 'مشرف' : 'موظف مبيعات')));

  return (
    <div className="min-h-screen bg-[#F4F6FA] dark:bg-[#000000] text-gray-900 dark:text-gray-100 flex flex-col md:flex-row font-['Tajawal'] print:bg-white print:block" dir="rtl">
      {/* Mobile Header */}
      <div 
        className="md:hidden relative z-20 print:hidden mb-6"
        style={{ height: 'calc(80px + env(safe-area-inset-top, 0px))' }}
      >
        {/* Main curved header background */}
        <div 
          className="absolute inset-x-0 top-0 bg-[#2A2A40] dark:bg-[#121212] rounded-b-[32px] overflow-hidden shadow-sm"
          style={{ height: 'calc(80px + env(safe-area-inset-top, 0px))' }}
        >
        </div>

        {/* Header Content */}
        <div 
          className="relative px-6 flex justify-between items-center"
          style={{ 
            height: 'calc(80px + env(safe-area-inset-top, 0px))', 
            paddingTop: 'env(safe-area-inset-top, 0px)' 
          }}
        >
          <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 text-white/90 bg-white/10 rounded-xl border border-white/5 hover:bg-white/20 hover:text-white transition-all active:scale-95">
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          
          <h1 onClick={handlePanicClick} className="text-xl font-black select-none cursor-pointer flex items-center gap-2 tracking-wide text-white">
            {businessName}
          </h1>

          <button
            onClick={() => changeView('SETTINGS')}
            className="p-2 text-white/90 bg-white/10 rounded-xl border border-white/5 hover:bg-white/20 hover:text-white transition-all active:scale-95"
            title="الإعدادات"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-30 md:hidden print:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 right-0 w-72 bg-white dark:bg-[#121212] border-l border-gray-200 dark:border-[#262626] shadow-sm transform transition-transform duration-300 ease-in-out z-40 print:hidden flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>
        {/* Header Section */}
        <div className="p-6 border-b border-gray-100 dark:border-[#262626]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3B5BDB] to-[#2B44A8] text-white flex items-center justify-center shadow-md shadow-[#3B5BDB]/20 border border-white/20 relative shrink-0">
              {role === 'admin' ? <ShieldCheck size={28} className="text-white" /> : <UserCheck size={28} className="text-white" />}
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-[#121212] rounded-full"></span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-black text-gray-900 dark:text-white text-lg truncate">{userName}</span>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`text-[10px] w-fit px-3 py-1 rounded-lg font-black uppercase tracking-wider ${role === 'admin' ? 'bg-[#EEF2FF] dark:bg-[#3B5BDB]/20 text-[#3B5BDB] dark:text-[#7A98FF] border border-[#C5D0FA] dark:border-[#3B5BDB]/40' : role === 'supervisor' ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300'}`}>
                  {role === 'admin' ? 'مدير' : role === 'supervisor' ? 'مشرف' : 'موظف'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="px-6 pb-2 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] pt-6">القائمة الرئيسية</div>
        {/* Navigation Links */}
        <nav className="px-4 pb-4 space-y-2.5 overflow-y-auto flex-1">
          <NavItem view="HOME" icon={Home} label="الرئيسية" />
          <NavItem view="CUSTOMERS" icon={Users} label="الزبائن والمحلات" />
          <NavItem view="INVOICES" icon={Receipt} label="الفواتير" />
          <NavItem view="PAYMENTS" icon={Banknote} label="سندات القبض" />
          <NavItem view="LEDGER" icon={List} label="كشوف الحسابات" />
          <NavItem view="CHEQUES" icon={Landmark} label="الشيكات البنكية" />
          
          {(role === 'admin' || role === 'supervisor') && (
            <>
              <div className="px-4 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] pt-4 pb-2">الإدارة</div>
              <NavItem view="REPORTS" icon={BarChart3} label="التقارير" />
              {role === 'admin' && <NavItem view="STAFF" icon={Users} label="الموظفين" />}
              <NavItem view="BACKUP" icon={Database} label="النسخ الاحتياطي" />
            </>
          )}

          <div className="pt-3 border-t border-gray-100 dark:border-[#262626] mt-3">
            <NavItem view="SETTINGS" icon={Settings} label="الإعدادات" />
          </div>

          <div className="pt-3 border-t border-gray-100 dark:border-[#262626] mt-3">
            <button
              onClick={logout}
              className="flex items-center w-full gap-3 px-3 py-2 rounded-2xl text-red-600 dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-950/30 transition-colors font-black text-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 border border-red-100/10 dark:border-red-900/10 shadow-inner">
                <LogOut size={18} />
              </div>
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 dark:border-[#262626] bg-gray-50/50 dark:bg-[#000000]/40 space-y-1.5">
          {['LEDGER', 'INVOICES', 'PAYMENTS'].includes(currentView) && (
            <button 
              onClick={() => window.print()}
              className="flex items-center w-full gap-3 px-4 py-2.5 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-[#1A1A1A] transition-colors font-bold text-sm"
            >
              <Printer size={18} className="text-[#3B5BDB]" />
              <span>طباعة مستندية (PDF)</span>
            </button>
          )}

          <div className="flex items-center justify-center mt-2 pt-2 border-t border-gray-100 dark:border-[#262626] text-[10px] text-gray-400 dark:text-gray-500 font-bold">
            <span 
              onClick={handlePanicClick}
              className="select-none cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              نظام دفترك v3.1
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto h-[calc(100vh-85px)] md:h-screen px-4 pt-1 pb-4 md:p-8 print:p-0 print:overflow-visible print:h-auto print:block">
        <div className="max-w-7xl mx-auto print:max-w-none print:w-full print:block">
             {children}
        </div>
      </main>

      {/* Radial Quick Actions Floating Button */}
      <QuickActionsFab 
        onAddInvoice={() => changeView('NEW_TRANSACTION')} 
        onAddPayment={() => changeView('PAYMENTS')} 
        onAddCustomer={() => changeView('CUSTOMERS')} 
      />
    </div>
  );
};

export default Layout;
