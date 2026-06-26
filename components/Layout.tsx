
import React from 'react';
import { ViewState } from '../types';
import { Users, FileText, Menu, X, LogOut, Home, Receipt, Banknote, List, BarChart3, Settings, Printer, Landmark, Wrench } from 'lucide-react';
import { useAuth } from './AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  changeView: (view: ViewState) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentView, changeView }) => {
  const [isSidebarOpen, setSidebarOpen] = React.useState(false);
  const [panicLevel, setPanicLevel] = React.useState(0);
  const [restoreLevel, setRestoreLevel] = React.useState(0);
  const { logout, role, user } = useAuth();
  
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

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState; icon: any; label: string }) => (
    <button
      onClick={() => {
        changeView(view);
        setSidebarOpen(false);
      }}
      className={`flex items-center w-full gap-3 px-4 py-3 rounded-lg transition-all active:scale-[0.97] duration-100 ${
        currentView === view
          ? 'bg-[#EEF2FF] text-[#3B5BDB] font-bold border-r-4 border-[#3B5BDB] shadow-sm'
          : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <div className={`p-1.5 rounded-lg ${currentView === view ? 'bg-white' : 'bg-gray-100'}`}>
        <Icon size={18} />
      </div>
      <span className="text-sm font-black">{label}</span>
    </button>
  );

  const userName = user?.displayName || (user?.email ? user?.email?.split('@')[0] : (role === 'admin' ? 'مدير النظام' : (role === 'supervisor' ? 'مشرف' : 'موظف مبيعات')));
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#F4F6FA] flex flex-col md:flex-row font-['Tajawal'] print:bg-white print:block" dir="rtl">
      {/* Mobile Header */}
      <div className="md:hidden relative z-20 print:hidden mb-2">
        {/* Main curved header background */}
        <div className="absolute inset-x-0 top-0 h-[85px] bg-gradient-to-b from-[#0F2A1E] to-[#05140E] rounded-b-[36px] shadow-[0_8px_20px_rgba(0,0,0,0.08)] overflow-hidden border-b border-white/5">
          {/* Subtle noise overlay for premium feel */}
          <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")'}}></div>
          
          {/* Bottom center golden glow */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[80%] h-16 bg-gradient-to-t from-amber-500/20 to-transparent blur-[20px] rounded-full pointer-events-none"></div>
          
          {/* Bottom edge shiny line */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60%] h-[1px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent opacity-80 pointer-events-none"></div>
        </div>

        {/* Header Content */}
        <div className="relative h-[85px] px-6 flex justify-center items-center">
          <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2.5 text-amber-50/90 bg-white/5 rounded-2xl border border-white/10 absolute right-6 hover:bg-white/10 hover:text-white transition-all backdrop-blur-xl active:scale-95 shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
            {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          
          <h1 onClick={handlePanicClick} className="text-2xl font-black select-none cursor-pointer flex items-center gap-3 tracking-wider">
            <span className="bg-clip-text text-transparent bg-gradient-to-l from-white via-white to-white/80 drop-shadow-sm">اليرموك</span>
            <span className="drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] text-2xl filter contrast-125">🏛️</span> 
          </h1>
        </div>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/30 z-30 md:hidden print:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 right-0 w-72 bg-white border-l border-gray-200 shadow-sm transform transition-transform duration-300 ease-in-out z-40 print:hidden flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>
        {/* Header Section */}
        <div className="p-8 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#EEF2FF] text-[#3B5BDB] flex items-center justify-center text-xl font-black shadow-inner">
              {userInitial}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-black text-[#1C1C2E] text-lg truncate">{userName}</span>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`text-[9px] w-fit px-3 py-1 rounded-lg font-black uppercase tracking-widest ${role === 'admin' ? 'bg-[#EEF2FF] text-[#3B5BDB] border border-[#C5D0FA]' : role === 'supervisor' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                  {role === 'admin' ? 'مدير' : role === 'supervisor' ? 'مشرف' : 'موظف'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="px-8 pb-4 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] pt-8">القائمة الرئيسية</div>
        {/* Navigation Links */}
        <nav className="px-5 pb-4 space-y-1.5 overflow-y-auto flex-1">
          <NavItem view="HOME" icon={Home} label="الرئيسية" />
          <NavItem view="CUSTOMERS" icon={Users} label="الزبائن والمحلات" />
          <NavItem view="INVOICES" icon={Receipt} label="الفواتير" />
          <NavItem view="PAYMENTS" icon={Banknote} label="سندات القبض" />
          <NavItem view="LEDGER" icon={List} label="كشوف الحسابات" />
          <NavItem view="CHEQUES" icon={Landmark} label="الشيكات البنكية" />
          
          {(role === 'admin' || role === 'supervisor') && (
            <>
              <div className="px-4 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] pt-6 pb-3">الإدارة</div>
              <NavItem view="REPORTS" icon={BarChart3} label="التقارير" />
              {role === 'admin' && <NavItem view="STAFF" icon={Settings} label="الموظفين" />}
            </>
          )}

          <div className="pt-4 border-t border-gray-100 mt-4">
            <button
              onClick={logout}
              className="flex items-center w-full gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors font-black text-sm"
            >
              <div className="p-1.5 rounded-lg bg-red-50 text-red-600">
                <LogOut size={18} />
              </div>
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50 space-y-1.5">
          {['LEDGER', 'INVOICES', 'PAYMENTS'].includes(currentView) && (
            <button 
              onClick={() => window.print()}
              className="flex items-center w-full gap-3 px-4 py-2.5 rounded-lg text-gray-600 hover:bg-white transition-colors font-bold text-sm"
            >
              <Printer size={18} className="text-[#3B5BDB]" />
              <span>طباعة مستندية (PDF)</span>
            </button>
          )}

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-400 font-bold">
            <span 
              onClick={handlePanicClick}
              className="select-none cursor-pointer hover:text-gray-600 transition-colors"
            >
              نظام اليرموك v3.1
            </span>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-diagnostics-center'))}
              className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-[#3B5BDB] rounded-md transition-all font-black text-[9px] cursor-pointer"
              title="فحص وحل الأعطال، المايك، والشبكة"
            >
              <Wrench size={10} className="text-indigo-600 animate-pulse" />
              <span>فحص وحل الأعطال 🛠️</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto h-[calc(100vh-85px)] md:h-screen px-4 pt-1 pb-4 md:p-8 print:p-0 print:overflow-visible print:h-auto print:block">
        <div className="max-w-7xl mx-auto print:max-w-none print:w-full print:block">
             {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
