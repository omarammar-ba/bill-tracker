export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
  details?: string;
  timestamp: number;
}

type ToastListener = (toasts: Toast[]) => void;
let listeners: ToastListener[] = [];
let toasts: Toast[] = [];

// Track offline state globally
let isOfflineGlobal = !navigator.onLine;
let offlineListeners: ((offline: boolean) => void)[] = [];

export const subscribeToOfflineState = (callback: (offline: boolean) => void) => {
  offlineListeners.push(callback);
  callback(isOfflineGlobal);
  return () => {
    offlineListeners = offlineListeners.filter(cb => cb !== callback);
  };
};

const notifyOfflineSubscribers = () => {
  offlineListeners.forEach(cb => cb(isOfflineGlobal));
};

// Setup global network event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOfflineGlobal = false;
    notifyOfflineSubscribers();
    showSuccess('نمط الاتصال 🟢', 'تم استعادة الاتصال بالإنترنت وتحديث البيانات التلقائي.');
  });

  window.addEventListener('offline', () => {
    isOfflineGlobal = true;
    notifyOfflineSubscribers();
    showWarning('نمط غير متصل 🌐', 'انقطع الاتصال بالإنترنت. يمكنك الاستمرار في استخدام التطبيق وسيتم حفظ البيانات محلياً.');
  });
}

export const isAppOffline = () => isOfflineGlobal;

export const subscribeToNotifications = (callback: ToastListener) => {
  listeners.push(callback);
  // Emit current copy instantly
  callback([...toasts]);
  return () => {
    listeners = listeners.filter(cb => cb !== callback);
  };
};

const notify = () => {
  listeners.forEach(cb => cb([...toasts]));
};

export const addToast = (type: ToastType, title: string, message: string, details?: string, duration = 6000) => {
  const id = Math.random().toString(36).substring(2, 9);
  
  // Format or refine messages if they contain json error information
  let refinedMessage = message;
  let refinedDetails = details;
  
  if (message && message.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(message);
      if (parsed.error) {
        refinedMessage = parsed.error;
        if (parsed.path) {
          refinedDetails = `العملية: ${parsed.operationType || 'غير معروفة'}\nالمسار: ${parsed.path}\n${details || ''}`;
        }
      }
    } catch {
      // Fallback to normal text
    }
  }

  const newToast: Toast = {
    id,
    type,
    title,
    message: refinedMessage,
    duration,
    details: refinedDetails,
    timestamp: Date.now()
  };

  // Keep at most 4 active toasts to prevent overfilling the screen
  toasts = [newToast, ...toasts].slice(0, 4);
  notify();

  if (duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }
  return id;
};

export const removeToast = (id: string) => {
  toasts = toasts.filter(t => t.id !== id);
  notify();
};

export const showSuccess = (title: string, message: string, duration?: number) => {
  return addToast('success', title, message, undefined, duration);
};

export const showError = (title: string, message: string, details?: string, duration = 10000) => {
  return addToast('error', title, message, details, duration);
};

export const showWarning = (title: string, message: string, duration?: number) => {
  return addToast('warning', title, message, undefined, duration);
};

export const showInfo = (title: string, message: string, duration?: number) => {
  return addToast('info', title, message, undefined, duration);
};
