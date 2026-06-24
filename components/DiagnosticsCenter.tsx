import React, { useState, useEffect } from 'react';
import { 
  addDiagnosticLog, 
  subscribeToDiagnostics, 
  clearDiagnosticLogs, 
  testMicrophoneAccess, 
  testDatabaseConnectivity, 
  checkSystemEnvironment, 
  DiagnosticLog, 
  EnvHealthResult,
  GeminiErrorAnalysis
} from '../services/diagnostics';
import { 
  Wrench, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  AlertOctagon, 
  Play, 
  Trash2, 
  Search, 
  Layers, 
  HelpCircle, 
  RefreshCw, 
  Clipboard,
  ExternalLink,
  Wifi,
  Database,
  Mic,
  Monitor
} from 'lucide-react';
import { useAuth } from './AuthContext';

export const DiagnosticsCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [isRefreshingEnv, setIsRefreshingEnv] = useState(false);
  const [envInfo, setEnvInfo] = useState<EnvHealthResult | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [analyzedError, setAnalyzedError] = useState<GeminiErrorAnalysis | null>(null);
  const { user } = useAuth();

  // Load diagnostic logs and check current environment on mount
  useEffect(() => {
    const unsub = subscribeToDiagnostics((newLogs) => {
      setLogs(newLogs);
    });

    const handleOpenEvent = () => setIsOpen(true);
    window.addEventListener('open-diagnostics-center', handleOpenEvent);

    const handleAnalyzedError = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setAnalyzedError(detail);
      setIsOpen(true); // Open panel to display the analysis
    };
    window.addEventListener('gemini-error-analyzed', handleAnalyzedError);

    const runInitCheck = async () => {
      const res = await checkSystemEnvironment();
      setEnvInfo(res);
      
      // Auto-log initial system setup
      addDiagnosticLog(
        'info', 
        'SYSTEM', 
        'تشغيل فحص البيئة التلقائي 🖥️', 
        res.isInIframe ? 'التطبيق مدمج داخل إطار (IFrame).' : 'التطبيق يعمل بشكل مباشر وطبيعي.',
        `متصفح المستخدم: ${res.userAgent}\nدعم الإدخال الصوتي: ${res.hasSpeechSupport ? 'مدعوم' : 'غير مدعوم'}\nالتخزين المحلي (LocalStorage): ${res.localStorageWorking ? 'سليم' : 'معطل'}\nتنظيف الخدمة: ${res.serviceWorkersCleaned ? 'سليم' : 'لم يثبت'}\nإصدار التطبيق: ${res.currentVersion}`,
        res.isInIframe ? 'يُفضل فتح التطبيق برابطه المباشر الخارجي للتخلص من قيود المتصفحات على أذونات الصوت.' : undefined
      );
    };

    runInitCheck();

    return () => {
      unsub();
      window.removeEventListener('open-diagnostics-center', handleOpenEvent);
      window.removeEventListener('gemini-error-analyzed', handleAnalyzedError);
    };
  }, []);

  const handleMicTest = async () => {
    setIsTestingMic(true);
    await testMicrophoneAccess();
    setIsTestingMic(false);
    // Refresh env info
    const res = await checkSystemEnvironment();
    setEnvInfo(res);
  };

  const handleDbTest = async () => {
    setIsTestingDb(true);
    await testDatabaseConnectivity();
    setIsTestingDb(false);
  };

  const handleRefreshEnv = async () => {
    setIsRefreshingEnv(true);
    const res = await checkSystemEnvironment();
    setEnvInfo(res);
    setIsRefreshingEnv(false);
    addDiagnosticLog('success', 'SYSTEM', 'تحديث مؤشرات البيئة 🔄', 'تم تفحص أذونات الأجهزة وشبكة الخادم حالياً بنجاح.');
  };

  const handleCopyLogs = () => {
    const text = logs.map(l => {
      return `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.category}] [${l.type.toUpperCase()}] ${l.title}\nالموضوع: ${l.message}\nالتفاصيل: ${l.details || 'بلا'}\nالحل المقترح: ${l.remedy || 'بلا'}\n-------------------------`;
    }).join('\n');
    
    navigator.clipboard.writeText(text);
    alert('📋 تم نسخ سجل التتبع إلى الحافظة بنجاح، يمكنك مشاركته مع فريق الدعم لحل المشكلة فوراً!');
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'ALL' || log.category === selectedCategory;
    const matchesSeverity = selectedSeverity === 'ALL' || log.type === selectedSeverity;
    
    return matchesSearch && matchesCategory && matchesSeverity;
  });

  const getSeverityStyle = (type: string) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-emerald-50 border-emerald-100 text-emerald-800',
          badge: 'bg-emerald-500 text-white',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        };
      case 'error':
        return {
          bg: 'bg-rose-50 border-rose-100 text-rose-800',
          badge: 'bg-rose-500 text-white',
          icon: <AlertOctagon className="w-5 h-5 text-rose-500" />
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 border-amber-100 text-amber-800',
          badge: 'bg-amber-500 text-white',
          icon: <AlertTriangle className="w-5 h-5 text-amber-500" />
        };
      default:
        return {
          bg: 'bg-indigo-50 border-indigo-100 text-indigo-800',
          badge: 'bg-indigo-500 text-white',
          icon: <Info className="w-5 h-5 text-indigo-500" />
        };
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'AUTH': return 'الصلاحيات والتوثيق 🔒';
      case 'DATABASE': return 'قاعدة البيانات 🔥';
      case 'SPEECH': return 'المايك والتعرف الصوتي 🎙️';
      case 'NETWORK': return 'الإنترنت والشبكة 🌐';
      case 'SYSTEM': return 'النظام والبيئة 🖥️';
      default: return cat;
    }
  };

  return (
    <>
      {/* Diagnostics Drawer Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-[#14142B]/40 backdrop-blur-sm z-[10000] transition-opacity duration-300 print:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Diagnostics Drawer Panel */}
      <div className={`fixed inset-y-0 left-0 w-full max-w-xl bg-white shadow-2xl border-r border-slate-200 z-[10001] transform transition-transform duration-300 ease-in-out flex flex-col font-['Tajawal'] text-slate-800 print:hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'}`} dir="rtl">
        
        {/* Panel Header */}
        <div className="p-6 border-b border-gray-100 bg-gradient-to-l from-slate-900 to-indigo-950 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
              <Wrench className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">مساعد فحص وحل المشاكل 🛠️</h2>
              <p className="text-[10px] text-slate-300 font-bold">مراقبة سريعة وحلول مبسطة لـ (المايك، الإنترنت، وتخزين السحابة)</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-705 text-slate-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Panel Content Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Gemini AI Support Banner */}
          {analyzedError && (
            <div className="bg-gradient-to-r from-violet-600 to-indigo-700 text-white rounded-3xl p-5 shadow-lg border border-indigo-500/20 space-y-4 transition-all duration-300">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <Wrench className="w-5 h-5 text-indigo-200 animate-pulse" />
                  </div>
                  <h3 className="font-black text-sm text-white">
                    {analyzedError.arabicTitle || "تحليل المشكلة بالذكاء الاصطناعي 🧠"}
                  </h3>
                </div>
                <button 
                  onClick={() => setAnalyzedError(null)}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-indigo-50 leading-relaxed font-bold">
                <p className="font-extrabold text-white text-[13px] bg-white/10 p-3 rounded-2xl">
                  {analyzedError.arabicExplanation}
                </p>
                
                <div>
                  <span className="text-[10px] font-black text-indigo-200 block mb-1">🔍 سبب الحدوث الفعلي:</span>
                  <p className="bg-white/5 border border-white/5 p-3 rounded-xl">
                    {analyzedError.arabicReason}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-black text-indigo-200 block mb-2">💡 خطوات حل آمنة وبسيطة (خالية من التعقيد):</span>
                  <ul className="space-y-2">
                    {analyzedError.arabicRemedySteps.map((step, i) => (
                      <li key={i} className="flex gap-2 items-start bg-white/5 p-2 rounded-xl">
                        <span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-black shrink-0">{i+1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                {analyzedError.canRetry && (
                  <button
                    onClick={() => {
                      setAnalyzedError(null);
                      setIsOpen(false);
                    }}
                    className="flex-1 py-2.5 bg-white text-indigo-950 hover:bg-indigo-50 font-black text-xs rounded-xl transition-all shadow-md active:scale-95 cursor-pointer text-center"
                  >
                    أعد التجربة الآن 🔁
                  </button>
                )}
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 py-2.5 bg-indigo-500/30 text-white border border-indigo-400/30 hover:bg-indigo-500/40 font-black text-xs rounded-xl transition-all active:scale-95 cursor-pointer text-center"
                >
                  تحديث الصفحة 🔄
                </button>
              </div>
            </div>
          )}

          {/* Simple Explanation Widget */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-3xl p-5 space-y-4">
            <h3 className="font-extrabold text-sm text-[#3B5BDB] flex items-center gap-1.5">
              💡 حالتك وحلول سريعة بلغة بسيطة:
            </h3>
            
            <div className="space-y-3">
              {envInfo?.isInIframe ? (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-950 text-xs font-bold leading-normal space-y-3">
                  <p className="text-amber-800 font-black flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />
                    تنبيه: أنت تتصفح من داخل نافذة تجريبية (iFrame)!
                  </p>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    متصفحات الأيفون والأندرويد تمنع تشغيل المايكروفون أو حفظ الخيارات داخل النوافذ الفرعية لأسباب أمنية.
                  </p>
                  <p className="text-[11px] font-black text-[#3B5BDB]">
                    حل المشكلة سريعاً جداً: اضغط على الزر الأزرق بالأسفل لفتح التطبيق بصفحة كاملة ومستقلة وسيعمل المايكروفون معك مباشرة وبأقصى سرعة!
                  </p>
                  <div className="pt-1">
                    <button 
                      onClick={() => {
                        window.open(window.location.href, '_blank');
                      }}
                      className="w-full py-2.5 bg-gradient-to-r from-[#3B5BDB] to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>افتح في نافذة خارجية مستقلة (لحل مشاكل المايك) 🌐</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {envInfo && !envInfo.hasSpeechSupport ? (
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-rose-950 text-xs font-bold leading-normal">
                  <p className="text-red-700 font-extrabold flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4 shrink-0 text-red-600" />
                    متصفحك الحالي لا يدعم ميزة الكتابة بالصوت 🎙️❌
                  </p>
                  <p className="text-[11px] text-slate-700 mt-2 leading-relaxed">
                    يبدو أنك تستخدم متصفحاً مدمجاً (مثل متصفح داخل فيسبوك/إنستغرام) أو متصفحاً قديماً.
                    <br />
                    <strong className="text-rose-900">الحل:</strong> يرجى نسخ رابط الموقع وفتحه باستخدام متصفح <strong>Google Chrome</strong> أو <strong>Safari</strong> الرسمي على جهازك لتفعيل التقاط الصوت.
                  </p>
                </div>
              ) : null}

              {envInfo && envInfo.hasSpeechSupport && !envInfo.isInIframe ? (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-950 text-xs font-bold leading-normal space-y-1">
                  <p className="text-emerald-700 font-extrabold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    الموقع مهيأ بالكامل والمايك والإنترنت جاهزان! ✅
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    أنت تتصفح الموقع بوضعية مستقلة آمنة. الآن يمكنك كبس زر المايكروفون وإملاء الفواتير أو الدخلاء الصوتي، وسيتلقاها التطبيق بلغة عامية مفهومة فوراً.
                  </p>
                </div>
              ) : null}
            </div>
            
            <p className="text-slate-500 text-[11px] leading-relaxed">
              * وظيفة هذه اللوحة ليست معقدة؛ هي للتأكد من أن جهاز المايك شغال، وأن خط الإنترنت متصل مع السيرفر، وتوجيهك بالحل مباشرة دون الحاجة لمعرفة فنية.
            </p>
          </div>

          {/* Section 1: Dynamic Diagnostics Check Tools & Quick Status */}
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-3xl space-y-4">
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">🛠️ اختبار الأجهزة والاتصال يدوياً:</h3>
              <button 
                onClick={handleRefreshEnv}
                disabled={isRefreshingEnv}
                className="text-[11px] text-indigo-600 hover:underline font-bold flex items-center gap-1"
                title="إعادة فحص مؤشرات الأجهزة"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshingEnv ? 'animate-spin' : ''}`} />
                <span>تحديث الحالة 🔄</span>
              </button>
            </div>

            {/* Current Environment Info Dashboard */}
            {envInfo && (
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                
                <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center ${envInfo.hasSpeechSupport ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                  <Mic className="w-4 h-4 mb-1 shrink-0" />
                  <span className="font-black text-[10px]">دعم الإدخال الصوتي</span>
                  <span className="font-extrabold text-[10px] mt-0.5">{envInfo.hasSpeechSupport ? 'متوفّر 🟢' : 'غير مدعوم ❌'}</span>
                </div>

                <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center ${envInfo.onlineStatus ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                  <Wifi className="w-4 h-4 mb-1 shrink-0" />
                  <span className="font-black text-[10px]">شبكة الإنترنت</span>
                  <span className="font-extrabold text-[10px] mt-0.5">{envInfo.onlineStatus ? 'متصل 🟢' : 'منقطع 🌐'}</span>
                </div>

                <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center ${!envInfo.isInIframe ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
                  <Monitor className="w-4 h-4 mb-1 shrink-0" />
                  <span className="font-black text-[10px]">بيئة التشغيل</span>
                  <span className="font-extrabold text-[10px] mt-0.5">{!envInfo.isInIframe ? 'مستقل 🟢' : 'إطار مدمج ⚠️'}</span>
                </div>

              </div>
            )}

            {/* Interactive Actions Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                onClick={handleMicTest}
                disabled={isTestingMic}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition-all shadow-md shadow-indigo-100 disabled:opacity-50"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{isTestingMic ? 'جاري فحص المايك...' : 'فحص أذونات المايك 🎙️'}</span>
              </button>
              
              <button
                onClick={handleDbTest}
                disabled={isTestingDb}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-xl transition-all shadow-md disabled:opacity-50"
              >
                <Database className="w-3.5 h-3.5 text-orange-400" />
                <span>{isTestingDb ? 'جاري فحص الاتصال...' : 'فحص مـزامـنـة السـيرفـر 🔥'}</span>
              </button>
            </div>

            {/* Quick alert details if problems are detected */}
            {envInfo && envInfo.errorsDetected.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl">
                <span className="font-black text-xs text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />
                  تم التنبؤ بـ {envInfo.errorsDetected.length} عامل قد يعيق عمل البرنامج كامل:
                </span>
                <ul className="list-disc list-inside text-[11px] text-amber-900 font-bold mt-2 space-y-1">
                  {envInfo.errorsDetected.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Section 2: Historical Logs Header */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-sm text-slate-900">📝 مسار العمليات وسجل الأحداث والخطوات السجليّة:</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyLogs}
                  disabled={logs.length === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold text-xs cursor-pointer transition-all disabled:opacity-40"
                  title="نسخ السجل البرمجي للدعم"
                >
                  <Clipboard className="w-3.5 h-3.5 text-indigo-500" />
                  <span>نسخ التقارير 📋</span>
                </button>
                <button
                  onClick={clearDiagnosticLogs}
                  disabled={logs.length === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 font-bold text-xs cursor-pointer transition-all disabled:opacity-40"
                  title="تفريغ سجل التتبع"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>تصفير🧹</span>
                </button>
              </div>
            </div>

            {/* Filter and Query bar */}
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute right-3.5 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="ابحث في سجل المشاكل أو الأحداث..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-4 pr-10 py-2 rounded-xl text-xs border border-gray-200 focus:outline-none focus:border-indigo-500 font-bold shadow-sm"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-2 py-2 rounded-xl text-[10px] font-black border border-gray-200 bg-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">كل الأقسام 👑</option>
                  <option value="SPEECH">المايك 🎙️</option>
                  <option value="DATABASE">البيانات 🔥</option>
                  <option value="NETWORK">الشبكة 🌐</option>
                  <option value="AUTH">الأمان 🔒</option>
                  <option value="SYSTEM">النظام 🖥️</option>
                </select>

                <select
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                  className="px-2 py-2 rounded-xl text-[10px] font-black border border-gray-200 bg-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">كل الحالات ⭐</option>
                  <option value="error">الأخطاء فقط 🔴</option>
                  <option value="warning">التحذيرات 🟡</option>
                  <option value="success">الناجحة 🟢</option>
                  <option value="info">الإرشادية 🔵</option>
                </select>
              </div>
            </div>

            {/* Main Logs list */}
            <div className="space-y-3">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-3xl opacity-50">
                  <Info className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="font-bold text-xs">لا يوجد أي تقارير أو أحداث فنية مطابقة حالياً.</p>
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const sStyle = getSeverityStyle(log.type);
                  const isExpanded = expandedLogId === log.id;
                  
                  return (
                    <div
                      key={log.id}
                      className={`border rounded-2xl overflow-hidden transition-all duration-300 ${sStyle.bg}`}
                    >
                      {/* Accordion Trigger Header */}
                      <div 
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="p-4 flex gap-3.5 items-start cursor-pointer select-none"
                      >
                        <div className="mt-0.5 shrink-0">
                          {sStyle.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[9px] font-bold text-gray-400" dir="ltr">
                              {new Date(log.timestamp).toLocaleTimeString('ar-EG')}
                            </span>
                            <span className="text-[9px] font-black uppercase bg-slate-800 text-white px-2 py-0.5 rounded-md tracking-wider">
                              {getCategoryLabel(log.category)}
                            </span>
                          </div>
                          
                          <h4 className="font-black text-xs text-slate-900 mt-1.5 leading-tight">
                            {log.title}
                          </h4>
                          
                          <p className="text-[11px] text-slate-600 mt-1 font-bold leading-relaxed truncate">
                            {log.message}
                          </p>
                        </div>
                      </div>

                      {/* Accordion Collapsible Detail Content */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 border-t border-gray-100/50 space-y-3.5 text-xs bg-white/60">
                          
                          {/* Log Message Description */}
                          <div>
                            <span className="text-[9px] font-black text-gray-400 block mb-1">وصف الحدث:</span>
                            <p className="font-bold text-slate-700 leading-relaxed">
                              {log.message}
                            </p>
                          </div>

                          {/* Technical details if logged */}
                          {log.details && (
                            <div className="bg-slate-900 text-teal-400 p-3 rounded-xl border border-slate-800">
                              <span className="text-[9px] font-black text-slate-400 block mb-1.5" dir="rtl">التفاصيل الفنية والرموز البرمجية للفحص:</span>
                              <pre className="font-mono text-[10px] whitespace-pre-wrap overflow-x-auto leading-normal" dir="ltr">
                                {log.details}
                              </pre>
                            </div>
                          )}

                          {/* Arabic remedy instructions if any */}
                          {log.remedy && (
                            <div className="bg-indigo-50/50 border border-indigo-100 p-3.5 rounded-xl">
                              <span className="text-[10px] font-black text-indigo-700 flex items-center gap-1 mb-1.5">
                                <HelpCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                اقتراح وحل لتخطي المشكلة فوراً💡:
                              </span>
                              <p className="font-black text-indigo-950 leading-relaxed whitespace-pre-line text-[11px]">
                                {log.remedy}
                              </p>
                            </div>
                          )}

                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Section 3: Browser Debugging Sandbox tips */}
          <div className="bg-indigo-50/30 border border-indigo-100 rounded-3xl p-5 space-y-3">
            <h4 className="font-black text-xs text-indigo-950 flex items-center gap-2">🛡️ هل تتصفح من داخل إطار المعاينة الداخلي؟</h4>
            <p className="text-slate-600 leading-relaxed text-[11px] font-bold">
              متصفحات الأجهزة المحمولة وتطبيقات الويب (مثل Safari و Google Chrome) تطبق سياسات حماية متشددة تسمى 
              <strong> Content Security Policy / Sandbox Restrictions</strong>.
            </p>
            <p className="text-slate-600 leading-relaxed text-[11px] font-bold">
              هذه الحماية تحجب كلياً تشغيل المايكروفون أو كاميرات الويب داخل النوافذ الفرعية أو المؤطرة (iFrames) التي تحتوي على عنوان يختلف عن الرئيسي.
            </p>
            <div className="pt-2">
              <span className="text-[10px] font-black uppercase text-indigo-700 block mb-1.5">💡 أفضل طريقة لحماية أداء عملك:</span>
              <p className="text-slate-800 font-black text-[11px] leading-relaxed">
                اضغط على خيار <strong>"مشاركة"</strong> في أعلى الشاشة أو انسخ رابط التطبيق وقم بفتحه بصفحة تصفح مستقلة بمتصفحك الرسمي وستجد المايك وسرعة المعالجة تعمل بالحد الأقصى!
              </p>
            </div>
          </div>

        </div>

        {/* Panel Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2 shrink-0">
          <button
            onClick={() => setIsOpen(false)}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-xl transition-colors text-center cursor-pointer"
          >
            إغلاق نافذة التتبع 🚪
          </button>
        </div>

      </div>
    </>
  );
};
