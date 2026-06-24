
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Customer, CartItem, Invoice, Payment, ViewProps, PaymentStatus, CustomerType } from '../types';
import { saveInvoice, savePayment, saveCustomer, generateId } from '../services/db';
import { Search, Plus, Trash2, Check, ShoppingBag, Banknote, X, Receipt, Wallet, Calculator, ArrowRight, User, Store, UserPlus, Mic, Key } from 'lucide-react';
import { useAuth } from './AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { analyzeTranscriptClient, getGeminiApiKey, saveGeminiApiKey } from '../services/geminiService';
import { showSuccess, showError, showWarning } from '../services/notifications';
import { addDiagnosticLog } from '../services/diagnostics';

interface Props extends ViewProps {
  customers: Customer[];
  initialType?: 'invoice' | 'payment';
}

const TransactionForm: React.FC<Props> = ({ customers, changeView, activeCustomerId, initialType = 'invoice', activeTransactionId }) => {
  const { role } = useAuth();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(activeCustomerId || '');
  const [transType, setTransType] = useState<'invoice' | 'payment'>(initialType || 'invoice');

  useEffect(() => {
    if (initialType) {
      setTransType(initialType);
    }
  }, [initialType]);

  useEffect(() => {
    if (activeCustomerId !== undefined) {
      setSelectedCustomerId(activeCustomerId);
    }
  }, [activeCustomerId]);
  
  // Invoice State
  const [items, setItems] = useState<CartItem[]>([]);
  const [currentItem, setCurrentItem] = useState<Partial<CartItem>>({ name: '', quantity: '' as any, price: '' as any, total: '' as any });
  const [paidAmountOnInvoice, setPaidAmountOnInvoice] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Payment State
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'cheque'>('cash');
  const [chequeNumber, setChequeNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [chequeStatus, setChequeStatus] = useState<'pending' | 'cashed' | 'bounced'>('pending');
  
  // Original transaction metadata (for edits)
  const [originalDate, setOriginalDate] = useState<number | null>(null);
  const [originalCreatedBy, setOriginalCreatedBy] = useState<string | null>(null);
  const [originalDeleted, setOriginalDeleted] = useState<boolean>(false);
  const [originalDeletedAt, setOriginalDeletedAt] = useState<number | null>(null);
  const [originalDeletedBy, setOriginalDeletedBy] = useState<string | null>(null);
  
  // New Customer State
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState<{name: string; type: CustomerType}>({
    name: '',
    type: CustomerType.INDIVIDUAL
  });
  
  // States representing API Key handling
  const [showApiKeySetting, setShowApiKeySetting] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => getGeminiApiKey());
  const [hasApiKey, setHasApiKey] = useState(() => !!getGeminiApiKey());
  
  // Native Web Speech API implementation
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [browserSupportsSpeechRecognition] = useState(() => {
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  });
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setVoiceTranscript(transcript);
  }, [transcript]);

  const startVoiceInput = () => {
    if (!browserSupportsSpeechRecognition) {
      showWarning(
        'التعرف الصوتي غير مدعوم 🎙️',
        'ميزة التسجيل والتعرف الصوتي المباشر غير مدعومة بالكامل على هذا المتصفح أو داخل هذا الإطار. يرجى فتح التطبيق في نافذة مستقلة واستخدام متصفح Google Chrome أو Safari حديث.'
      );
      return;
    }

    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    setTranscript('');
    setVoiceTranscript('');

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }

    addDiagnosticLog('info', 'SPEECH', 'تشغيل الاستماع الصوتي 🎙️', 'بدأ معالج المتصفح بتهيئة المايكروفون للاستماع للإملاء بالعامية الأردنية أو العربية الفصحى (ar-JO)...');

    const rec = new SpeechRecognitionAPI();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'ar-JO';

    rec.onstart = () => {
      setListening(true);
      addDiagnosticLog('success', 'SPEECH', 'المايك أصبح نشطاً 🟢', 'أعطى المتصفح موافقة على تشغيل المايكروفون ودفق موجات لقط الصوت بنجاح.');
    };

    rec.onresult = (event: any) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }
      setTranscript(fullTranscript);
    };

    rec.onerror = (event: any) => {
      console.error("Speech recognition error:", event);
      const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;
      
      let errorTitle = 'خطأ في التعرف الصوتي 🎙️';
      let errorMessage = 'حدث خطأ غير متوقع أثناء تشغيل مدخلات الصوت.';
      let errorDetails = '';

      switch (event.error) {
        case 'not-allowed':
          errorTitle = 'مرفوض: صلاحية المايكروفون 🚫🎙️';
          errorMessage = 'تم رفض الوصول إلى المايكروفون. يرجى تفعيل الصلاحية لتتمكن من استخدام الإدخال الصوتي المتطور.';
          errorDetails = `⚠️ تنبيه هام:\n${isInsideIframe ? 'أنت تتصفح التطبيق حالياً من داخل إطار المعاينة الداخلي. المتصفحات تحظر استخدام المايكروفون داخل هذه الإطارات المدمجة افتراضياً لدواعي الأمان والخصوصية.\n\n💡 الحل السريع: يرجى فتح رابط التطبيق المباشر (رابط المشاركة / التطبيق المشترك) بشكل كامل ومباشر في علامة تبويب أو متصفح مستقل، ثم امنح الصلاحية مجدداً.\n\n' : ''}🛠️ خطوات تفعيل المايك لكل الأجهزة:\n\n1. على أجهزة اللابتوب (Chrome / Edge): اضغط على علامة القفل 🔒 بجانب رابط الموقع في شريط العنوان بالأعلى، ثم غيّر خيار "الميكروفون" (Microphone) إلى "السماح" (Allow)، وقم بتحديث الصفحة.\n\n2. على هاتف الآيفون (Mobile Safari): اذهب إلى تطبيق إعدادات الهاتف (Settings) ⚙️ > خيار Safari > ميكروفون (Microphone) > ثم اختر "السماح" (Allow) أو "اسأل" (Ask).\n\n3. على هاتف أندرويد (Chrome / Samsung Internet): انقر فوق النقاط الثلاث في أعلى الصفحة > إعدادات الموقع > المايكروفون وتأكد من تفعيله والسماح لهذا الموقع المعتمد.`;
          break;
          
        case 'audio-capture':
          errorTitle = 'عطل بالتقاط الصوت ⚠️🎤';
          errorMessage = 'فشل في رصد وإمساك الموجات الصوتية أو تعذر إيجاد مايكروفون نشط.';
          errorDetails = `خطوات تتبع السلامة العتادية:\n- تأكد من أن جهاز المايكروفون الخاص بلابتوبك أو هاتفك موصول ومفعّل بشكل سليم.\n- يُرجى التحقق من ألا يكون المايكروفون محجوزاً ومستخدماً حالياً من قبل تطبيق آخر في الخلفية (مثل Zoom أو Teams أو الكاميرا).\n- تحقق من لوحة تحكم الصوت في جهازك بأن مستوى حساس لقط الصوت غير صامت أو كتم (Mute).`;
          break;

        case 'network':
          errorTitle = 'مشكلة شبكة واتصال 🌐❌';
          errorMessage = 'تعذر بلوغ الخدمة السحابية المخصصة لتحليل الكلام الصوتي إلى نصوص.';
          errorDetails = `تفصيل تقني:\nميزة التعرف الصوتي (Web Speech API) على متصفحات Chrome و Safari ترحل موجات الصوت إلى خادم الذكاء السحابي الموثوق لتحليلها وتدقيق النبرات والمفردات بدقة.\nيُرجى التحقق من كفاءة وموثوقية اتصالك الحالي بالإنترنت (Wi-Fi أو 4G/5G) ثم أعد النقر والحديث بوضوح.`;
          break;

        case 'no-speech':
          errorTitle = 'لم يتم تمييز كلام صامت 🤐🎙️';
          errorMessage = 'لم نقم بأي تعديلات في الحقول لأننا لم نرصد أو نميز أي نية صوتية صريحة بالملتقط.';
          errorDetails = `توجيهات لنجاح التسجيل:\n- تحدث فور ظهور الضوء النابض على الزر الملون.\n- اقترب بشكل ملائم من منفع مايكروفون جهازك.\n- ألقِ الكلمات بجمل عربية واضحة بنبرة معتدلة وبمستوى تشويش محيطي منخفض ومريح.`;
          break;

        case 'aborted':
          errorTitle = 'تم مقاطعة وإيقاف الاستماع 🛑';
          errorMessage = 'أوقف الاستماع الصوتي بشكل قسري قبل إكمال الإفادة.';
          errorDetails = `يحدث هذا الإيقاف المفاجئ تلقائياً في حال ورود مكالمة خلوية فجائية أو عند النقر المزدوج المتتالي على زر المايك.`;
          break;

        case 'language-not-supported':
          errorTitle = 'لهجة الإدخال غير مدعومة 🇸🇦🇯🇴';
          errorMessage = 'المتصفح النشط حالياً لا يملك التروس الكافية لدعم إملاء العربية باللهجة الأردنية.';
          errorDetails = `المقترح:\nنوصي بأن تستخدم متصفح Google Chrome (على الأندرويد والكمبيوتر) أو Safari (على أجهزة الآيفون والآيباد)، فكلاهما يوفر محرك لغوي محدّد بدقة ومتكامل لمعالجة العربية الفصحى والمحكية.`;
          break;

        default:
          errorTitle = 'تنبيه فني بالتقاط الصوت 🛠️';
          errorMessage = `تعذر المتابعة بالتحويل الصوتي نظراً لتنبيه بالمتصفح: ${event.error || 'عطل غير معروف'}`;
          errorDetails = `رمز المشكلة للتدقيق: ${event.error || 'unknown'}\nيرجى محاولة إنعاش الصفحة بإعاده تحميلها وسيقوم المايك بالاستعداد التام مجدداً.`;
          break;
      }

      addDiagnosticLog('error', 'SPEECH', errorTitle, errorMessage, `نوع الخطأ المسجل: ${event.error || 'مجهول'}\n\n${errorDetails}`, 'يرجى مراجعة إعدادات الأندرويد أو المتصفح النشط.');
      showError(errorTitle, errorMessage, errorDetails);
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      addDiagnosticLog('info', 'SPEECH', 'إغلاق المايكروفون 🔴', 'تم إطفاء موجة المايكروفون وتحليل الصوت المنطوق بنجاح.');
    };

    recognitionRef.current = rec;
    
    try {
      rec.start();
    } catch (e: any) {
      console.error("Failed to start speech recognition:", e);
      showError('خطأ تشغيل المايك 🎙️', 'لم نتمكن من الوصول للمايك المباشر. يرجى التحقق من الصلاحيات.');
    }
  };

  const stopAndProcess = async (textToProcess?: string) => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setListening(false);

    const currentTranscript = textToProcess !== undefined ? textToProcess : transcript;
    if (!currentTranscript || !currentTranscript.trim()) {
       showWarning('لم يتم التقاط صوت 🎙️', 'لم يتم التعرف على أي نص صوتي صالح لتحليله. تحدث بوضوح وحاول مرة أخرى.');
       return;
    }

    setIsSaving(true);
    try {
        const data = await analyzeTranscriptClient(currentTranscript);
        
        if (data.customerName && !selectedCustomerId) {
            const cMatch = customers.find(c => c.name.includes(data.customerName));
            if (cMatch) { 
                setSelectedCustomerId(cMatch.id); 
            } else {
                setNewCustomer({...newCustomer, name: data.customerName});
                setShowNewCustomerForm(true);
            }
        }
        
        if (data.items && data.items.length) {
            const newItems = data.items.map((i: any) => ({
                id: generateId(),
                name: i.name,
                quantity: i.quantity,
                unit: i.unit,
                price: i.price,
                total: i.quantity * i.price
            }));
            setItems(prev => [...prev, ...newItems]);
            showSuccess('تم إضافة الأصناف بالتعرف الصوتي 🎙️', `تم ملء الفاتورة مع التعرف على ${newItems.length} أسطر بنجاح.`);
        } else {
            showWarning('تنبيه التحليل الصوتي 🔍', 'تم الاستماع لكلماتك ولكن لم نتمكن من تحديد تفاصيل الأصناف أو الكميات الصالحة للفاتورة بشكل دقيق.');
        }
    } catch (e: any) {
        const errMsg = e.message || "";
        if (errMsg.includes("API key not valid") || errMsg.includes("غير صالح")) {
            showError('مفتاح الـ API غير صالح ⚠️', 'المفتاح الخاص بالذكاء الاصطناعي (Gemini) غير صالح أو غير مفعل. تأكد من صحة المفتاح.');
            setHasApiKey(false);
            setShowApiKeySetting(true);
        } else if (errMsg.includes("is not set") || errMsg.includes("لم يتم العثور") || errMsg.includes("مفتاح")) {
            showError('مفتاح الـ API مفقود ⚠️', 'يرجى إدخال مفتاح الـ API الخاص بـ Gemini في إعدادات التطبيق أو الكود.');
            setHasApiKey(false);
            setShowApiKeySetting(true);
        } else if (
            errMsg.toLowerCase().includes("quota") || 
            errMsg.toLowerCase().includes("limit") || 
            errMsg.toLowerCase().includes("exhausted") || 
            errMsg.toLowerCase().includes("billing") || 
            errMsg.toLowerCase().includes("plan")
        ) {
            showWarning(
                'انتهى رصيد الذكاء الاصطناعي ⚠️', 
                'لقد انتهت الحصة المجانية المؤقتة لمفتاح Gemini API الحالي (Quota Exceeded). يرجى مراجعة الاستهلاك أو تجديد المفتاح لمواصلة الإدخال الصوتي.'
            );
        } else {
            showError('فشل تحليل الصوت ⚠️', 'حدثت مشكلة أثناء الاتصال بخوادم تحليل الصوت الذكية. يرجى تجربة الإدخال اليدوي مؤقتاً.');
        }
    }
    setIsSaving(false);
  };

  const handleSaveNewCustomer = async () => {
    if (!newCustomer.name.trim()) return;
    try {
      setIsSaving(true);
      const customer: Customer = {
        id: generateId(),
        name: newCustomer.name.trim(),
        type: newCustomer.type,
        createdAt: Date.now(),
        balance: 0,
        locked: false
      };
      await saveCustomer(customer);
      setSelectedCustomerId(customer.id);
      setShowNewCustomerForm(false);
      setIsSaving(false);
    } catch (e) {
      console.error(e);
      setIsSaving(false);
    }
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const [savedProducts, setSavedProducts] = useState<string[]>([]);
  const [savedUnits, setSavedUnits] = useState<string[]>(['متر', 'حبة', 'طقم']);

  useEffect(() => {
    const products = JSON.parse(localStorage.getItem('saved_products') || '[]');
    const units = JSON.parse(localStorage.getItem('saved_units') || '["متر", "حبة", "طقم"]');
    setSavedProducts(products);
    setSavedUnits(units);
    
    const fetchTransaction = async () => {
        if (!activeTransactionId) return;
        
        if (activeTransactionId === 'new_cheque') {
            setTransType('payment');
            setPaymentMethod('cheque');
            return;
        }

        try {
            const invSnap = await getDoc(doc(db, 'invoices', activeTransactionId));
            if (invSnap.exists()) {
                const inv = invSnap.data() as Invoice;
                setTransType('invoice');
                setItems(inv.items || []);
                setPaidAmountOnInvoice(inv.paidAmount || 0);
                setNotes(inv.notes || '');
                setSelectedCustomerId(inv.customerId);
                setOriginalDate(inv.date || null);
                setOriginalCreatedBy(inv.createdBy || null);
                setOriginalDeleted(inv.deleted || false);
                setOriginalDeletedAt(inv.deletedAt || null);
                setOriginalDeletedBy(inv.deletedBy || null);
                return;
            }
            
            const paySnap = await getDoc(doc(db, 'payments', activeTransactionId));
            if (paySnap.exists()) {
                const pay = paySnap.data() as Payment;
                setTransType('payment');
                setPaymentAmount(pay.amount || 0);
                setPaymentNotes(pay.notes || '');
                setSelectedCustomerId(pay.customerId);
                setPaymentMethod(pay.paymentMethod || 'cash');
                setChequeNumber(pay.chequeNumber || '');
                setBankName(pay.bankName || '');
                if (pay.dueDate) {
                    setDueDate(new Date(pay.dueDate).toISOString().substring(0, 10));
                }
                setChequeStatus(pay.chequeStatus || 'pending');
                setOriginalDate(pay.date || null);
                setOriginalCreatedBy(pay.createdBy || null);
                setOriginalDeleted(pay.deleted || false);
                setOriginalDeletedAt(pay.deletedAt || null);
                setOriginalDeletedBy(pay.deletedBy || null);
                return;
            }
        } catch(e) {
            console.error('Error fetching transaction:', e);
        }
    };
    
    fetchTransaction();
  }, [activeTransactionId]);

  const addItem = () => {
    if (!currentItem.name || (currentItem.price as any) === '' || currentItem.price === undefined || (currentItem.total as any) === '' || currentItem.total === undefined) return;
    
    const newItem: CartItem = {
      id: currentItem.id || generateId(),
      name: currentItem.name,
      quantity: Number(currentItem.quantity) || 1,
      price: Number(currentItem.price),
      total: Number(currentItem.total),
      unit: currentItem.unit || ''
    };
    
    if (!savedProducts.includes(newItem.name)) {
      const updatedProducts = [...savedProducts, newItem.name];
      setSavedProducts(updatedProducts);
      localStorage.setItem('saved_products', JSON.stringify(updatedProducts));
    }

    if (newItem.unit && !savedUnits.includes(newItem.unit)) {
      const updatedUnits = [...savedUnits, newItem.unit];
      setSavedUnits(updatedUnits);
      localStorage.setItem('saved_units', JSON.stringify(updatedUnits));
    }
    
    setItems([...items, newItem]);
    setCurrentItem({ name: '', unit: '', quantity: '' as any, price: '' as any, total: '' as any });
  };

  const totalInvoiceAmount = items.reduce((sum, item) => sum + item.total, 0);

  const resetForm = () => {
    setItems([]);
    setPaidAmountOnInvoice(0);
    setNotes('');
    setPaymentAmount(0);
    setPaymentNotes('');
    setPaymentMethod('cash');
    setChequeNumber('');
    setBankName('');
    setDueDate(new Date().toISOString().substring(0, 10));
    setChequeStatus('pending');
    setCurrentItem({ name: '', unit: '', quantity: '' as any, price: '' as any, total: '' as any });
    setOriginalDate(null);
    setOriginalCreatedBy(null);
    setOriginalDeleted(false);
    setOriginalDeletedAt(null);
    setOriginalDeletedBy(null);
    if (role === 'employee' && !activeCustomerId) {
      setSelectedCustomerId('');
    }
  };

  const handleSaveInvoice = async () => {
    let finalItems = [...items];
    if (currentItem.name) {
      finalItems.push({
        id: currentItem.id || generateId(),
        name: currentItem.name,
        quantity: Number(currentItem.quantity) || 1,
        price: Number(currentItem.price) || 0,
        total: Number(currentItem.total) || 0,
        unit: currentItem.unit || ''
      });
    }

    if (!selectedCustomerId || finalItems.length === 0) return;
    
    setIsSaving(true);
    try {
      const finalTotal = finalItems.reduce((sum, item) => sum + item.total, 0);
      const invoiceId = activeTransactionId || generateId();
      const status: PaymentStatus = paidAmountOnInvoice >= finalTotal ? 'paid' : (paidAmountOnInvoice > 0 ? 'partial' : 'unpaid');
      
      const invoice: Invoice = {
        id: invoiceId,
        customerId: selectedCustomerId,
        date: originalDate || Date.now(),
        items: finalItems,
        totalAmount: finalTotal,
        paidAmount: paidAmountOnInvoice,
        status,
        notes,
        ...(originalCreatedBy ? { createdBy: originalCreatedBy } : {}),
        ...(originalDeleted ? { deleted: originalDeleted } : {}),
        ...(originalDeletedAt ? { deletedAt: originalDeletedAt } : {}),
        ...(originalDeletedBy ? { deletedBy: originalDeletedBy } : {})
      };
      
      await saveInvoice(invoice);
      
      if (paidAmountOnInvoice > 0 && !activeTransactionId) {
        const payment: Payment = {
          id: generateId(),
          customerId: selectedCustomerId,
          invoiceId: invoiceId,
          date: Date.now(),
          amount: paidAmountOnInvoice,
          notes: 'دفعة عند إنشاء الفاتورة'
        };
        await savePayment(payment);
      }
      
      const customerObj = customers.find(c => c.id === selectedCustomerId);
      showSuccess(
        activeTransactionId ? 'تم تعديل الفاتورة 🧾' : 'إصدار فاتورة جديدة 🎉',
        `تم حفظ الفاتورة بنجاح للعميل (${customerObj?.name || ''}) بقيمة ${finalTotal} د.أ.`
      );

      resetForm();
      setIsSaving(false);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('just_saved_invoice_id', invoiceId);
      }
      changeView('LEDGER', selectedCustomerId, invoiceId);
    } catch (error) {
      console.error('Error saving invoice:', error);
      showError('خطأ أثناء حفظ الفاتورة ❌', 'يتعذر حفظ الفاتورة، يرجى مراجعة الصلاحيات وحالة الاتصال.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePayment = async () => {
    if (!selectedCustomerId || paymentAmount <= 0) return;
    
    setIsSaving(true);
    try {
      const payment: Payment = {
        id: (activeTransactionId && activeTransactionId !== 'new_cheque') ? activeTransactionId : generateId(),
        customerId: selectedCustomerId,
        date: originalDate || Date.now(),
        amount: paymentAmount,
        notes: paymentNotes,
        paymentMethod,
        ...(paymentMethod === 'cheque' ? {
          chequeNumber,
          bankName,
          dueDate: new Date(dueDate).getTime(),
          chequeStatus
        } : {}),
        ...(originalCreatedBy ? { createdBy: originalCreatedBy } : {}),
        ...(originalDeleted ? { deleted: originalDeleted } : {}),
        ...(originalDeletedAt ? { deletedAt: originalDeletedAt } : {}),
        ...(originalDeletedBy ? { deletedBy: originalDeletedBy } : {})
      };
      
      await savePayment(payment);
      const isCheque = paymentMethod === 'cheque';
      const customerObj = customers.find(c => c.id === selectedCustomerId);
      
      showSuccess(
        isCheque ? 'تسجيل شيك بنكي 🏛️' : 'سند قبض مالي 💵',
        `تم استلام دفعة بقيمة ${paymentAmount} د.أ. بنجاح من العميل (${customerObj?.name || ''}).`
      );

      resetForm();
      setIsSaving(false);
      if (isCheque) {
        changeView('CHEQUES');
      } else {
        changeView('LEDGER', selectedCustomerId, payment.id);
      }
    } catch (error) {
      console.error('Error saving payment:', error);
      showError('فشل حفظ السند ❌', 'يتعذر تسجيل الدفعة بالخادم، راجع صلاحية العمليات.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full pb-20 font-['Tajawal']" dir="rtl">
      <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
        
        {listening && (
          <div className="bg-indigo-50 border-r-4 border-[#3B5BDB] p-5 rounded-2xl shadow-sm text-indigo-900 mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-in slide-in-from-top-2 duration-300">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
                <span className="text-xs md:text-sm font-extrabold text-[#3B5BDB]">جاري الاستماع لصوتك الآن...</span>
              </div>
              <p className="bg-white p-4 rounded-xl border border-indigo-100 text-[#1C1C2E] text-xs font-bold leading-relaxed min-h-[48px]">
                {voiceTranscript ? voiceTranscript : "ابدأ بالتحدث الآن، وسيتم كتابة كلماتك هنا تلقائياً..."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => stopAndProcess()}
              className="px-5 py-2.5 bg-[#3B5BDB] hover:bg-[#364FC7] text-white rounded-xl text-xs font-black shadow transition-all active:scale-95 duration-100 shrink-0"
            >
              إنهاء وتحليل الفاتورة ⚡
            </button>
          </div>
        )}

        {/* Type Selector & Customer Info */}
        <div className="bg-white p-6 rounded-none border-2 border-gray-100 space-y-8 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
             <div>
                <h2 className="text-2xl font-black text-[#1C1C2E]">
                  {activeTransactionId ? 'تعديل ' : 'إنشاء '} 
                  {transType === 'invoice' ? 'فاتورة بيع' : 'سند قبض مالي'}
                </h2>
                <p className="text-gray-400 text-xs font-bold mt-1 uppercase tracking-widest">يرجى تعبئة كافة الحقول المطلوبة بدقة</p>
             </div>

            {!activeTransactionId && (
              <div className="flex gap-1 p-1 bg-gray-50 rounded-2xl border border-gray-200">
                <button 
                  onClick={() => setTransType('invoice')} 
                  className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${transType === 'invoice' ? 'bg-[#3B5BDB] text-white shadow-lg shadow-[#3B5BDB]/20' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <Receipt size={16} />
                  فاتورة
                </button>
                <button 
                  onClick={() => setTransType('payment')} 
                  className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${transType === 'payment' ? 'bg-[#2F9E44] text-white shadow-lg shadow-[#2F9E44]/20' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <Banknote size={16} />
                  سند قبض
                </button>
              </div>
            )}
          </div>

          {!selectedCustomerId ? (
            <div className="space-y-4">
              <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest">اختر الزبون أو المحل</label>
              
              {!showNewCustomerForm ? (
                <>
                  <div className="relative group">
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</div>
                    <input 
                      type="text" 
                      placeholder="ابحث عن اسم..."
                      className="w-full pr-12 pl-4 py-4 rounded-2xl border-2 border-gray-100 focus:border-[#3B5BDB] focus:bg-white bg-gray-50 outline-none font-bold text-base transition-all"
                      onChange={(e) => setCustomerSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => setShowNewCustomerForm(true)}
                      className="w-full text-center px-4 py-4 bg-[#EBFBEE] text-[#2F9E44] border-2 border-[#B2F2BB] hover:bg-[#D3F9D8] rounded-xl font-bold transition-all active:scale-95 duration-100 text-sm flex items-center justify-center gap-2"
                    >
                      <UserPlus size={18} />
                      إضافة زبون أو محل جديد
                    </button>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                      {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).map(c => (
                        <button 
                          key={c.id} 
                          onClick={() => setSelectedCustomerId(c.id)}
                          className="text-right px-4 py-4 bg-gray-50 hover:bg-[#EEF2FF] hover:text-[#3B5BDB] border-2 border-transparent hover:border-[#C5D0FA] rounded-xl font-bold transition-all active:scale-95 duration-100 text-sm flex items-center justify-between group"
                        >
                          <span>{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-[#EEF2FF] p-6 rounded-2xl border-2 border-[#C5D0FA] space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-black text-[#3B5BDB] flex items-center gap-2">
                      <UserPlus size={18} /> إضافة جديد
                    </h3>
                    <button onClick={() => setShowNewCustomerForm(false)} className="text-gray-400 hover:text-red-500">
                      <X size={20} />
                    </button>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setNewCustomer({...newCustomer, type: CustomerType.INDIVIDUAL})}
                      className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${newCustomer.type === CustomerType.INDIVIDUAL ? 'bg-white shadow-md text-[#3B5BDB] ring-1 ring-[#C5D0FA]' : 'bg-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                      <User size={16} />
                      زبون فردي
                    </button>
                    <button 
                      onClick={() => setNewCustomer({...newCustomer, type: CustomerType.SHOP})}
                      className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${newCustomer.type === CustomerType.SHOP ? 'bg-white shadow-md text-[#3B5BDB] ring-1 ring-[#C5D0FA]' : 'bg-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                      <Store size={16} />
                      محل تجاري
                    </button>
                  </div>
                  
                  <div>
                    <input 
                      type="text" 
                      placeholder="اسم الزبون أو المحل..."
                      autoFocus
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#3B5BDB] focus:bg-white bg-white outline-none font-bold text-sm transition-all"
                    />
                  </div>
                  
                  <button 
                    onClick={handleSaveNewCustomer}
                    disabled={isSaving || !newCustomer.name.trim()}
                    className="w-full py-3 bg-[#3B5BDB] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#364FC7] active:scale-95 duration-100 disabled:opacity-50 transition-all"
                  >
                    {isSaving ? 'جاري الحفظ...' : 'حفظ واختيار'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-[#EEF2FF] rounded-2xl border border-[#C5D0FA]">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-white border border-[#C5D0FA] flex items-center justify-center text-xl shadow-sm text-[#3B5BDB]">
                    👤
                 </div>
                 <div>
                    <p className="text-[10px] text-[#3B5BDB] font-black uppercase tracking-widest">الزبون المختار</p>
                    <p className="text-lg font-black text-[#1C1C2E]">{selectedCustomer?.name}</p>
                 </div>
              </div>
              {!activeTransactionId && (
                <button onClick={() => setSelectedCustomerId('')} className="bg-white/50 p-2 rounded-xl hover:bg-white text-red-400 transition-colors">
                  <X size={20} />
                </button>
              )}
            </div>
          )}
        </div>

        {selectedCustomerId && (
          transType === 'invoice' ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                <h3 className="font-black text-[#1C1C2E] text-base">قائمة أصناف الفاتورة:</h3>
                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                  {!hasApiKey && (
                    <button
                      type="button"
                      onClick={() => setShowApiKeySetting(!showApiKeySetting)}
                      className="px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 border bg-white border-gray-200 text-[#1C1C2E] hover:bg-gray-50 shadow-sm"
                      title="إعدادات مفتاح الذكاء الاصطناعي (Gemini API Key)"
                    >
                      <Key size={14} className="text-amber-500 animate-pulse" />
                      <span>مفتاح الـ API 🔑</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={listening ? () => stopAndProcess() : startVoiceInput}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 border ${
                      listening 
                        ? 'bg-amber-500 text-white border-amber-600 animate-pulse shadow-lg shadow-amber-500/20 hover:bg-amber-600' 
                        : 'bg-[#3B5BDB] border-[#3B5BDB] text-white hover:bg-[#364FC7] shadow-md shadow-[#3B5BDB]/15'
                    }`}
                  >
                    <Mic size={14} className={listening ? "animate-bounce" : ""} />
                    <span>{listening ? 'إنهاء وتحليل الآن ⚡' : 'إدخال صوتي 🎙️'}</span>
                  </button>
                </div>
              </div>

              {showApiKeySetting && (
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 transition-all" dir="rtl">
                  <div className="flex-1 space-y-1">
                    <label className="block text-xs font-black text-[#1C1C2E]">مفتاح API الخاص بـ Gemini (مخزن محلياً وآمن 🔒):</label>
                    <p className="text-[10px] text-gray-500 font-bold">يتم تخزين المفتاح بأمان وسرية تامة داخل متصفحك الشخصي فقط لتشغيل ميزة الفاتورة الصوتية.</p>
                  </div>
                  <div className="flex items-center gap-2 min-w-[280px] md:min-w-[350px]">
                    <input
                      type="password"
                      placeholder="أدخل مفتاح AIzaSy..."
                      className="w-full text-right p-2.5 border-2 border-[#1C1C2E] rounded-xl text-xs outline-none bg-white font-mono"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        saveGeminiApiKey(apiKeyInput);
                        setHasApiKey(!!apiKeyInput.trim());
                        showSuccess("تم حفظ مفتاح API بنجاح! 🎉", "يمكنك الآن البدء باستخدام ميزة الإدخال والتحليل الصوتي للفواتير مباشرة.");
                        setShowApiKeySetting(false);
                      }}
                      className="whitespace-nowrap bg-green-600 hover:bg-green-700 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-md transition-all"
                    >
                      حفظ المفتاح
                    </button>
                  </div>
                </div>
              )}
              <div className="bg-white rounded-none border-2 border-[#1C1C2E] shadow-sm overflow-hidden mb-6">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-[#EEF2FF] border-b-[3px] border-[#1C1C2E] text-[#1C1C2E]">
                      <th className="p-2 md:p-3 border-l-[3px] border-[#1C1C2E] text-[10px] md:text-xs font-black w-[35%]">البيان</th>
                      <th className="p-2 md:p-3 border-l-[3px] border-[#1C1C2E] text-[10px] md:text-xs font-black w-[15%]">الوحدة</th>
                      <th className="p-2 md:p-3 border-l-[3px] border-[#1C1C2E] text-[10px] md:text-xs font-black w-[10%]">العدد</th>
                      <th className="p-2 md:p-3 border-l-[3px] border-[#1C1C2E] text-[10px] md:text-xs font-black w-[20%]">الافرادي</th>
                      <th className="p-2 md:p-3 text-[10px] md:text-xs font-black w-[20%]">الاجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.id} className="border-b-[1.5px] border-[#1C1C2E]/20 hover:bg-gray-50 transition-colors group">
                        <td className="p-0 border-l-[3px] border-[#1C1C2E] relative">
                           <input type="text" className="w-full h-full min-h-[40px] md:min-h-[48px] p-2 md:p-3 text-right pr-2 md:pr-4 outline-none bg-transparent font-black text-xs md:text-sm text-[#1C1C2E]" value={item.name} onChange={(e) => { const newItems = [...items]; newItems[idx].name = e.target.value; setItems(newItems); }} />
                           <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setItems(items.filter((_, i) => i !== idx)); }} className="absolute text-red-500 left-1 md:left-3 top-1/2 -translate-y-1/2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity bg-white p-1 rounded-md shadow-sm border border-red-100 z-10"><Trash2 size={14}/></button>
                        </td>
                        <td className="p-0 border-l-[3px] border-[#1C1C2E]">
                           <input type="text" className="w-full h-full min-h-[40px] md:min-h-[48px] p-2 md:p-3 text-center outline-none bg-transparent font-black text-xs md:text-sm text-[#1C1C2E]" value={item.unit || ''} onChange={(e) => { const newItems = [...items]; newItems[idx].unit = e.target.value; setItems(newItems); }} />
                        </td>
                        <td className="p-0 border-l-[3px] border-[#1C1C2E]">
                           <input type="number" className="w-full h-full min-h-[40px] md:min-h-[48px] p-2 md:p-3 text-center outline-none bg-transparent font-black text-[#1C1C2E] text-xs md:text-sm" value={item.quantity === undefined ? '' : item.quantity} onChange={(e) => { const newItems = [...items]; const val = e.target.value; newItems[idx].quantity = val === '' ? ('' as any) : Number(val); newItems[idx].total = val === '' ? ('' as any) : newItems[idx].price * Number(val); setItems(newItems); }} />
                        </td>
                        <td className="p-0 border-l-[3px] border-[#1C1C2E]">
                           <input type="number" step="0.001" className="w-full h-full min-h-[40px] md:min-h-[48px] p-2 md:p-3 text-center outline-none bg-transparent font-black text-[#1C1C2E] text-xs md:text-sm" value={item.price === undefined ? '' : item.price} onChange={(e) => { const newItems = [...items]; const val = e.target.value; newItems[idx].price = val === '' ? ('' as any) : Number(val); newItems[idx].total = val === '' ? ('' as any) : Number(val) * (Number(newItems[idx].quantity) || 1); setItems(newItems); }} />
                        </td>
                        <td className="p-0">
                           <input type="number" step="0.001" className="w-full h-full min-h-[40px] md:min-h-[48px] p-2 md:p-3 text-center outline-none bg-transparent font-black text-[#1C1C2E] text-xs md:text-sm" value={item.total === undefined ? '' : item.total} onChange={(e) => { const newItems = [...items]; const val = e.target.value; newItems[idx].total = val === '' ? ('' as any) : Number(val); setItems(newItems); }} />
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50/50">
                      <td className="p-0 border-l-[3px] border-[#1C1C2E]">
                         <input list="saved-products-list" type="text" placeholder="البيان..." className="w-full p-2 md:p-3 text-right pr-2 md:pr-3 outline-none bg-transparent font-black text-xs md:text-sm text-[#1C1C2E]" value={currentItem.name || ''} onChange={(e) => setCurrentItem({...currentItem, name: e.target.value})} onKeyDown={(e) => { if(e.key === 'Enter') addItem(); }} />
                         <datalist id="saved-products-list">
                            {savedProducts.map((p, i) => <option key={i} value={p} />)}
                         </datalist>
                      </td>
                      <td className="p-0 border-l-[3px] border-[#1C1C2E]">
                         <input list="saved-units-list" type="text" placeholder="الوحدة" className="w-full p-2 md:p-3 text-center outline-none bg-transparent font-black text-xs md:text-sm text-[#1C1C2E]" value={currentItem.unit || ''} onChange={(e) => setCurrentItem({...currentItem, unit: e.target.value})} onKeyDown={(e) => { if(e.key === 'Enter') addItem(); }} />
                         <datalist id="saved-units-list">
                            {savedUnits.map((u, i) => <option key={i} value={u} />)}
                         </datalist>
                      </td>
                      <td className="p-0 border-l-[3px] border-[#1C1C2E]">
                        <input type="number" placeholder="العدد" className="w-full p-2 md:p-3 text-center outline-none bg-transparent font-black text-[#1C1C2E] text-xs md:text-sm" value={currentItem.quantity === undefined ? '' : currentItem.quantity} min={1} onChange={(e) => { const val = e.target.value; const qty = val === '' ? ('' as any) : Number(val); setCurrentItem({...currentItem, quantity: qty, total: val === '' ? ('' as any) : (currentItem.price || 0) * qty}); }} onKeyDown={(e) => { if(e.key === 'Enter') addItem(); }} />
                      </td>
                      <td className="p-0 border-l-[3px] border-[#1C1C2E]">
                        <input type="number" step="0.001" placeholder="الافرادي" className="w-full p-2 md:p-3 text-center outline-none bg-transparent font-black text-[#3B5BDB] placeholder:text-[#3B5BDB]/40 text-xs md:text-sm" value={currentItem.price === undefined ? '' : currentItem.price} onChange={(e) => { const val = e.target.value; const price = val === '' ? ('' as any) : Number(val); setCurrentItem({...currentItem, price, total: val === '' ? ('' as any) : price * (Number(currentItem.quantity) || 1)}); }} onKeyDown={(e) => { if(e.key === 'Enter') addItem(); }} />
                      </td>
                      <td className="p-0">
                         <input type="number" step="0.001" placeholder="الاجمالي" className="w-full p-2 md:p-3 text-center outline-none bg-transparent font-black text-[#1C1C2E] text-xs md:text-sm" value={currentItem.total === undefined ? '' : currentItem.total} onChange={(e) => { const val = e.target.value; setCurrentItem({...currentItem, total: val === '' ? ('' as any) : Number(val)}); }} onKeyDown={(e) => { if(e.key === 'Enter') addItem(); }} />
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="p-0 border-t-[3px] border-[#1C1C2E]">
                        <button onClick={(e) => { e.preventDefault(); addItem(); }} className="w-full py-3 bg-[#EEF2FF] hover:bg-[#3B5BDB] text-[#3B5BDB] hover:text-white transition-all active:scale-95 duration-100 flex items-center justify-center gap-2 font-black text-sm">
                          <Plus size={18} />
                          <span>إضافة الصنف للفاتورة</span>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="border-t-[3px] border-[#1C1C2E] bg-gray-50">
                       <td colSpan={3} className="p-3 md:p-4 text-left pl-4 md:pl-6 font-black text-[10px] md:text-xs text-[#1C1C2E] border-l-[3px] border-[#1C1C2E]">المجموع</td>
                       <td className="p-3 md:p-4 font-black text-[#3B5BDB] text-sm md:text-xl">{totalInvoiceAmount.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Payment Info & Actions */}
              <div className="bg-white p-6 md:p-8 rounded-[32px] border border-gray-100 flex flex-col md:flex-row items-center gap-6 md:gap-8 shadow-sm">
                <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">المبلغ المورد (الواصل)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        placeholder="0.00"
                        className="w-full p-4 text-xl rounded-xl border-2 border-gray-50 bg-gray-50 focus:bg-white focus:border-[#2F9E44] outline-none font-black text-[#2F9E44] transition-all"
                        value={paidAmountOnInvoice || ''}
                        onChange={(e) => setPaidAmountOnInvoice(Number(e.target.value))}
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2F9E44]/50 font-bold text-sm">د.أ</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">ملاحظات إضافية</label>
                    <input 
                      className="w-full p-4 rounded-xl border-2 border-gray-50 bg-gray-50 focus:bg-white focus:border-[#3B5BDB] outline-none font-bold text-sm transition-all"
                      placeholder="اكتب ملاحظاتك هنا..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="w-full md:w-auto shrink-0 space-y-4 md:border-r md:border-gray-100 md:pr-8 md:pl-2">
                   <div className="text-center md:text-right">
                     <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">
                       {paidAmountOnInvoice > totalInvoiceAmount ? 'رصيد دائن للزبون (دفع زيادة)' : 'المتبقي للحساب'}
                     </p>
                     <p className={`text-3xl font-black ${paidAmountOnInvoice > totalInvoiceAmount ? 'text-[#2F9E44]' : 'text-[#1C1C2E]'}`}>
                       {Math.abs(totalInvoiceAmount - paidAmountOnInvoice).toLocaleString()} <span className="text-sm">د.أ</span>
                     </p>
                   </div>
                   <button 
                     onClick={() => {
                       if (!selectedCustomerId || (items.length === 0 && !currentItem.name)) return;
                       handleSaveInvoice();
                     }}
                     className="w-full py-4 px-8 rounded-xl font-black text-sm text-white bg-[#3B5BDB] hover:bg-[#364FC7] shadow-xl shadow-[#3B5BDB]/20 flex items-center justify-center gap-2 transition-all active:scale-95 duration-100 disabled:opacity-50"
                     disabled={isSaving || !selectedCustomerId || (items.length === 0 && !currentItem.name)}
                   >
                     {isSaving ? (
                       <span className="animate-pulse">جاري الحفظ...</span>
                     ) : (
                       <>
                         <Check size={20} strokeWidth={4} />
                         <span>{activeTransactionId ? 'حفظ التعديلات' : 'إصدار الفاتورة'}</span>
                       </>
                     )}
                   </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-10 rounded-3xl border-2 border-[#EBFBEE] text-center space-y-8 animate-in zoom-in duration-300">
              <div className="bg-[#EBFBEE] w-20 h-20 rounded-3xl flex items-center justify-center mx-auto text-[#2F9E44] shadow-sm rotate-3">
                <Banknote size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-[#1C1C2E]">بيانات سند القبض</h3>
                <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">قم بتسجيل المبلغ المستلم من الزبون</p>
              </div>
              <div className="max-w-md mx-auto space-y-6">
                <div className="relative group">
                  <input 
                    type="number" 
                    placeholder="0.00"
                    className="w-full py-6 text-center text-4xl font-black text-[#2F9E44] bg-gray-50 rounded-2xl border-2 border-gray-100 focus:border-[#2F9E44] focus:bg-white outline-none shadow-sm transition-all"
                    value={paymentAmount || ''}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    autoFocus
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2F9E44] font-black text-lg">د.أ</div>
                </div>
                <input 
                  type="text" 
                  placeholder="بيان السند (مثلاً: دفعة من الحساب)"
                  className="w-full p-4 rounded-xl border-2 border-gray-50 bg-gray-50 focus:bg-white outline-none font-bold text-center text-sm transition-all"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />

                {/* طريقة الدفع */}
                <div className="flex gap-2 p-1 bg-gray-50 rounded-2xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`flex-1 py-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${paymentMethod === 'cash' ? 'bg-[#2F9E44] text-white shadow-md' : 'text-gray-400 hover:text-gray-600 bg-white'}`}
                  >
                    💵 قبض نقدي
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cheque')}
                    className={`flex-1 py-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${paymentMethod === 'cheque' ? 'bg-[#3B5BDB] text-white shadow-md' : 'text-gray-400 hover:text-gray-600 bg-white'}`}
                  >
                    ✍️ شيك بنكي
                  </button>
                </div>

                {paymentMethod === 'cheque' && (
                  <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-2xl text-right space-y-4 animate-in slide-in-from-top-2 duration-300">
                    <p className="text-xs font-black text-[#3B5BDB] mb-1">تفاصيل الشيك البنكي:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 mb-1">رقم الشيك</label>
                        <input 
                          type="text" 
                          placeholder="أدخل رقم الشيك"
                          className="w-full p-3 rounded-xl border border-gray-200 focus:border-[#3B5BDB] focus:bg-white bg-white outline-none font-bold text-sm transition-all text-center"
                          value={chequeNumber}
                          onChange={(e) => setChequeNumber(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 mb-1">البنك المسحوب عليه</label>
                        <input 
                          type="text" 
                          placeholder="اسم البنك"
                          className="w-full p-3 rounded-xl border border-gray-200 focus:border-[#3B5BDB] focus:bg-white bg-white outline-none font-bold text-sm transition-all text-center"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 mb-1">تاريخ الاستحقاق</label>
                        <input 
                          type="date" 
                          className="w-full p-3 rounded-xl border border-gray-200 focus:border-[#3B5BDB] focus:bg-white bg-white outline-none font-bold text-sm transition-all text-center"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 mb-1">حالة الشيك</label>
                        <select 
                          className="w-full p-3 rounded-xl border border-gray-200 focus:border-[#3B5BDB] focus:bg-white bg-white outline-none font-bold text-sm transition-all text-center"
                          value={chequeStatus}
                          onChange={(e) => setChequeStatus(e.target.value as any)}
                        >
                          <option value="pending">⏳ قيد الانتظار</option>
                          <option value="cashed">✅ تم تحصيله (مقبول)</option>
                          <option value="bounced">❌ مرتجع (مدين)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
                <button 
                  onClick={() => {
                    if (!selectedCustomerId || paymentAmount <= 0) return;
                    handleSavePayment();
                  }}
                  className="w-full py-4 px-8 rounded-xl font-black text-sm text-white bg-[#2F9E44] hover:bg-[#2B8A3E] shadow-xl shadow-[#2F9E44]/20 flex items-center justify-center gap-2 transition-all active:scale-95 duration-100 disabled:opacity-50 mt-4"
                  disabled={isSaving || !selectedCustomerId || paymentAmount <= 0}
                >
                  {isSaving ? (
                     <span className="animate-pulse">جاري الحفظ...</span>
                  ) : (
                     <>
                        <Check size={20} strokeWidth={4} />
                        <span>{activeTransactionId ? 'حفظ التعديلات' : 'تأكيد القبض'}</span>
                     </>
                  )}
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default TransactionForm;
