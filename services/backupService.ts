import { collection, getDocs, setDoc, doc, writeBatch } from 'firebase/firestore';
import { db, auth } from './firebase';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Customer, Invoice, Payment } from '../types';

export const createMonthlyBackup = async () => {
    // 1. Fetch current data
    const customersSnap = await getDocs(collection(db, 'customers'));
    const invoicesSnap = await getDocs(collection(db, 'invoices'));
    const paymentsSnap = await getDocs(collection(db, 'payments'));

    const customers = customersSnap.docs.map(d => d.data() as Customer);
    const invoices = invoicesSnap.docs.map(d => d.data() as Invoice);
    const payments = paymentsSnap.docs.map(d => d.data() as Payment);

    const now = new Date();
    const monthStr = now.toISOString().substring(0, 7);

    // 2. Prepare JSON
    const backupJson = {
        backupInfo: {
            appName: "معرض اليرموك",
            backupVersion: 1,
            type: "monthly-backup",
            createdAt: now.toISOString(),
            month: monthStr,
            sourceUserId: auth.currentUser?.uid || 'temp_guest',
            sourceAccountEmail: auth.currentUser?.email || ''
        },
        customers,
        invoices,
        payments,
        settings: {}
    };

    // 3. Prepare customers_summary.xlsx
    const calculateCustomerBalance = (customerId: string) => {
        const cInvoices = invoices.filter(i => i.customerId === customerId && !i.deleted);
        const cPayments = payments.filter(p => p.customerId === customerId && !p.deleted);
        
        const totalInvoices = cInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
        const totalPayments = cPayments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
        return {
            countInvoices: cInvoices.length,
            countPayments: cPayments.length,
            totalInvoices,
            totalPayments,
            balance: totalInvoices - totalPayments
        };
    };

    const customersSummary = customers.map(c => {
        const stats = calculateCustomerBalance(c.id);
        return {
            "اسم العميل": c.name,
            "رقم الهاتف": c.phone || '',
            "النوع": c.type === 'shop' ? 'محل' : 'فرد',
            "عدد الفواتير": stats.countInvoices,
            "عدد سندات القبض": stats.countPayments,
            "إجمالي الفواتير": stats.totalInvoices,
            "إجمالي المقبوضات": stats.totalPayments,
            "الرصيد النهائي": stats.balance
        };
    });
    const wsCustomers = XLSX.utils.json_to_sheet(customersSummary);

    // 4. Prepare invoices.xlsx (Two Sheets)
    const getInvoiceNumber = (inv: any) => {
        const num = inv.invoiceNumber || inv.number || inv.serial || inv.receiptNumber || inv.id?.substring(0, 8).toUpperCase() || 'غير معروف';
        return String(num);
    };

    const invoicesSummary = invoices.map(i => {
        const customer = customers.find(c => c.id === i.customerId);
        let itemsSummary = 'لا توجد أصناف';
        
        if (i.items && i.items.length > 0) {
            const formatItem = (item: any) => {
                const name = item.description || item.name || 'صنف بدون اسم';
                const qty = item.quantity ?? 1;
                const price = item.unitPrice ?? item.price ?? 0;
                const total = item.total ?? (qty * price);
                return `${name} × ${qty} = ${total}`;
            };
            
            if (i.items.length === 1) {
                itemsSummary = formatItem(i.items[0]);
            } else {
                const firstTwo = i.items.slice(0, 2).map(formatItem).join(' | ');
                const others = i.items.length > 2 ? ` | + ${i.items.length - 2} أصناف أخرى` : '';
                itemsSummary = firstTwo + others;
            }
        }

        return {
            "رقم الفاتورة": getInvoiceNumber(i),
            "اسم العميل": customer ? (customer.name || 'محذوف') : 'محذوف',
            "customerId": i.customerId || '',
            "التاريخ": i.date ? new Date(i.date).toISOString().split('T')[0] : '',
            "الحالة": i.status === 'paid' ? 'مدفوعة' : i.status === 'partial' ? 'جزئي' : 'غير مدفوعة',
            "الإجمالي": i.totalAmount ?? 0,
            "المبلغ المدفوع": (i as any).amountPaid ?? i.paidAmount ?? 0,
            "عدد الأصناف": i.items ? i.items.length : 0,
            "ملاحظات": i.notes || '',
            "ملخص الأصناف": itemsSummary
        };
    });
    const wsInvoicesSummary = XLSX.utils.json_to_sheet(invoicesSummary);

    const invoiceItemsDetails: any[] = [];
    invoices.forEach(i => {
        const customer = customers.find(c => c.id === i.customerId);
        if (i.items && Array.isArray(i.items)) {
            i.items.forEach((item, idx) => {
                const qty = item.quantity ?? 1;
                const price = (item as any).unitPrice ?? item.price ?? 0;
                const total = item.total ?? (qty * price);
                invoiceItemsDetails.push({
                    "رقم الفاتورة": getInvoiceNumber(i),
                    "اسم العميل": customer ? (customer.name || 'محذوف') : 'محذوف',
                    "customerId": i.customerId || '',
                    "تاريخ الفاتورة": i.date ? new Date(i.date).toISOString().split('T')[0] : '',
                    "رقم الصنف داخل الفاتورة": idx + 1,
                    "اسم الصنف": (item as any).description || item.name || 'صنف بدون اسم',
                    "الكمية": qty,
                    "الوحدة": item.unit || '',
                    "سعر الوحدة": price,
                    "الإجمالي": total,
                    "ملاحظات الفاتورة": i.notes || ''
                });
            });
        }
    });
    const wsInvoiceItems = XLSX.utils.json_to_sheet(invoiceItemsDetails);

    // 5. Prepare payments.xlsx
    const paymentsData = payments.map(p => {
        const customer = customers.find(c => c.id === p.customerId);
        let methodText = 'نقداً';
        if ((p as any).method === 'cheque' || p.paymentMethod === 'cheque') methodText = 'شيك';
        else if ((p as any).method === 'bank_transfer' || (p as any).paymentMethod === 'bank_transfer') methodText = 'تحويل بنكي';
        
        return {
            "رقم السند": (p as any).paymentNumber || p.id,
            "اسم العميل": customer ? (customer.name || 'محذوف') : 'محذوف',
            "customerId": p.customerId || '',
            "التاريخ": p.date ? new Date(p.date).toISOString().split('T')[0] : '',
            "المبلغ": p.amount ?? 0,
            "طريقة الدفع": methodText,
            "رقم الشيك": p.chequeNumber || '',
            "اسم البنك": p.bankName || '',
            "تاريخ الاستحقاق": p.dueDate ? new Date(p.dueDate).toISOString().split('T')[0] : '',
            "الملاحظات": p.notes || ''
        };
    });
    const wsPayments = XLSX.utils.json_to_sheet(paymentsData);

    // Create Workbooks
    const wbCustomers = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbCustomers, wsCustomers, "ملخص العملاء");

    const wbInvoices = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbInvoices, wsInvoicesSummary, "الفواتير");
    XLSX.utils.book_append_sheet(wbInvoices, wsInvoiceItems, "تفاصيل الأصناف");

    const wbPayments = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbPayments, wsPayments, "سندات القبض");

    const excelCustomersBuffer = XLSX.write(wbCustomers, { bookType: 'xlsx', type: 'array' });
    const excelInvoicesBuffer = XLSX.write(wbInvoices, { bookType: 'xlsx', type: 'array' });
    const excelPaymentsBuffer = XLSX.write(wbPayments, { bookType: 'xlsx', type: 'array' });

    // 6. Prepare README
    const totalInvoicesSum = invoices.filter(i => !i.deleted).reduce((s, i) => s + (i.totalAmount || 0), 0);
    const totalPaymentsSum = payments.filter(p => !p.deleted).reduce((s, p) => s + (p.amount || 0), 0);
    
    const readmeContent = `اسم النظام: معرض اليرموك
تاريخ إنشاء النسخة: ${now.toLocaleString('ar')}
شهر النسخة: ${monthStr}

ملخص البيانات:
- عدد العملاء: ${customers.length}
- عدد الفواتير: ${invoices.length}
- عدد سندات القبض: ${payments.length}
- إجمالي الفواتير: ${totalInvoicesSum}
- إجمالي المقبوضات: ${totalPaymentsSum}
- إجمالي المديونية: ${totalInvoicesSum - totalPaymentsSum}

تنبيهات هامة:
- ملف backup.json هو الملف الأساسي والوحيد المستخدم للاستعادة داخل النظام.
- ملفات Excel (xlsx) هي للمراجعة والقراءة فقط ولا يمكن استخدامها للاستعادة.
- ملف invoices.xlsx يحتوي على شيتين (ورقتي عمل): ورقة لملخص الفواتير وورقة لتفاصيل الأصناف.
- هذه النسخة تحفظ بيانات النظام وروابط المرفقات إن وجدت، ولا تحفظ ملفات الصور نفسها.
`;

    // 7. Zip and Download
    const zip = new JSZip();
    zip.file("backup.json", JSON.stringify(backupJson, null, 2));
    zip.file("customers_summary.xlsx", excelCustomersBuffer);
    zip.file("invoices.xlsx", excelInvoicesBuffer);
    zip.file("payments.xlsx", excelPaymentsBuffer);
    zip.file("README.txt", readmeContent);

    const zipBlob = await zip.generateAsync({ type: "blob" });
    
    const safeDate = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    const filename = `backup_${safeDate}.zip`;
    
    saveAs(zipBlob, filename);

    localStorage.setItem('last_backup_date', now.toISOString());
    
    return {
        customers: customers.length,
        invoices: invoices.length,
        payments: payments.length,
        totalInvoices: totalInvoicesSum,
        totalPayments: totalPaymentsSum,
        balance: totalInvoicesSum - totalPaymentsSum
    };
};

export const restoreBackup = async (
    backupData: any, 
    onProgress: (status: string) => void
) => {
    try {
        if (!auth.currentUser) throw new Error("يجب تسجيل الدخول أولاً");

        onProgress("جاري التحقق من البيانات...");
        
        const { backupInfo, customers, invoices, payments } = backupData;
        if (!backupInfo || !Array.isArray(customers) || !Array.isArray(invoices) || !Array.isArray(payments)) {
            throw new Error("ملف النسخة غير صحيح: البيانات مفقودة أو تالفة");
        }

        // Validate items
        const invalidCustomers = customers.some(c => !c.id);
        const invalidInvoices = invoices.some(i => !i.id || !i.customerId);
        const invalidPayments = payments.some(p => !p.id || !p.customerId);

        if (invalidCustomers || invalidInvoices || invalidPayments) {
            throw new Error("ملف النسخة غير صحيح: معرفات مفقودة");
        }

        onProgress("جاري قراءة البيانات الحالية...");
        // 1. Fetch all current IDs to avoid duplicates
        const currentCustomersSnap = await getDocs(collection(db, 'customers'));
        const currentInvoicesSnap = await getDocs(collection(db, 'invoices'));
        const currentPaymentsSnap = await getDocs(collection(db, 'payments'));

        const existingCustomerIds = new Set(currentCustomersSnap.docs.map(d => d.id));
        const existingInvoiceIds = new Set(currentInvoicesSnap.docs.map(d => d.id));
        const existingPaymentIds = new Set(currentPaymentsSnap.docs.map(d => d.id));

        const currentUserId = auth.currentUser.uid;

        // Filter new items
        onProgress("جاري مقارنة البيانات الحالية...");
        const newCustomers = customers.filter(c => !existingCustomerIds.has(c.id)).map(c => ({
            ...c,
            createdBy: currentUserId
        }));

        const newInvoices = invoices.filter(i => !existingInvoiceIds.has(i.id)).map(i => ({
            ...i,
            createdBy: currentUserId
        }));

        const newPayments = payments.filter(p => !existingPaymentIds.has(p.id)).map(p => ({
            ...p,
            createdBy: currentUserId
        }));

        const totalToWrite = newCustomers.length + newInvoices.length + newPayments.length;
        if (totalToWrite === 0) {
            return {
                success: true,
                message: "لم يتم استعادة أي بيانات لأن كل البيانات موجودة مسبقاً",
                added: 0
            };
        }

        if (totalToWrite > 18000) {
            throw new Error("حجم النسخة كبير وقد يقترب من حدود Firebase المجانية. يفضل تنفيذ الاستعادة لاحقاً أو تقسيمها.");
        }

        const BATCH_SIZE = 400; // Safe size for firestore
        let batch = writeBatch(db);
        let operationCount = 0;
        let totalAdded = 0;

        const commitBatch = async () => {
            if (operationCount > 0) {
                await batch.commit();
                batch = writeBatch(db);
                operationCount = 0;
            }
        };

        const addItem = async (colName: string, item: any) => {
            const ref = doc(db, colName, item.id);
            const cleanItem = { ...item };
            
            // Fix dates if they are strings or objects
            if (cleanItem.date) {
                if (typeof cleanItem.date === 'string') cleanItem.date = new Date(cleanItem.date).getTime();
                else if (cleanItem.date.seconds) cleanItem.date = cleanItem.date.seconds * 1000;
            } else {
                if (colName === 'invoices' || colName === 'payments') cleanItem.date = Date.now();
            }

            if (cleanItem.createdAt) {
                if (typeof cleanItem.createdAt === 'string') cleanItem.createdAt = new Date(cleanItem.createdAt).getTime();
                else if (cleanItem.createdAt.seconds) cleanItem.createdAt = cleanItem.createdAt.seconds * 1000;
            } else {
                if (colName === 'customers') cleanItem.createdAt = Date.now();
            }

            if (cleanItem.dueDate) {
                if (typeof cleanItem.dueDate === 'string') cleanItem.dueDate = new Date(cleanItem.dueDate).getTime();
                else if (cleanItem.dueDate.seconds) cleanItem.dueDate = cleanItem.dueDate.seconds * 1000;
            }

            Object.keys(cleanItem).forEach(key => {
                if (cleanItem[key] === undefined || cleanItem[key] === null) {
                    delete cleanItem[key];
                }
            });

            batch.set(ref, cleanItem);
            operationCount++;
            totalAdded++;

            if (operationCount >= BATCH_SIZE) {
                await commitBatch();
            }
        };

        onProgress("جاري رفع العملاء...");
        for (const c of newCustomers) await addItem('customers', c);
        await commitBatch();

        onProgress("جاري رفع الفواتير...");
        for (const i of newInvoices) await addItem('invoices', i);
        await commitBatch();

        onProgress("جاري رفع سندات القبض...");
        for (const p of newPayments) await addItem('payments', p);
        await commitBatch();

        localStorage.setItem('last_restore_date', new Date().toISOString());
        onProgress("تمت الاستعادة بنجاح.");

        return {
            success: true,
            message: "تم استعادة النسخة الاحتياطية بنجاح إلى الحساب الحالي.",
            added: totalAdded
        };
    } catch (err: any) {
        throw new Error(err.message || "حدث خطأ أثناء الاستعادة");
    }
};

