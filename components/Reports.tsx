import React, { useMemo, useState } from 'react';
import { Customer, Transaction } from '../types';
import { TrendingUp, Users, DollarSign, Wallet, FileSpreadsheet, Phone, MapPin, Search, BarChart as ChartIcon, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  customers: Customer[];
  transactions: Transaction[];
}

const Reports: React.FC<Props> = ({ customers, transactions }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const stats = useMemo(() => {
    let totalSales = 0;
    let totalCollected = 0;
    
    transactions.filter(t => !t.deleted).forEach(t => {
      if (t.type === 'invoice') {
        const amt = Number((t as any).totalAmount || (t as any).amount || 0);
        if (!isNaN(amt)) {
          totalSales += amt;
        }
      } else if (t.type === 'payment') {
        const amt = Number((t as any).amount || (t as any).totalAmount || 0);
        if (!isNaN(amt)) {
          totalCollected += amt;
        }
      }
    });
    
    return {
      sales: totalSales,
      collected: totalCollected,
      customers: customers.length,
      debt: customers.reduce((acc, c) => acc + (c.balance || 0), 0)
    };
  }, [customers, transactions]);

  // Customer debt data for Recharts (Show top 8 customers with highest debt)
  const chartData = useMemo(() => {
    return [...customers]
      .filter(c => (c.balance || 0) > 0)
      .sort((a, b) => (b.balance || 0) - (a.balance || 0))
      .slice(0, 8)
      .map(c => ({
        name: c.name.length > 12 ? c.name.substring(0, 12) + '..' : c.name,
        'الذمم المطلوبة (د.أ)': c.balance || 0
      }));
  }, [customers]);

  // Active debtors list for interactive lookup
  const debtorsList = useMemo(() => {
    const list = customers.filter(c => (c.balance || 0) > 0);
    if (!searchTerm.trim()) return list;
    return list.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [customers, searchTerm]);

  const handleExportBackup = () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      metadata: {
        customersCount: customers.length,
        transactionsCount: transactions.length,
      },
      customers: customers,
      transactions: transactions
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `yarmouk_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-750 font-['Tajawal'] text-right" dir="rtl">
      {/* Visual Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#1C1C2E]">التقارير والتحليلات المالية 📊</h1>
          <p className="text-gray-500 font-medium text-sm mt-1">كشف تفصيلي لحسابات الذمم والمبيعات الكلية والتحصيلات في النظام</p>
        </div>
        <button
          onClick={handleExportBackup}
          className="bg-white border border-gray-200 text-[#1C1C2E] px-4 py-2.5 rounded-2xl text-sm font-bold shadow-sm hover:bg-gray-50 flex items-center justify-center gap-2 transition-all shrink-0"
        >
          <Download size={18} />
          <span>تصدير نسخة احتياطية (JSON)</span>
        </button>
      </div>

      {/* Stats Cards Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-blue-50 shadow-xl shadow-blue-900/5">
           <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] text-[#3B5BDB] flex items-center justify-center mb-4">
              <TrendingUp size={24} />
           </div>
           <p className="text-gray-400 text-xs font-bold mb-1">إجمالي المبيعات (الفواتير)</p>
           <p className="text-2xl font-black text-[#1C1C2E]">{(stats.sales || 0).toLocaleString()} <span className="text-sm font-bold text-gray-400">د.أ</span></p>
        </div>
        
        <div className="bg-white p-6 rounded-3xl border border-green-50 shadow-xl shadow-green-900/5">
           <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center mb-4">
              <DollarSign size={24} />
           </div>
           <p className="text-gray-400 text-xs font-bold mb-1">إجمالي المبالغ المحصلة</p>
           <p className="text-2xl font-black text-green-600">{(stats.collected || 0).toLocaleString()} <span className="text-sm font-bold text-gray-400">د.أ</span></p>
        </div>
        
        <div className="bg-white p-6 rounded-3xl border border-red-50 shadow-xl shadow-red-900/5">
           <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <Wallet size={24} />
           </div>
           <p className="text-gray-400 text-xs font-bold mb-1">إجمالي الذمم المتبقية بالدفتر</p>
           <p className="text-2xl font-black text-red-600">{(stats.debt || 0).toLocaleString()} <span className="text-sm font-bold text-gray-400">د.أ</span></p>
        </div>
        
        <div className="bg-white p-6 rounded-3xl border border-slate-50 shadow-xl shadow-slate-200/5">
           <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center mb-4">
              <Users size={24} />
           </div>
           <p className="text-gray-400 text-xs font-bold mb-1">إجمالي عدد الحسابات كلياً</p>
           <p className="text-2xl font-black text-[#1C1C2E]">{stats.customers} <span className="text-sm font-bold text-gray-400">حساب كلي</span></p>
        </div>
      </div>
      
      {/* Chart and Active Debts Directory Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Visual Chart Card */}
        <div className="bg-white p-6 md:p-8 rounded-[32px] border border-gray-100 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <ChartIcon className="text-[#3B5BDB]" size={22} />
              <h3 className="text-lg font-black text-[#1C1C2E]">أعلى 8 حسابات ذمم مطلوبة بالدفتر</h3>
            </div>
            
            <div className="h-80 w-full font-sans">
              {chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400 font-bold">
                  لا توجد أرصدة مديونية حالياً بالدفتر لعرضها في الرسم
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="horizontal" margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F3F5" />
                    <XAxis dataKey="name" tick={{ fill: '#868E96', fontSize: 10, fontWeight: 'bold' }} axisLine={{ stroke: '#E9ECEF' }} />
                    <YAxis tick={{ fill: '#868E96', fontSize: 10, fontWeight: 'bold' }} axisLine={{ stroke: '#E9ECEF' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: 12, border: '1px solid #E9ECEF', direction: 'rtl', fontFamily: 'Tajawal', fontWeight: 'bold', fontSize: 12 }} 
                      cursor={{ fill: '#F8F9FA' }}
                    />
                    <Bar dataKey="الذمم المطلوبة (د.أ)" radius={[8, 8, 0, 0]} fill="#3B5BDB" barSize={32}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#E03131' : index === 1 ? '#FF922B' : '#3B5BDB'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          
          <div className="mt-4 border-t border-gray-100 pt-4 flex gap-4 text-xs font-bold text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#E03131]"></span>
              <span>المديونية الأكبر</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#FF922B]"></span>
              <span>المرتبة الثانية</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#3B5BDB]"></span>
              <span>باقي الحسابات</span>
            </div>
          </div>
        </div>

        {/* Directory Card - No print, highly interactive directory */}
        <div className="bg-white p-6 md:p-8 rounded-[32px] border border-gray-100 shadow-sm flex flex-col h-[500px]">
          <div className="flex items-center gap-3 mb-2">
            <FileSpreadsheet className="text-[#3B5BDB]" size={22} />
            <h3 className="text-lg font-black text-[#1C1C2E]">دليل حسابات الذمم المستحقة</h3>
          </div>
          <p className="text-gray-400 text-xs font-bold leading-relaxed mb-4">
            قائمة محدثة تلقائياً بجميع الحسابات النشطة التي يترتب عليها ذمم لمتابعتها مباشرة بالهاتف:
          </p>

          {/* Search box inside the directory card */}
          <div className="relative mb-4">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              placeholder="ابحث سريعاً عن المدين..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-3 py-2 text-xs rounded-xl border border-gray-200 outline-none focus:border-[#3B5BDB] font-bold text-gray-800"
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-3">
            {debtorsList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-2xl">
                <span className="text-2xl">🎉</span>
                <p className="text-xs font-bold text-slate-500 mt-2">لا توجد ذمم مستحقة تتطابق مع البحث حالياً</p>
              </div>
            ) : (
              debtorsList.map(c => (
                <div key={c.id} className="p-3 bg-slate-50/70 border border-slate-100/50 rounded-2xl hover:bg-slate-50 transition-all flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-xs text-gray-850 truncate max-w-[150px]">{c.name}</span>
                    <span className="font-black text-rose-600 font-mono text-xs">{(c.balance).toLocaleString()} د.أ</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold border-t border-gray-100/40 pt-1.5">
                    <div className="flex items-center gap-1">
                      <Phone size={10} className="text-[#3B5BDB]" />
                      <span>{c.phone || 'بدون هاتف'}</span>
                    </div>
                    {c.address && (
                      <div className="flex items-center gap-1 truncate max-w-[100px]">
                        <MapPin size={10} className="text-amber-500" />
                        <span>{c.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center text-xs font-bold text-gray-500">
            <span>إجمالي ذمم الدليل المصفى:</span>
            <span className="font-black text-[#1C1C2E] font-mono">
              {debtorsList.reduce((acc, current) => acc + (current.balance || 0), 0).toLocaleString()} د.أ
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
