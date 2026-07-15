
import React, { useState, useEffect } from 'react';
import { Customer, ViewState } from './types';
import { subscribeToCustomers, subscribeToTransactions } from './services/db';
import { AuthProvider, useAuth } from './components/AuthContext';
import Layout from './components/Layout';
import CustomerManager from './components/CustomerManager';
import TransactionForm from './components/TransactionForm';
import Ledger from './components/Ledger';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

import Reports from './components/Reports';
import { StaffManager } from './components/StaffManager';
import { ChequesManager } from './components/ChequesManager';
import { BackupRestore } from './components/BackupRestore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastNotifications } from './components/ToastNotifications';
import { DiagnosticsCenter } from './components/DiagnosticsCenter';

const AppContent: React.FC = () => {
  const { user, loading, role } = useAuth();
  const [view, setView] = useState<ViewState>('HOME');
  const [activeCustomerId, setActiveCustomerId] = useState<string | undefined>();
  const [activeTransactionId, setActiveTransactionId] = useState<string | undefined>();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

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
        setCustomers(data.sort((a, b) => b.createdAt - a.createdAt));
      });

      const unsubscribeTrans = subscribeToTransactions((data) => {
        setTransactions(data.sort((a, b) => {
          let da: any = a.date;
          let dbDate: any = b.date;
          if (typeof da === 'string') da = new Date(da).getTime();
          else if (da?.seconds) da = da.seconds * 1000;
          if (typeof dbDate === 'string') dbDate = new Date(dbDate).getTime();
          else if (dbDate?.seconds) dbDate = dbDate.seconds * 1000;
          return (dbDate || 0) - (da || 0);
        }));
      });

      return () => {
        unsubscribeCust();
        unsubscribeTrans();
      };
    }
  }, [user, role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex flex-col font-['Tajawal'] p-4 space-y-4" dir="rtl">
        {/* Header Skeleton */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between animate-pulse">
          <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
          <div className="w-24 h-5 bg-gray-200 rounded-full"></div>
          <div className="w-10 h-10 bg-gray-200 rounded-xl"></div>
        </div>

        {/* List Skeleton */}
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 animate-pulse relative h-48">
               <div className="absolute top-6 right-6 w-16 h-16 bg-gray-200 rounded-2xl"></div>
               <div className="absolute top-6 left-6 w-20 h-5 bg-gray-200 rounded-full"></div>
               <div className="absolute bottom-12 right-6 w-32 h-5 bg-gray-200 rounded-full"></div>
               <div className="absolute bottom-4 right-6 w-48 h-5 bg-gray-200 rounded-full"></div>
            </div>
          ))}
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
      default:
        return <Dashboard customers={visibleCustomers} transactions={visibleTransactions} changeView={changeView} />;
    }
  };

  return (
    <Layout currentView={view} changeView={changeView}>
      {renderContent()}
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
