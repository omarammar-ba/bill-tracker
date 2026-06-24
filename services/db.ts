import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, query, orderBy, getDoc, where } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { Customer, Invoice, Payment, CustomerType, PaymentStatus } from '../types';
import { isAppOffline, showWarning, showSuccess } from './notifications';

// Detect if we are in temporary guest mode to bypass firebase errors
const isLocalMode = () => localStorage.getItem('yarmouk_guest_session') === 'true';

export interface PendingAction {
  id: string;
  action: 'saveCustomer' | 'deleteCustomer' | 'saveInvoice' | 'deleteInvoice' | 'savePayment' | 'deletePayment';
  payload: any;
  timestamp: number;
}

const shouldEnqueueOffline = (): boolean => {
  return !isLocalMode() && isAppOffline();
};

const enqueueOfflineAction = (action: PendingAction['action'], payload: any) => {
  try {
    const queue: PendingAction[] = JSON.parse(localStorage.getItem('yarmouk_offline_pending_actions') || '[]');
    const newAction: PendingAction = {
      id: generateId(),
      action,
      payload,
      timestamp: Date.now()
    };
    queue.push(newAction);
    localStorage.setItem('yarmouk_offline_pending_actions', JSON.stringify(queue));
    
    showWarning(
      'تخزين محلي معلق 📲',
      'انقطع الإنترنت فجأة! تم حفظ العملية على الذاكرة المحلية لجهازك وسنتولى مزامنتها مع خادم السحاب تلقائياً فور عودة التغطية.'
    );
  } catch (err) {
    console.error('Offline queue failure:', err);
  }
};

export const synchronizeOfflineQueue = async (): Promise<void> => {
  if (isAppOffline()) return;
  
  const queue: PendingAction[] = JSON.parse(localStorage.getItem('yarmouk_offline_pending_actions') || '[]');
  if (queue.length === 0) return;
  
  console.log(`Auto-Sync: Found ${queue.length} pending operations. Sync started...`);
  let successCount = 0;
  const remaining: PendingAction[] = [];
  
  for (const item of queue) {
    try {
      if (item.action === 'saveCustomer') {
        const customer = item.payload;
        // Limit fields written to Firestore to keep them compliant with rules (max 6 fields, no balance/locked)
        const c: any = {
            id: customer.id,
            name: customer.name,
            type: customer.type || 'individual',
            createdAt: customer.createdAt || Date.now(),
            locked: customer.locked || false
        };
        if (customer.phone) c.phone = customer.phone;
        if (customer.address) c.address = customer.address;
        await setDoc(doc(db, 'customers', customer.id), cleanObject(c));
      } else if (item.action === 'deleteCustomer') {
        await deleteDoc(doc(db, 'customers', item.payload));
      } else if (item.action === 'saveInvoice') {
        const invoice = item.payload;
        await setDoc(doc(db, 'invoices', invoice.id), cleanObject(invoice));
      } else if (item.action === 'deleteInvoice') {
        const snap = await getDoc(doc(db, 'invoices', item.payload));
        if (snap.exists()) {
             await setDoc(doc(db, 'invoices', item.payload), { deleted: true, deletedAt: Date.now(), deletedBy: auth.currentUser?.uid || 'temp_guest' }, { merge: true });
        }
      } else if (item.action === 'savePayment') {
        const payment = item.payload;
        await setDoc(doc(db, 'payments', payment.id), cleanObject(payment));
      } else if (item.action === 'deletePayment') {
        const snap = await getDoc(doc(db, 'payments', item.payload));
        if (snap.exists()) {
             await setDoc(doc(db, 'payments', item.payload), { deleted: true, deletedAt: Date.now(), deletedBy: auth.currentUser?.uid || 'temp_guest' }, { merge: true });
        }
      }
      successCount++;
    } catch (err) {
      console.error(`Offline sync sub-item error [${item.action}]:`, err);
      remaining.push(item);
    }
  }
  
  localStorage.setItem('yarmouk_offline_pending_actions', JSON.stringify(remaining));
  
  if (successCount > 0) {
    showSuccess(
      'مزامنة سحابية مكتملة ☁️✅',
      `تم استرداد الاتصال بالشبكة بنجاح ورفع عدد ( ${successCount} ) عملية معلقة كانت مخزنة سلفاً بهاتفك وحفظها بسحابة غوغل بنجاح تام!`
    );
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setTimeout(() => {
      synchronizeOfflineQueue();
    }, 2500);
  });
}

// Safe cryptographically random ID generator to bypass crypto.randomUUID failures in sandboxed/iframe/HTTP contexts
export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback V4 UUID compliant with isValidId constraints on Firestore rules
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Local storage storage utilities
const getLocalData = (key: string, defaultVal: any = []) => {
    try {
        const stored = localStorage.getItem(key);
        if (!stored) {
            localStorage.setItem(key, JSON.stringify(defaultVal));
            return defaultVal;
        }
        return JSON.parse(stored);
    } catch {
        return defaultVal;
    }
};

const saveLocalData = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
};

const cleanObject = <T extends Record<string, any>>(obj: T): T => {
    const cleaned = { ...obj } as any;
    Object.keys(cleaned).forEach(key => {
        if (cleaned[key] === undefined || cleaned[key] === null) {
            delete cleaned[key];
        } else if (typeof cleaned[key] === 'object' && !Array.isArray(cleaned[key])) {
            cleaned[key] = cleanObject(cleaned[key]);
        }
    });
    return cleaned;
};

// Initial default customers for testing if empty
const DEFAULT_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'أحمد محمود (تجريبي)', phone: '0791234567', type: CustomerType.INDIVIDUAL, balance: 150, createdAt: Date.now() - 86400000 * 3 },
  { id: 'c2', name: 'شركة السلام للمقاولات (تجريبي)', phone: '0789876543', type: CustomerType.SHOP, balance: -350, createdAt: Date.now() - 86400000 * 10 },
  { id: 'c3', name: 'معرض النخبة للسيراميك (تجريبي)', phone: '0775556667', type: CustomerType.SHOP, balance: 0, createdAt: Date.now() - 86400000 * 5 }
];

// Memory registries of listeners to allow reactive state changes in local mode
let localCustomerListeners: ((data: Customer[]) => void)[] = [];
let localTransactionListeners: ((data: any[]) => void)[] = [];
let localPaymentsListeners: ((data: Payment[]) => void)[] = [];

let customerSubscribers: ((data: Customer[]) => void)[] = [];
let customerUnsubOfFirestore: (() => void) | null = null;
let currentCustomersCache: Customer[] = [];
let customerUnsubTimeout: any = null;

let transactionSubscribers: ((data: any[]) => void)[] = [];
let invUnsub: any = null;
let payUnsub: any = null;
let currentInvoicesCache: any[] = [];
let currentPaymentsCache: any[] = [];
let transactionUnsubTimeout: any = null;

let paymentsSubscribers: ((data: Payment[]) => void)[] = [];
let paymentsUnsubOfFirestore: (() => void) | null = null;
let currentPaymentsCacheOnly: Payment[] = [];
let paymentsUnsubTimeout: any = null;

const notifyLocalCustomers = () => {
    const list = getLocalData('yarmouk_local_customers', DEFAULT_CUSTOMERS);
    localCustomerListeners.forEach(cb => cb(list));
};

const notifyLocalTransactions = () => {
    const invoices = getLocalData('yarmouk_local_invoices', []);
    const payments = getLocalData('yarmouk_local_payments', []);
    
    const combinedInvoices = invoices.map((i: any) => ({ ...i, type: 'invoice' }));
    const combinedPayments = payments.map((p: any) => {
        return { ...p, type: 'payment', totalAmount: p.amount, amount: p.amount };
    });
    
    const combined = [...combinedInvoices, ...combinedPayments].sort((a, b) => b.date - a.date);
    localTransactionListeners.forEach(cb => cb(combined));
};

const notifyLocalPayments = () => {
    const list = getLocalData('yarmouk_local_payments', []);
    localPaymentsListeners.forEach(cb => cb(list));
};

export const subscribeToCustomers = (callback: (data: Customer[]) => void) => {
  if (isLocalMode()) {
    localCustomerListeners.push(callback);
    // Emit current list instantly
    callback(getLocalData('yarmouk_local_customers', DEFAULT_CUSTOMERS));
    return () => {
      localCustomerListeners = localCustomerListeners.filter(cb => cb !== callback);
    };
  }

  if (!auth.currentUser) return () => {};
  
  if (customerUnsubTimeout) {
    clearTimeout(customerUnsubTimeout);
    customerUnsubTimeout = null;
  }

  customerSubscribers.push(callback);
  
  // If we already have the cache, emit it instantly to this subscriber
  if (currentCustomersCache.length > 0) {
    callback(currentCustomersCache);
  }

  if (!customerUnsubOfFirestore) {
    const q = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
    customerUnsubOfFirestore = onSnapshot(q, (snapshot) => {
      const lockedIds = getLocalData('yarmouk_locked_customers', []);
      const customersVal = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          locked: data.locked === true || lockedIds.includes(doc.id)
        } as Customer;
      });
      currentCustomersCache = customersVal;
      customerSubscribers.forEach(cb => cb(customersVal));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'customers'));
  }

  return () => {
    customerSubscribers = customerSubscribers.filter(cb => cb !== callback);
    if (customerSubscribers.length === 0 && customerUnsubOfFirestore) {
      if (customerUnsubTimeout) {
        clearTimeout(customerUnsubTimeout);
      }
      customerUnsubTimeout = setTimeout(() => {
        if (customerSubscribers.length === 0 && customerUnsubOfFirestore) {
          customerUnsubOfFirestore();
          customerUnsubOfFirestore = null;
          currentCustomersCache = [];
        }
        customerUnsubTimeout = null;
      }, 2000);
    }
  };
};

export const subscribeToTransactions = (callback: (data: any[]) => void) => {
  if (isLocalMode()) {
    localTransactionListeners.push(callback);
    notifyLocalTransactions();
    return () => {
      localTransactionListeners = localTransactionListeners.filter(cb => cb !== callback);
    };
  }

  if (!auth.currentUser) return () => {};
  
  if (transactionUnsubTimeout) {
    clearTimeout(transactionUnsubTimeout);
    transactionUnsubTimeout = null;
  }

  transactionSubscribers.push(callback);

  // If we already have cached transaction values, emit them instantly
  if (currentInvoicesCache.length > 0 || currentPaymentsCache.length > 0) {
    const combined = [...currentInvoicesCache, ...currentPaymentsCache].sort((a, b) => b.date - a.date);
    callback(combined);
  }

  if (!invUnsub && !payUnsub) {
    const invQuery = query(collection(db, 'invoices'), orderBy('date', 'desc'));
    const payQuery = query(collection(db, 'payments'), orderBy('date', 'desc'));

    invUnsub = onSnapshot(invQuery, (snapshot) => {
      currentInvoicesCache = snapshot.docs.map(d => ({ ...d.data(), id: d.id, type: 'invoice' } as any));
      const combined = [...currentInvoicesCache, ...currentPaymentsCache].sort((a, b) => b.date - a.date);
      transactionSubscribers.forEach(cb => cb(combined));
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'invoices'));

    payUnsub = onSnapshot(payQuery, (snapshot) => {
      currentPaymentsCache = snapshot.docs.map(d => {
        const data = d.data();
        return { ...data, id: d.id, type: 'payment', totalAmount: data.amount, amount: data.amount } as any;
      });
      const combined = [...currentInvoicesCache, ...currentPaymentsCache].sort((a, b) => b.date - a.date);
      transactionSubscribers.forEach(cb => cb(combined));
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'payments'));
  }

  return () => {
    transactionSubscribers = transactionSubscribers.filter(cb => cb !== callback);
    if (transactionSubscribers.length === 0) {
      if (transactionUnsubTimeout) {
        clearTimeout(transactionUnsubTimeout);
      }
      transactionUnsubTimeout = setTimeout(() => {
        if (transactionSubscribers.length === 0) {
          if (invUnsub) { invUnsub(); invUnsub = null; }
          if (payUnsub) { payUnsub(); payUnsub = null; }
          currentInvoicesCache = [];
          currentPaymentsCache = [];
        }
        transactionUnsubTimeout = null;
      }, 2000);
    }
  };
};

export const subscribeToPayments = (callback: (data: Payment[]) => void) => {
  if (isLocalMode()) {
    localPaymentsListeners.push(callback);
    callback(getLocalData('yarmouk_local_payments', []));
    return () => {
      localPaymentsListeners = localPaymentsListeners.filter(cb => cb !== callback);
    };
  }

  if (!auth.currentUser) return () => {};
  
  if (paymentsUnsubTimeout) {
    clearTimeout(paymentsUnsubTimeout);
    paymentsUnsubTimeout = null;
  }

  paymentsSubscribers.push(callback);
  
  if (currentPaymentsCacheOnly.length > 0) {
    callback(currentPaymentsCacheOnly);
  }

  if (!paymentsUnsubOfFirestore) {
    const q = query(collection(db, 'payments'), orderBy('date', 'desc'));
    paymentsUnsubOfFirestore = onSnapshot(q, (snapshot) => {
      const pays = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
      currentPaymentsCacheOnly = pays;
      paymentsSubscribers.forEach(cb => cb(pays));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'payments'));
  }

  return () => {
    paymentsSubscribers = paymentsSubscribers.filter(cb => cb !== callback);
    if (paymentsSubscribers.length === 0 && paymentsUnsubOfFirestore) {
      if (paymentsUnsubTimeout) {
        clearTimeout(paymentsUnsubTimeout);
      }
      paymentsUnsubTimeout = setTimeout(() => {
        if (paymentsSubscribers.length === 0 && paymentsUnsubOfFirestore) {
          paymentsUnsubOfFirestore();
          paymentsUnsubOfFirestore = null;
          currentPaymentsCacheOnly = [];
        }
        paymentsUnsubTimeout = null;
      }, 2000);
    }
  };
};

export const saveCustomer = async (customer: Customer): Promise<void> => {
    if (isLocalMode()) {
        const list = getLocalData('yarmouk_local_customers', DEFAULT_CUSTOMERS);
        const existsIdx = list.findIndex((c: any) => c.id === customer.id);
        const c = { ...customer, balance: customer.balance || 0 };
        if (!c.createdAt) c.createdAt = Date.now();
        if (existsIdx > -1) {
            list[existsIdx] = c;
        } else {
            list.push(c);
        }
        saveLocalData('yarmouk_local_customers', list);
        notifyLocalCustomers();
        return;
    }

    if (shouldEnqueueOffline()) {
        enqueueOfflineAction('saveCustomer', customer);
        return;
    }

    try {
        if (customer.locked !== undefined) {
            const lockedIds = getLocalData('yarmouk_locked_customers', []);
            let updatedLockedIds;
            if (customer.locked) {
                updatedLockedIds = [...new Set([...lockedIds, customer.id])];
            } else {
                updatedLockedIds = lockedIds.filter((id: string) => id !== customer.id);
            }
            saveLocalData('yarmouk_locked_customers', updatedLockedIds);
            
            // Instantly update cached customer states to reflect the modification immediately
            currentCustomersCache = currentCustomersCache.map(c => 
                c.id === customer.id ? { ...c, locked: customer.locked } : c
            );
            customerSubscribers.forEach(cb => cb(currentCustomersCache));
        }

        // Limit fields written to Firestore to keep them compliant with rules (max 6 fields, no balance/locked)
        const c: any = {
            id: customer.id,
            name: customer.name,
            type: customer.type || 'individual',
            createdAt: customer.createdAt || Date.now(),
            locked: customer.locked || false
        };
        
        if (customer.phone) c.phone = customer.phone;
        if (customer.address) c.address = customer.address;

        const cleaned = cleanObject(c);
        await setDoc(doc(db, 'customers', customer.id), cleaned);
    } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, `customers/${customer.id}`);
    }
};

export const deleteCustomer = async (id: string): Promise<void> => {
    if (isLocalMode()) {
        const list = getLocalData('yarmouk_local_customers', DEFAULT_CUSTOMERS);
        const filtered = list.filter((c: any) => c.id !== id);
        saveLocalData('yarmouk_local_customers', filtered);
        notifyLocalCustomers();
        return;
    }

    if (shouldEnqueueOffline()) {
        enqueueOfflineAction('deleteCustomer', id);
        return;
    }

    try {
        await deleteDoc(doc(db, 'customers', id));
    } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `customers/${id}`);
    }
};

export const recalculateCustomerBalance = async (customerId: string): Promise<void> => {
    if (isLocalMode()) {
        const invoices = getLocalData('yarmouk_local_invoices', []);
        const payments = getLocalData('yarmouk_local_payments', []);
        
        const custInvoices = invoices.filter((i: any) => i.customerId === customerId && !i.deleted);
        const custPayments = payments.filter((p: any) => p.customerId === customerId && !p.deleted);
        
        const totalInvoiced = custInvoices.reduce((sum: number, inv: any) => sum + inv.totalAmount, 0);
        const totalPaid = custPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
        
        const customers = getLocalData('yarmouk_local_customers', DEFAULT_CUSTOMERS);
        const cIdx = customers.findIndex((c: any) => c.id === customerId);
        if (cIdx > -1) {
            customers[cIdx].balance = totalInvoiced - totalPaid;
            saveLocalData('yarmouk_local_customers', customers);
            notifyLocalCustomers();
        }
        return;
    }

    // In Firestore mode, we compute the balance 100% dynamically on the client side.
    // This allows exact backward compatibility while strictly complying with the production schemas.
};

export const saveInvoice = async (invoice: Invoice): Promise<void> => {
    if (isLocalMode()) {
        const list = getLocalData('yarmouk_local_invoices', []);
        const existsIdx = list.findIndex((i: any) => i.id === invoice.id);
        const inv = { ...invoice };
        if (!inv.createdBy) inv.createdBy = 'temp_guest';
        if (existsIdx > -1) {
            list[existsIdx] = inv;
        } else {
            list.push(inv);
        }
        saveLocalData('yarmouk_local_invoices', list);
        await recalculateCustomerBalance(invoice.customerId);
        notifyLocalTransactions();
        return;
    }

    if (shouldEnqueueOffline()) {
        enqueueOfflineAction('saveInvoice', invoice);
        return;
    }

    try {
        if (!invoice.createdBy) invoice.createdBy = auth.currentUser?.uid || '';
        const cleaned = cleanObject(invoice);
        await setDoc(doc(db, 'invoices', invoice.id), cleaned);
        await recalculateCustomerBalance(invoice.customerId);
    } catch(e) {
        handleFirestoreError(e, OperationType.CREATE, `invoices/${invoice.id}`);
    }
};

export const deleteInvoice = async (invoiceId: string): Promise<void> => {
    if (isLocalMode()) {
        const list = getLocalData('yarmouk_local_invoices', []);
        const target = list.find((i: any) => i.id === invoiceId);
        if (target) {
            target.deleted = true;
            target.deletedAt = Date.now();
            target.deletedBy = 'temp_guest';
            saveLocalData('yarmouk_local_invoices', list);
            await recalculateCustomerBalance(target.customerId);
            notifyLocalTransactions();
        }
        return;
    }

    if (shouldEnqueueOffline()) {
        enqueueOfflineAction('deleteInvoice', invoiceId);
        return;
    }

    try {
        const snap = await getDoc(doc(db, 'invoices', invoiceId));
        if (snap.exists()) {
             const data = snap.data();
             const custId = data.customerId;
             const updated = { ...data, deleted: true, deletedAt: Date.now(), deletedBy: auth.currentUser?.uid || '' };
             await setDoc(doc(db, 'invoices', invoiceId), cleanObject(updated));
             await recalculateCustomerBalance(custId);
        }
    } catch(e) {
        handleFirestoreError(e, OperationType.DELETE, `invoices/${invoiceId}`);
    }
};

export const deleteInvoicePermanently = async (invoiceId: string): Promise<void> => {
    if (isLocalMode()) {
        const list = getLocalData('yarmouk_local_invoices', []);
        const target = list.find((i: any) => i.id === invoiceId);
        const filtered = list.filter((i: any) => i.id !== invoiceId);
        saveLocalData('yarmouk_local_invoices', filtered);
        if (target) {
            await recalculateCustomerBalance(target.customerId);
        }
        notifyLocalTransactions();
        return;
    }

    try {
        const snap = await getDoc(doc(db, 'invoices', invoiceId));
        if (snap.exists()) {
            const data = snap.data();
            const custId = data.customerId;
            await deleteDoc(doc(db, 'invoices', invoiceId));
            await recalculateCustomerBalance(custId);
        }
    } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `invoices/${invoiceId}`);
    }
};

export const savePayment = async (payment: Payment): Promise<void> => {
    if (isLocalMode()) {
        const list = getLocalData('yarmouk_local_payments', []);
        const existsIdx = list.findIndex((p: any) => p.id === payment.id);
        const pay = { ...payment };
        if (!pay.createdBy) pay.createdBy = 'temp_guest';
        if (existsIdx > -1) {
            list[existsIdx] = pay;
        } else {
            list.push(pay);
        }
        saveLocalData('yarmouk_local_payments', list);
        
        if (payment.invoiceId) {
            const invoices = getLocalData('yarmouk_local_invoices', []);
            const invIdx = invoices.findIndex((i: any) => i.id === payment.invoiceId);
            if (invIdx > -1) {
                const inv = invoices[invIdx];
                const allPaymentsForThis = list.filter((p: any) => p.invoiceId === payment.invoiceId);
                const totalPaid = allPaymentsForThis.reduce((sum: number, p: any) => sum + p.amount, 0);
                inv.paidAmount = totalPaid;
                inv.status = inv.paidAmount >= inv.totalAmount ? 'paid' : (inv.paidAmount > 0 ? 'partial' : 'unpaid');
                invoices[invIdx] = inv;
                saveLocalData('yarmouk_local_invoices', invoices);
            }
        }
        await recalculateCustomerBalance(payment.customerId);
        notifyLocalTransactions();
        notifyLocalPayments();
        return;
    }

    if (shouldEnqueueOffline()) {
        enqueueOfflineAction('savePayment', payment);
        return;
    }

    try {
        if (!payment.createdBy) payment.createdBy = auth.currentUser?.uid || '';
        const cleaned = cleanObject(payment);
        await setDoc(doc(db, 'payments', payment.id), cleaned);
        
        if (payment.invoiceId) {
             const invSnap = await getDoc(doc(db, 'invoices', payment.invoiceId));
             if (invSnap.exists()) {
                 const inv = invSnap.data() as Invoice;
                 
                  // Fetch all payments for this invoice
                  const paySnap = await getDocs(query(collection(db, 'payments'), where('invoiceId', '==', payment.invoiceId)));
                  const payments = paySnap.docs.map(d => d.data() as Payment).filter(p => !p.deleted);
                  
                  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
                  inv.paidAmount = totalPaid;
                  inv.status = inv.paidAmount >= inv.totalAmount ? 'paid' : (inv.paidAmount > 0 ? 'partial' : 'unpaid');
                  
                  const cleanedInv = cleanObject(inv);
                  await setDoc(doc(db, 'invoices', inv.id), cleanedInv);
             }
        }
        await recalculateCustomerBalance(payment.customerId);
    } catch(e) {
        handleFirestoreError(e, OperationType.CREATE, `payments/${payment.id}`);
    }
};

export const deletePayment = async (paymentId: string): Promise<void> => {
    if (isLocalMode()) {
        const list = getLocalData('yarmouk_local_payments', []);
        const target = list.find((p: any) => p.id === paymentId);
        if (target) {
            target.deleted = true;
            target.deletedAt = Date.now();
            target.deletedBy = 'temp_guest';
            saveLocalData('yarmouk_local_payments', list);
            await recalculateCustomerBalance(target.customerId);
            notifyLocalTransactions();
            notifyLocalPayments();
        }
        return;
    }

    if (shouldEnqueueOffline()) {
        enqueueOfflineAction('deletePayment', paymentId);
        return;
    }

    try {
        const snap = await getDoc(doc(db, 'payments', paymentId));
        if (snap.exists()) {
             const data = snap.data();
             const custId = data.customerId;
             const updated = { ...data, deleted: true, deletedAt: Date.now(), deletedBy: auth.currentUser?.uid || '' };
             await setDoc(doc(db, 'payments', paymentId), cleanObject(updated));
             await recalculateCustomerBalance(custId);
        }
    } catch(e) {
        handleFirestoreError(e, OperationType.DELETE, `payments/${paymentId}`);
    }
};

export const deletePaymentPermanently = async (paymentId: string): Promise<void> => {
    if (isLocalMode()) {
        const list = getLocalData('yarmouk_local_payments', []);
        const target = list.find((p: any) => p.id === paymentId);
        const filtered = list.filter((p: any) => p.id !== paymentId);
        saveLocalData('yarmouk_local_payments', filtered);
        if (target) {
            await recalculateCustomerBalance(target.customerId);
        }
        notifyLocalTransactions();
        notifyLocalPayments();
        return;
    }

    try {
        const snap = await getDoc(doc(db, 'payments', paymentId));
        if (snap.exists()) {
            const data = snap.data();
            const custId = data.customerId;
            await deleteDoc(doc(db, 'payments', paymentId));
            await recalculateCustomerBalance(custId);
        }
    } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `payments/${paymentId}`);
    }
};

export const seedRandomCustomers = async (): Promise<void> => {
    console.log("Seeding deactivated.");
};

export const getCustomerInvoices = async (customerId: string): Promise<Invoice[]> => {
    if (isLocalMode()) {
        const list = getLocalData('yarmouk_local_invoices', []);
        return list.filter((i: any) => i.customerId === customerId && !i.deleted).sort((a: any, b: any) => b.date - a.date);
    }

    try {
        const invQuery = query(collection(db, 'invoices'));
        const snap = await getDocs(invQuery);
        return snap.docs.map(d => d.data() as Invoice).filter(i => i.customerId === customerId && !i.deleted).sort((a, b) => b.date - a.date);
    } catch(e) {
        handleFirestoreError(e, OperationType.LIST, 'invoices');
        return [];
    }
};

export const getCustomerPayments = async (customerId: string): Promise<Payment[]> => {
    if (isLocalMode()) {
        const list = getLocalData('yarmouk_local_payments', []);
        return list.filter((p: any) => p.customerId === customerId && !p.deleted).sort((a: any, b: any) => b.date - a.date);
    }

    try {
        const payQuery = query(collection(db, 'payments'));
        const snap = await getDocs(payQuery);
        return snap.docs.map(d => d.data() as Payment).filter(p => p.customerId === customerId && !p.deleted).sort((a, b) => b.date - a.date);
    } catch(e) {
        handleFirestoreError(e, OperationType.LIST, 'payments');
        return [];
    }
};
