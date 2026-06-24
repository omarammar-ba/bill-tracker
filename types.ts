
export enum CustomerType {
  INDIVIDUAL = 'individual',
  SHOP = 'shop'
}

export type PaymentStatus = 'paid' | 'partial' | 'unpaid';

export interface Customer {
  id: string;
  name: string;
  type: CustomerType | 'individual' | 'shop';
  phone?: string;
  address?: string;
  createdAt: number;
  balance?: number;
  locked?: boolean;
}

export interface CartItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  unit?: string;
}

export interface Invoice {
  id: string;
  customerId: string;
  date: number; 
  items: CartItem[];
  totalAmount: number;
  paidAmount: number;
  status: PaymentStatus;
  notes?: string;
  type?: 'invoice';
  createdBy?: string;
  deleted?: boolean;
  deletedAt?: number;
  deletedBy?: string;
}

export interface Payment {
  id: string;
  customerId: string;
  invoiceId?: string;
  date: number;
  amount: number;
  notes?: string;
  type?: 'payment';
  paymentMethod?: 'cash' | 'cheque';
  chequeNumber?: string;
  bankName?: string;
  dueDate?: number;
  chequeStatus?: 'pending' | 'cashed' | 'bounced';
  createdBy?: string;
  deleted?: boolean;
  deletedAt?: number;
  deletedBy?: string;
}

export type Transaction = (Invoice & { type: 'invoice' }) | (Payment & { type: 'payment' });

export type ViewState = 'CUSTOMERS' | 'NEW_TRANSACTION' | 'EDIT_TRANSACTION' | 'LEDGER' | 'LOGIN' | 'REPORTS' | 'STAFF' | 'HOME' | 'INVOICES' | 'PAYMENTS' | 'CHEQUES';

export interface ViewProps {
  changeView: (view: ViewState, customerId?: string, transactionId?: string) => void;
  activeCustomerId?: string;
  activeTransactionId?: string;
}
