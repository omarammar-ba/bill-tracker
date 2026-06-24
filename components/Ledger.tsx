import React, { useState, useEffect, useMemo, useRef } from "react";
import { Customer, Invoice, Payment, ViewProps, PaymentStatus, Transaction } from "../types";
import {
  getCustomerInvoices,
  getCustomerPayments,
  deleteInvoice,
  deletePayment,
} from "../services/db";
import {
  ArrowRight,
  Printer,
  Search,
  FileText,
  Wallet,
  X,
  Banknote,
  Calendar,
  Receipt,
  Box,
  Hash,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Edit,
  Trash2,
  ChevronRight,
  Download,
  Share2
} from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "./AuthContext";
import { ConfirmModal } from "./ConfirmModal";
import * as htmlToImage from 'html-to-image';

function tafqeet(amount: number): string {
  if (isNaN(amount) || amount === 0) return "فقط صفر دينار لا غير";
  
  const JOD = Math.floor(amount);
  const fils = Math.round((amount - JOD) * 1000);
  
  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
  
  const convert = (n: number): string => {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) {
      const ten = Math.floor(n / 10);
      const one = n % 10;
      return (one ? ones[one] + " و" : "") + tens[ten];
    }
    if (n < 1000) {
      const hundred = Math.floor(n / 100);
      const rest = n % 100;
      return (hundreds[hundred]) + (rest ? " و" + convert(rest) : "");
    }
    if (n < 1000000) {
      const thousand = Math.floor(n / 1000);
      const rest = n % 1000;
      let thousandStr = "";
      if (thousand === 1) thousandStr = "ألف";
      else if (thousand === 2) thousandStr = "ألفين";
      else if (thousand >= 3 && thousand <= 10) thousandStr = ones[thousand] + " آلاف";
      else thousandStr = convert(thousand) + " ألف";
      
      return thousandStr + (rest ? " و" + convert(rest) : "");
    }
    return n.toString();
  };

  let text = "";
  if (JOD === 0) {
    text = "صفر دينار";
  } else {
    text = convert(JOD) + " دينار";
  }

  if (fils > 0) {
    let filsStr = "";
    if (fils === 1) filsStr = "فلس واحد";
    else if (fils === 2) filsStr = "فلسين";
    else if (fils >= 3 && fils <= 10) filsStr = ones[fils] + " فلوس";
    else filsStr = convert(fils) + " فلس";
    text += " و " + filsStr;
  } else {
    text += " لا غير";
  }

  return "فقط " + text;
}

interface Props extends ViewProps {
  customers: Customer[];
}

const Ledger: React.FC<Props> = ({
  activeCustomerId,
  activeTransactionId,
  customers,
  changeView,
}) => {
  const { role } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
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

  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [isJustSavedInvoice, setIsJustSavedInvoice] = useState(false);
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);
  const [isSharingImage, setIsSharingImage] = useState(false);
  const [sharingImageSrc, setSharingImageSrc] = useState<string | null>(null);
  const [sharingType, setSharingType] = useState<"invoice" | "payment" | null>(null);
  const [sharingFilename, setSharingFilename] = useState<string>("");
  const [sharingPhone, setSharingPhone] = useState<string>("");
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<
    Record<string, boolean>
  >({});

  const closeViewingInvoice = () => {
    setViewingInvoice(null);
    setIsJustSavedInvoice(false);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('just_saved_invoice_id');
    }
  };

  const applyPreset = (
    preset: "today" | "yesterday" | "week" | "month" | "all",
  ) => {
    const today = new Date();
    const format = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    if (preset === "today") {
      setFromDate(format(today));
      setToDate(format(today));
    } else if (preset === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      setFromDate(format(yesterday));
      setToDate(format(yesterday));
    } else if (preset === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      setFromDate(format(weekAgo));
      setToDate(format(today));
    } else if (preset === "month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(format(firstDay));
      setToDate(format(today));
    } else {
      setFromDate("");
      setToDate("");
    }
  };

  useEffect(() => {
    if (activeCustomerId) {
      getCustomerInvoices(activeCustomerId).then(setInvoices);
      getCustomerPayments(activeCustomerId).then(setPayments);
    }
  }, [activeCustomerId]);

  const handledTransactionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeTransactionId && handledTransactionIdRef.current !== activeTransactionId) {
      if (invoices.length > 0) {
        const foundInvoice = invoices.find(inv => inv.id === activeTransactionId);
        if (foundInvoice) {
          const savedId = typeof window !== 'undefined' ? window.localStorage.getItem('just_saved_invoice_id') : null;
          if (savedId === activeTransactionId) {
            setIsJustSavedInvoice(true);
          } else {
            setIsJustSavedInvoice(false);
          }
          setViewingInvoice(foundInvoice);
          handledTransactionIdRef.current = activeTransactionId;
          return;
        }
      }
      if (payments.length > 0) {
        const foundPayment = payments.find(pay => pay.id === activeTransactionId);
        if (foundPayment) {
          setIsJustSavedInvoice(false);
          setViewingPayment(foundPayment);
          handledTransactionIdRef.current = activeTransactionId;
          return;
        }
      }
    }
  }, [activeTransactionId, invoices, payments]);

  const customer = customers.find((c) => c.id === activeCustomerId);

  const startBalance = useMemo(() => {
    if (!fromDate) return 0;
    const fromTime = new Date(fromDate + "T00:00:00").getTime();
    const prevInvoiceSum = invoices
      .filter((inv) => inv.date < fromTime && !inv.deleted)
      .reduce((sum, inv) => sum + inv.totalAmount, 0);
    const prevPaymentSum = payments
      .filter((pay) => pay.date < fromTime && !pay.deleted)
      .reduce((sum, pay) => sum + pay.amount, 0);
    return prevInvoiceSum - prevPaymentSum;
  }, [invoices, payments, fromDate]);

  const statementRows = useMemo(() => {
    const combined = [
      ...invoices.map((inv) => ({ ...inv, type: "invoice" as const })),
      ...payments.map((pay) => ({ ...pay, type: "payment" as const })),
    ].sort((a, b) => b.date - a.date);

    return combined.filter((row) => {
      const fromTime = fromDate ? new Date(fromDate + "T00:00:00").getTime() : null;
      const toTime = toDate ? new Date(toDate + "T23:59:59.999").getTime() : null;

      const dateInRange =
        (fromTime === null || row.date >= fromTime) &&
        (toTime === null || row.date <= toTime);

      const matchesStatus =
        statusFilter === "all" ||
        (row.type === "invoice" && row.status === statusFilter);

      return dateInRange && matchesStatus;
    });
  }, [invoices, payments, fromDate, toDate, statusFilter]);

  const totals = useMemo(() => {
    const totalInvoices = invoices.reduce(
      (acc, inv) => acc + (inv.deleted ? 0 : inv.totalAmount),
      0,
    );
    const totalPayments = payments.reduce((acc, pay) => acc + (pay.deleted ? 0 : pay.amount), 0);
    return {
      totalInvoices,
      totalPayments,
      balance: totalInvoices - totalPayments,
    };
  }, [invoices, payments]);

  const handleExportInvoiceExcel = (invoice: Invoice & { type: "invoice" }) => {
    const splitAmount = (val: number) => {
      const d = Math.floor(val);
      const f = Math.round((val - d) * 1000);
      return {
        dinar: d,
        fils: String(f).padStart(3, '0')
      };
    };

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>الفاتورة</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayRightToLeft />
                  <x:FitToPage/>
                  <x:Print>
                    <x:FitWidth>1</x:FitWidth>
                    <x:FitHeight>1</x:FitHeight>
                    <x:PaperSizeIndex>9</x:PaperSizeIndex> <!-- A4 paper -->
                    <x:HorizontalResolution>600</x:HorizontalResolution>
                    <x:VerticalResolution>600</x:VerticalResolution>
                  </x:Print>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; direction: rtl; font-family: 'Arial', sans-serif; font-size: 11pt; width: 100%; }
          .money { mso-number-format:"\\#,##0"; }
          th, td { border: 1px solid #111111; }
        </style>
      </head>
      <body dir="rtl">
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; border: 1px solid #111111; direction: rtl; font-family: 'Arial', sans-serif; font-size: 11pt; width: 100%;">
          <colgroup>
            <col width="40" />  <!-- Col 1: التسلسل -->
            <col width="220" /> <!-- Col 2: البيان -->
            <col width="55" />  <!-- Col 3: الوحدة -->
            <col width="55" />  <!-- Col 4: الكمية -->
            <col width="65" />  <!-- Col 5: دينار سعر الوحدة -->
            <col width="45" />  <!-- Col 6: فلس سعر الوحدة -->
            <col width="70" />  <!-- Col 7: دينار القيمة الاجمالية -->
            <col width="45" />  <!-- Col 8: فلس القيمة الاجمالية -->
          </colgroup>

          <!-- Row 1: Logo and Title -->
          <tr>
            <td colspan="3" style="border: none !important; font-size: 14pt; font-weight: bold; text-align: right; background-color: #ffffff; padding: 4px;">معرض اليرموك</td>
            <td colspan="2" style="border: none !important; font-size: 16pt; font-weight: bold; text-align: center; background-color: #ffffff; padding: 0;">فاتورة</td>
            <td colspan="3" style="border: none !important; background-color: #ffffff;"></td>
          </tr>
          <!-- Row 2: Sub-logo and Subtitle -->
          <tr>
            <td colspan="3" style="border: none !important; font-size: 10pt; font-weight: normal; text-align: right; color: #333333; background-color: #ffffff; padding: 2px;">اليرموك للسيراميك والأدوات الصحية</td>
            <td colspan="2" style="border: none !important; font-size: 14pt; font-weight: bold; text-align: center; background-color: #ffffff; padding: 0;">بالحساب</td>
            <td colspan="3" style="border: none !important; background-color: #ffffff;"></td>
          </tr>
          <!-- Row 3: Logo Address & Blank Center -->
          <tr>
            <td colspan="3" style="border: none !important; font-size: 10pt; font-weight: normal; text-align: right; color: #333333; background-color: #ffffff; padding: 2px;">اربد - الاردن</td>
            <td colspan="5" style="border: none !important; background-color: #ffffff;"></td>
          </tr>
          <!-- Row 4: Blank spacer -->
          <tr style="height: 15px;">
            <td colspan="8" style="border: none !important; height: 15px; background-color: #ffffff;"></td>
          </tr>

          <!-- Metadata Rows (5, 6, 7) matching layout perfectly with consistent borders -->
          <tr style="height: 25px;">
            <td colspan="5" style="border-top: 1px solid #111111; border-right: 1px solid #111111; border-left: 1px solid #111111; border-bottom: none; font-size: 11pt; font-weight: bold; text-align: right; background-color: #ffffff; padding: 6px; direction: rtl;">رقم الفاتورة : ${invoice.id.substring(0, 8).toUpperCase()}</td>
            <td colspan="3" style="border-top: 1px solid #111111; border-left: 1px solid #111111; border-right: 1px solid #111111; border-bottom: none; font-size: 11pt; text-align: right; background-color: #ffffff; padding: 6px; direction: rtl; color: #333333;">التاريخ : ${new Date(invoice.date).toLocaleDateString('en-GB')}</td>
          </tr>
          <tr style="height: 25px;">
            <td colspan="5" style="border-top: none; border-right: 1px solid #111111; border-left: 1px solid #111111; border-bottom: none; font-size: 11pt; font-weight: bold; text-align: right; background-color: #ffffff; padding: 6px; direction: rtl;">مطلوب من السادة : ${customer?.name || ""} المحترمين</td>
            <td colspan="3" style="border-top: none; border-left: 1px solid #111111; border-right: 1px solid #111111; border-bottom: none; font-size: 11pt; text-align: right; background-color: #ffffff; padding: 6px; direction: rtl; color: #333333;">الاخراج :</td>
          </tr>
          <tr style="height: 25px;">
            <td colspan="5" style="border-top: none; border-right: 1px solid #111111; border-left: 1px solid #111111; border-bottom: 1px solid #111111; background-color: #ffffff; padding: 6px;"></td>
            <td colspan="3" style="border-top: none; border-left: 1px solid #111111; border-right: 1px solid #111111; border-bottom: 1px solid #111111; font-size: 11pt; text-align: right; background-color: #ffffff; padding: 6px; direction: rtl; color: #333333;">طلب الشراء :</td>
          </tr>
          
          <tr style="height: 10px;">
            <td colspan="8" style="border: none !important; height: 10px; background-color: #ffffff;"></td>
          </tr>

          <!-- Table Headers style -->
          <tr>
            <td rowspan="2" style="border: 1px solid #111111; font-weight: bold; background-color: #ffffff; padding: 6px; text-align: center; vertical-align: middle;">التسلسل</td>
            <td rowspan="2" style="border: 1px solid #111111; font-weight: bold; background-color: #ffffff; padding: 6px; text-align: center; vertical-align: middle; width: 220px;">البيان</td>
            <td rowspan="2" style="border: 1px solid #111111; font-weight: bold; background-color: #ffffff; padding: 6px; text-align: center; vertical-align: middle;">الوحدة</td>
            <td rowspan="2" style="border: 1px solid #111111; font-weight: bold; background-color: #ffffff; padding: 6px; text-align: center; vertical-align: middle;">الكمية</td>
            <td colspan="2" style="border: 1px solid #111111; font-weight: bold; background-color: #ffffff; padding: 6px; text-align: center; vertical-align: middle;">سعر الوحدة</td>
            <td colspan="2" style="border: 1px solid #111111; font-weight: bold; background-color: #ffffff; padding: 6px; text-align: center; vertical-align: middle;">القيمة الاجمالية</td>
          </tr>
          <tr>
            <td style="border: 1px solid #111111; font-weight: bold; background-color: #ffffff; padding: 6px; text-align: center; vertical-align: middle;">فلس</td>
            <td style="border: 1px solid #111111; font-weight: bold; background-color: #ffffff; padding: 6px; text-align: center; vertical-align: middle;">دينار</td>
            <td style="border: 1px solid #111111; font-weight: bold; background-color: #ffffff; padding: 6px; text-align: center; vertical-align: middle;">فلس</td>
            <td style="border: 1px solid #111111; font-weight: bold; background-color: #ffffff; padding: 6px; text-align: center; vertical-align: middle;">دينار</td>
          </tr>`;

    invoice.items?.forEach((item, idx) => {
      const price = item.price || 0;
      const total = item.total || (price * (item.quantity || 1));
      const priceParts = splitAmount(price);
      const totalParts = splitAmount(total);

      html += `
        <tr>
          <td style="border: 1px solid #111111; padding: 4px; text-align: center; vertical-align: middle; background-color: #ffffff;">${idx + 1}</td>
          <td style="border: 1px solid #111111; padding: 4px; text-align: right; font-weight: bold; padding-right: 15px; background-color: #ffffff; word-break: break-all; white-space: normal; max-width: 300px;">${item.name}</td>
          <td style="border: 1px solid #111111; padding: 4px; text-align: center; vertical-align: middle; background-color: #ffffff;">${item.unit || 'متر'}</td>
          <td style="border: 1px solid #111111; padding: 4px; text-align: center; vertical-align: middle; font-weight: bold; background-color: #ffffff;">${item.quantity}</td>
          <td style="border: 1px solid #111111; padding: 4px; text-align: center; vertical-align: middle; background-color: #ffffff;" class="money">${priceParts.dinar}</td>
          <td style="border: 1px solid #111111; padding: 4px; text-align: center; vertical-align: middle; background-color: #ffffff;" class="money">${priceParts.fils}</td>
          <td style="border: 1px solid #111111; padding: 4px; text-align: center; vertical-align: middle; background-color: #ffffff;" class="money">${totalParts.dinar}</td>
          <td style="border: 1px solid #111111; padding: 4px; text-align: center; vertical-align: middle; background-color: #ffffff;" class="money">${totalParts.fils}</td>
        </tr>`;
    });

    // Filler Rows to make grid look standard and rich (at least 15 rows total)
    const fillerRowsCount = Math.max(0, 15 - (invoice.items?.length || 0));
    for (let i = 0; i < fillerRowsCount; i++) {
      html += `
        <tr>
          <td style="border: 1px solid #111111; height: 25px; padding: 4px; text-align: center; vertical-align: middle; background-color: #ffffff;">${(invoice.items?.length || 0) + i + 1}</td>
          <td style="border: 1px solid #111111; height: 25px; background-color: #ffffff;"></td>
          <td style="border: 1px solid #111111; height: 25px; background-color: #ffffff;"></td>
          <td style="border: 1px solid #111111; height: 25px; background-color: #ffffff;"></td>
          <td style="border: 1px solid #111111; height: 25px; background-color: #ffffff;"></td>
          <td style="border: 1px solid #111111; height: 25px; background-color: #ffffff;"></td>
          <td style="border: 1px solid #111111; height: 25px; background-color: #ffffff;"></td>
          <td style="border: 1px solid #111111; height: 25px; background-color: #ffffff;"></td>
        </tr>`;
    }

    html += `
          <!-- Totals block matching image exactly -->
          <tr>
            <td colspan="5" style="border-top: none; border-bottom: none; border-left: none; border-right: 1px solid #111111; background-color: #ffffff;"></td>
            <td style="border: 1px solid #111111; font-weight: bold; text-align: center; background-color: #ffffff; padding: 6px;">المجموع</td>
            <td colspan="2" style="border: 1px solid #111111; font-weight: bold; text-align: left; font-size: 12pt; padding-left: 10px; background-color: #ffffff;">${invoice.totalAmount.toFixed(3)}</td>
          </tr>
          <tr>
            <td colspan="5" style="border-top: none; border-bottom: none; border-left: none; border-right: 1px solid #111111; text-align: center; font-weight: bold; font-size: 11pt; background-color: #ffffff; padding: 6px;">Page : 1 / 1</td>
            <td style="border: 1px solid #111111; font-weight: bold; text-align: center; background-color: #ffffff; padding: 6px;">الاجمالي</td>
            <td colspan="2" style="border: 1px solid #111111; font-weight: bold; text-align: left; font-size: 12pt; padding-left: 10px; background-color: #ffffff;">${invoice.totalAmount.toFixed(3)}</td>
          </tr>
          <tr>
            <td colspan="5" style="border-top: none; border-bottom: 1px solid #111111; border-left: none; border-right: 1px solid #111111; text-align: right; font-weight: bold; padding-right: 10px; background-color: #ffffff; padding: 6px; direction: rtl;">${tafqeet(invoice.totalAmount)}</td>
            <td style="border: 1px solid #111111; font-weight: bold; text-align: center; background-color: #ffffff; padding: 6px;">الصافي</td>
            <td colspan="2" style="border: 1px solid #111111; font-weight: bold; text-align: left; font-size: 12pt; padding-left: 10px; background-color: #ffffff;">${invoice.totalAmount.toFixed(3)}</td>
          </tr>
          
          <!-- Spacing -->
          <tr>
            <td colspan="8" style="border: none !important; height: 35px; background-color: #ffffff;"></td>
          </tr>
          
          <!-- Signatures -->
          <tr>
            <td colspan="4" style="font-weight: bold; font-size: 11pt; color: #333333; border: none !important; background-color: #ffffff; text-align: right;">اسم وتوقيع المستلم : ................................................</td>
            <td colspan="4" style="font-weight: bold; font-size: 11pt; color: #333333; border: none !important; background-color: #ffffff; text-align: left;">اسم وتوقيع البائع : ................................................</td>
          </tr>
      </table>
      </body>
    </html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `فاتورة_${invoice.id.substring(0, 4)}_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPaymentExcel = (payment: Payment & { type: "payment" }) => {
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>سند القبض</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayRightToLeft />
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; direction: rtl; font-family: sans-serif; font-size: 14px; width: 100%; }
          th, td { border: 1px solid #111111; padding: 8px; text-align: center; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .money { mso-number-format:"\\#,##0\\.000"; }
        </style>
      </head>
      <body dir="rtl">
        <h2>سند قبض مالي</h2>
        <table border="1" cellspacing="0" cellpadding="8" style="border-collapse: collapse; border: 1px solid #111111; direction: rtl; font-family: sans-serif; font-size: 14px; width: 100%;">
          <tr>
            <th colspan="2" style="background-color: #f2f2f2; font-weight: bold; text-align: right; border: 1px solid #111111;">رقم السند</th>
            <td colspan="4" style="mso-number-format:'\\@'; text-align: right; border: 1px solid #111111;">${payment.id.substring(0, 8).toUpperCase()}</td>
          </tr>
          <tr>
            <th colspan="2" style="background-color: #f2f2f2; font-weight: bold; text-align: right; border: 1px solid #111111;">التاريخ</th>
            <td colspan="4" style="text-align: right; border: 1px solid #111111;">${new Date(payment.date).toLocaleDateString('en-GB')}</td>
          </tr>
          <tr>
            <th colspan="2" style="background-color: #f2f2f2; font-weight: bold; text-align: right; border: 1px solid #111111;">وصلنا من السيد</th>
            <td colspan="4" style="text-align: right; border: 1px solid #111111;">${customer?.name || ""}</td>
          </tr>
          <tr>
            <th colspan="2" style="background-color: #f2f2f2; font-weight: bold; text-align: right; border: 1px solid #111111;">مبلغ وقدره</th>
            <td colspan="4" class="money" style="text-align: right; border: 1px solid #111111;"><strong>${payment.amount}</strong></td>
          </tr>
          <tr>
            <th colspan="2" style="background-color: #f2f2f2; font-weight: bold; text-align: right; border: 1px solid #111111;">الصافي كتابة</th>
            <td colspan="4" style="text-align: right; border: 1px solid #111111;"><strong>${tafqeet(payment.amount)}</strong></td>
          </tr>
          <tr>
            <th colspan="2" style="background-color: #f2f2f2; font-weight: bold; text-align: right; border: 1px solid #111111;">طريقة الدفع</th>
            <td colspan="4" style="text-align: right; border: 1px solid #111111;">${payment.paymentMethod === 'cheque' ? 'شيك بنكي' : 'نقداً'}</td>
          </tr>
          <tr>
            <th colspan="2" style="background-color: #f2f2f2; font-weight: bold; text-align: right; border: 1px solid #111111;">وذلك عن / البيان</th>
            <td colspan="4" style="text-align: right; border: 1px solid #111111;">${payment.notes || "دفعة من الحساب"}</td>
          </tr>`;

    if (payment.paymentMethod === 'cheque') {
      html += `
          <tr>
            <th colspan="6" style="background-color: #f2f2f2; font-weight: bold; border: 1px solid #111111;">تفاصيل الشيك البنكي المرفق</th>
          </tr>
          <tr>
            <th colspan="2" style="background-color: #f2f2f2; font-weight: bold; text-align: right; border: 1px solid #111111;">رقم الشيك</th>
            <td colspan="4" style="mso-number-format:'\\@'; text-align: right; border: 1px solid #111111;">${payment.chequeNumber || ""}</td>
          </tr>
          <tr>
            <th colspan="2" style="background-color: #f2f2f2; font-weight: bold; text-align: right; border: 1px solid #111111;">اسم البنك</th>
            <td colspan="4" style="text-align: right; border: 1px solid #111111;">${payment.bankName || ""}</td>
          </tr>
          <tr>
            <th colspan="2" style="background-color: #f2f2f2; font-weight: bold; text-align: right; border: 1px solid #111111;">تاريخ الاستحقاق</th>
            <td colspan="4" style="text-align: right; border: 1px solid #111111;">${payment.dueDate ? new Date(payment.dueDate).toLocaleDateString('en-GB') : ""}</td>
          </tr>`;
    }

    html += `
        </table>
        <br>
        <table style="border: none !important; width: 100%;">
          <tr>
            <td style="border: none !important; text-align: right; background-color: #ffffff;"><strong>الاسم والتوقيع:</strong> .......................................</td>
            <td style="border: none !important; text-align: left; background-color: #ffffff;"><strong>أمين الصندوق:</strong> .......................................</td>
          </tr>
        </table>
      </body>
    </html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `سند_قبض_${payment.id.substring(0, 4)}_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    if (!customer) return;

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>كشف الحساب</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayRightToLeft/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; direction: rtl; font-family: sans-serif; font-size: 14px; }
          th, td { border: 1px solid #111111; padding: 8px; text-align: center; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .money { mso-number-format:"\\#,##0\\.000"; }
        </style>
      </head>
      <body dir="rtl">
        <h2>كشف حساب</h2>
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; border: 1px solid #111111; direction: rtl; font-family: sans-serif; font-size: 14px;">
          <tr>
            <th colspan="2" style="background-color: #f2f2f2; font-weight: bold; padding: 6px; border: 1px solid #111111;">اسم العميل</th>
            <td colspan="5" style="padding: 6px; border: 1px solid #111111;">${customer.name}</td>
          </tr>
          <tr>
            <th colspan="2" style="background-color: #f2f2f2; font-weight: bold; padding: 6px; border: 1px solid #111111;">رقم الحساب</th>
            <td colspan="5" style="mso-number-format:'\\@'; padding: 6px; border: 1px solid #111111;">${customer.id.replace(/-/g, '').substring(0, 14)}</td>
          </tr>
          <tr>
            <th colspan="2" style="background-color: #f2f2f2; font-weight: bold; padding: 6px; border: 1px solid #111111;">الفترة من</th>
            <td colspan="2" style="padding: 6px; border: 1px solid #111111;">${fromDate ? new Date(fromDate).toLocaleDateString('en-GB') : '2026/01/01'}</td>
            <th style="background-color: #f2f2f2; font-weight: bold; padding: 6px; border: 1px solid #111111;">إلى</th>
            <td colspan="2" style="padding: 6px; border: 1px solid #111111;">${toDate ? new Date(toDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}</td>
          </tr>
        </table>
        <br>
        <table border="1" cellspacing="0" cellpadding="8" style="border-collapse: collapse; border: 1px solid #111111; direction: rtl; font-family: sans-serif; font-size: 14px; width: 100%;">
          <tr>
            <td style="background-color: #f2f2f2; font-weight: bold; border: 1px solid #111111; text-align: center;">التاريخ</td>
            <td style="background-color: #f2f2f2; font-weight: bold; border: 1px solid #111111; text-align: center;">نوع السند</td>
            <td style="background-color: #f2f2f2; font-weight: bold; border: 1px solid #111111; text-align: center;">الرقم</td>
            <td style="background-color: #f2f2f2; font-weight: bold; border: 1px solid #111111; text-align: center;">البيان</td>
            <td style="background-color: #f2f2f2; font-weight: bold; border: 1px solid #111111; text-align: center;">مدين (عليه)</td>
            <td style="background-color: #f2f2f2; font-weight: bold; border: 1px solid #111111; text-align: center;">دائن (له)</td>
            <td style="background-color: #f2f2f2; font-weight: bold; border: 1px solid #111111; text-align: center;">الرصيد</td>
          </tr>
            <tr>
              <td style="border: 1px solid #111111;"></td>
              <td style="border: 1px solid #111111;"></td>
              <td style="border: 1px solid #111111;"></td>
              <td style="border: 1px solid #111111;"><strong>رصيد مدور</strong></td>
              <td style="border: 1px solid #111111;"></td>
              <td style="border: 1px solid #111111;"></td>
              <td class="money" style="border: 1px solid #111111;"><strong>${startBalance}</strong></td>
            </tr>`;

    let runningBalance = startBalance;
    const sorted = [...statementRows].sort((a,b) => a.date - b.date);
    sorted.forEach(row => {
      let description = '';
      if (row.type === 'payment') {
        description = row.paymentMethod === 'cheque' 
          ? `شيك رقم ${row.chequeNumber || ''} / استحقاق ${row.dueDate ? new Date(row.dueDate).toLocaleDateString('en-GB') : ''}` 
          : 'نقدا';
      } else {
        description = row.notes || "";
      }

      const debit = row.type === 'invoice' ? row.totalAmount : 0;
      const credit = row.type === 'payment' ? row.amount : 0;
      
      runningBalance += (debit - credit);
      
      const docType = row.type === 'invoice' ? 'بالحساب' : 'سند قبض';
      const serialNo = row.type === 'invoice' ? row.id.substring(0, 8).toUpperCase() : ((row as any).receiptNumber || row.id.substring(0, 8).toUpperCase());
      const dateStr = new Date(row.date).toLocaleDateString('en-GB');

      html += `
        <tr>
          <td style="border: 1px solid #111111;">${dateStr}</td>
          <td style="border: 1px solid #111111;">${docType}</td>
          <td style="mso-number-format:'\\@'; border: 1px solid #111111;">${serialNo}</td>
          <td style="text-align:right; border: 1px solid #111111;">${description}</td>
          <td class="money" style="border: 1px solid #111111;">${debit || ''}</td>
          <td class="money" style="border: 1px solid #111111;">${credit || ''}</td>
          <td class="money" style="border: 1px solid #111111;"><strong>${runningBalance}</strong></td>
        </tr>`;
    });

    const totalDebit = statementRows.reduce((a, b) => a + (b.type === 'invoice' ? b.totalAmount : 0), 0);
    const totalCredit = statementRows.reduce((a, b) => a + (b.type === 'payment' ? b.amount : 0), 0);

    html += `
          <tr>
            <th colspan="4" style="background-color: #f2f2f2; font-weight: bold; border: 1px solid #111111;">المجموع</th>
            <th class="money" style="border: 1px solid #111111;">${totalDebit}</th>
            <th class="money" style="border: 1px solid #111111;">${totalCredit}</th>
            <th style="border: 1px solid #111111;"></th>
          </tr>
          <tr>
            <th colspan="4" style="font-size:16px; background-color: #f2f2f2; font-weight: bold; border: 1px solid #111111;">الرصيد</th>
            <th colspan="2" style="border: 1px solid #111111;"></th>
            <th class="money" style="font-size:16px; border: 1px solid #111111;">${totals.balance}</th>
          </tr>
      </table>
      </body>
    </html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `كشف_حساب_${customer.name}_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shareInvoiceWhatsapp = async (invoice: Invoice & { type: "invoice" }) => {
    // We target our hidden offscreen styled invoice card designed for mobile high-res captures
    const element = document.getElementById("share-invoice-card");
    if (!element) return;
    setIsSharingImage(true);
    
    try {
      const dataUrl = await htmlToImage.toPng(element, { 
        quality: 0.95, 
        pixelRatio: 2, 
        backgroundColor: '#ffffff',
        skipFonts: true // Skips remote fonts to bypass iframe CORS security policy blocks
      });
      
      const blob = await (await fetch(dataUrl)).blob();
      setIsSharingImage(false);
      
      if (!blob) {
        alert('حدث خطأ أثناء معالجة الصورة');
        return;
      }
      
      const filename = `فاتورة_${invoice.id.substring(0, 4)}_${new Date(invoice.date).toLocaleDateString('en-GB').replace(/\//g, '-')}.png`;
      const customerObj = customers.find(c => c.id === invoice.customerId || c.id === activeCustomerId);
      const phoneNum = customerObj?.phone || "";

      // Defensively enclose File object instantiation and navigator.share for old/restricted browsers & webviews
      let sharedSuccessfully = false;
      try {
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'فاتورة مبيعات بالحساب',
            text: `فاتورة رقم ${invoice.id.substring(0, 4)} - معرض اليرموك`
          });
          sharedSuccessfully = true;
        }
      } catch (err) {
        console.warn('System native share failed or not allowed, fallback to custom share wizard:', err);
      }

      if (sharedSuccessfully) {
        return;
      }
      
      // Fallback: Open our gorgeous interactive sharing helper modal
      setSharingImageSrc(dataUrl);
      setSharingType("invoice");
      setSharingFilename(filename);
      setSharingPhone(phoneNum);
    } catch (e) {
      setIsSharingImage(false);
      console.error(e);
      alert('حدث خطأ أثناء إعداد صورة الفاتورة للمشاركة');
    }
  };

  const sharePaymentWhatsapp = async (payment: Payment & { type: "payment" }) => {
    // We target our hidden offscreen styled payment voucher card designed for mobile high-res captures
    const element = document.getElementById("share-payment-card");
    if (!element) return;
    setIsSharingImage(true);
    
    try {
      const dataUrl = await htmlToImage.toPng(element, { 
        quality: 0.95, 
        pixelRatio: 2, 
        backgroundColor: '#ffffff',
        skipFonts: true // Skips remote fonts to bypass iframe CORS security policy blocks
      });
      
      const blob = await (await fetch(dataUrl)).blob();
      setIsSharingImage(false);
      
      if (!blob) {
        alert('حدث خطأ أثناء معالجة الصورة');
        return;
      }
      
      const filename = `سند_قبض_${payment.id.substring(0, 4)}_${new Date(payment.date).toLocaleDateString('en-GB').replace(/\//g, '-')}.png`;
      const customerObj = customers.find(c => c.id === payment.customerId || c.id === activeCustomerId);
      const phoneNum = customerObj?.phone || "";

      // Defensively enclose File object instantiation and navigator.share for old/restricted browsers & webviews
      let sharedSuccessfully = false;
      try {
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'سند قبض مالي',
            text: `سند قبض رقم ${payment.id.substring(0, 4)} - معرض اليرموك`
          });
          sharedSuccessfully = true;
        }
      } catch (err) {
        console.warn('System native share failed or not allowed, fallback to custom share wizard:', err);
      }

      if (sharedSuccessfully) {
        return;
      }
      
      // Fallback: Open our gorgeous interactive sharing helper modal
      setSharingImageSrc(dataUrl);
      setSharingType("payment");
      setSharingFilename(filename);
      setSharingPhone(phoneNum);
    } catch (e) {
      setIsSharingImage(false);
      console.error(e);
      alert('حدث خطأ أثناء إعداد صورة السند للمشاركة');
    }
  };

  const handleDeleteTransaction = (row: any) => {
    const isInvoice = row.type === "invoice";
    const confirmMessage = isInvoice
      ? `هل أنت متأكد من حذف هذه الفاتورة رقم #${row.id.substring(0, 8)} نهائياً؟ سيتم تلقائياً تحديث رصيد الحساب والمديونية.`
      : `هل أنت متأكد من حذف سند القبض هذا بمبلغ ${(row.amount || 0).toLocaleString()} د.أ نهائياً؟ سيتم تلقائياً تحديث رصيد الحساب والمديونية.`;

    setConfirmState({
      isOpen: true,
      title: isInvoice ? 'حذف فاتورة مبيعات ⚠️' : 'حذف سند قبض مالي ⚠️',
      message: confirmMessage,
      onConfirm: async () => {
        if (isInvoice) {
          await deleteInvoice(row.id);
          setInvoices((prev) => prev.filter((i) => i.id !== row.id));
        } else {
          await deletePayment(row.id);
          setPayments((prev) => prev.filter((p) => p.id !== row.id));
        }
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case "paid":
        return (
          <div className="p-1 px-3 rounded-full bg-[#EBFBEE] text-[#2F9E44] text-[10px] font-black tracking-widest uppercase">
            مدفوع
          </div>
        );
      case "partial":
        return (
          <div className="p-1 px-3 rounded-full bg-[#FFF4E6] text-[#E8590C] text-[10px] font-black tracking-widest uppercase">
            جزئي
          </div>
        );
      case "unpaid":
        return (
          <div className="p-1 px-3 rounded-full bg-[#FFF5F5] text-[#E03131] text-[10px] font-black tracking-widest uppercase">
            غير مدفوع
          </div>
        );
    }
  };

  return (
    <div className="space-y-8 pb-20 font-['Tajawal']" dir="rtl">
      {/* ------------------- SCREEN VIEW ------------------- */}
      {!activeCustomerId ? (
        <div className="max-w-4xl mx-auto space-y-12 py-10 print:hidden text-center animate-in fade-in zoom-in duration-500">
          <div className="space-y-4">
            <div className="bg-white w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto mb-6 text-[#3B5BDB] shadow-xl shadow-[#3B5BDB]/10 border border-[#EEF2FF] rotate-3">
              <FileText size={44} />
            </div>
            <h1 className="text-4xl font-black text-[#1C1C2E]">
              كشوف الحسابات
            </h1>
            <p className="text-gray-400 font-bold max-w-md mx-auto">
              اختر أحد الزبائن أو المحلات لمشاهدة تفاصيل الحساب والعمليات
              المالية والطباعة
            </p>
          </div>

          <div className="relative max-w-xl mx-auto">
            <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[#3B5BDB]">
              <Search size={22} />
            </div>
            <input
              type="text"
              placeholder="ابحث عن اسم زبون أو محل..."
              className="w-full pr-14 pl-6 py-5 rounded-3xl border-2 border-white bg-white/70 backdrop-blur-md shadow-lg focus:border-[#3B5BDB] focus:bg-white outline-none transition-all text-xl font-black text-[#1C1C2E] placeholder:text-gray-300"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            {customers
              .filter((c) =>
                c.name.toLowerCase().includes(searchTerm.toLowerCase()),
              )
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => changeView("LEDGER", c.id)}
                  className="p-6 bg-white border border-gray-100 rounded-[32px] text-right hover:border-[#3B5BDB] hover:shadow-xl transition-all group flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#EEF2FF] text-[#3B5BDB] flex items-center justify-center text-xl shadow-sm font-black">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <span className="block font-black text-xl text-[#1C1C2E] group-hover:text-[#3B5BDB] transition-colors">
                        {c.name}
                      </span>
                      <span className="text-[10px] text-gray-400 font-black tracking-widest uppercase mt-1 block">
                        {c.type === "shop"
                          ? "محل تجاري / معرض"
                          : "زبون فردي / خاص"}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-[#3B5BDB] group-hover:text-white transition-all">
                    <ChevronRight size={20} className="rotate-180" />
                  </div>
                </button>
              ))}
          </div>
        </div>
      ) : (
        <div className={`animate-in slide-in-from-bottom-4 duration-500 ${(viewingInvoice || viewingPayment) ? 'print:hidden' : ''}`}>
          <div className="flex flex-col gap-8 print:hidden">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
              <div className="flex items-center gap-5">
                <button
                  onClick={() => changeView("CUSTOMERS")}
                  className="w-12 h-12 bg-white border border-gray-100 rounded-2xl text-[#1C1C2E] hover:bg-[#3B5BDB] hover:text-white transition-all shadow-sm flex items-center justify-center"
                >
                  <ArrowRight size={24} />
                </button>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-black text-[#1C1C2E]">
                      {customer?.name}
                    </h1>
                    <span
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${customer?.type === "shop" ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"}`}
                    >
                      {customer?.type === "shop" ? "محل" : "فرد"}
                    </span>
                  </div>
                  <p className="text-gray-400 font-bold text-xs mt-2 flex items-center gap-2">
                    <Calendar size={14} /> سجل العمليات وكشف الحساب التفصيلي
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-center w-full lg:w-auto shrink-0">
                <div className="flex bg-gray-100 p-1 rounded-xl gap-1 shrink-0 print:hidden">
                  <button
                    onClick={() => applyPreset("today")}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white text-gray-800 shadow-sm hover:bg-[#EEF2FF] hover:text-[#3B5BDB] transition-all"
                  >
                    اليوم
                  </button>
                  <button
                    onClick={() => applyPreset("yesterday")}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-transparent text-gray-500 hover:text-gray-800 transition-all"
                  >
                    أمس
                  </button>
                  <button
                    onClick={() => applyPreset("week")}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-transparent text-gray-500 hover:text-gray-800 transition-all"
                  >
                    أسبوع
                  </button>
                  <button
                    onClick={() => applyPreset("month")}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-transparent text-gray-500 hover:text-gray-800 transition-all"
                  >
                    الشهر
                  </button>
                  <button
                    onClick={() => applyPreset("all")}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-transparent text-gray-500 hover:text-gray-800 transition-all"
                  >
                    الكل
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 items-center bg-white/50 backdrop-blur-sm p-1.5 rounded-2xl border border-white shadow-sm shrink-0">
                  <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-lg border border-gray-100 max-w-[130px]">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">
                      من
                    </span>
                    <input
                      type="date"
                      value={fromDate}
                      onClick={(e) => {
                        try {
                          (e.target as any).showPicker();
                        } catch (e) {}
                      }}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="bg-transparent text-[11px] font-bold outline-none text-[#1C1C2E] cursor-pointer w-full"
                    />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-lg border border-gray-100 max-w-[130px]">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">
                      إلى
                    </span>
                    <input
                      type="date"
                      value={toDate}
                      onClick={(e) => {
                        try {
                          (e.target as any).showPicker();
                        } catch (e) {}
                      }}
                      onChange={(e) => setToDate(e.target.value)}
                      className="bg-transparent text-[11px] font-bold outline-none text-[#1C1C2E] cursor-pointer w-full"
                    />
                  </div>
                  <select
                    className="px-3 py-1 bg-white rounded-lg text-xs font-bold outline-none border border-gray-100 text-[#1C1C2E]"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">كل الحالات</option>
                    <option value="paid">مدفوع كامل</option>
                    <option value="partial">دفع جزئي</option>
                    <option value="unpaid">غير مدفوع</option>
                  </select>
                  {(fromDate || toDate || statusFilter !== "all") && (
                    <button
                      onClick={() => {
                        setFromDate("");
                        setToDate("");
                        setStatusFilter("all");
                      }}
                      className="p-1 px-2.5 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-col justify-between h-40">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#3B5BDB] flex items-center justify-center">
                    <Receipt size={20} />
                  </div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    إجمالي الفواتير
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-black text-[#1C1C2E]" dir="ltr">
                    {totals.totalInvoices.toLocaleString()}{" "}
                    <span className="text-sm">د.أ</span>
                  </p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-col justify-between h-40">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#EBFBEE] text-[#2F9E44] flex items-center justify-center">
                    <Banknote size={20} />
                  </div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    إجمالي المقبوضات
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-black text-[#2F9E44]" dir="ltr">
                    {totals.totalPayments.toLocaleString()}{" "}
                    <span className="text-sm">د.أ</span>
                  </p>
                </div>
              </div>
              <div className="bg-[#1C1C2E] p-6 rounded-[40px] shadow-2xl shadow-blue-900/10 flex flex-col justify-between h-40 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 transition-all group-hover:scale-110"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-[#3B5BDB] text-white flex items-center justify-center">
                    <Wallet size={20} />
                  </div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    الرصيد النهائي
                  </span>
                </div>
                <div className="mt-4 relative z-10">
                  <p className="text-4xl font-black text-white" dir="ltr">
                    {totals.balance.toLocaleString()}{" "}
                    <span className="text-base text-blue-400">د.أ</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Removed Print Styles CSS block completely to lighten the code since Excel export is now used */}
          <div className="hidden">

            {/* Visual Title Header (Specially Styled Arabic Letterhead) */}
            <div className="flex justify-end items-start mb-6 font-['Tajawal'] text-slate-800">
              <div className="text-right">
                <p className="text-xl font-black text-slate-900">اليرموك</p>
                <p className="text-xs font-bold text-gray-800 mt-1">اربد - الاردن</p>
              </div>
            </div>

            <div className="text-center w-full mb-6 relative">
              <span className="text-lg font-black tracking-widest text-[#1C1C2E] block mb-2">كشف حساب</span>
              <div className="flex justify-between items-end border-b-2 border-[#1C1C2E] pb-2 text-sm font-bold">
                <div className="w-1/3 text-left">
                  <span className="font-mono text-left" dir="ltr">1 / 1</span> &nbsp;:&nbsp; <span className="font-black">الصفحة</span>
                </div>
                <div className="w-1/3 text-center">
                  <span className="font-black">الفترة من</span> {fromDate ? new Date(fromDate).toLocaleDateString('en-GB') : '2026/01/01'} <span className="font-black">إلى</span> {toDate ? new Date(toDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}
                </div>
                <div className="w-1/3 text-right">
                  <span className="font-black">التاريخ : </span> <span className="font-mono" dir="ltr">{new Date().toLocaleDateString('en-GB')}</span>
                </div>
              </div>
            </div>

            {/* Account Info Bar */}
            <div className="mb-4 text-sm font-bold text-gray-800 flex flex-col items-end pr-4">
              <div className="flex gap-4 items-center">
                <span className="font-mono font-black">{customer?.id.replace(/-/g, '').substring(0, 14)}</span>
                <span className="font-black">-</span>
                <span className="font-black">{customer?.name}</span>
                <span className="font-black">:</span>
                <span className="font-black">رقم الحساب</span>
              </div>
              <div className="flex gap-4 items-center mt-2">
                <span className="font-black">{customer?.type === "shop" ? "محل تجاري / معرض" : "زبون فردي / خاص"}</span>
                <span className="font-black">-</span>
                <span className="font-black">:</span>
                <span className="font-black">تصنيف الحساب</span>
              </div>
              <div className="flex gap-4 items-center mt-2">
                <span className="font-black">-</span>
                <span className="font-black">:</span>
                <span className="font-black">الهاتف / العنوان</span>
              </div>
            </div>

            {/* LEDGER TABLE */}
            <table className="w-full text-center border-collapse border border-slate-200 text-[11px] font-bold text-gray-800 print-table">
              <thead>
                <tr className="bg-slate-50 text-slate-800 border-b border-slate-200 text-xs">
                  <th className="p-2.5 border-l border-slate-200 w-[12%]">التاريخ</th>
                  <th className="p-2.5 border-l border-slate-200 w-[11%]">نوع السند</th>
                  <th className="p-2.5 border-l border-slate-200 w-[8%]">الرقم</th>
                  <th className="p-2.5 border-l border-slate-200 w-[35%] text-right pr-4">البيان</th>
                  <th className="p-2.5 border-l border-slate-200 w-[11%]">مدين</th>
                  <th className="p-2.5 border-l border-slate-200 w-[11%]">دائن</th>
                  <th className="p-2.5 w-[12%]">الرصيد</th>
                </tr>
              </thead>
              <tbody>
                {/* Brought Forward Row */}
                <tr className="border-b border-slate-200 font-extrabold text-slate-900 bg-slate-50/55">
                  <td className="p-2.5 border-l border-slate-200 text-center">-</td>
                  <td className="p-2.5 border-l border-slate-200 text-center">-</td>
                  <td className="p-2.5 border-l border-slate-200 text-center">-</td>
                  <td className="p-2.5 border-l border-slate-200 text-center font-black">رصيد مدور</td>
                  <td className="p-2.5 border-l border-slate-200 text-center">-</td>
                  <td className="p-2.5 border-l border-slate-200 text-center">-</td>
                  <td className="p-2.5 font-black text-center" dir="ltr">
                    {startBalance.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                  </td>
                </tr>

                {/* Listing Rows */}
                {(() => {
                  let runningBalance = startBalance;
                  const sorted = [...statementRows].sort((a,b) => a.date - b.date);
                  return sorted.map((row) => {
                    const debit = row.type === 'invoice' ? row.totalAmount : 0;
                    const credit = row.type === 'payment' ? row.amount : 0;
                    const calcDebit = row.deleted ? 0 : debit;
                    const calcCredit = row.deleted ? 0 : credit;
                    runningBalance += (calcDebit - calcCredit);

                    const serialNo = row.id.substring(0, 6).toUpperCase();
                    
                    let description = "";
                    let itemsDetail: React.ReactNode = null;
                    if (row.type === 'payment') {
                      if (row.paymentMethod === 'cheque') {
                        description = `شيك رقم ${row.chequeNumber || ''} / ${row.dueDate ? new Date(row.dueDate).toLocaleDateString('en-GB') : ''}`;
                      } else {
                        description = "نقدا";
                      }
                    } else {
                      description = row.notes || "";
                    }

                    if (row.deleted) {
                      description = `(ملغي) ${description}`;
                    }

                    const docType = row.type === 'invoice' ? 'بالحساب' : 'سند قبض';

                    return (
                      <tr key={row.id} className={`border-b border-slate-200 text-gray-850 hover:bg-slate-50/30 ${row.deleted ? 'bg-red-50/40 opacity-70' : ''}`}>
                        <td className="p-2 border-l border-slate-200 text-gray-700 text-xs font-semibold text-center" dir="ltr">
                          {new Date(row.date).toLocaleDateString('en-GB')}
                        </td>
                        <td className={`p-2 border-l border-slate-200 font-bold text-center ${row.deleted ? 'text-red-600 line-through' : 'text-gray-650'}`}>
                          {docType}
                        </td>
                        <td className={`p-2 border-l border-slate-200 font-bold font-mono text-center ${row.deleted ? 'text-red-600 line-through' : 'text-gray-600'}`}>
                          {serialNo}
                        </td>
                        <td className={`p-2.5 border-l border-slate-200 text-right pr-4 text-xs font-semibold ${row.deleted ? 'text-red-600 font-black' : 'text-gray-700'}`}>
                          {description}
                        </td>
                        <td className="p-2 border-l border-slate-200 text-gray-800 font-extrabold text-center">
                          {debit > 0 ? <span dir="ltr" className={row.deleted ? 'line-through text-red-500' : ''}>{debit.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span> : ''}
                        </td>
                        <td className="p-2 border-l border-slate-200 text-gray-800 font-extrabold text-center">
                          {credit > 0 ? <span dir="ltr" className={row.deleted ? 'line-through text-red-500' : ''}>{credit.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span> : ''}
                        </td>
                        <td className="p-2 font-bold text-center">
                          <span dir="ltr">{runningBalance.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-black text-xs bg-slate-50 text-slate-800">
                  <td colSpan={4} className="p-2.5 border-l border-slate-200 text-center font-black text-slate-700">المجموع</td>
                  <td className="p-2.5 border-l border-slate-200 text-slate-900 font-black text-center">
                    {(() => {
                      const totalDebitInTable = statementRows.reduce((acc, row) => acc + (row.deleted ? 0 : (row.type === 'invoice' ? row.totalAmount : 0)), 0);
                      return <span dir="ltr">{totalDebitInTable.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>;
                    })()}
                  </td>
                  <td className="p-2.5 border-l border-slate-200 text-slate-900 font-black text-center">
                    {(() => {
                      const totalCreditInTable = statementRows.reduce((acc, row) => acc + (row.deleted ? 0 : (row.type === 'payment' ? row.amount : 0)), 0);
                      return <span dir="ltr">{totalCreditInTable.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>;
                    })()}
                  </td>
                  <td className="p-2.5 text-center"></td>
                </tr>
                <tr className="font-black text-sm bg-slate-50 text-slate-800">
                  <td colSpan={4} className="p-2 border-l border-slate-200 text-center font-black text-slate-700">الرصيد</td>
                  <td colSpan={2} className="p-2 border-l border-slate-200"></td>
                  <td className="p-2 text-center text-lg">
                    <span dir="ltr">{totals.balance.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Print Footer signatures with soft elegant slate border lines removed */}
            <div className="mt-16"></div>

            <div className="mt-16 text-center text-gray-400 text-[10px] border-t border-gray-150 pt-4">
              تحريراً في نظام معرض اليرموك المحاسبي الإلكتروني الموحد لسيراميك وبورسلان وبناء © {new Date().getFullYear()}
            </div>
          </div>

          <div className="bg-white rounded-none shadow-xl shadow-blue-900/5 border border-gray-100 mt-10 overflow-hidden print:hidden">
            {/* Table Header Controls */}
            <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center print:hidden bg-gray-50/50">
              <div>
                <h3 className="text-xl font-black text-[#1C1C2E] flex items-center gap-3">
                  <Clock size={22} className="text-[#3B5BDB]" /> تفاصيل الحركات
                  المالية
                </h3>
                <p className="text-xs text-gray-400 font-bold mt-1">
                  إجمالي {statementRows.length} حركات مسجلة (منها{" "}
                  {statementRows.filter((r) => r.type === "invoice").length}{" "}
                  فواتير مبيعات، و{" "}
                  {statementRows.filter((r) => r.type === "payment").length}{" "}
                  سندات قبض)
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExportExcel}
                  className="px-6 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl font-black text-sm text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300 transition-all flex items-center gap-3 shadow-sm hover:shadow-md shrink-0"
                >
                  <Download size={18} /> تحميل إكسيل
                </button>
              </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block mb-8 text-center border-b-[4px] border-[#1C1C2E] pb-8 pt-10">
              <div className="flex justify-between items-start mb-6">
                <div className="text-right space-y-2">
                  <h2 className="text-4xl font-black text-[#1C1C2E]">
                    معرض اليرموك
                  </h2>
                  <p className="text-gray-500 font-bold text-lg uppercase tracking-widest">
                    للسيراميك والأدوات الصحية
                  </p>
                  <div className="text-sm text-gray-400 font-bold mt-2">
                    <p>اربد - الأردن | هاتف: 0797788990</p>
                  </div>
                </div>
                <div className="text-left">
                  <div className="w-20 h-20 bg-[#1C1C2E] rounded-[32px] flex items-center justify-center text-white text-2xl shadow-lg rotate-3">
                    🏠
                  </div>
                </div>
              </div>
              <div className="bg-[#F4F6FA] rounded-2xl py-4 my-6">
                <h1 className="text-2xl font-black text-[#1C1C2E]">
                  كشف حساب تفصيلي
                </h1>
              </div>
              <div className="flex justify-between items-center px-4 text-lg">
                <div className="text-right">
                  <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-1">
                    الزبون / المحل
                  </p>
                  <p className="font-black text-[#1C1C2E] text-2xl">
                    {customer?.name}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-1">
                    تاريخ الكشف
                  </p>
                  <p className="font-black text-[#1C1C2E]">
                    {new Date().toLocaleDateString("ar-EG", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-0 border-t border-b border-gray-200 mt-8">
                <div className="p-4 border-l border-gray-100">
                  <p className="text-[10px] text-gray-400 font-black uppercase mb-1">
                    مجموع الفواتير
                  </p>
                  <p className="text-xl font-black text-[#1C1C2E]">
                    {totals.totalInvoices.toLocaleString()} د.أ
                  </p>
                </div>
                <div className="p-4 border-l border-gray-100">
                  <p className="text-[10px] text-gray-400 font-black uppercase mb-1">
                    مجموع المقبوضات
                  </p>
                  <p className="text-xl font-black text-[#2F9E44]">
                    {totals.totalPayments.toLocaleString()} د.أ
                  </p>
                </div>
                <div className="p-4 bg-gray-50">
                  <p className="text-[10px] text-gray-400 font-black uppercase mb-1">
                    الرصيد المتبقي
                  </p>
                  <p className="text-2xl font-black text-[#3B5BDB]">
                    {totals.balance.toLocaleString()} د.أ
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full space-y-6 print:hidden">
              {statementRows.length === 0 ? (
                <div className="py-24 border-y-[3px] border-x-[3px] border-[#1C1C2E] bg-white text-center">
                  <div className="flex flex-col items-center max-w-xs mx-auto">
                    <div className="bg-gray-50 w-20 h-20 rounded-[28px] flex items-center justify-center mb-6 text-gray-200">
                      <Search size={32} />
                    </div>
                    <h3 className="text-[#1C1C2E] font-black text-xl mb-2">
                      لا يوجد عمليات لعرضها
                    </h3>
                    <p className="text-gray-400 font-bold text-sm">
                      لم يتم العثور على أي فواتير أو سندات في السجل لهذه الفترة
                    </p>
                  </div>
                </div>
              ) : (
                statementRows.map((row) => (
                  <div
                    key={row.id}
                    className={`bg-white border-[3px] border-[#1C1C2E] shadow-sm overflow-hidden relative ${row.deleted ? 'opacity-70 bg-gray-100 grayscale-[30%]' : ''}`}
                  >
                    {/* Header */}
                    <div
                      className={`p-4 md:p-6 border-b-[3px] border-[#1C1C2E] flex justify-between items-center ${row.deleted ? 'bg-red-50' : (row.type === "invoice" ? "bg-gradient-to-r from-blue-50 to-[#EEF2FF]" : "bg-gradient-to-r from-green-50 to-[#EBFBEE]")}`}
                    >
                      <div>
                        <div className="flex items-center gap-3">
                          {row.deleted ? <Trash2 size={24} className="text-red-500" /> : (row.type === "invoice" ? (
                            <Receipt size={24} className="text-[#3B5BDB]" />
                          ) : (
                            <Banknote size={24} className="text-[#2F9E44]" />
                          ))}
                          <p className={`font-black text-base md:text-xl ${row.deleted ? 'text-red-600 line-through' : 'text-[#1C1C2E]'}`}>
                            {row.type === "invoice"
                              ? "فاتورة مبيعات"
                              : "سند قبض مالي"}
                            {row.deleted && <span className="text-red-500 mr-2 text-sm no-underline">(محذوف)</span>}
                          </p>
                        </div>
                        <div className="flex gap-4 mt-3">
                          <p className="text-xs font-bold text-gray-500 bg-white px-3 py-1 rounded-md border border-gray-200">
                            رقم: #{row.id.substring(0, 8)}
                          </p>
                          <p className="text-xs font-bold text-gray-500 bg-white px-3 py-1 rounded-md border border-gray-200">
                            التاريخ:{" "}
                            {new Date(row.date).toLocaleDateString("ar-EG")}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {row.type === "invoice" && !row.deleted && getStatusIcon(row.status)}
                        <p
                          className={`text-2xl font-black shrink-0 ${row.deleted ? 'text-red-500 line-through' : (row.type === "payment" ? "text-[#2F9E44]" : "text-[#1C1C2E]")}`}
                          dir="ltr"
                        >
                          {(row.type === "invoice"
                            ? row.totalAmount || 0
                            : row.amount || 0
                          ).toLocaleString()}{" "}
                          <span className="text-sm text-gray-500">د.أ</span>
                        </p>
                        {!row.deleted && (
                          <button
                            onClick={() => {
                              if (row.type === 'invoice') {
                                setIsJustSavedInvoice(false);
                                setViewingInvoice(row as any); // Set it as viewing so offscreen element renders
                                setTimeout(() => shareInvoiceWhatsapp(row as any), 50);
                              } else {
                                setViewingPayment(row as any);
                                setTimeout(() => sharePaymentWhatsapp(row as any), 50);
                              }
                            }}
                            className="px-3 py-1.5 mt-1 bg-white hover:bg-gray-50 border border-gray-200 text-[#1C1C2E] text-[11px] font-black flex items-center gap-1 rounded-lg shadow-sm transition-all active:scale-95"
                          >
                            <Share2 size={14} className="text-[#3B5BDB]" />
                            مشاركة
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    {row.type === "invoice" ? (
                      <div className="p-0">
                        {!expandedInvoiceIds[row.id] && (
                          <div className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs font-bold bg-white text-gray-500 print:hidden border-t-[1px] border-gray-100 gap-3">
                            <div>
                              <span>
                                عدد الأصناف بالفاتورة:{" "}
                                <strong className="text-[#3B5BDB]">
                                  {row.items?.length || 0}
                                </strong>{" "}
                                أصناف مختلفة
                              </span>
                              {row.notes && (
                                <span className="bg-gray-50 text-gray-600 px-2.5 py-1 rounded-md mr-4 font-bold border border-gray-150">
                                  ملاحظة: {row.notes}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() =>
                                setExpandedInvoiceIds((prev) => ({
                                  ...prev,
                                  [row.id]: true,
                                }))
                              }
                              className="px-4 py-2 bg-[#EEF2FF] hover:bg-[#3B5BDB] hover:text-white border border-[#C5D0FA] hover:border-[#3B5BDB] text-[#3B5BDB] text-xs font-black rounded-xl transition-all flex items-center gap-1 shrink-0"
                            >
                              عرض تفاصيل المنتجات ↓
                            </button>
                          </div>
                        )}

                        <div
                          className={`${expandedInvoiceIds[row.id] ? "block" : "hidden print:block"}`}
                        >
                          <table className="w-full text-center border-collapse bg-white">
                            <thead className="bg-gray-50 text-[#1C1C2E] border-b-[3px] border-[#1C1C2E]">
                              <tr className="text-xs font-black">
                                <th className="p-2 border-l-[3px] border-[#1C1C2E] w-[45%] text-right pr-4">
                                  البيان
                                </th>
                                <th className="p-2 border-l-[3px] border-[#1C1C2E] w-[15%]">
                                  العدد
                                </th>
                                <th className="p-2 border-l-[3px] border-[#1C1C2E] w-[20%]">
                                  الإفرادي
                                </th>
                                <th className="p-2 w-[20%]">الإجمالي</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(row.items || []).map((item, idx) => (
                                <tr
                                  key={idx}
                                  className="border-b-[1.5px] border-[#1C1C2E]/20 text-sm font-bold"
                                >
                                  <td className="p-3 border-l-[3px] border-[#1C1C2E] text-right pr-4">
                                    {item.name}
                                  </td>
                                  <td className="p-3 border-l-[3px] border-[#1C1C2E]">
                                    {item.quantity}
                                  </td>
                                  <td className="p-3 border-l-[3px] border-[#1C1C2E]">
                                    {(item.price || 0).toLocaleString()}
                                  </td>
                                  <td className="p-3">
                                    {(item.total || 0).toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          <div className="p-4 bg-gray-50 border-t-[3px] border-[#1C1C2E] flex justify-between items-center">
                            <p className="text-xs font-black text-gray-500">
                              ملاحظات: {row.notes || "لا يوجد"}
                            </p>
                            {row.paidAmount > 0 && (
                              <p className="text-xs font-black px-3 py-1 bg-[#EBFBEE] border border-[#B2F2BB] rounded-lg text-[#2F9E44]">
                                المدفوع نقداً/سندات:{" "}
                                {(row.paidAmount || 0).toLocaleString()} د.أ
                              </p>
                            )}
                          </div>
                        </div>
                        {expandedInvoiceIds[row.id] && (
                          <div className="p-3 bg-gray-50 flex justify-center border-t border-gray-100 print:hidden">
                            <button
                              onClick={() =>
                                setExpandedInvoiceIds((prev) => ({
                                  ...prev,
                                  [row.id]: false,
                                }))
                              }
                              className="text-xs font-black text-[#3B5BDB] hover:text-[#364FC7] flex items-center gap-1"
                            >
                              إغلاق تفاصيل المنتجات ↑
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-6 md:p-8 flex items-center justify-between bg-white text-[#1C1C2E]">
                        <div className="flex gap-6 items-center w-full">
                          <div className="p-5 rounded-2xl bg-[#EBFBEE] border-2 border-[#B2F2BB] text-[#2F9E44] shrink-0 hidden md:block">
                            <Banknote size={40} />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 border-b-2 border-dotted border-gray-200 inline-block pb-1">
                              {row.paymentMethod === "cheque"
                                ? "سند قبض - شيك بنكي ✍️"
                                : "سند قبض مالي - نقدي 💵"}
                            </p>
                            <p
                              className="text-4xl font-black text-[#2F9E44]"
                              dir="ltr"
                            >
                              {(row.amount || 0).toLocaleString()}{" "}
                              <span className="text-base text-gray-400">
                                د.أ
                              </span>
                            </p>

                            {row.paymentMethod === "cheque" && (
                              <div
                                className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold text-gray-600 bg-blue-50/40 p-4 border border-blue-100 rounded-2xl text-right"
                                dir="rtl"
                              >
                                <div>
                                  رقم الشيك:{" "}
                                  <span className="font-mono text-gray-800">
                                    {row.chequeNumber || "غير محدد"}
                                  </span>
                                </div>
                                <div>
                                  البنك المسحوب عليه:{" "}
                                  <span className="text-gray-800">
                                    {row.bankName || "غير محدد"}
                                  </span>
                                </div>
                                <div>
                                  تاريخ الاستحقاق:{" "}
                                  <span className="text-gray-800">
                                    {row.dueDate
                                      ? new Date(
                                          row.dueDate,
                                        ).toLocaleDateString("ar-JO")
                                      : "غير محدد"}
                                  </span>
                                </div>
                                <div className="sm:col-span-3 mt-2 flex items-center gap-2 border-t border-blue-100/50 pt-2 text-xs">
                                  <span>الحالة الحالية للشيك البنكي:</span>
                                  {row.chequeStatus === "cashed" ? (
                                    <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-[10px] font-black">
                                      ✅ تم تحصيله بنجاح
                                    </span>
                                  ) : row.chequeStatus === "bounced" ? (
                                    <span className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[10px] font-black">
                                      ❌ شيك مرتجع ومرفوض
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-[10px] font-black">
                                      ⏳ قيد الانتظار
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            {row.notes && (
                              <div className="mt-4 p-3 bg-gray-50 border-r-4 border-gray-300 rounded-l-lg">
                                <p className="text-xs font-black text-gray-500">
                                  ملاحظات والتفاصيل:{" "}
                                  <span className="text-gray-800">
                                    {row.notes}
                                  </span>
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="p-2 bg-gray-50 flex justify-end gap-2 border-t-[1px] border-gray-100 print:hidden">
                      <button
                        onClick={() => {
                          if (row.type === "invoice") {
                            setIsJustSavedInvoice(false);
                            setViewingInvoice(row as Invoice);
                          } else {
                            setViewingPayment(row as Payment);
                          }
                        }}
                        className="p-2 text-gray-500 hover:text-[#3B5BDB] hover:bg-white rounded-lg transition-all active:scale-95 active:bg-gray-200"
                        title="عرض كامل التفاصيل"
                      >
                        <Search size={16} />
                      </button>
                      {(role === "admin" || role === "supervisor" || role === "employee") && (
                        <>
                          <button
                            onClick={() =>
                              changeView(
                                "EDIT_TRANSACTION",
                                activeCustomerId,
                                row.id,
                              )
                            }
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg transition-all active:scale-95 active:bg-gray-200"
                            title="تعديل"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(row)}
                            className="p-2 text-red-300 hover:text-red-600 hover:bg-white rounded-lg transition-all active:scale-95 active:bg-red-50"
                            title="حذف"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Screen Actions Only Footer Details (Previously Print Footer Details) */}
            <div className="hidden">
              <div className="grid grid-cols-2 gap-20">
                <div className="text-right space-y-4">
                  <p className="text-gray-400 font-black text-xs uppercase tracking-widest">
                    توقيع وختم المعرض
                  </p>
                  <div className="h-24 border-2 border-dashed border-gray-100 rounded-2xl"></div>
                </div>
                <div className="text-right space-y-4">
                  <p className="text-gray-400 font-black text-xs uppercase tracking-widest">
                    توقيع الزبون / المستلم
                  </p>
                  <div className="h-24 border-2 border-dashed border-gray-100 rounded-2xl"></div>
                </div>
              </div>
              <div className="mt-20 text-center text-gray-300 font-bold text-xs">
                <p>
                  هذا الكشف صادر عن النظام الإلكتروني — معرض اليرموك ©{" "}
                  {new Date().getFullYear()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal (PDF Look) */}
      {viewingInvoice && (
        <div className="fixed inset-0 bg-[#050510]/80 print:bg-white backdrop-blur-md z-50 flex items-center justify-center p-1 sm:p-4 md:p-8 print:p-0 animate-in fade-in duration-300 print:relative print:block print:h-auto print:overflow-visible" dir="rtl">
          {isJustSavedInvoice ? (
            <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col p-8 text-center relative border border-gray-100 animate-in zoom-in-95 duration-200">
              <button
                onClick={closeViewingInvoice}
                className="absolute top-4 right-4 p-2 bg-gray-50 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center my-6">
                <div className="w-16 h-16 bg-[#EBFBEE] text-[#2F9E44] rounded-full flex items-center justify-center mb-4 shadow-sm">
                  <CheckCircle2 size={36} />
                </div>
                <h2 className="text-xl font-black text-[#1C1C2E]">تم حفظ الفاتورة بنجاح! 🎉</h2>
                <p className="text-sm text-gray-500 mt-2 font-bold">
                  تم إصدار وتسجيل الفاتورة في كشف الحساب بنجاح.
                </p>

                {/* Quick Info summary */}
                <div className="w-full bg-slate-50/70 rounded-2xl p-4 mt-6 space-y-3.5 text-right text-xs border border-slate-100/80">
                  <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-200/60">
                    <span className="text-gray-400 font-bold">الزبون / العميل:</span>
                    <span className="font-extrabold text-[#3B5BDB] text-sm">{customer?.name}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-200/60">
                    <span className="text-gray-400 font-bold">المجموع الكلي:</span>
                    <span className="font-black text-[#1C1C2E] text-sm">
                      {(viewingInvoice.totalAmount || 0).toLocaleString()} د.أ
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 font-bold">رقم الفاتورة:</span>
                    <span className="font-mono font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">
                      {viewingInvoice.id.substring(0, 8).toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 mt-4 w-full">
                <button
                  type="button"
                  onClick={() => shareInvoiceWhatsapp(viewingInvoice as any)}
                  disabled={isSharingImage}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl font-black text-sm transition-all shadow-sm cursor-pointer ${
                    isSharingImage 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-[#25D366] text-white hover:bg-[#20ba59] hover:shadow-md active:scale-[0.98]'
                  }`}
                >
                  <Share2 size={18} className={isSharingImage ? "animate-spin" : ""} />
                  <span>{isSharingImage ? "جاري تجهيز الصورة..." : "مشاركة الفاتورة للزبون عبر واتساب"}</span>
                </button>

                <button
                  type="button"
                  onClick={closeViewingInvoice}
                  className="w-full py-3 px-4 border border-gray-200 text-gray-600 font-black text-sm rounded-2xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  <X size={16} />
                  <span>إغلاق وخروج</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white w-full max-w-3xl print-container print:max-w-none rounded-none print:rounded-none overflow-hidden shadow-2xl print:shadow-none flex flex-col max-h-[95vh] print:max-h-none print:h-auto print:border-none relative print:block print:overflow-visible">
              <button
                onClick={closeViewingInvoice}
                className="absolute top-6 right-6 p-2 bg-gray-100 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all print:hidden z-10"
              >
                <X size={20} />
              </button>

              <div id="invoice-print-area" className="flex-1 overflow-y-auto px-1 sm:px-4 py-6 text-black print:overflow-visible print:h-auto print:block">
              {/* Items Table - Highly responsive font and padding to fit all viewport sizes completely */}
              <table className="w-full text-center border-collapse border border-slate-200 text-[10px] xs:text-[11px] sm:text-xs font-bold text-gray-800 print-table" dir="rtl">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/50">
                    <th className="p-1 sm:p-2 border-l border-slate-200 w-[6%] text-center text-slate-700 font-extrabold" rowSpan={2}>الرقم</th>
                    <th className="p-1 sm:p-2 border-l border-slate-200 w-[36%] text-right pr-1 sm:pr-4 text-slate-700 font-extrabold" rowSpan={2}>البيان</th>
                    <th className="p-1 sm:p-2 border-l border-slate-200 w-[10%] text-center text-slate-700 font-extrabold" rowSpan={2}>الوحدة</th>
                    <th className="p-1 sm:p-2 border-l border-slate-200 w-[10%] text-center text-slate-700 font-extrabold" rowSpan={2}>العدد</th>
                    <th colSpan={2} className="p-1 sm:p-2 border-l border-slate-200 w-[18%] text-center text-slate-700 font-extrabold">سعر الوحدة</th>
                    <th colSpan={2} className="p-1 w-[20%] text-center text-slate-700 font-extrabold">القيمة الاجمالية</th>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[8px] xs:text-[9.5px] sm:text-[10px] text-gray-500">
                    <th className="p-0.5 sm:p-1 border-l border-slate-200 text-center font-bold">فلس</th>
                    <th className="p-0.5 sm:p-1 border-l border-slate-200 text-center font-bold">دينار</th>
                    <th className="p-0.5 sm:p-1 border-l border-slate-200 text-center font-bold">فلس</th>
                    <th className="p-0.5 text-center font-bold">دينار</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingInvoice.items.map((item, idx) => {
                    const priceDinar = Math.floor(item.price || 0);
                    const priceFils = Math.round(((item.price || 0) - priceDinar) * 1000);
                    
                    const actualTotal = item.total || ((item.price || 0) * (item.quantity || 1));
                    const totalDinar = Math.floor(actualTotal);
                    const totalFils = Math.round((actualTotal - totalDinar) * 1000);

                    return (
                      <tr key={idx} className="border-b border-slate-200 h-9 text-gray-800">
                        <td className="p-0.5 sm:p-1 text-center font-mono text-gray-400 border-l border-slate-200">{idx + 1}</td>
                        <td 
                          className="p-0.5 sm:p-1 border-l border-slate-200 text-right pr-1 sm:pr-3 font-extrabold text-[#111827] break-words"
                          style={{
                            wordBreak: 'break-all',
                            wordWrap: 'break-word',
                            whiteSpace: 'normal'
                          }}
                        >
                          {item.name}
                        </td>
                        <td className="p-0.5 sm:p-1 border-l border-slate-200 text-center text-gray-500">{item.unit || 'متر'}</td>
                        <td className="p-0.5 sm:p-1 border-l border-slate-200 text-center font-bold">{item.quantity}</td>
                        <td className="p-0.5 sm:p-1 border-l border-slate-200 font-mono text-center font-bold">{priceFils.toString().padStart(3, '0')}</td>
                        <td className="p-0.5 sm:p-1 border-l border-slate-200 text-center font-bold bg-slate-50/10">{(priceDinar).toLocaleString('en-US')}</td>
                        <td className="p-0.5 sm:p-1 border-l border-slate-200 font-mono text-center font-bold">{totalFils.toString().padStart(3, '0')}</td>
                        <td className="p-0.5 sm:p-1 font-mono text-center font-bold">{(totalDinar).toLocaleString('en-US')}</td>
                      </tr>
                    );
                  })}
                  {/* Filler rows */}
                  {Array.from({ length: Math.max(0, 8 - viewingInvoice.items.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className="border-b border-slate-100 h-9">
                      <td className="border-l border-slate-100"></td>
                      <td className="border-l border-slate-100"></td>
                      <td className="border-l border-slate-100"></td>
                      <td className="border-l border-slate-100"></td>
                      <td className="border-l border-slate-100"></td>
                      <td className="border-l border-slate-100"></td>
                      <td className="border-l border-slate-100"></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {(() => {
                    const grandDinar = Math.floor(viewingInvoice.totalAmount || 0);
                    const grandFils = Math.round(((viewingInvoice.totalAmount || 0) - grandDinar) * 1000);
                    return (
                      <>
                        <tr className="border-t-[1.5px] border-slate-400 h-9 font-extrabold text-gray-800">
                          <td colSpan={4} className="border-l border-slate-200 text-left pl-2 sm:pl-4 font-bold text-[8px] xs:text-[10px] sm:text-xs" dir="ltr">Page : 1 / 1</td>
                          <td colSpan={2} className="border-l border-slate-200 text-center font-bold">المجموع</td>
                          <td className="p-0.5 sm:p-1 border-l border-slate-200 font-mono text-center font-bold">{grandFils.toString().padStart(3, '0')}</td>
                          <td className="p-0.5 sm:p-1 text-center font-bold">{grandDinar.toLocaleString('en-US')}</td>
                        </tr>
                        <tr className="border-t border-slate-200 h-9 font-extrabold text-gray-800">
                          <td colSpan={4} className="border-l border-slate-200"></td>
                          <td colSpan={2} className="border-l border-slate-200 text-center font-bold">الاجمالي</td>
                          <td className="p-0.5 sm:p-1 border-l border-slate-200 font-mono text-center font-bold">{grandFils.toString().padStart(3, '0')}</td>
                          <td className="p-0.5 sm:p-1 text-center font-bold">{grandDinar.toLocaleString('en-US')}</td>
                        </tr>
                        <tr className="border-t border-slate-200 h-9 font-extrabold text-gray-800">
                          <td colSpan={4} className="border-l border-slate-200 text-center text-[9px] xs:text-[10.5px] sm:text-sm font-bold">{tafqeet(viewingInvoice.totalAmount)}</td>
                          <td colSpan={2} className="border-l border-slate-200 text-center font-bold">الصافي</td>
                          <td className="p-0.5 sm:p-1 border-l border-slate-200 font-mono text-center font-bold">{grandFils.toString().padStart(3, '0')}</td>
                          <td className="p-0.5 sm:p-1 text-center font-bold">{grandDinar.toLocaleString('en-US')}</td>
                        </tr>
                      </>
                    );
                  })()}
                </tfoot>
              </table>

              {/* Invoice notes info (if any) */}
              {viewingInvoice.notes && (
                <div className="mt-4 p-3 border border-slate-200 bg-slate-50 text-xs font-bold text-gray-600">
                  ملاحظات: <span className="font-normal text-gray-700">{viewingInvoice.notes}</span>
                </div>
              )}



               <div className="mt-10 pt-6 border-t border-slate-200 flex justify-end items-center bg-[#F4F6FA] p-6 rounded-none print:hidden">
                 <div className="flex gap-2">
                  {(role === "admin" || role === "supervisor" || role === "employee") && (
                    <button
                      onClick={() => {
                        closeViewingInvoice();
                        changeView(
                          "EDIT_TRANSACTION",
                          activeCustomerId,
                          viewingInvoice.id,
                        );
                      }}
                      className="w-10 h-10 bg-white text-[#3B5BDB] border border-slate-200 rounded-lg flex items-center justify-center font-black hover:bg-[#3B5BDB] hover:text-white transition-all print:hidden shadow-sm"
                    >
                      <Edit size={18} />
                    </button>
                  )}

                  <button
                    onClick={() => shareInvoiceWhatsapp(viewingInvoice as any)}
                    disabled={isSharingImage}
                    className={`flex items-center gap-2 px-3 h-10 ${isSharingImage ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-[#25D366]/10 text-[#075E54] border-[#25D366]/30 hover:bg-[#25D366]/20'} border rounded-lg font-bold text-xs transition-all shadow-sm print:hidden`}
                    title="مشاركة الفاتورة"
                  >
                    <Share2 size={18} className={isSharingImage ? "animate-spin" : ""} />
                    <span>{isSharingImage ? "جاري التجهيز..." : "مشاركة"}</span>
                  </button>

                  <button
                    onClick={() => handleExportInvoiceExcel(viewingInvoice as any)}
                    className="w-10 h-10 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg flex items-center justify-center hover:bg-emerald-100 transition-all shadow-sm print:hidden"
                    title="تحميل كملف إكسيل"
                  >
                    <Download size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      )}

      {/* Payment Detail Modal */}
      {viewingPayment && (
        <div className="fixed inset-0 bg-[#050510]/80 print:bg-white backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-8 print:p-0 animate-in fade-in duration-300 print:relative print:block print:h-auto print:overflow-visible" dir="rtl">
          <div id="payment-print-area" className="bg-white w-full max-w-xl print-container print:max-w-none rounded-none print:rounded-none overflow-hidden shadow-2xl print:shadow-none flex flex-col max-h-[90vh] print:max-h-none print:h-auto border border-[#2F9E44]/30 print:border-none print:block print:overflow-visible">
            <div className="p-10 bg-white print:border-b print:border-slate-300 flex justify-between items-start">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-none bg-[#2F9E44] text-white flex items-center justify-center shadow-lg shadow-emerald-500/10 print:bg-[#1C1C2E]">
                  <Banknote size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-[#1C1C2E]">
                    سند قبض مالي
                  </h3>
                  <p className="text-[#2F9E44] font-black text-xs tracking-[0.3em] uppercase mt-1">
                    RCP-{viewingPayment.id.substring(0, 8)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingPayment(null)}
                className="p-3 bg-gray-50 rounded-none text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all print:hidden"
              >
                <X size={24} />
              </button>
            </div>

            <div className="px-10 py-12 flex-1 flex flex-col items-center justify-center space-y-10">
              <div className="text-center space-y-4">
                <p className="text-gray-300 font-black uppercase tracking-[0.4em] text-xs">
                  Received from
                </p>
                <h4 className="text-4xl font-black text-[#1C1C2E] leading-loose">
                  {customer?.name}
                </h4>
                <div className="h-0.5 bg-gray-100 w-24 mx-auto my-4"></div>
              </div>

              <div className="text-center space-y-4">
                <p className="text-gray-300 font-black uppercase tracking-[0.4em] text-xs">
                  Amount Received
                </p>
                <div className="bg-[#EBFBEE] py-6 px-12 rounded-lg border-2 border-[#B2F2BB]">
                  <p className="text-5xl font-black text-[#2F9E44]" dir="ltr">
                    {(viewingPayment.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}{" "}
                    <span className="text-xl">JD</span>
                  </p>
                </div>

                {viewingPayment.paymentMethod === "cheque" && (
                  <div
                    className="w-full bg-blue-50/50 p-6 border border-blue-150 rounded-2xl text-left space-y-3 mt-2"
                    dir="ltr"
                  >
                    <p className="text-[#3B5BDB] font-black text-xs uppercase tracking-widest border-b border-blue-100 pb-2">
                       Bank Cheque Details:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-bold text-gray-700">
                      <div>
                        Cheque No:{" "}
                        <span className="font-mono text-gray-900">
                          {viewingPayment.chequeNumber || "N/A"}
                        </span>
                      </div>
                      <div>
                        Bank Name:{" "}
                        <span className="text-gray-900">
                          {viewingPayment.bankName || "N/A"}
                        </span>
                      </div>
                      <div>
                        Due Date:{" "}
                        <span className="text-gray-900">
                          {viewingPayment.dueDate
                            ? new Date(
                                viewingPayment.dueDate,
                              ).toLocaleDateString("en-GB")
                            : "N/A"}
                        </span>
                      </div>
                      <div className="md:col-span-2">
                        Status:
                        <span className="mr-1.5 inline-block font-black">
                          {viewingPayment.chequeStatus === "cashed"
                            ? "✅ Accepted & Cashed"
                            : viewingPayment.chequeStatus === "bounced"
                              ? "❌ Rejected & Bounced"
                              : "⏳ Pending"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="hidden"></div>
              </div>

              <div className="text-center">
                <p className="text-gray-400 font-bold italic text-lg opacity-80">
                  "{" "}
                  {viewingPayment.notes ||
                    "For construction materials and sanitary equipment from your account."}{" "}
                  "
                </p>
              </div>
            </div>

            <div className="p-10 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-center text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                {new Date(viewingPayment.date).toLocaleDateString('en-GB')}
              </p>
              <div className="flex gap-4">
                  {(role === "admin" || role === "supervisor" || role === "employee") && (
                    <button
                      onClick={() => {
                        setViewingPayment(null);
                        changeView(
                          "EDIT_TRANSACTION",
                          activeCustomerId,
                          viewingPayment.id,
                        );
                      }}
                      className="w-10 h-10 bg-white text-[#3B5BDB] border border-slate-200 rounded-lg flex items-center justify-center font-black hover:bg-[#3B5BDB] hover:text-white transition-all print:hidden shadow-sm"
                    >
                      <Edit size={18} />
                    </button>
                  )}

                  <button
                    onClick={() => sharePaymentWhatsapp(viewingPayment as any)}
                    disabled={isSharingImage}
                    className={`flex items-center gap-2 px-3 h-10 ${isSharingImage ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-[#25D366]/10 text-[#075E54] border-[#25D366]/30 hover:bg-[#25D366]/20'} border rounded-lg font-bold text-xs transition-all shadow-sm print:hidden`}
                    title="مشاركة السند"
                  >
                    <Share2 size={18} className={isSharingImage ? "animate-spin" : ""} />
                    <span>{isSharingImage ? "جاري التجهيز..." : "مشاركة"}</span>
                  </button>

                  <button
                    onClick={() => handleExportPaymentExcel(viewingPayment as any)}
                    className="w-10 h-10 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg flex items-center justify-center hover:bg-emerald-100 transition-all shadow-sm print:hidden"
                    title="تحميل كملف إكسيل"
                  >
                    <Download size={18} />
                  </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden off-screen Invoice template for sharing */}
      {viewingInvoice && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: -999 }}>
          <div
            id="share-invoice-card"
            className="bg-white p-10 text-black leading-normal animate-none"
            style={{
              width: '800px',
              direction: 'rtl',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
          {/* Company Header */}
          <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-200">
            <div className="text-right">
              <h1 className="text-2xl font-extrabold text-slate-900">معرض اليرموك</h1>
              <p className="text-sm font-bold text-slate-600 mt-1">للسيراميك والأدوات الصحية</p>
              <p className="text-xs text-slate-500">اربد - الاردن</p>
            </div>
            <div className="text-center py-2 px-6 border border-slate-300 rounded-lg">
              <h2 className="text-lg font-black text-slate-800">فاتورة مبيعات بالحساب</h2>
              <span className="text-xs text-slate-500 font-mono">Invoice</span>
            </div>
            <div className="text-left select-none">
              <table className="mr-auto text-xs font-bold text-slate-700">
                <tbody>
                  <tr>
                    <td className="text-left px-2 py-1">التاريخ:</td>
                    <td className="font-mono text-left" dir="ltr">{new Date(viewingInvoice.date).toLocaleDateString('en-GB')}</td>
                  </tr>
                  <tr>
                    <td className="text-left px-2 py-1">رقم الفاتورة:</td>
                    <td className="font-mono text-left">{viewingInvoice.id.substring(0, 8).toUpperCase()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Customer Info */}
          <div className="mb-8 bg-slate-50 p-4 border border-slate-200 rounded-lg text-right">
            <div className="grid grid-cols-2 gap-4 text-sm font-bold text-slate-800">
              <div>
                <span className="text-slate-500">مطلوب من السادة:</span> {customer?.name || ""} المحترمين
              </div>
              <div className="text-left font-mono">
                <span className="text-slate-500">رقم الحساب:</span> {customer?.id.substring(0, 8).toUpperCase()}
              </div>
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-center border-collapse border border-slate-300 text-xs font-bold text-slate-800" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
                <th className="p-2 border-l border-slate-300 w-[6%] text-center">ت</th>
                <th className="p-2 border-l border-slate-300 w-[42%] text-right pr-4">البيان (اسم المادة)</th>
                <th className="p-2 border-l border-slate-300 w-[10%] text-center">الوحدة</th>
                <th className="p-2 border-l border-slate-300 w-[10%] text-center">الكمية</th>
                <th colSpan={2} className="p-2 border-l border-slate-300 w-[16%] text-center">سعر الوحدة (د.أ)</th>
                <th colSpan={2} className="p-2 w-[16%] text-center">المجموع (د.أ)</th>
              </tr>
              <tr className="bg-slate-50 border-b border-slate-300 text-[10px] text-slate-500">
                <th colSpan={4} className="border-l border-slate-300"></th>
                <th className="p-1 border-l border-slate-300 text-center font-semibold">فلس</th>
                <th className="p-1 border-l border-slate-300 text-center font-semibold">دينار</th>
                <th className="p-1 border-l border-slate-300 text-center font-semibold">فلس</th>
                <th className="p-1 text-center font-semibold">دينار</th>
              </tr>
            </thead>
            <tbody>
              {viewingInvoice.items.map((item, idx) => {
                const priceDinar = Math.floor(item.price || 0);
                const priceFils = Math.round(((item.price || 0) - priceDinar) * 1000);
                
                const actualTotal = item.total || ((item.price || 0) * (item.quantity || 1));
                const totalDinar = Math.floor(actualTotal);
                const totalFils = Math.round((actualTotal - totalDinar) * 1000);

                return (
                  <tr key={idx} className="border-b border-slate-300 h-9 text-slate-800 bg-white">
                    <td className="p-1 text-center border-l border-slate-300 text-slate-400 font-mono">{idx + 1}</td>
                    <td 
                      className="p-1 border-l border-slate-300 text-right pr-4 font-bold text-slate-900 break-words"
                      style={{
                        wordBreak: 'break-all',
                        wordWrap: 'break-word',
                        whiteSpace: 'normal',
                        maxWidth: '336px'
                      }}
                    >
                      {item.name}
                    </td>
                    <td className="p-1 border-l border-slate-300 text-center text-slate-600">{item.unit || 'متر'}</td>
                    <td className="p-1 border-l border-slate-300 text-center text-slate-900 font-extrabold">{item.quantity}</td>
                    <td className="p-1 border-l border-slate-300 font-mono text-center text-slate-600">{priceFils.toString().padStart(3, '0')}</td>
                    <td className="p-1 border-l border-slate-300 text-center text-slate-900 font-bold">{priceDinar}</td>
                    <td className="p-1 border-l border-slate-300 font-mono text-center text-slate-600">{totalFils.toString().padStart(3, '0')}</td>
                    <td className="p-1 text-center text-slate-900 font-bold">{totalDinar}</td>
                  </tr>
                );
              })}
              {/* Fill empty lines to always make a complete form layout */}
              {Array.from({ length: Math.max(1, 10 - viewingInvoice.items.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className="border-b border-slate-200 h-9 bg-white">
                  <td className="border-l border-slate-300 text-slate-300 text-center font-mono">{(viewingInvoice.items.length) + i + 1}</td>
                  <td className="border-l border-slate-300"></td>
                  <td className="border-l border-slate-300"></td>
                  <td className="border-l border-slate-300"></td>
                  <td className="border-l border-slate-300"></td>
                  <td className="border-l border-slate-300"></td>
                  <td className="border-l border-slate-300"></td>
                  <td></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {(() => {
                const grandDinar = Math.floor(viewingInvoice.totalAmount || 0);
                const grandFils = Math.round(((viewingInvoice.totalAmount || 0) - grandDinar) * 1000);
                return (
                  <>
                    <tr className="border-t border-slate-300 h-9 font-bold text-slate-800 bg-slate-50">
                      <td colSpan={4} className="border-l border-slate-300 text-right pr-4 text-slate-500 font-normal">Page : 1 / 1</td>
                      <td colSpan={2} className="border-l border-slate-300 text-center font-extrabold bg-slate-100">المجموع</td>
                      <td className="p-1 border-l border-slate-300 font-mono text-center font-bold">{grandFils.toString().padStart(3, '0')}</td>
                      <td className="p-1 text-center font-bold">{grandDinar}</td>
                    </tr>
                    <tr className="border-t border-slate-300 h-9 font-bold text-slate-800 bg-slate-50">
                      <td colSpan={4} className="border-l border-slate-300"></td>
                      <td colSpan={2} className="border-l border-slate-300 text-center font-extrabold bg-slate-100">الاجمالي</td>
                      <td className="p-1 border-l border-slate-300 font-mono text-center font-bold">{grandFils.toString().padStart(3, '0')}</td>
                      <td className="p-1 text-center font-bold">{grandDinar}</td>
                    </tr>
                    <tr className="border-t border-slate-300 h-10 font-bold text-slate-800 bg-emerald-50/50">
                      <td colSpan={4} className="border-l border-slate-300 text-center text-xs font-extrabold text-indigo-900 bg-slate-50" style={{ direction: 'rtl' }}>
                        {tafqeet(viewingInvoice.totalAmount)}
                      </td>
                      <td colSpan={2} className="border-l border-slate-300 text-center font-extrabold bg-emerald-100 text-emerald-900">الصافي المطلوب</td>
                      <td className="p-1 border-l border-slate-300 font-mono text-center font-black text-emerald-950 bg-emerald-50">{grandFils.toString().padStart(3, '0')}</td>
                      <td className="p-1 text-center font-black text-emerald-950 bg-emerald-50">{grandDinar}</td>
                    </tr>
                  </>
                );
              })()}
            </tfoot>
          </table>

          {/* Note footer copy */}
          {viewingInvoice.notes && (
            <div className="mt-4 p-3 border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 rounded-lg text-right">
              📝 <span className="text-slate-500">ملاحظات الفاتورة:</span> {viewingInvoice.notes}
            </div>
          )}

          {/* Elegant Signatures section */}
          <div className="mt-16 pt-6 border-t border-slate-100 flex justify-between px-8 text-xs font-bold text-slate-600">
            <div>✍️ اسم وتوقيع المستلم: ................................................</div>
            <div>🏢 اسم وتوقيع البائع: معرض اليرموك للسيراميك</div>
          </div>
          
          <div className="mt-10 text-center text-[10px] text-slate-400 font-medium">
            هذا المستند صادر إلكترونياً عن نظام معرض اليرموك والأدوات الصحية © {new Date().getFullYear()}
          </div>
        </div>
      </div>
      )}

      {/* Hidden off-screen Payment template for sharing */}
      {viewingPayment && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: -999 }}>
          <div
            id="share-payment-card"
            className="bg-white p-10 text-black leading-normal animate-none"
            style={{
              width: '800px',
              direction: 'rtl',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
          {/* Company Header */}
          <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-200">
            <div className="text-right">
              <h1 className="text-2xl font-extrabold text-slate-900">معرض اليرموك</h1>
              <p className="text-sm font-bold text-slate-600 mt-1">للسيراميك والأدوات الصحية</p>
              <p className="text-xs text-slate-500">اربد - الاردن</p>
            </div>
            <div className="text-center py-2 px-6 border border-emerald-300 bg-emerald-50/30 rounded-lg">
              <h2 className="text-lg font-black text-slate-800">سند قبض مالي</h2>
              <span className="text-xs text-emerald-700 font-mono font-bold">Receipt Note</span>
            </div>
            <div className="text-left select-none">
              <table className="mr-auto text-xs font-bold text-slate-700">
                <tbody>
                  <tr>
                    <td className="text-left px-2 py-1">التاريخ:</td>
                    <td className="font-mono text-left" dir="ltr">{new Date(viewingPayment.date).toLocaleDateString('en-GB')}</td>
                  </tr>
                  <tr>
                    <td className="text-left px-2 py-1">رقم السند:</td>
                    <td className="font-mono text-left">{viewingPayment.id.substring(0, 8).toUpperCase()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Receipt Details Block */}
          <div className="space-y-6">
            {/* Box for received details */}
            <table className="w-full text-right border-collapse border border-slate-300 font-bold" style={{ tableLayout: 'fixed' }}>
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="p-3 bg-slate-50 w-1/4 text-slate-500 border-l border-slate-300">وصلنا من السيد:</td>
                  <td className="p-3 text-lg text-slate-900 w-3/4">{customer?.name || ""} المحترم</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-3 bg-slate-50 text-slate-500 border-l border-slate-300">مبلـغ وقـدره:</td>
                  <td className="p-3 text-lg text-emerald-700 font-extrabold">
                    {(viewingPayment.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} د.أ (دينار أردني فقط)
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-3 bg-slate-50 text-slate-500 border-l border-slate-300">الصافي كتابة:</td>
                  <td className="p-3 text-slate-900 text-sm">{tafqeet(viewingPayment.amount)}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-3 bg-slate-50 text-slate-500 border-l border-slate-300">طريقة الدفع:</td>
                  <td className="p-3 text-slate-900 font-semibold">{viewingPayment.paymentMethod === 'cheque' ? 'شيك بنكي' : 'نقداً'}</td>
                </tr>
                <tr>
                  <td className="p-3 bg-slate-50 text-slate-500 border-l border-slate-300">وذلك عن / البيان:</td>
                  <td 
                    className="p-3 text-slate-700 font-medium text-sm break-words"
                    style={{
                      wordBreak: 'break-all',
                      wordWrap: 'break-word',
                      whiteSpace: 'normal'
                    }}
                  >
                    {viewingPayment.notes || "دفعة مقبوضة من الحساب الساري للعميل"}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Cheque details card if payment method is bank cheque */}
            {viewingPayment.paymentMethod === 'cheque' && (
              <div className="p-4 border border-blue-250 bg-blue-50/40 rounded-lg text-right space-y-3">
                <h4 className="text-xs font-black text-blue-800 uppercase tracking-wider border-b border-blue-100 pb-1.5 flex items-center gap-1.5">
                  🏦 تفاصيل الشيك البنكي المرفق:
                </h4>
                <div className="grid grid-cols-3 gap-4 text-xs font-bold text-slate-700">
                  <div>
                    <span className="text-slate-500">رقم الشيك:</span> <span className="font-mono text-slate-900">{viewingPayment.chequeNumber || "-"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">البنك المسحوب عليه:</span> <span className="text-slate-950">{viewingPayment.bankName || "-"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">تاريخ الاستحقاق:</span> <span className="text-slate-950">{viewingPayment.dueDate ? new Date(viewingPayment.dueDate).toLocaleDateString("en-GB") : "-"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Signature Section */}
          <div className="mt-20 pt-6 border-t border-slate-100 flex justify-between px-8 text-xs font-bold text-slate-600">
            <div>✍️ توقيع المستلم/العميل: ................................................</div>
            <div>🏢 أمين الصندوق: ................................................</div>
          </div>

          <div className="mt-14 text-center text-[10px] text-slate-400 font-medium">
            هذا السند معتمد صادر إلكترونياً عن معرض اليرموك والأدوات الصحية © {new Date().getFullYear()}
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

      {sharingImageSrc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200 font-['Tajawal']" dir="rtl">
          <div className="bg-white rounded-[32px] w-full max-w-lg p-6 shadow-2xl flex flex-col gap-6 relative animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            {/* Close button */}
            <button 
              onClick={() => {
                setSharingImageSrc(null);
                setSharingType(null);
                setSharingFilename("");
                setSharingPhone("");
              }}
              className="absolute left-4 top-4 w-10 h-10 bg-gray-100 hover:bg-gray-200 active:scale-90 text-gray-500 rounded-full flex items-center justify-center transition-all cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            <div className="text-center mt-2.5 select-none">
              <h3 className="text-xl font-black text-slate-800 flex items-center justify-center gap-2">
                <span>{sharingType === "invoice" ? "مشاركة الفاتورة كـ صورة 🚀" : "مشاركة السند كـ صورة 🚀"}</span>
              </h3>
              <p className="text-xs text-gray-400 font-extrabold mt-1">تمت معالجة الصورة واختصار الألوان بنجاح!</p>
            </div>

            {/* Generated Image Preview in Dash-border box */}
            <div className="border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 p-2 flex items-center justify-center overflow-hidden max-h-72">
              <img 
                src={sharingImageSrc} 
                alt="Generated voucher preview" 
                className="max-h-64 object-contain rounded-xl shadow-md border border-gray-100 pointer-events-auto"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Micro instructions */}
            <div className="bg-[#EEF2FF] border border-[#C5D0FA] rounded-2xl p-4 text-xs font-bold text-[#1C1C2E]/90 leading-relaxed text-right space-y-2 select-none font-['Tajawal']">
              <p className="text-[#3B5BDB] font-black flex items-center gap-1.5 text-[13px]">
                <span>💡 نصائح سريعة للمشاركة بسهولة وتوفير الوقت:</span>
              </p>
              <ul className="list-disc pr-4 space-y-1 text-[11px] text-[#3B5BDB]/90 leading-relaxed">
                <li>للجوال (موبايل): اضغط مطولاً على الصورة لعرض خيار المشاركة السريعة أو الحفظ للإرسال الفوري للزبون عبر واتساب!</li>
                <li>للكمبيوتر (PC): يمكنك النقر بالزر الأيمن على الصورة، اختيار "نسخ الصورة" ثم لصقها (Ctrl+V) مباشرة في محادثة واتساب ويب للعميل المفتوحة!</li>
              </ul>
            </div>

            {/* Phone Number Selector if they want to load custom phone */}
            <div className="flex gap-2 items-center select-none font-['Tajawal']">
              <p className="text-xs font-black text-slate-500 whitespace-nowrap">رقم الواتساب للعميل:</p>
              <input
                type="text"
                value={sharingPhone}
                onChange={(e) => setSharingPhone(e.target.value)}
                placeholder="أدخل رقم الهاتف للعميل (مثال: 079...)"
                className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl font-black bg-slate-50 focus:bg-white text-slate-800 outline-none focus:border-[#3B5BDB]"
              />
            </div>

            {/* Action buttons list */}
            <div className="flex flex-col gap-2.5 font-['Tajawal'] select-none">
              <button
                onClick={() => {
                  const cleanedPhone = sharingPhone.replace(/\s+/g, '');
                  const textMsg = sharingType === "invoice" ? "مرحباً، مرفق لك صورة فاتورة مبيعات الحساب - معرض اليرموك" : "مرحباً، مرفق لك صورة سند القبض المالي - معرض اليرموك";
                  const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanedPhone}&text=${encodeURIComponent(textMsg)}`;
                  window.open(whatsappUrl, "_blank");
                }}
                className="w-full py-3.5 px-4 bg-[#2F9E44] hover:bg-[#2B8A3E] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-green-600/10 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                فتح واتساب للنشر العاجل
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = sharingImageSrc;
                    link.download = sharingFilename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  تنزيل كملف
                </button>

                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(sharingImageSrc);
                      const blob = await res.blob();
                      await navigator.clipboard.write([
                        new ClipboardItem({
                          [blob.type]: blob
                        })
                      ]);
                      alert("تم نسخ الصورة إلى الحافظة! يمكنك الآن لصقها (Ctrl+V) مباشرة في محادثة الواتساب للعميل.");
                    } catch (err) {
                      console.error("Clipboard copy failed:", err);
                      alert("نسخ الصورة المباشر غير مدعوم على متصفحك الحالي. يرجى تنزيل الصورة أو الضغط كليك يمين لاختيار نسخ الصورة.");
                    }
                  }}
                  className="py-3 px-4 bg-[#EEF2FF] hover:bg-[#D5E1FD] text-[#3B5BDB] border border-[#C5D0FA] rounded-2xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  نسخ لـ لصقها بالواتساب
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Ledger;
