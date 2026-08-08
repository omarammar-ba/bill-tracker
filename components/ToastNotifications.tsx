import React, { useState, useEffect } from 'react';
import { subscribeToNotifications, subscribeToOfflineState, removeToast, Toast, isAppOffline } from '../services/notifications';
import { CheckCircle2, AlertOctagon, AlertTriangle, Info, X, ChevronDown, ChevronUp, WifiOff, Wrench } from 'lucide-react';

export const ToastNotifications: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  const [expandedToasts, setExpandedToasts] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsubscribeToasts = subscribeToNotifications((currentToasts) => {
      setToasts(currentToasts);
    });

    const unsubscribeOffline = subscribeToOfflineState((offlineStatus) => {
      setIsOffline(offlineStatus);
    });

    return () => {
      unsubscribeToasts();
      unsubscribeOffline();
    };
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedToasts(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
      case 'error':
        return <AlertOctagon className="w-5 h-5 text-rose-500 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-blue-500 shrink-0" />;
    }
  };

  const getColorClass = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-white dark:bg-[#1E1E24] border-emerald-100 dark:border-emerald-950/40 shadow-emerald-50/50 dark:shadow-black/20 text-gray-900 dark:text-gray-100';
      case 'error':
        return 'bg-white dark:bg-[#1E1E24] border-rose-100 dark:border-rose-950/40 shadow-rose-50/50 dark:shadow-black/20 text-gray-900 dark:text-gray-100';
      case 'warning':
        return 'bg-white dark:bg-[#1E1E24] border-amber-100 dark:border-amber-950/40 shadow-amber-50/50 dark:shadow-black/20 text-gray-900 dark:text-gray-100';
      default:
        return 'bg-white dark:bg-[#1E1E24] border-blue-100 dark:border-blue-950/40 shadow-blue-50/50 dark:shadow-black/20 text-gray-900 dark:text-gray-100';
    }
  };

  return (
    <div 
      className="fixed top-0 inset-x-0 z-[9999] pointer-events-none flex flex-col items-center gap-3 px-4 pb-4 md:p-6 font-['Tajawal']" 
      dir="rtl"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 16px) + 12px)' }}
    >
      {/* Offline Status Persistent Banner */}
      {isOffline && (
        <div
          className="pointer-events-auto bg-gradient-to-r from-red-600 to-rose-700 text-white px-6 py-2.5 rounded-full shadow-lg flex items-center gap-3 text-xs md:text-sm font-bold border border-red-500/30 max-w-md w-full justify-center transition-all animate-pulse"
        >
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>لا يوجد اتصال بالإنترنت! أنت تعمل الآن بالنمط غير المتصل</span>
        </div>
      )}

      {/* Floating Toasts container */}
      <div className="flex flex-col gap-3 w-full max-w-md pointer-events-auto mt-2">
        {toasts.map((toast) => {
          const isExpanded = !!expandedToasts[toast.id];
          return (
            <div
              key={toast.id}
              className={`w-full overflow-hidden rounded-2xl border p-4 shadow-xl backdrop-blur-md transition-all duration-300 transform scale-100 opacity-100 translate-y-0 ${getColorClass(toast.type)}`}
            >
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 shrink-0">
                  {getIcon(toast.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-extrabold text-sm text-gray-900 dark:text-white leading-tight">
                    {toast.title}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300 text-xs mt-1 font-bold whitespace-pre-line leading-relaxed">
                    {toast.message}
                  </p>

                  {toast.type === 'error' && (
                    <div className="mt-2 text-right">
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('open-diagnostics-center'));
                          removeToast(toast.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-[10px] rounded-lg border border-rose-200 shadow-sm transition-all cursor-pointer"
                        title="انقر لتتبع سبب العطل وكيفية علاجه"
                      >
                        <Wrench size={11} className="text-rose-600 animate-pulse" />
                        <span>تتبع أسباب المشكلة وحلها الفوري</span>
                      </button>
                    </div>
                  )}
                  
                  {toast.details && (
                    <div className="mt-2.5">
                      <button
                        onClick={() => toggleExpand(toast.id)}
                        className="flex items-center gap-1 text-[10px] font-black text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 px-2 py-1 rounded-md"
                      >
                        {isExpanded ? (
                          <>
                            <span>إخفاء الرمز الفني</span>
                            <ChevronUp className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            <span>عرض التفاصيل التقنية</span>
                            <ChevronDown className="w-3 h-3" />
                          </>
                        )}
                      </button>
                      
                      {isExpanded && (
                        <pre
                          className="bg-slate-900 border border-slate-800 text-teal-400 font-mono text-[9px] p-2.5 rounded-lg mt-2 overflow-x-auto whitespace-pre leading-normal shadow-inner max-h-48 scrollbar-thin"
                          dir="ltr"
                        >
                          {toast.details}
                        </pre>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => removeToast(toast.id)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
