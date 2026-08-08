import React, { useMemo, useState, useEffect } from 'react';
import { Customer, Transaction, ViewState } from '../types';
import { Users, Receipt, Banknote, Wallet, ArrowUpRight, ArrowDownRight, Clock, Eye, EyeOff, Trash2, AlertCircle, ChevronLeft, Plus, X, FilePlus } from 'lucide-react';
import { useAuth } from './AuthContext';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import { motion } from 'motion/react';
import { deleteInvoice, deletePayment, deleteInvoicePermanently, deletePaymentPermanently } from '../services/db';
import { ConfirmModal } from './ConfirmModal';
import Counter from './Counter';

const SwipeableTransactionItem: React.FC<{
  t: Transaction;
  customers: Customer[];
  userNames: Record<string, string>;
  changeView: (view: ViewState, customerId?: string, transactionId?: string) => void;
  activeTxId: string | null;
  setActiveTxId: (id: string | null) => void;
  onInitiateDelete: (t: Transaction) => void;
}> = ({ t, customers, userNames, changeView, activeTxId, setActiveTxId, onInitiateDelete }) => {
  const [isSwipedLeft, setIsSwipedLeft] = useState(false);
  const [isSwipedRight, setIsSwipedRight] = useState(false);

  const isDeleted = t.deleted;
  const actorId = isDeleted ? t.deletedBy : t.createdBy;
  const actorName = actorId ? (userNames[actorId] || (actorId === 'temp_guest' ? 'نظام محلي' : 'موظف')) : 'نظام';
  const dateObj = new Date(isDeleted ? (t.deletedAt || t.date) : t.date);
  
  const customer = customers.find(c => c.id === t.customerId);
  const displayCustomerName = customer ? customer.name : ((t as any).customerName || 'حساب محذوف');
  const isMissingCustomer = !customer;

  return (
    <div className="relative overflow-hidden rounded-2xl mb-2 select-none" dir="rtl">
      {/* Background delete actions */}
      <>
        {/* Swipe Left Background - reveals Delete action on Right */}
        {isSwipedLeft && (
          <div 
            onClick={(e) => {
              e.stopPropagation();
              onInitiateDelete(t);
              setIsSwipedLeft(false);
              setIsSwipedRight(false);
            }}
            className={`absolute inset-y-0 right-0 w-24 rounded-2xl flex flex-col items-center justify-center text-white gap-1 cursor-pointer z-0 shadow-inner ${
              isDeleted ? 'bg-gradient-to-l from-red-600 to-red-800' : 'bg-gradient-to-l from-red-500 to-rose-600'
            }`}
          >
            <Trash2 size={18} className="animate-pulse text-white" />
            <span className="text-[10px] font-black">{isDeleted ? 'حذف نهائي' : 'حذف الحركة'}</span>
          </div>
        )}

        {/* Swipe Right Background - reveals Delete action on Left */}
        {isSwipedRight && (
          <div 
            onClick={(e) => {
              e.stopPropagation();
              onInitiateDelete(t);
              setIsSwipedLeft(false);
              setIsSwipedRight(false);
            }}
            className={`absolute inset-y-0 left-0 w-24 rounded-2xl flex flex-col items-center justify-center text-white gap-1 cursor-pointer z-0 shadow-inner ${
              isDeleted ? 'bg-gradient-to-r from-red-600 to-red-800' : 'bg-gradient-to-r from-red-500 to-rose-600'
            }`}
          >
            <Trash2 size={18} className="animate-pulse text-white" />
            <span className="text-[10px] font-black">{isDeleted ? 'حذف نهائي' : 'حذف الحركة'}</span>
          </div>
        )}
      </>

      {/* Foreground Interactive Card with Drag/Swipe Gestures */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 100 }}
        dragElastic={0.15}
        onDragEnd={(event, info) => {
          if (info.offset.x < -45) {
            setIsSwipedLeft(true);
            setIsSwipedRight(false);
          } else if (info.offset.x > 45) {
            setIsSwipedRight(true);
            setIsSwipedLeft(false);
          } else {
            setIsSwipedLeft(false);
            setIsSwipedRight(false);
          }
        }}
        animate={{ x: isSwipedLeft ? -96 : (isSwipedRight ? 96 : 0) }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
        style={{ touchAction: 'none' }} // Crucial for responsive mobile scrolling while dragging
        className={`z-10 relative flex flex-col p-3 bg-gray-50/50 dark:bg-[#1A1A1A]/80 hover:bg-white dark:hover:bg-[#222222] rounded-2xl border border-gray-100 dark:border-[#262626] hover:border-[#3B5BDB]/30 transition-shadow duration-150 cursor-pointer ${
          activeTxId === t.id ? 'bg-white dark:bg-[#222222] border-[#3B5BDB]/30 shadow-sm ring-1 ring-[#3B5BDB]/10' : ''
        } ${isDeleted ? 'bg-red-50/30 dark:bg-red-950/20 border-red-100/50 dark:border-red-900/30 hover:border-red-200' : ''}`}
        onClick={() => {
          if (isSwipedLeft || isSwipedRight) {
            setIsSwipedLeft(false);
            setIsSwipedRight(false);
          } else {
            setActiveTxId(activeTxId === t.id ? null : t.id);
          }
        }}
      >
        {/* Top Row: Icon + Type & ID badge (Right) AND Amount (Left) */}
        <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 min-w-0 pr-1">
                <div className={`shrink-0 p-1 transition-transform duration-300 ${t.type === 'invoice' ? 'text-[#3B5BDB] dark:text-[#7A98FF]' : 'text-[#2F9E44] dark:text-[#51CF66]'} ${isDeleted ? 'text-red-500 dark:text-red-400' : ''}`}>
                    {isDeleted ? <Trash2 size={18} /> : (t.type === 'invoice' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />)}
                </div>
                <div className="min-w-0 flex flex-col justify-center">
                     <p className={`font-extrabold text-[13px] md:text-[14px] truncate flex items-center gap-1.5 ${isDeleted ? 'text-red-600 dark:text-red-400 line-through' : 'text-[#1C1C2E] dark:text-white'}`}>
                         {t.type === 'invoice' ? 'فاتورة مبيعات' : 'سند قبض مالي'} 
                         {isDeleted && <span className="text-[10px] bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded font-black no-underline font-sans">محذوفة</span>}
                     </p>
                     <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        العميل: <span className={isMissingCustomer ? 'text-red-400 border-b border-red-200 border-dashed' : 'text-[#3B5BDB] dark:text-[#7A98FF]'}>{displayCustomerName}</span>
                     </p>
                </div>
            </div>

            <div className="shrink-0 pl-1">
                <p className={`text-[13px] md:text-[14px] font-black ${isDeleted ? 'text-red-400 line-through' : (t.type === 'invoice' ? 'text-[#1C1C2E] dark:text-white' : 'text-[#2F9E44] dark:text-[#51CF66]')}`}>
                    {((t as any).amount || (t as any).totalAmount || 0).toLocaleString()} <span className="text-[10px] opacity-70">د.أ</span>
                </p>
            </div>
        </div>

        {/* Divider & Bottom Row: Info on Right, Actions on Left */}
        <div className="flex items-center justify-between border-t border-gray-100/50 dark:border-[#262626] pt-2 mt-2 w-full">
            {/* Date & Actor Info */}
            <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap text-[10px] md:text-[11px] font-bold text-gray-400 dark:text-gray-500" dir="rtl">
                     <span dir="ltr">{dateObj.toLocaleDateString('ar-EG')} {dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                     <span className="text-gray-300 dark:text-gray-600">|</span>
                     <span>{isDeleted ? 'حذف بواسطة:' : 'بواسطة:'} <strong className={`font-extrabold ${isDeleted ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}`}>{actorName}</strong></span>
                </div>
            </div>

            {/* Actions */}
            <div 
                className={`flex items-center gap-2 transition-all duration-300 select-none ${
                    activeTxId === t.id 
                        ? 'opacity-100 translate-x-0 pointer-events-auto' 
                        : 'opacity-0 translate-x-2 pointer-events-none lg:group-hover:opacity-100 lg:group-hover:translate-x-0 lg:group-hover:pointer-events-auto'
                }`}
            >
                {!isDeleted && !isMissingCustomer && (
                <button 
                   type="button"
                   onClick={(e) => { 
                       e.stopPropagation(); 
                       changeView('LEDGER', t.customerId, t.id); 
                    }}
                   className="p-2 bg-white dark:bg-[#121212] text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 rounded-xl transition-all duration-100 hover:bg-emerald-600 hover:text-white cursor-pointer shadow-sm active:scale-95 touch-manipulation flex items-center justify-center shrink-0"
                   title="معاينة وطباعة"
                >
                    <Eye size={16} />
                </button>
                )}
                {!isDeleted && !isMissingCustomer && (
                <button 
                   type="button"
                   onClick={(e) => { 
                       e.stopPropagation(); 
                       changeView('EDIT_TRANSACTION', t.customerId, t.id); 
                    }}
                   className="p-2 bg-white dark:bg-[#121212] text-[#3B5BDB] dark:text-[#7A98FF] border border-[#C5D0FA] dark:border-[#3B5BDB]/40 rounded-xl transition-all duration-100 hover:bg-[#3B5BDB] hover:text-white cursor-pointer shadow-sm active:scale-95 touch-manipulation flex items-center justify-center shrink-0"
                   title="تعديل"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-[16px] h-[16px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                )}
            </div>
        </div>
      </motion.div>
    </div>
  );
};

interface DashboardProps {
  customers: Customer[];
  transactions: Transaction[];
  changeView: (view: ViewState, customerId?: string, transactionId?: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ customers, transactions, changeView }) => {
  const { role } = useAuth();
  const [activeTxId, setActiveTxId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(5);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [confirmingTransaction, setConfirmingTransaction] = useState<Transaction | null>(null);
  const [isBalanceHidden, setIsBalanceHidden] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('isBalanceHidden');
      return saved === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('isBalanceHidden', String(isBalanceHidden));
    }
  }, [isBalanceHidden]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const namesMap: Record<string, string> = {};
        snap.docs.forEach(d => {
          namesMap[d.id] = d.data().name || d.data().email?.split('@')[0] || 'موظف';
        });
        setUserNames(namesMap);
      } catch (err) {
        console.error('Could not fetch users', err);
      }
    };
    fetchUsers();
  }, []);

  const recentTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      let da: any = a.date;
      let dbDate: any = b.date;
      if (typeof da === 'string') da = new Date(da).getTime();
      else if (da?.seconds) da = da.seconds * 1000;
      if (typeof dbDate === 'string') dbDate = new Date(dbDate).getTime();
      else if (dbDate?.seconds) dbDate = dbDate.seconds * 1000;
      return (dbDate || 0) - (da || 0);
    }).slice(0, visibleCount);
  }, [transactions, visibleCount]);

  const stats = useMemo(() => {
    const totalSales = transactions.filter(t => t.type === 'invoice' && !t.deleted).reduce((acc, t) => acc + ((t as any).totalAmount || (t as any).amount || 0), 0);
    const totalCollected = transactions.filter(t => t.type === 'payment' && !t.deleted).reduce((acc, t) => acc + ((t as any).amount || 0), 0);
    const totalDebts = customers.reduce((acc, c) => acc + (c.balance || 0), 0);
    const customerCount = customers.length;

    return { totalSales, totalCollected, totalDebts, customerCount };
  }, [customers, transactions]);

  const [needsBackup, setNeedsBackup] = useState(false);
  useEffect(() => {
    const backupDate = localStorage.getItem('last_backup_date');
    if (backupDate) {
      const days = (Date.now() - new Date(backupDate).getTime()) / (1000 * 60 * 60 * 24);
      if (days > 30) setNeedsBackup(true);
    } else {
      setNeedsBackup(true);
    }
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 font-['Tajawal']" dir="rtl">
      
      {needsBackup && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-5 py-4 rounded-xl flex items-center justify-between gap-4 cursor-pointer hover:bg-amber-100 transition-colors"
             onClick={() => changeView('BACKUP')}>
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <div>
              <h3 className="font-bold text-lg">حان وقت إنشاء نسخة احتياطية شهرية</h3>
              <p className="text-sm mt-0.5">مر أكثر من 30 يوم على آخر نسخة احتياطية، اضغط هنا لإنشاء نسخة جديدة لحماية بياناتك.</p>
            </div>
          </div>
          <ChevronLeft className="w-5 h-5 shrink-0" />
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#1C1C2E] dark:text-white">لوحة التحكم</h1>
          <p className="text-gray-500 dark:text-gray-400 font-bold text-sm mt-1">نظرة عامة على أداء المعرض والعمليات المالية اليومية</p>
        </div>

        <div className="hidden md:flex flex-wrap gap-3 items-center">
          <button 
            onClick={() => changeView('NEW_TRANSACTION')}
            className="flex-1 md:flex-none px-5 py-3 bg-[#EEF2FF] dark:bg-[#1A1A1A] hover:bg-[#3B5BDB] dark:hover:bg-[#3B5BDB] text-[#3B5BDB] dark:text-[#7A98FF] hover:text-white dark:hover:text-white border border-[#C5D0FA] dark:border-[#262626] font-black text-sm rounded-xl transition-all active:scale-95 duration-100 shadow-sm flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
          >
            <Receipt size={18} />
            إضافة فاتورة بيع
          </button>
          <button 
            onClick={() => changeView('PAYMENTS')}
            className="flex-1 md:flex-none px-5 py-3 bg-[#EBFBEE] dark:bg-[#1A1A1A] hover:bg-[#2F9E44] dark:hover:bg-[#2F9E44] text-[#2F9E44] dark:text-[#51CF66] hover:text-white dark:hover:text-white border border-[#B2F2BB] dark:border-[#262626] font-black text-sm rounded-xl transition-all active:scale-95 duration-100 shadow-sm flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
          >
            <Banknote size={18} />
            إضافة سند قبض
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard 
          icon={<Wallet size={20} />} 
          label="إجمالي الذمم (الديون الدفترية)" 
          numericValue={stats.totalDebts}
          suffix="د.أ"
          value={`${stats.totalDebts.toLocaleString()} د.أ`} 
          sub="مجموع الذمم المطلوبة من الزبائن"
          color="pink"
          isHidden={isBalanceHidden}
          onToggleHide={() => setIsBalanceHidden(!isBalanceHidden)}
        />
        <StatCard 
          icon={<Users size={20} />} 
          label="عدد الزبائن" 
          numericValue={stats.customerCount}
          value={`${stats.customerCount.toLocaleString()}`} 
          sub="عدد الزبائن المسجلين في النظام"
          color="blue"
        />
      </div>

      <div className="bg-white dark:bg-[#121212] p-5 md:p-6 rounded-[24px] shadow-lg shadow-blue-900/5 border border-gray-100 dark:border-[#262626] flex flex-col w-full">
        <div className="flex items-center justify-between mb-4 border-b border-gray-50 dark:border-[#262626] pb-3">
            <h3 className="text-base font-black text-[#1C1C2E] dark:text-white flex items-center gap-2">
                <Clock size={18} className="text-[#3B5BDB]" /> آخر الحركات
            </h3>
        </div>
          
        <div className="space-y-2 flex-1">
            {recentTransactions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-8 opacity-40">
                    <Clock size={40} className="mb-3" />
                    <p className="font-bold text-sm">لا يوجد حركات مؤخراً</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {recentTransactions.map((t) => (
                      <SwipeableTransactionItem
                        key={t.id}
                        t={t}
                        customers={customers}
                        userNames={userNames}
                        changeView={changeView}
                        activeTxId={activeTxId}
                        setActiveTxId={setActiveTxId}
                        onInitiateDelete={(tx) => setConfirmingTransaction(tx)}
                      />
                    ))}
                    
                    {/* Elegant Manual Show More Button */}
                    {transactions.length > visibleCount && visibleCount < 20 && (
                        <div className="flex justify-center pt-3">
                            <button
                                type="button"
                                onClick={() => setVisibleCount(prev => Math.min(prev + 5, 20))}
                                className="px-5 py-2 bg-[#EEF2FF] hover:bg-[#3B5BDB] text-[#3B5BDB] hover:text-white font-black text-xs rounded-xl transition-all duration-150 shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer select-none"
                            >
                                تحميل المزيد
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!confirmingTransaction}
        title={
          confirmingTransaction?.deleted
            ? (confirmingTransaction?.type === 'invoice' ? 'تأكيد الحذف النهائي للفاتورة' : 'تأكيد الحذف النهائي للسند')
            : (confirmingTransaction?.type === 'invoice' ? 'تأكيد إلغاء وحذف الفاتورة' : 'تأكيد إلغاء وحذف السند')
        }
        message={
          confirmingTransaction?.deleted
            ? `هل أنت متأكد من رغبتك في حذف ${confirmingTransaction?.type === 'invoice' ? 'هذه الفاتورة' : 'هذا السند القابض'} بشكل نهائي؟ سيتم مسح الحركة وتفاصيلها تماماً من السجلات ولا يمكن التراجع عن ذلك.`
            : `هل أنت متأكد من رغبتك في حذف ${confirmingTransaction?.type === 'invoice' ? 'هذه الفاتورة' : 'هذا السند القابض'}؟ سيتم إلغاء الحركة وتحديث رصيد الزبون تلقائياً.`
        }
        confirmText="تأكيد الحذف"
        cancelText="تراجع"
        onConfirm={async () => {
          if (confirmingTransaction) {
            try {
              if (confirmingTransaction.type === 'invoice') {
                if (confirmingTransaction.deleted) {
                  await deleteInvoicePermanently(confirmingTransaction.id);
                } else {
                  await deleteInvoice(confirmingTransaction.id);
                }
              } else {
                if (confirmingTransaction.deleted) {
                  await deletePaymentPermanently(confirmingTransaction.id);
                } else {
                  await deletePayment(confirmingTransaction.id);
                }
              }
            } catch (e) {
              console.error('Failed to delete transaction', e);
            }
            setConfirmingTransaction(null);
          }
        }}
        onCancel={() => setConfirmingTransaction(null)}
      />
    </div>
  );
};

const StatCard = ({ icon, label, value, numericValue, suffix, sub, color, isHidden, onToggleHide }: any) => {
  const iconColors: any = {
    blue: 'text-[#3B5BDB] dark:text-[#7A98FF]',
    green: 'text-[#2F9E44] dark:text-[#51CF66]',
    red: 'text-[#E03131] dark:text-[#FF6B6B]',
    pink: 'text-[#E03131] dark:text-[#FF6B8B]',
    orange: 'text-[#E8590C] dark:text-[#FF922B]',
    indigo: 'text-indigo-600 dark:text-indigo-400'
  };

  return (
    <div className={`p-6 bg-white dark:bg-[#121212] rounded-[32px] border border-gray-100 dark:border-[#262626] shadow-xl shadow-blue-900/5 flex flex-col justify-between h-48 transition-all hover:-translate-y-1 hover:shadow-2xl`}>
      <div className="flex items-center justify-between">
        <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center bg-gray-100/80 dark:bg-[#1C1C1E] border border-gray-200/40 dark:border-white/5 shadow-inner ${iconColors[color] || 'text-[#3B5BDB]'}`}>
          {icon}
        </div>
        {onToggleHide && (
          <button 
            onClick={onToggleHide} 
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#1A1A1A] rounded-xl transition-all"
            title={isHidden ? "إظهار الرصيد" : "إخفاء الرصيد"}
          >
            {isHidden ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
      <div className="mt-4">
        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-1">{label}</p>
        <div className="text-3xl font-black text-[#1C1C2E] dark:text-white tracking-tight h-[36px] flex items-center">
          {isHidden ? (
            <span className="text-[#1C1C2E] dark:text-white font-black">***** د.أ</span>
          ) : typeof numericValue === 'number' ? (
            <div className="flex items-center gap-1.5 justify-start w-full" dir="rtl">
              <span dir="ltr">
                <Counter 
                  value={numericValue} 
                  fontSize={28} 
                  textColor="currentColor" 
                  fontWeight="900" 
                  minimumFractionDigits={suffix ? 3 : 0}
                  maximumFractionDigits={suffix ? 3 : 0}
                />
              </span>
              {suffix && <span className="text-lg font-black text-[#1C1C2E] dark:text-white">{suffix}</span>}
            </div>
          ) : (
            value
          )}
        </div>
        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 mt-2">{sub}</p>
      </div>
    </div>
  );
};

export default Dashboard;
