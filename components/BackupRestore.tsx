import React, { useState, useRef, useEffect } from 'react';
import { Database, Download, Upload, AlertTriangle, FileUp, CheckCircle, Info, Clock } from 'lucide-react';
import { createMonthlyBackup, restoreBackup } from '../services/backupService';
import JSZip from 'jszip';
import { db } from '../services/firebase';
import { collection, getDocs } from 'firebase/firestore';

export const BackupRestore: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [progress, setProgress] = useState('');
  
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
  const [lastRestoreDate, setLastRestoreDate] = useState<string | null>(null);
  const [needsBackup, setNeedsBackup] = useState(false);

  const [previewData, setPreviewData] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const backupDate = localStorage.getItem('last_backup_date');
    const restoreDate = localStorage.getItem('last_restore_date');
    if (backupDate) setLastBackupDate(new Date(backupDate).toLocaleString('ar'));
    if (restoreDate) setLastRestoreDate(new Date(restoreDate).toLocaleString('ar'));

    if (backupDate) {
      const days = (Date.now() - new Date(backupDate).getTime()) / (1000 * 60 * 60 * 24);
      if (days > 30) setNeedsBackup(true);
    } else {
      setNeedsBackup(true);
    }
  }, []);

  const handleCreateBackup = async () => {
    try {
      setLoading(true);
      setStatus(null);
      setProgress("جاري جمع البيانات وإنشاء النسخة الاحتياطية...");
      
      const result = await createMonthlyBackup();
      
      const date = new Date().toLocaleString('ar');
      setLastBackupDate(date);
      setNeedsBackup(false);
      
      setStatus({ 
        type: 'success', 
        message: `تم إنشاء النسخة الاحتياطية بنجاح! ملخص: ${result.customers} عميل، ${result.invoices} فاتورة، ${result.payments} سند قبض.` 
      });
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || "فشل إنشاء النسخة الاحتياطية" });
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    setStatus(null);
    setPreviewData(null);
    setLoading(true);
    setProgress("جاري قراءة الملف...");

    try {
      let backupJson: any = null;

      if (file.name.endsWith('.zip')) {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);
        const jsonFile = zipContent.file("backup.json");
        if (!jsonFile) {
          throw new Error("backup.json غير موجود داخل ملف ZIP");
        }
        const jsonString = await jsonFile.async("string");
        backupJson = JSON.parse(jsonString);
      } else if (file.name.endsWith('.json')) {
        const text = await file.text();
        backupJson = JSON.parse(text);
      } else {
        throw new Error("ملف النسخة غير صحيح: يجب أن يكون ZIP أو JSON");
      }

      if (!backupJson.backupInfo || !backupJson.customers) {
        throw new Error("البيانات ناقصة داخل النسخة");
      }

      setProgress("جاري مقارنة البيانات الحالية...");
      
      const currentCustomersSnap = await getDocs(collection(db, 'customers'));
      const currentInvoicesSnap = await getDocs(collection(db, 'invoices'));
      const currentPaymentsSnap = await getDocs(collection(db, 'payments'));

      const existingCustomerIds = new Set(currentCustomersSnap.docs.map(d => d.id));
      const existingInvoiceIds = new Set(currentInvoicesSnap.docs.map(d => d.id));
      const existingPaymentIds = new Set(currentPaymentsSnap.docs.map(d => d.id));

      const newCustomers = backupJson.customers.filter((c: any) => !existingCustomerIds.has(c.id));
      const newInvoices = backupJson.invoices.filter((i: any) => !existingInvoiceIds.has(i.id));
      const newPayments = backupJson.payments.filter((p: any) => !existingPaymentIds.has(p.id));

      const duplicated = 
        (backupJson.customers.length - newCustomers.length) +
        (backupJson.invoices.length - newInvoices.length) +
        (backupJson.payments.length - newPayments.length);

      setPreviewData({
        backupInfo: backupJson.backupInfo,
        backupData: backupJson, // keep for restoration
        stats: {
          backupCustomers: backupJson.customers.length,
          backupInvoices: backupJson.invoices.length,
          backupPayments: backupJson.payments.length,
          currentCustomers: currentCustomersSnap.size,
          currentInvoices: currentInvoicesSnap.size,
          currentPayments: currentPaymentsSnap.size,
          newCustomers: newCustomers.length,
          newInvoices: newInvoices.length,
          newPayments: newPayments.length,
          duplicated
        }
      });
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || "حدث خطأ أثناء قراءة الملف" });
      setSelectedFile(null);
    } finally {
      setLoading(false);
      setProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmRestore = async () => {
    if (!previewData?.backupData) return;
    
    setLoading(true);
    setStatus(null);
    
    try {
      const result = await restoreBackup(previewData.backupData, setProgress);
      
      if (result.success) {
        setStatus({ type: 'success', message: result.message });
        setLastRestoreDate(new Date().toLocaleString('ar'));
        setPreviewData(null);
        setSelectedFile(null);
        // We should ideally reload the window to fetch fresh data if needed, but the requirements just say "اعرض رسالة: تم استعادة..."
        // A simple timeout to reload might be good, or let user navigate away.
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || "حدث خطأ أثناء الاستعادة" });
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const cancelRestore = () => {
    setPreviewData(null);
    setSelectedFile(null);
    setStatus({ type: 'info', message: "تم إلغاء الاستعادة" });
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4" dir="rtl">
      <div className="flex items-center gap-3 mb-8">
        <Database className="w-8 h-8 text-[#3B5BDB]" />
        <h1 className="text-2xl font-bold text-slate-800">النسخ الاحتياطي والاستعادة</h1>
      </div>

      {needsBackup && (
        <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold">حان وقت إنشاء نسخة احتياطية شهرية</h3>
            <p className="text-sm mt-1">مر أكثر من 30 يوم على آخر نسخة احتياطية، يُنصح بإنشاء نسخة جديدة لحماية بياناتك.</p>
          </div>
        </div>
      )}

      {status && (
        <div className={`mb-6 px-4 py-3 rounded-xl flex items-start gap-3 ${
          status.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
          status.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
          'bg-blue-50 border border-blue-200 text-blue-800'
        }`}>
          {status.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" /> :
           status.type === 'error' ? <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" /> :
           <Info className="w-5 h-5 shrink-0 mt-0.5" />}
          <p className="text-sm">{status.message}</p>
        </div>
      )}

      {progress && (
        <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-xl flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
          <span className="font-medium">{progress}</span>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Backup Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <Download className="w-8 h-8 text-[#3B5BDB]" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">إنشاء نسخة احتياطية</h2>
          <p className="text-slate-500 mb-6 flex-grow">
            سيتم إنشاء ملف ZIP يحتوي على جميع بيانات النظام بما في ذلك العملاء والفواتير والسندات في ملف JSON و Excel للمراجعة.
          </p>
          
          <div className="w-full bg-slate-50 p-4 rounded-xl mb-6 text-sm text-slate-600 space-y-2">
            <div className="flex justify-between">
              <span>آخر نسخة احتياطية:</span>
              <span className="font-semibold">{lastBackupDate || 'لا يوجد'}</span>
            </div>
          </div>

          <button
            onClick={handleCreateBackup}
            disabled={loading || !!previewData}
            className="w-full py-3 bg-[#3B5BDB] hover:bg-blue-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            إنشاء نسخة احتياطية الآن
          </button>
        </div>

        {/* Restore Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">استعادة نسخة احتياطية</h2>
          <p className="text-slate-500 mb-6 flex-grow">
            لن يتم الكتابة فوق البيانات الحالية أبداً.
          </p>
          
          <input
            type="file"
            accept=".zip,.json"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || !!previewData}
            className="w-full py-10 border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 text-slate-500 font-bold rounded-2xl transition-all disabled:opacity-50 flex flex-col items-center justify-center gap-3 mb-6"
          >
            <Upload className="w-8 h-8 text-slate-400" />
            <span className="text-base font-normal">اضغط هنا أو<br/>اسحب ملف<br/>(ZIP)</span>
          </button>

          <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
             <div className="text-right">
                آخر استرجاع: {lastRestoreDate ? lastRestoreDate.split(' ')[0] : 'لا يوجد'}<br/>
                {lastRestoreDate ? lastRestoreDate.split(' ').slice(1).join(' ') : ''}
             </div>
             <Clock className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Restore Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-slate-800 mb-6">
              <Database className="w-7 h-7 text-[#0f9d58]" />
              <h2 className="text-2xl font-black">تأكيد دمج واسترجاع البيانات</h2>
            </div>
            
            <div className="bg-[#fff9e6] border border-[#fce4a6] text-[#b07d00] p-4 rounded-xl flex items-start gap-3 mb-8">
               <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
               <p className="text-sm font-medium">
                  تنبيه آمن: عملية الاسترجاع هذه ستقوم بدمج البيانات الجديدة فقط. لن يتم حذف أي بيانات حالية، ولن يتم الكتابة فوق البيانات الموجودة.
               </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
               <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                  <h3 className="text-slate-500 font-bold mb-4 text-center">البيانات الموجودة حالياً</h3>
                  <div className="space-y-3 text-sm">
                     <div className="flex justify-between items-center">
                        <span className="text-slate-500">العملاء:</span>
                        <span className="font-bold text-slate-800">{previewData.stats.currentCustomers}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-slate-500">الفواتير:</span>
                        <span className="font-bold text-slate-800">{previewData.stats.currentInvoices}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-slate-500">السندات:</span>
                        <span className="font-bold text-slate-800">{previewData.stats.currentPayments}</span>
                     </div>
                  </div>
               </div>

               <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                  <h3 className="text-slate-500 font-bold mb-4 text-center">بيانات النسخة المرفوعة</h3>
                  <div className="space-y-3 text-sm">
                     <div className="flex justify-between items-center">
                        <span className="text-slate-500">تاريخ النسخة:</span>
                        <span className="font-bold text-slate-800 text-xs text-left" dir="ltr">{new Date(previewData.backupInfo.createdAt).toLocaleString('ar')}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-slate-500">العملاء:</span>
                        <span className="font-bold text-slate-800">{previewData.stats.backupCustomers}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-slate-500">الفواتير:</span>
                        <span className="font-bold text-slate-800">{previewData.stats.backupInvoices}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-slate-500">السندات:</span>
                        <span className="font-bold text-slate-800">{previewData.stats.backupPayments}</span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="bg-[#f0fdf4] border border-[#dcfce7] rounded-2xl p-5 mb-6">
                <h3 className="text-[#166534] font-bold mb-4 text-center">البيانات الجديدة التي سيتم إضافتها</h3>
                <div className="grid grid-cols-3 gap-3">
                   <div className="bg-white border border-[#dcfce7] rounded-xl py-4 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-[#0f9d58] mb-1">{previewData.stats.newPayments}</span>
                      <span className="text-xs text-slate-500 font-bold">سند جديد</span>
                   </div>
                   <div className="bg-white border border-[#dcfce7] rounded-xl py-4 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-[#0f9d58] mb-1">{previewData.stats.newInvoices}</span>
                      <span className="text-xs text-slate-500 font-bold">فاتورة جديدة</span>
                   </div>
                   <div className="bg-white border border-[#dcfce7] rounded-xl py-4 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-[#0f9d58] mb-1">{previewData.stats.newCustomers}</span>
                      <span className="text-xs text-slate-500 font-bold">عميل جديد</span>
                   </div>
                </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 flex justify-between items-center text-sm font-bold text-slate-500 mb-8">
               <span>عمليات الكتابة المتوقعة: {previewData.stats.newCustomers + previewData.stats.newInvoices + previewData.stats.newPayments}</span>
               <span>العناصر المكررة (سيتم تجاهلها): {previewData.stats.duplicated}</span>
            </div>

            <div className="flex gap-4">
              <button
                onClick={cancelRestore}
                disabled={loading}
                className="w-32 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={confirmRestore}
                disabled={loading}
                className="flex-1 py-3.5 bg-[#0f9d58] hover:bg-[#0b8043] text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
              >
                تأكيد الدمج الآمن
                <CheckCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
