import React, { useState, useEffect } from 'react';
import { Payment, Customer, ViewProps } from '../types';
import { subscribeToPayments, subscribeToCustomers, savePayment } from '../services/db';
import { Search, Calendar, FileText, Landmark, Clock, Check, AlertTriangle, RefreshCw, Inbox } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import Counter from './Counter';

export const ChequesManager: React.FC<{ changeView: any }> = ({ changeView }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'cashed' | 'bounced'>('all');
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    const unsubPayments = subscribeToPayments((data) => {
      // Filter out payments that are cheques and not deleted
      const cheques = data.filter(p => p.paymentMethod === 'cheque' && !p.deleted);
      setPayments(cheques);
    });

    const unsubCustomers = subscribeToCustomers((data) => {
      setCustomers(data);
    });

    return () => {
      unsubPayments();
      unsubCustomers();
    };
  }, []);

  const getCustomerName = (customerId: string) => {
    return customers.find(c => c.id === customerId)?.name || 'زبون غير معروف';
  };

  const handleStatusChange = (cheque: Payment, newStatus: 'pending' | 'cashed' | 'bounced') => {
    const statusLabel = newStatus === 'cashed' ? 'تم تحصيله' : newStatus === 'bounced' ? 'مرتجع' : 'قيد الانتظار';
    setConfirmState({
      isOpen: true,
      title: 'تغيير حالة الشيك',
      message: `هل أنت متأكد من تغيير حالة الشيك رقم "${cheque.chequeNumber || ''}" إلى "${statusLabel}"؟ سيتم تلقائياً إعادة احتساب الأرصدة والمديونية لكل الأطراف المعنية بنتيجة هذه التسوية.`,
      isDanger: newStatus === 'bounced',
      onConfirm: async () => {
        const updated: Payment = {
          ...cheque,
          chequeStatus: newStatus
        };
        await savePayment(updated);
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Calculations
  const chequesList = payments.map(p => ({
    ...p,
    customerName: getCustomerName(p.customerId)
  }));

  const filteredCheques = chequesList.filter(c => {
    const matchesSearch = 
      c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.chequeNumber || '').includes(searchQuery) ||
      (c.bankName || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' ? true : c.chequeStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPending = payments
    .filter(p => !p.chequeStatus || p.chequeStatus === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalCashed = payments
    .filter(p => p.chequeStatus === 'cashed')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalBounced = payments
    .filter(p => p.chequeStatus === 'bounced')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="w-full pb-20 font-['Tajawal']" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-[#1C1C2E] dark:text-white">إدارة وتسوية الشيكات البنكية</h2>
          <p className="text-gray-400 dark:text-gray-500 text-xs font-bold mt-1 uppercase tracking-widest">متابعة مواعيد استحقاق شيكات المقاولين والزبائن وتعديل حالاتها</p>
        </div>
        <button
          onClick={() => changeView('PAYMENTS', undefined, 'new_cheque')}
          className="px-6 py-3.5 bg-[#3B5BDB] text-white hover:bg-[#364FC7] rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-[#3B5BDB]/20 text-xs transition-all"
        >
          <span>+ تسجيل شيك جديد</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Pending Cheques */}
        <div className="bg-white dark:bg-[#121212] p-6 rounded-3xl border border-amber-100 dark:border-[#262626] shadow-sm flex flex-col justify-between h-40">
          <div className="flex items-start justify-between">
            <div className="space-y-1 text-right">
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block">شيكات برسم التحصيل (قيد الانتظار)</span>
              <div className="text-2xl font-black text-[#1C1C2E] dark:text-white flex items-center gap-1.5 justify-start w-full" dir="rtl">
                <span dir="ltr">
                  <Counter value={totalPending} fontSize={24} textColor="currentColor" fontWeight="900" minimumFractionDigits={3} maximumFractionDigits={3} />
                </span>
                <span className="text-sm font-black text-[#1C1C2E] dark:text-white">د.أ</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center text-xl font-black shrink-0">
              <Clock size={22} />
            </div>
          </div>
          <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 mt-2">الشيكات المسجلة التي لم يحن تاريخ استحقاقها أو لم تُحصّل بعد</p>
        </div>

        {/* Cashed Cheques */}
        <div className="bg-white dark:bg-[#121212] p-6 rounded-3xl border border-emerald-100 dark:border-[#262626] shadow-sm flex flex-col justify-between h-40">
          <div className="flex items-start justify-between">
            <div className="space-y-1 text-right">
              <span className="text-[10px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-widest block">شيكات مقبولة وتحصلت</span>
              <div className="text-2xl font-black text-[#2F9E44] dark:text-[#51CF66] flex items-center gap-1.5 justify-start w-full" dir="rtl">
                <span dir="ltr">
                  <Counter value={totalCashed} fontSize={24} textColor="currentColor" fontWeight="900" minimumFractionDigits={3} maximumFractionDigits={3} />
                </span>
                <span className="text-sm font-black text-[#2F9E44] dark:text-[#51CF66]">د.أ</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 dark:text-emerald-400 flex items-center justify-center text-xl font-black shrink-0">
              <Check size={22} />
            </div>
          </div>
          <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 mt-2">الشيكات البنكية التي تم إيداعها وقبولها بنجاح لتسوية الذمم</p>
        </div>

        {/* Bounced Cheques */}
        <div className="bg-white dark:bg-[#121212] p-6 rounded-3xl border border-rose-100 dark:border-[#262626] shadow-sm flex flex-col justify-between h-40">
          <div className="flex items-start justify-between">
            <div className="space-y-1 text-right">
              <span className="text-[10px] font-black text-rose-500 dark:text-rose-400 uppercase tracking-widest block">شيكات مرتجعة (مرفوضة)</span>
              <div className="text-2xl font-black text-[#E03131] dark:text-rose-400 flex items-center gap-1.5 justify-start w-full" dir="rtl">
                <span dir="ltr">
                  <Counter value={totalBounced} fontSize={24} textColor="currentColor" fontWeight="900" minimumFractionDigits={3} maximumFractionDigits={3} />
                </span>
                <span className="text-sm font-black text-[#E03131] dark:text-rose-400">د.أ</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400 flex items-center justify-center text-xl font-black shrink-0">
              <AlertTriangle size={22} />
            </div>
          </div>
          <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 mt-2">الشيكات المرفوضة من البنك وتعاد كدين مطلوب على الزبون</p>
        </div>
      </div>

      {/* Table & Controls Section */}
      <div className="bg-white dark:bg-[#121212] rounded-3xl border border-gray-100 dark:border-[#262626] overflow-hidden shadow-sm">
        {/* Controls */}
        <div className="p-6 md:p-8 bg-gray-50/50 dark:bg-[#1A1A1A]/60 border-b border-gray-100 dark:border-[#262626] flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <input
              type="text"
              placeholder="ابحث باسم الزبون، البنك، أو رقم الشيك..."
              className="w-full pr-11 pl-4 py-3 bg-white dark:bg-[#121212] text-gray-900 dark:text-white border border-gray-200 dark:border-[#262626] rounded-xl outline-none font-bold text-xs focus:border-[#3B5BDB] transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'pending', label: 'قيد الانتظار' },
              { id: 'cashed', label: 'تم تحصيله' },
              { id: 'bounced', label: 'مرتجعة' },
            ].map(btn => (
              <button
                key={btn.id}
                onClick={() => setStatusFilter(btn.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-black shrink-0 transition-colors ${
                  statusFilter === btn.id 
                    ? 'bg-[#1C1C2E] dark:bg-[#3B5BDB] text-white' 
                    : 'bg-white dark:bg-[#121212] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#222222] border border-gray-100 dark:border-[#262626]'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cheques List */}
        {filteredCheques.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-14 h-14 bg-slate-100 dark:bg-[#1A1A1A] text-slate-400 rounded-full mx-auto flex items-center justify-center">
              <Inbox size={28} />
            </div>
            <p className="text-gray-400 dark:text-gray-500 font-bold text-sm">لا يوجد شيكات بنكية مطابقة للبحث حالياً</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#1A1A1A] border-b border-gray-100 dark:border-[#262626] text-gray-400 dark:text-gray-400 text-[10px] font-black uppercase tracking-wider">
                  <th className="px-6 py-4">اسم الزبون</th>
                  <th className="px-6 py-4">معلومات الشيك</th>
                  <th className="px-6 py-4">البنك المسحوب عليه</th>
                  <th className="px-6 py-4">تاريخ الاستحقاق</th>
                  <th className="px-6 py-4">مبلغ الشيك</th>
                  <th className="px-6 py-4">حالة الشيك</th>
                  <th className="px-6 py-4 text-center">تغيير حالة الشيك تسوية الديون</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-[#262626] text-sm font-bold text-[#1C1C2E] dark:text-gray-200">
                {filteredCheques.map((cheque) => {
                  const daysToDue = cheque.dueDate 
                    ? Math.ceil((cheque.dueDate - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;

                  return (
                    <tr key={cheque.id} className="hover:bg-gray-50/50 dark:hover:bg-[#1A1A1A]/50 transition-colors">
                      <td className="px-6 py-5">
                        <span className="font-bold text-[#3B5BDB] dark:text-[#7A98FF]">{cheque.customerName}</span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-0.5 text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-mono text-gray-800 dark:text-gray-200">رقم: {cheque.chequeNumber || 'غير متوفر'}</span>
                          {cheque.notes && <span className="text-[10px]">{cheque.notes}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                          <Landmark size={14} className="text-gray-400" />
                          <span>{cheque.bankName || 'غير محدد'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="text-gray-800 dark:text-gray-200">{cheque.dueDate ? new Date(cheque.dueDate).toLocaleDateString('ar-JO') : 'غير محدد'}</span>
                          {daysToDue !== null && (
                            cheque.chequeStatus === 'pending' || !cheque.chequeStatus ? (
                              daysToDue === 0 ? (
                                <span className="text-amber-500 text-[10px] font-black">يستحق اليوم</span>
                              ) : daysToDue > 0 ? (
                                <span className="text-gray-400 text-[10px]">متبقي {daysToDue} يوم</span>
                              ) : (
                                <span className="text-rose-500 text-[10px] font-black">متأخر عن الاستحقاق بـ {Math.abs(daysToDue)} يوم</span>
                              )
                            ) : null
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-base font-black text-[#2F9E44] dark:text-[#51CF66]">
                        {cheque.amount.toLocaleString()} <span className="text-xs font-bold text-gray-400">د.أ</span>
                      </td>
                      <td className="px-6 py-5">
                        {cheque.chequeStatus === 'cashed' ? (
                          <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 w-fit">
                            <Check size={12} strokeWidth={3} />
                            <span>تم تحصيله</span>
                          </span>
                        ) : cheque.chequeStatus === 'bounced' ? (
                          <span className="px-3 py-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-bold flex items-center gap-1 w-fit">
                            <AlertTriangle size={12} />
                            <span>مرتجع (مدين)</span>
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 w-fit">
                            <Clock size={12} />
                            <span>قيد الانتظار</span>
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleStatusChange(cheque, 'cashed')}
                            disabled={cheque.chequeStatus === 'cashed'}
                            className="p-1 px-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-lg text-[10px] font-black transition-all flex items-center gap-1"
                            title="تحديث الحالة كـ مقبول ومحصل"
                          >
                            <Check size={12} strokeWidth={3} />
                            <span>تحصيل</span>
                          </button>
                          <button
                            onClick={() => handleStatusChange(cheque, 'bounced')}
                            disabled={cheque.chequeStatus === 'bounced'}
                            className="p-1 px-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-lg text-[10px] font-black transition-all flex items-center gap-1"
                            title="تحديث الحالة كـ مرتجع (لا يتم اعتباره مدفوعاً)"
                          >
                            <AlertTriangle size={12} />
                            <span>ارتجاع</span>
                          </button>
                          <button
                            onClick={() => handleStatusChange(cheque, 'pending')}
                            disabled={cheque.chequeStatus === 'pending' || !cheque.chequeStatus}
                            className="p-1 px-2 bg-gray-100 dark:bg-[#262626] hover:bg-gray-200 dark:hover:bg-[#333] text-gray-700 dark:text-gray-200 disabled:opacity-40 rounded-lg text-[10px] font-black transition-all flex items-center gap-1"
                            title="إعادته كقيد انتظار الميعاد"
                          >
                            <RefreshCw size={12} />
                            <span>انتظار</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        isDanger={confirmState.isDanger}
        confirmText="تأكيد التغيير"
        cancelText="إلغاء"
      />
    </div>
  );
};
