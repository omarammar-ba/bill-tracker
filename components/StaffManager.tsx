import React, { useState, useEffect } from 'react';
import { Settings, UserPlus, Trash2, Shield, User, Lock, Mail, Users, Check, X, ShieldAlert, ShieldCheck, Edit2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { ConfirmModal } from './ConfirmModal';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db, createEmployeeAccount } from '../services/firebase';
import { showSuccess, showError, showWarning } from '../services/notifications';

interface Employee {
  id: string;
  name?: string;
  email: string;
  role: 'admin' | 'supervisor' | 'employee';
  active: boolean;
  createdAt: number;
}

export const StaffManager: React.FC = () => {
  const { role, user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'supervisor' | 'employee'>('employee');
  const [isAdding, setIsAdding] = useState(false);
  
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  
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

  useEffect(() => {
    if (role !== 'admin') return;
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snap) => {
       const usersData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
       setEmployees(usersData.sort((a,b) => b.createdAt - a.createdAt));
    });
    return () => unsubscribe();
  }, [role]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newName) return;
    setIsAdding(true);
    try {
        const uid = await createEmployeeAccount(newEmail, newPassword);
        await setDoc(doc(db, 'users', uid), {
            email: newEmail,
            name: newName,
            role: newRole,
            active: true,
            createdAt: Date.now()
        });
        
        showSuccess('تمت الإضافة بنجاح 👥', `تم تسجيل الموظف "${newName}" بصفة (${newRole === 'admin' ? 'مدير' : newRole === 'supervisor' ? 'مشرف' : 'موظف مبيعات'}) في النظام.`);
        setShowAddForm(false);
        setNewName('');
        setNewEmail('');
        setNewPassword('');
        setNewRole('employee');
    } catch(err: any) {
        showError('فشل إضافة الموظف ⚠️', err.message);
    }
    setIsAdding(false);
  };

  const toggleStatus = async (id: string, currentStatus: boolean, isSelf: boolean) => {
    if (isSelf) {
      showWarning('تنبيه أمان 🔒', 'لا يمكنك رصد أو تعطيل حسابك النشط الشخصي لتفادي فقدان التحكم بالبروتوكول.');
      return;
    }
    try {
        await updateDoc(doc(db, 'users', id), { active: !currentStatus });
        const empName = employees.find(e => e.id === id)?.name || 'المستخدم';
        showSuccess(
          !currentStatus ? 'تنشيط الحساب 🔓' : 'تعطيل الحساب 🔒',
          `تم ${!currentStatus ? 'تنشيط' : 'تعطيل'} حساب الموظف "${empName}" بنجاح في قاعدة البيانات.`
        );
    } catch(e: any) {
        showError('خطأ بتعديل الحالة ⚠️', e.message);
    }
  };

  const updateRole = async (id: string, newRole: 'admin' | 'supervisor' | 'employee', isSelf: boolean) => {
    if (isSelf) {
      showWarning('تنبيه أمان 🔒', 'لا يمكنك تخفيض أو تبديل رتبتك الإدارية الشخصية من لوحة التحديثات.');
      return;
    }
    try {
        await updateDoc(doc(db, 'users', id), { role: newRole });
        const empName = employees.find(e => e.id === id)?.name || 'المستخدم';
        const roleLabel = newRole === 'admin' ? 'مدير' : newRole === 'supervisor' ? 'مشرف' : 'موظف مبيعات';
        showSuccess(
          'تحديث رتبة الموظف 🎖️',
          `تم ترقية/تحديث رتبة الموظف "${empName}" إلى (${roleLabel}) بنجاح.`
        );
    } catch(e: any) {
        showError('خطأ بتحديث الصلاحية ⚠️', e.message);
    }
  };

  const handleEditNameStart = (emp: Employee) => {
    setEditingNameId(emp.id);
    setEditingNameValue(emp.name || '');
  };

  const handleEditNameSave = async (id: string) => {
    if (!editingNameValue.trim()) return setEditingNameId(null);
    try {
        await updateDoc(doc(db, 'users', id), { name: editingNameValue.trim() });
        showSuccess('تم تحديث الاسم المالي 🎉', `تم تعديل الاسم الشخصي للموظف بنجاح.`);
    } catch(e: any) {
        showError('فشل تعديل الاسم ⚠️', e.message);
    }
    setEditingNameId(null);
  };

  const handleDeleteEmployee = (id: string, isSelf: boolean) => {
    if (isSelf) {
      showWarning('حظر الإجراء ⚠️', 'لا يمكن تصفير أو حذف حسابك المالي المفتوح حالياً للوقاية.');
      return;
    }
    const empName = employees.find(emp => emp.id === id)?.name || 'المستخدم';
    setConfirmState({
      isOpen: true,
      title: 'حذف حساب موظف ⚠️',
      message: `هل أنت متأكد من حذف حساب "${empName}" نهائياً من النظام؟`,
      onConfirm: async () => {
        try {
           await deleteDoc(doc(db, 'users', id));
           showSuccess('حذف الحساب بنجاح 🗑️', `تم شطب حساب الموظف "${empName}" نهائياً من قاعدة البيانات.`);
        } catch(e: any) {
           showError('خطأ بالحذف ❌', e.message);
        }
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 font-['Tajawal']" dir="rtl">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#1C1C2E]">إدارة الموظفين والصلاحيات</h1>
          <p className="text-gray-400 font-bold text-sm mt-1">
             يمكنك إضافة موظف جديد من خلال إدخال بريده الإلكتروني وكلمة مرور مبدئية.
          </p>
        </div>
        {role === 'admin' && !showAddForm && (
          <button 
            onClick={() => setShowAddForm(true)}
            className="px-5 py-3 bg-[#EEF2FF] hover:bg-[#3B5BDB] hover:text-white text-[#3B5BDB] border border-[#C5D0FA] font-black text-sm rounded-xl transition-all shadow-sm flex items-center gap-2"
          >
            <UserPlus size={18} />
            إضافة حساب موظف
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleAddEmployee} className="bg-white p-6 md:p-8 rounded-[32px] border border-gray-100 shadow-xl shadow-blue-900/5 max-w-2xl mx-auto space-y-5 animate-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center pb-3 border-b border-gray-50">
            <h3 className="text-xl font-black text-[#1C1C2E] flex items-center gap-2">
              <UserPlus className="text-[#3B5BDB]" size={22} /> إضافة حساب جديد
            </h3>
            <button 
              type="button" 
              onClick={() => setShowAddForm(false)} 
              className="p-1 px-3 text-sm font-bold bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-all"
            >
              إلغاء
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1.5">اسم الموظف</label>
              <div className="relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"><User size={16} /></span>
                <input 
                  type="text" 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="الاسم الكامل"
                  className="w-full pr-12 pl-4 py-3 bg-gray-50/50 border-2 border-gray-100 rounded-xl focus:border-[#3B5BDB] focus:bg-white outline-none font-bold text-sm transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1.5">البريد الإلكتروني</label>
              <div className="relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"><Mail size={16} /></span>
                <input 
                  type="email" 
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pr-12 pl-4 py-3 bg-gray-50/50 border-2 border-gray-100 rounded-xl focus:border-[#3B5BDB] focus:bg-white outline-none font-bold text-sm transition-all text-right dir-ltr"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1.5">كلمة المرور المبدئية</label>
              <div className="relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"><Lock size={16} /></span>
                <input 
                  type="text" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="لا تقل عن 6 أحرف"
                  minLength={6}
                  className="w-full pr-12 pl-4 py-3 bg-gray-50/50 border-2 border-gray-100 rounded-xl focus:border-[#3B5BDB] focus:bg-white outline-none font-bold text-sm transition-all text-right dir-ltr"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1.5">الصلاحية</label>
              <div className="flex gap-2 p-1.5 bg-gray-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setNewRole('employee')}
                  className={`flex-1 py-1 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${newRole === 'employee' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                >
                  موظف مبيعات
                </button>
                <button
                  type="button"
                  onClick={() => setNewRole('supervisor')}
                  className={`flex-1 py-1 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${newRole === 'supervisor' ? 'bg-[#3B5BDB] text-white shadow-sm' : 'text-gray-500'}`}
                >
                  مشرف
                </button>
                <button
                  type="button"
                  onClick={() => setNewRole('admin')}
                  className={`flex-1 py-1 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${newRole === 'admin' ? 'bg-[#3B5BDB] text-white shadow-sm' : 'text-gray-500'}`}
                >
                  مدير نظام
                </button>
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={isAdding}
            className="w-full py-4 px-6 bg-[#3B5BDB] text-white font-black text-sm rounded-xl hover:bg-[#364FC7] shadow-lg shadow-[#3B5BDB]/20 flex items-center justify-center gap-2 transition-all disabled:opacity-70"
          >
            <Check size={20} />
            <span>{isAdding ? 'جاري إنشاء الحساب...' : 'حفظ وإنشاء حساب الموظف'}</span>
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {employees.map(emp => {
          const isManager = emp.role === 'admin';
          const isSelf = emp.email === user?.email;
          return (
            <div 
              key={emp.id} 
              className={`bg-white border rounded-[32px] p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between min-h-[180px] ${emp.active ? 'border-gray-100' : 'border-red-100 opacity-80'}`}
            >
              <div className={`absolute top-0 inset-x-0 h-1.5 ${isManager ? 'bg-[#3B5BDB]' : 'bg-gray-200'} ${!emp.active && 'bg-red-500'}`} />

              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3 w-full">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 ${isManager ? 'bg-[#EEF2FF] text-[#3B5BDB]' : 'bg-gray-100 text-gray-500'} ${!emp.active && 'bg-red-50 text-red-500'}`}>
                      {emp.name ? emp.name.charAt(0) : 'U'}
                    </div>
                    <div className="flex-1 min-w-0 pr-1">
                      {editingNameId === emp.id ? (
                        <div className="flex items-center gap-2 max-w-full">
                          <input 
                            type="text" 
                            className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm font-bold w-full"
                            value={editingNameValue}
                            onChange={(e) => setEditingNameValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleEditNameSave(emp.id)}
                            autoFocus
                          />
                          <button onClick={() => handleEditNameSave(emp.id)} className="text-green-600 p-1 hover:bg-green-50 rounded">
                            <Check size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <h3 className="font-bold text-[#1C1C2E] text-base leading-tight truncate">{emp.name || 'غير محدد'}</h3>
                          <button 
                            onClick={() => handleEditNameStart(emp)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-[#3B5BDB] p-1"
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <span className={`text-[9px] px-2.5 py-1 rounded-lg font-black uppercase tracking-widest ${isManager ? 'bg-[#EEF2FF] text-[#3B5BDB]' : emp.role === 'supervisor' ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400'}`}>
                    {isManager ? 'مدير' : emp.role === 'supervisor' ? 'مشرف' : 'موظف'}
                  </span>
                </div>

                <div className="text-xs text-gray-400 font-bold space-y-1.5 mt-2 bg-gray-50/50 p-3 rounded-2xl border border-gray-50">
                  <div className="flex justify-between">
                    <span>البريد:</span>
                    <span className="text-[#1C1C2E] font-mono select-all text-[11px] truncate max-w-[150px]">{emp.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>تاريخ التسجيل:</span>
                    <span className="text-gray-500">{new Date(emp.createdAt).toLocaleDateString('ar-JO')}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                    <span>الحساب:</span>
                    <span className={`font-black ${emp.active ? 'text-green-500' : 'text-red-500'}`}>
                       {emp.active ? 'نشط' : 'قيد المراجعة / معطل'}
                    </span>
                  </div>
                </div>
              </div>

              {role === 'admin' && (
                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-gray-50">
                  {!isSelf && (
                     <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => toggleStatus(emp.id, emp.active, isSelf)}
                          className={`w-full flex items-center justify-center gap-1 py-2 text-white rounded-xl text-xs font-bold transition-all ${emp.active ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'}`}
                        >
                          {emp.active ? <X size={14}/> : <Check size={14}/>}
                          <span>{emp.active ? 'تعطيل الحساب' : 'تفعيل الحساب'}</span>
                        </button>
                        
                        <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 p-1 rounded-xl">
                          <button 
                            onClick={() => updateRole(emp.id, 'employee', isSelf)}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${emp.role === 'employee' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:bg-gray-100/50'}`}
                          >
                            موظف
                          </button>
                          <button 
                            onClick={() => updateRole(emp.id, 'supervisor', isSelf)}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${emp.role === 'supervisor' ? 'bg-amber-100 text-amber-700 shadow-sm' : 'text-gray-500 hover:bg-gray-100/50'}`}
                          >
                            مشرف
                          </button>
                          <button 
                            onClick={() => updateRole(emp.id, 'admin', isSelf)}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${emp.role === 'admin' ? 'bg-[#EEF2FF] text-[#3B5BDB] shadow-sm' : 'text-gray-500 hover:bg-gray-100/50'}`}
                          >
                            مدير
                          </button>
                        </div>
                     </div>
                  )}

                  {!isSelf && (
                    <button 
                      onClick={() => handleDeleteEmployee(emp.id, isSelf)}
                      className="w-full flex items-center justify-center gap-1 py-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl text-xs font-bold transition-all"
                    >
                      <Trash2 size={13} />
                      <span>حذف موظف</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

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
