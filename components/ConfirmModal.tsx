import React from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = "تأكيد الإجراء",
  cancelText = "تراجع",
  onConfirm,
  onCancel,
  isDanger = true,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-['Tajawal']" dir="rtl">
      <div className="bg-white rounded-[28px] w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className={`p-6 text-white text-center flex flex-col items-center gap-3 ${isDanger ? 'bg-gradient-to-br from-rose-500 to-red-600' : 'bg-gradient-to-br from-[#3B5BDB] to-[#364FC7]'}`}>
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white text-2xl font-black shrink-0">
            {isDanger ? <AlertTriangle size={28} /> : <HelpCircle size={28} />}
          </div>
          <div>
            <h3 className="text-xl font-black">{title}</h3>
          </div>
        </div>
        
        <div className="p-6 md:p-8 text-center space-y-4">
          <p className="text-gray-600 text-sm font-bold leading-relaxed">{message}</p>
        </div>
        
        <div className="p-6 pt-0 flex gap-3">
          <button 
            type="button"
            onClick={onCancel}
            className="flex-1 py-3.5 border-2 border-gray-150 rounded-xl text-gray-500 font-bold hover:bg-gray-50 transition-all text-xs"
          >
            {cancelText}
          </button>
          <button 
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-3.5 text-white rounded-xl font-black transition-all shadow-md text-xs ${isDanger ? 'bg-red-600 hover:bg-red-700 shadow-red-500/10' : 'bg-[#3B5BDB] hover:bg-[#364FC7] shadow-blue-500/10'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
