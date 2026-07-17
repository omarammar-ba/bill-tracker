
import React, { useState, useEffect, Suspense } from 'react';
import { Customer, ViewState } from './types';
import { subscribeToCustomers, subscribeToTransactions } from './services/db';
import { AuthProvider, useAuth } from './components/AuthContext';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

import CustomerManager from './components/CustomerManager';
import TransactionForm from './components/TransactionForm';
import Ledger from './components/Ledger';
import Reports from './components/Reports';
import { StaffManager } from './components/StaffManager';
import { ChequesManager } from './components/ChequesManager';
import { BackupRestore } from './components/BackupRestore';
import { DiagnosticsCenter } from './components/DiagnosticsCenter';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastNotifications } from './components/ToastNotifications';

const AppContent: React.FC = () => {
  const { user, loading, role } = useAuth();
  const [view, setView] = useState<ViewState>('HOME');
  const [activeCustomerId, setActiveCustomerId] = useState<string | undefined>();
  const [activeTransactionId, setActiveTransactionId] = useState<string | undefined>();
  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      const cachedUser = localStorage.getItem('yarmouk_user_cache');
      if (cachedUser) {
        const u = JSON.parse(cachedUser);
        if (u && u.uid) {
          const cachedCust = localStorage.getItem(`yarmouk_customers_${u.uid}`);
          return cachedCust ? JSON.parse(cachedCust) : [];
        }
      }
    } catch {}
    return [];
  });
  const [transactions, setTransactions] = useState<any[]>(() => {
    try {
      const cachedUser = localStorage.getItem('yarmouk_user_cache');
      if (cachedUser) {
        const u = JSON.parse(cachedUser);
        if (u && u.uid) {
          const cachedTrans = localStorage.getItem(`yarmouk_transactions_${u.uid}`);
          return cachedTrans ? JSON.parse(cachedTrans) : [];
        }
      }
    } catch {}
    return [];
  });

  const computedCustomers = React.useMemo(() => {
    return customers.map(c => {
      const custInvoices = transactions.filter(t => t.type === 'invoice' && t.customerId === c.id && !t.deleted);
      const custPayments = transactions.filter(t => t.type === 'payment' && t.customerId === c.id && !t.deleted);
      
      const totalInvoiced = custInvoices.reduce((sum, inv) => sum + (inv.amount || inv.totalAmount || 0), 0);
      const totalPaid = custPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      
      return {
        ...c,
        balance: totalInvoiced - totalPaid
      };
    });
  }, [customers, transactions]);

  useEffect(() => {
    if (user) {
      if ((role === 'employee' && (view === 'REPORTS' || view === 'STAFF')) || (role === 'supervisor' && view === 'STAFF')) {
        setView('HOME');
      }
      
      const unsubscribeCust = subscribeToCustomers((data) => {
        const sorted = data.sort((a, b) => b.createdAt - a.createdAt);
        setCustomers(sorted);
        try {
          localStorage.setItem(`yarmouk_customers_${user.uid}`, JSON.stringify(sorted));
        } catch (e) {}
      });

      const unsubscribeTrans = subscribeToTransactions((data) => {
        const sorted = data.sort((a, b) => {
          let da: any = a.date;
          let dbDate: any = b.date;
          if (typeof da === 'string') da = new Date(da).getTime();
          else if (da?.seconds) da = da.seconds * 1000;
          if (typeof dbDate === 'string') dbDate = new Date(dbDate).getTime();
          else if (dbDate?.seconds) dbDate = dbDate.seconds * 1000;
          return (dbDate || 0) - (da || 0);
        });
        setTransactions(sorted);
        try {
          localStorage.setItem(`yarmouk_transactions_${user.uid}`, JSON.stringify(sorted));
        } catch (e) {}
      });

      return () => {
        unsubscribeCust();
        unsubscribeTrans();
      };
    }
  }, [user, role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex flex-col md:flex-row font-['Tajawal']" dir="rtl">
        {/* Mobile Header Skeleton */}
        <div className="md:hidden relative z-20 mb-6 w-full">
          <div className="absolute inset-x-0 top-0 h-[80px] bg-[#2A2A40] rounded-b-[32px] overflow-hidden shadow-sm"></div>
          <div className="relative h-[80px] px-6 flex justify-between items-center">
            <div className="w-10 h-10 bg-white/10 rounded-xl animate-pulse"></div>
            <div className="w-24 h-6 bg-white/20 rounded-md animate-pulse"></div>
          </div>
        </div>

        {/* Desktop Sidebar Skeleton */}
        <div className="hidden md:flex w-72 flex-col bg-[#1C1C2E] border-l border-white/5 relative z-20">
          <div className="p-8">
            <div className="w-32 h-8 bg-white/10 rounded-md animate-pulse mb-8"></div>
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="w-full h-12 bg-white/5 rounded-xl animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Skeleton */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="p-4 md:p-8 max-w-[1200px] mx-auto w-full pt-4 md:pt-8 min-h-screen">
            <div className="flex flex-col gap-6">
              {/* Dashboard Header Skeleton */}
              <div>
                <div className="w-48 h-8 bg-gray-200 rounded-md animate-pulse mb-2"></div>
                <div className="w-64 h-4 bg-gray-200 rounded-md animate-pulse"></div>
              </div>
              
              {/* Stat Cards Skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 animate-pulse h-48"></div>
                <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 animate-pulse h-48"></div>
                <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 animate-pulse h-48"></div>
              </div>

              {/* List Skeleton */}
              <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 mt-2">
                <div className="w-32 h-6 bg-gray-200 rounded-md animate-pulse mb-6"></div>
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-20 bg-gray-50 rounded-2xl animate-pulse"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const changeView = (newView: ViewState, customerId?: string, transactionId?: string) => {
    if ((role === 'employee' && (newView === 'REPORTS' || newView === 'STAFF')) || (role === 'supervisor' && newView === 'STAFF')) {
      return; 
    }

    if (customerId) setActiveCustomerId(customerId);
    else if (['LEDGER', 'CUSTOMERS', 'HOME'].includes(newView)) setActiveCustomerId(undefined);
    
    if (transactionId) setActiveTransactionId(transactionId);
    else setActiveTransactionId(undefined);
    
    setView(newView);
  };

  const visibleCustomers = role === 'employee' ? computedCustomers.filter(c => !c.locked) : computedCustomers;
  const visibleCustomerIds = new Set(visibleCustomers.map(c => c.id));
  const visibleTransactions = role === 'employee' ? transactions.filter(t => visibleCustomerIds.has(t.customerId)) : transactions;

  const renderContent = () => {
    switch (view) {
      case 'HOME':
        return <Dashboard customers={visibleCustomers} transactions={visibleTransactions} changeView={changeView} />;
      case 'CUSTOMERS':
        return <CustomerManager customers={visibleCustomers} changeView={changeView} />;
      case 'INVOICES':
      case 'PAYMENTS':
      case 'NEW_TRANSACTION':
      case 'EDIT_TRANSACTION':
        return <TransactionForm key={`${view}-${activeCustomerId || 'new'}-${activeTransactionId || 'new'}`} customers={visibleCustomers} changeView={changeView} activeCustomerId={activeCustomerId} initialType={view === 'PAYMENTS' ? 'payment' : 'invoice'} activeTransactionId={activeTransactionId} />;
      case 'LEDGER':
        return <Ledger customers={visibleCustomers} activeCustomerId={activeCustomerId} activeTransactionId={activeTransactionId} changeView={changeView} />;
      case 'CHEQUES':
        return <ChequesManager changeView={changeView} />;
      case 'REPORTS':
        return <Reports customers={visibleCustomers} transactions={visibleTransactions} />;
      case 'BACKUP':
        return <BackupRestore />;
      case 'STAFF':
        return <StaffManager />;
      default:
        return <Dashboard customers={visibleCustomers} transactions={visibleTransactions} changeView={changeView} />;
    }
  };

  return (
    <Layout currentView={view} changeView={changeView}>
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center p-8 min-h-[50vh]">
          <div className="animate-spin w-8 h-8 border-4 border-[#3B5BDB] border-t-transparent rounded-full shadow-sm"></div>
        </div>
      }>
        {renderContent()}
      </Suspense>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
        <ToastNotifications />
        <DiagnosticsCenter />
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
