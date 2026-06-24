import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw, Trash2 } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("Critical Render Error caught by boundary:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F4F6FA] p-4 font-['Tajawal']" dir="rtl">
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-2xl max-w-lg w-full text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
              <AlertOctagon className="w-9 h-9" />
            </div>

            <h1 className="text-xl font-black text-gray-900 mb-2">عذراً، حدث خطأ غير متوقع في الواجهة ⚠️</h1>
            <p className="text-sm font-bold text-gray-500 mb-6 leading-relaxed">
              تلقينا تنبيهاً بخطأ غريب أثناء محاولة عرض هذه الصفحة. لا تقلق، بياناتك المسجلة على السيرفر آمنة تماماً ولم تفقد أي شيء.
            </p>

            {this.state.error && (
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-right mb-6">
                <span className="text-[10px] font-black text-gray-400 block mb-1">تفاصيل ومكان الخطأ:</span>
                <p className="text-rose-600 text-xs font-mono break-all leading-normal">
                  {this.state.error.message || String(this.state.error)}
                </p>
                {this.state.errorInfo && (
                  <pre className="text-[9px] text-gray-500 font-mono mt-2 overflow-x-auto max-h-32 scrollbar-thin leading-relaxed" dir="ltr">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#3B5BDB] text-white font-black text-sm hover:bg-[#2B49BD] transition-all shadow-md shadow-blue-100"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة تحميل الصفحة 🔄</span>
              </button>
              
              <button
                onClick={this.handleResetCache}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-rose-200 text-rose-700 bg-rose-50/50 font-black text-sm hover:bg-rose-50 hover:text-rose-800 transition-all"
                title="قم بتصفير التخزين المؤقت المحلي فقط إذا تكرر العطل لمنع تداخل الجلسات الغريبة"
              >
                <Trash2 className="w-4 h-4" />
                <span>تصفير الذاكرة المؤقتة للأمان 🧹</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
