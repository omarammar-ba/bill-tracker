import React, { useState, useEffect } from 'react';
import { Payment, Customer, ViewProps } from '../types';
import { subscribeToPayments, subscribeToCustomers, savePayment } from '../services/db';
import { Search, Calendar, FileText, Landmark, Clock, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

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
      title: 'تغيير حالة الشيك ✍️',
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
          <h2 className="text-2xl font-black text-[#1C1C2E]">إدارة وتسوية الشيكات البنكية ✍️</h2>
          <p className="text-gray-400 text-xs font-bold mt-1 uppercase tracking-widest">متابعة مواعيد استحقاق شيكات المقاولين والزبائن وتعديل حالاتها</p>
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
        <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1 text-right">
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block">شيكات برسم التحصيل (قيد الانتظار)</span>
            <span className="text-2xl font-black text-[#1C1C2E] block">
              {totalPending.toLocaleString()} <span className="text-sm font-bold text-gray-500">د.أ</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center text-xl font-black">
            ⏳
          </div>
        </div>

        {/* Cashed Cheques */}
        <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1 text-right">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block">شيكات مقبولة وتحصلت</span>
            <span className="text-2xl font-black text-[#1C1C2E] block">
              {totalCashed.toLocaleString()} <span className="text-sm font-bold text-gray-500">د.أ</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-xl font-black">
            ✅
          </div>
        </div>

        {/* Bounced Cheques */}
        <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1 text-right">
            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest block">شيكات مرتجعة (مرفوضة)</span>
            <span className="text-2xl font-black text-rose-700 block">
              {totalBounced.toLocaleString()} <span className="text-sm font-bold text-rose-500">د.أ</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center text-xl font-black">
            ❌
          </div>
        </div>
      </div>

      {/* Table & Controls Section */}
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
        {/* Controls */}
        <div className="p-6 md:p-8 bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <input
              type="text"
              placeholder="ابحث باسم الزبون، البنك، أو رقم الشيك..."
              className="w-full pr-11 pl-4 py-3 bg-white border border-gray-200 rounded-xl outline-none font-bold text-xs focus:border-[#3B5BDB] transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'pending', label: '⏳ قيد الانتظار' },
              { id: 'cashed', label: '✅ تم تحصيله' },
              { id: 'bounced', label: '❌ مرتجعة' },
            ].map(btn => (
              <button
                key={btn.id}
                onClick={() => setStatusFilter(btn.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-black shrink-0 transition-colors ${
                  statusFilter === btn.id 
                    ? 'bg-[#1C1C2E] text-white' 
                    : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-100'
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
            <span className="text-4xl block">📬</span>
            <p className="text-gray-400 font-bold text-sm">لا يوجد شيكات بنكية مطابقة للبحث حالياً</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 text-[10px] font-black uppercase tracking-wider">
                  <th className="px-6 py-4">اسم الزبون</th>
                  <th className="px-6 py-4">معلومات الشيك</th>
                  <th className="px-6 py-4">البنك المسحوب عليه</th>
                  <th className="px-6 py-4">تاريخ الاستحقاق</th>
                  <th className="px-6 py-4">مبلغ الشيك</th>
                  <th className="px-6 py-4">حالة الشيك</th>
                  <th className="px-6 py-4 text-center">تغيير حالة الشيك تسوية الديون</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm font-bold text-[#1C1C2E]">
                {filteredCheques.map((cheque) => {
                  const daysToDue = cheque.dueDate 
                    ? Math.ceil((cheque.dueDate - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;

                  return (
                    <tr key={cheque.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-5">
                        <span className="font-bold text-[#3B5BDB]">{cheque.customerName}</span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-0.5 text-xs text-gray-500">
                          <span className="font-mono text-gray-800">رقم: {cheque.chequeNumber || 'غير متوفر'}</span>
                          {cheque.notes && <span className="text-[10px]">{cheque.notes}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-1.5 text-xs text-gray-700">
                          <Landmark size={14} className="text-gray-400" />
                          <span>{cheque.bankName || 'غير محدد'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="text-gray-800">{cheque.dueDate ? new Date(cheque.dueDate).toLocaleDateString('ar-JO') : 'غير محدد'}</span>
                          {daysToDue !== null && (
                            cheque.chequeStatus === 'pending' || !cheque.chequeStatus ? (
                              daysToDue === 0 ? (
                                <span className="text-amber-500 text-[10px] font-black">يستحق اليوم ⚠️</span>
                              ) : daysToDue > 0 ? (
                                <span className="text-gray-400 text-[10px]">متبقي {daysToDue} يوم</span>
                              ) : (
                                <span className="text-rose-500 text-[10px] font-black">متأخر عن الاستحقاق بـ {Math.abs(daysToDue)} يوم 🗓️</span>
                              )
                            ) : null
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-base font-black text-[#2F9E44]">
                        {cheque.amount.toLocaleString()} <span className="text-xs font-bold text-gray-400">د.أ</span>
                      </td>
                      <td className="px-6 py-5">
                        {cheque.chequeStatus === 'cashed' ? (
                          <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1 w-fit">
                            <Check size={12} strokeWidth={3} />
                            <span>تم تحصيله</span>
                          </span>
                        ) : cheque.chequeStatus === 'bounced' ? (
                          <span className="px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-bold flex items-center gap-1 w-fit">
                            <AlertTriangle size={12} />
                            <span>مرتجع (مدين)</span>
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-bold flex items-center gap-1 w-fit">
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
                            className="p-1 px-2 bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-40 rounded-lg text-[10px] font-black transition-all flex items-center gap-1"
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
