
import React, { useState } from 'react';
import { Customer, CustomerType, ViewProps } from '../types';
import { Search, Store, User, Trash2, PlusCircle, History, Phone, MapPin, Database, BarChart3, Banknote } from 'lucide-react';
import { saveCustomer, deleteCustomer, seedRandomCustomers, generateId } from '../services/db';
import { useAuth } from './AuthContext';
import { ConfirmModal } from './ConfirmModal';
import { showSuccess, showError, showWarning } from '../services/notifications';

interface Props extends ViewProps {
  customers: Customer[];
}

const CustomerManager: React.FC<Props> = ({ customers, changeView }) => {
  const { role } = useAuth();
  const [isModalOpen, setModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({
    name: '',
    type: CustomerType.INDIVIDUAL,
    address: '',
    phone: ''
  });
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const handleSave = async () => {
    const trimmedName = newCustomer.name?.trim();
    if (!trimmedName) {
      showError('حقل مطلوب ⚠️', 'يرجى إدخال اسم الزبون بشكل صحيح.');
      return;
    }

    // Check for duplicate name
    const nameExists = customers.some(
      c => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (nameExists) {
      showWarning('الاسم مسجل مسبقاً ⚠️', 'هذا الاسم مسجل بالفعل كزبون أو محل تجاري.');
      return;
    }

    try {
      const customer: Customer = {
        id: generateId(),
        name: trimmedName,
        type: newCustomer.type || CustomerType.INDIVIDUAL,
        address: newCustomer.address?.trim() || '',
        phone: newCustomer.phone?.trim() || '',
        createdAt: Date.now()
      };
      
      await saveCustomer(customer);
      setModalOpen(false);
      setNewCustomer({ name: '', type: CustomerType.INDIVIDUAL, address: '', phone: '' });
      
      // Floating Success Notification from Top
      showSuccess(
        'تم إضافة جديد 🎉', 
        `تم تسجيل الزبون "${trimmedName}" بنجاح في قاعدة البيانات.`
      );
    } catch (err: any) {
      console.error("Failed to save customer:", err);
      let errorMsg = 'حدث خطأ أثناء حفظ الزبون. يرجى المحاولة لاحقاً.';
      if (err.message) {
         try {
            const parsed = JSON.parse(err.message);
            if (parsed.error && (parsed.error.includes("PERMISSION_DENIED") || parsed.error.includes("permission-denied"))) {
                errorMsg = '⚠️ ليس لديك الصلاحية لإضافة زبون (تأكد من تفعيل الحساب من الإدارة).';
            }
         } catch {
            if (err.message.includes("permission-denied") || err.message.includes("PERMISSION_DENIED")) {
                errorMsg = '⚠️ ليس لديك الصلاحية لإضافة زبون (تأكد من تفعيل الحساب من الإدارة).';
            }
         }
      }
      
      // Floating Error Notification from Top
      showError('فشل إضافة الزبون ⚠️', errorMsg);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const customer = customers.find(c => c.id === id);
    setConfirmState({
      isOpen: true,
      title: 'حذف الحساب المالي ⚠️',
      message: `هل أنت متأكد من حذف الحساب "${customer?.name || ''}" بصفة نهائية مع كافّة فواتيره وسندات القبض المترتبة عليه؟ هذا الإجراء لا يمكن التراجع عنه.`,
      onConfirm: async () => {
        try {
          await deleteCustomer(id);
          setConfirmState(prev => ({ ...prev, isOpen: false }));
          showSuccess(
            'تم حذف الزبون 🗑️', 
            `تم حذف حساب "${customer?.name || ''}" بالكامل بنجاح.`
          );
        } catch (err) {
          showError('خطأ أثناء حذف الزبون ⚠️', 'لم نتمكن من حذف حساب الزبون، يرجى التحقق من الصلاحيات.');
          setConfirmState(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  }

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone && c.phone.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#1C1C2E]">الزبائن والمحلات</h2>
          <p className="text-sm text-gray-500 font-medium">إدارة {customers.length} حساب مسجل في النظام</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setModalOpen(true)}
            className="bg-[#3B5BDB] hover:bg-[#364FC7] text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-[#3B5BDB]/20 justify-center font-bold text-sm"
          >
            <PlusCircle size={18} />
            <span>إضافة حساب جديد</span>
          </button>
        </div>
      </div>

      <div className="relative group">
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</div>
        <input 
          type="text" 
          placeholder="ابحث عن زبون أو محل..." 
          className="w-full pr-12 pl-4 py-3.5 rounded-xl border-2 border-gray-100 focus:border-[#3B5BDB] bg-white shadow-sm focus:outline-none transition-all font-bold text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-gray-200 flex flex-col items-center">
            <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mb-4">
                <Search size={32} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-700">لا يوجد حسابات حالياً</h3>
            <p className="text-gray-400 mt-1 text-sm font-bold mb-6">ابدأ بإضافة أول زبون أو محل تجاري</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer, idx) => {
            const avatarColors = ['bg-[#EEF2FF] text-[#3B5BDB] border-[#C5D0FA]', 'bg-[#EBFBEE] text-[#2F9E44] border-[#B2F2BB]', 'bg-[#FFF4E6] text-[#E8590C] border-[#FFD8A8]', 'bg-[#FFF5F5] text-[#E03131] border-[#FFC9C9]'];
            const colorClass = avatarColors[idx % avatarColors.length];
            
            return (
              <div 
                key={customer.id} 
                className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <div className="p-4">
                  {role === 'admin' && customer.locked && (
                    <div className="mb-3 w-full bg-rose-50 border-2 border-rose-300 text-rose-700 text-xs font-black py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm animate-pulse">
                       <span className="font-black text-sm">🔒</span> هذا الحساب مقفل ومخفي عن الموظفين
                    </div>
                  )}
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center text-lg font-black shrink-0 ${colorClass}`}>
                      {customer.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[#1C1C2E] text-base truncate leading-tight">{customer.name}</h3>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                        {customer.type === CustomerType.SHOP ? '🏠 محل تجاري' : '👤 زبون فردي'}
                      </p>
                    </div>
                    <div className="text-left">
                      <div className={`text-sm font-black ${customer.balance > 0 ? 'text-[#E03131]' : 'text-[#2F9E44]'}`}>
                        {Math.abs(customer.balance || 0).toLocaleString()} د.أ
                      </div>
                      <div className="text-[9px] text-gray-400 font-bold">
                        {customer.balance > 0 ? 'مديون لنا' : (customer.balance < 0 ? 'مدفوع زيادة' : 'رصيد صفر')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-50">
                    <button 
                      onClick={() => changeView('INVOICES', customer.id)}
                      className="flex items-center justify-center gap-1.5 bg-[#EEF2FF] text-[#3B5BDB] py-2.5 rounded-xl font-bold hover:bg-[#3B5BDB] hover:text-white transition-all text-xs border border-[#C5D0FA] active:scale-95 duration-100"
                      title="إصدار فاتورة جديدة"
                    >
                      <PlusCircle size={14} />
                      <span>إصدار فاتورة</span>
                    </button>
                    
                    <button 
                      onClick={() => changeView('PAYMENTS', customer.id)}
                      className="flex items-center justify-center gap-1.5 bg-[#EBFBEE] text-[#2F9E44] py-2.5 rounded-xl font-bold hover:bg-[#2F9E44] hover:text-white transition-all text-xs border border-[#B2F2BB] active:scale-95 duration-100"
                      title="سحب سند قبض مالي"
                    >
                      <Banknote size={14} />
                      <span>سند قبض</span>
                    </button>
                    
                    <button 
                      onClick={() => changeView('LEDGER', customer.id)}
                      className="flex items-center justify-center gap-1.5 bg-gray-50 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-100 transition-all border border-gray-200 text-xs col-span-2 md:col-span-2 active:scale-95 duration-100"
                      title="عرض كشف الحساب وجميع الفواتير والمقبوضات"
                    >
                      <BarChart3 size={14} />
                      <span>سجل الفواتير والكشف</span>
                    </button>

                    {role === 'admin' && (
                       <>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const nextLockState = !customer.locked;
                                await saveCustomer({ ...customer, locked: nextLockState });
                                if (nextLockState) {
                                  showWarning('تم قفل الحساب 🔒', `تم حظر وإخفاء الحساب المالي لـ "${customer.name}" عن موظفي المبيعات بصورة مؤقتة.`);
                                } else {
                                  showSuccess('إلغاء قفل الحساب 🔓', `تم تفعيل الحساب لـ "${customer.name}" وإتاحته لموظفي المبيعات من جديد.`);
                                }
                              } catch (err) {
                                showError('فشل تغيير حالة القفل 🔐', 'لم نتمكن من تعديل قفل الحساب المالي، تأكد من صلاحيات الإدارة.');
                              }
                            }}
                            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold transition-all text-xs border md:col-span-2 active:scale-95 duration-100 ${customer.locked ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700' : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'}`}
                            title={customer.locked ? 'إلغاء قفل الحساب' : 'قفل الحساب لإخفائه عن الموظفين'}
                          >
                            <span>{customer.locked ? '🔓 إلغاء قفل الحساب' : '🔒 قفل الحساب'}</span>
                          </button>
                          
                          <button
                            onClick={(e) => handleDelete(customer.id, e)}
                            className="flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 py-2.5 rounded-xl font-bold transition-all text-xs md:col-span-2 shadow-sm active:scale-95 duration-100"
                            title="حذف الحساب بصفة نهائية"
                          >
                            <Trash2 size={14} className="text-red-700" />
                            <span>حذف الحساب</span>
                          </button>
                       </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#3B5BDB] p-6 text-white text-center">
              <h3 className="text-xl font-black">إضافة حساب جديد 👥</h3>
              <p className="text-white/70 text-xs font-bold mt-1 uppercase tracking-widest">تسجيل زبون أو محل جديد في النظام</p>
            </div>
            
            <div className="p-6 md:p-8 space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">نوع الحساب</label>
                <div className="flex gap-2 p-1.5 bg-gray-50 rounded-xl border border-gray-200">
                  <button 
                    className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${newCustomer.type === CustomerType.INDIVIDUAL ? 'bg-white shadow-md text-[#3B5BDB] ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setNewCustomer({...newCustomer, type: CustomerType.INDIVIDUAL})}
                  >
                    <User size={16} />
                    زبون فردي
                  </button>
                  <button 
                    className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${newCustomer.type === CustomerType.SHOP ? 'bg-white shadow-md text-[#3B5BDB] ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setNewCustomer({...newCustomer, type: CustomerType.SHOP})}
                  >
                    <Store size={16} />
                    محل تجاري
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">الاسم الكامل</label>
                <input 
                  type="text" 
                  autoFocus
                  className="w-full p-3.5 border-2 border-gray-100 rounded-xl focus:border-[#3B5BDB] focus:outline-none bg-gray-50 focus:bg-white transition-all font-bold text-sm"
                  placeholder="أدخل الاسم هنا..."
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">رقم الهاتف</label>
                  <input 
                    type="text" 
                    className="w-full p-3.5 border-2 border-gray-100 rounded-xl focus:border-[#3B5BDB] focus:outline-none bg-gray-50 focus:bg-white transition-all font-bold text-sm text-right"
                    placeholder="079xxxxxxx"
                    dir="rtl"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">العنوان</label>
                  <input 
                    type="text" 
                    className="w-full p-3.5 border-2 border-gray-100 rounded-xl focus:border-[#3B5BDB] focus:outline-none bg-gray-50 focus:bg-white transition-all font-bold text-sm"
                    placeholder="المدينة / المنطقة"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                  />
                </div>
              </div>
            </div>
            
            <div className="p-6 pt-0 flex gap-4">
              <button 
                onClick={() => setModalOpen(false)}
                className="flex-1 py-4 border-2 border-gray-100 rounded-xl text-gray-600 font-bold hover:bg-gray-50 transition-all text-sm"
              >
                إلغاء الإجراء
              </button>
              <button 
                onClick={handleSave}
                disabled={!newCustomer.name}
                className="flex-1 py-4 bg-[#3B5BDB] text-white rounded-xl font-bold hover:bg-[#364FC7] disabled:opacity-50 transition-all shadow-lg shadow-[#3B5BDB]/20 text-sm"
              >
                تأكيد التسجيل
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        isDanger={true}
        confirmText="حذف نهائي"
        cancelText="إلغاء"
      />
    </div>
  );
};

export default CustomerManager;
