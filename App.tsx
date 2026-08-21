
import React, { useState, useEffect, Suspense } from 'react';
import { Customer, ViewState } from './types';
import { subscribeToCustomers, subscribeToTransactions, fixLegacyPaymentsV2 } from './services/db';
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
import { Settings } from './components/Settings';
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
      const custInvoices = transactions.filter(t => t.type === 'invoice' && t.customerId === c.id && !t.deleted) as any[];
      const custPayments = transactions.filter(t => t.type === 'payment' && t.customerId === c.id && !t.deleted && !t.invoiceId && t.createdBy !== 'system' && t.createdBy !== 'system_v2') as any[];
      
      const totalInvoiced = custInvoices.reduce((sum, inv) => sum + (inv.amount || inv.totalAmount || 0), 0);
      
      // Total payments = standalone receipt vouchers (سندات القبض) + cash paid directly on invoices (المدفوع مع الفاتورة)
      const totalStandalonePayments = custPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const totalInvoicePayments = custInvoices.reduce((sum, inv) => {
        const invPaid = (typeof inv.paidAmount === 'number' && inv.paidAmount >= 0) 
          ? inv.paidAmount 
          : (inv.status === 'paid' ? (inv.amount || inv.totalAmount || 0) : 0);
        return sum + invPaid;
      }, 0);
      
      const totalPaid = totalStandalonePayments + totalInvoicePayments;
      const netBalance = Number((totalInvoiced - totalPaid).toFixed(3));

      // Calculate latest activity date for this customer (latest invoice, payment, or creation date)
      let lastActivityAt = c.createdAt || 0;
      custInvoices.forEach(inv => {
        let t = inv.date;
        if (typeof t === 'string') t = new Date(t).getTime();
        else if (t?.seconds) t = t.seconds * 1000;
        if (typeof t === 'number' && !isNaN(t) && t > lastActivityAt) lastActivityAt = t;
      });
      custPayments.forEach(p => {
        let t = p.date;
        if (typeof t === 'string') t = new Date(t).getTime();
        else if (t?.seconds) t = t.seconds * 1000;
        if (typeof t === 'number' && !isNaN(t) && t > lastActivityAt) lastActivityAt = t;
      });

      return {
        ...c,
        balance: Math.abs(netBalance) < 0.001 ? 0 : netBalance,
        lastActivityAt
      };
    }).sort((a, b) => (b.lastActivityAt || b.createdAt || 0) - (a.lastActivityAt || a.createdAt || 0));
  }, [customers, transactions]);

  useEffect(() => {
    if (user) {
      // Run automatic reconciliation to consolidate split payments and ensure all invoice payments exist
      fixLegacyPaymentsV2().catch(console.error);

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

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] dark:bg-[#000000] flex items-center justify-center font-['Tajawal']" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#3B5BDB] border-t-transparent rounded-full animate-spin"></div>
        </div>
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
      case 'SETTINGS':
        return <Settings />;
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
