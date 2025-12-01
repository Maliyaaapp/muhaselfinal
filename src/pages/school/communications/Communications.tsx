import React, { useState, useEffect } from 'react';
import { Send, MessageSquare, RefreshCw, AlertCircle, Download, AlertTriangle, X, Users, FileText, Plus, Search, CheckSquare, History, Sparkles } from 'lucide-react';
import { Trash2 } from 'lucide-react';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import { CURRENCY } from '../../../utils/constants';
import * as hybridApiMessages from '../../../services/hybridApi';
import * as hybridApi from '../../../services/hybridApi';
import whatsappService from '../../../services/whatsapp';
import { formatDate } from '../../../utils/formatters';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/Dialog';

interface Student { id: string; name: string; grade: string; parentName: string; phone: string; }
interface Fee { id: string; studentId: string; studentName: string; amount: number; balance: number; feeType: string; status: 'paid' | 'partial' | 'unpaid'; }
interface Installment { id: string; studentId: string; studentName: string; amount: number; dueDate: string; status: string; feeType: string; paidAmount?: number; }
interface Message { id: string; studentId: string; studentName: string; grade: string; parentName: string; phone: string; recipient: string; template: string; message: string; sentAt: string; status: 'delivered' | 'failed' | 'pending'; schoolId: string; messageType?: 'admin_notification' | 'school_communication'; }
interface MessageTemplate { id: string; name: string; message: string; }

const Communications = () => {
  const { user } = useSupabaseAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [selectedStudentFees, setSelectedStudentFees] = useState<Fee[]>([]);
  const [selectedStudentInstallments, setSelectedStudentInstallments] = useState<Installment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [previewAmount, setPreviewAmount] = useState(0);
  const [previewDate, setPreviewDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeFinancialTab, setActiveFinancialTab] = useState<'fees' | 'installments' | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [studentPage, setStudentPage] = useState(1);
  const studentsPerPage = 10;
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [selectAllMessages, setSelectAllMessages] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<MessageTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateMessage, setNewTemplateMessage] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  const getFeeTypeLabel = (type: string) => { if (!type) return ''; if (type === 'transportation_and_tuition') return 'رسوم مدمجة'; if (type === 'tuition') return 'رسوم دراسية'; if (type === 'transportation') return 'نقل مدرسي'; return type; };
  const getInstallmentStatusLabel = (status: string) => { switch (status) { case 'paid': return 'مدفوع'; case 'partial': return 'جزئي'; case 'upcoming': return 'قادم'; case 'overdue': return 'متأخر'; default: return status; } };
  const getInstallmentStatusColor = (status: string) => { switch (status) { case 'paid': return 'bg-emerald-100 text-emerald-700'; case 'partial': return 'bg-amber-100 text-amber-700'; case 'upcoming': return 'bg-blue-100 text-blue-700'; case 'overdue': return 'bg-red-100 text-red-700'; default: return 'bg-gray-100 text-gray-700'; } };
  
  const messageTemplates: MessageTemplate[] = [
    { id: '1', name: 'تذكير بموعد القسط', message: 'الفاضل ولي الامر المحترم\n\nنود افادتكم بموعد سداد القسط المستحق على الطالب اسم الطالب و البالغ قدره المبلغ ريال عماني بتاريخ التاريخ.\n\nشاكرين لكم تعاونكم' },
    { id: '2', name: 'إشعار بتأخر سداد', message: 'الفاضل ولي الامر المحترم\n\nنود افادتكم بأن القسط المستحق على الطالب اسم الطالب بمبلغ المبلغ ريال عماني قد تأخر سداده.\n\nشاكرين لكم تعاونكم' },
    { id: '3', name: 'تأكيد استلام الدفعة', message: 'الفاضل ولي الامر المحترم\n\nنشكركم على سداد الدفعة المستحقة للطالب اسم الطالب بمبلغ المبلغ ريال عماني بتاريخ التاريخ.\n\nشاكرين لكم تعاونكم' },
    { id: '4', name: 'معلومات عامة', message: 'الفاضل ولي الامر المحترم\n\nنود إعلامكم بخصوص الطالب اسم الطالب، بأن هناك معلومات هامة.\n\nشاكرين لكم تعاونكم' },
    { id: '5', name: 'تذكير بالرسوم الدراسية', message: 'الفاضل ولي الامر المحترم\n\nنود افادتكم بموعد سداد الرسوم الدراسية المستحقة على الطالب اسم الطالب و البالغ قدرها المبلغ ريال عماني.\n\nشاكرين لكم تعاونكم' },
    { id: '6', name: 'اشعار بتأخر سداد الرسوم الدراسية', message: 'الفاضل ولي الامر المحترم\n\nنود افادتكم بأن الرسوم المستحقة على الطالب اسم الطالب بمبلغ المبلغ ريال عماني قد تأخر سداده.\n\nشاكرين لكم تعاونكم' },
  ];

  const convertTemplateToArabicDisplay = (text: string): string => { const map: Record<string, string> = { '{{name}}': 'اسم الطالب', '{{amount}}': 'المبلغ', '{{date}}': 'التاريخ', '{{parent}}': 'ولي الأمر', '{{grade}}': 'الصف' }; let result = text; Object.entries(map).forEach(([k, v]) => { result = result.replace(new RegExp(k.replace(/[{}]/g, '\\$&'), 'g'), v); }); return result; };
  const convertArabicVariablesToTemplate = (text: string): string => { const map: Record<string, string> = { 'اسم الطالب': '{{name}}', 'المبلغ': '{{amount}}', 'التاريخ': '{{date}}', 'ولي الأمر': '{{parent}}', 'الصف': '{{grade}}' }; let result = text; Object.entries(map).forEach(([k, v]) => { result = result.replace(new RegExp(k, 'g'), v); }); return result; };
  const getStatusLabel = (status: string) => { switch (status) { case 'delivered': return 'تم التسليم'; case 'failed': return 'فشل'; case 'pending': return 'قيد الإرسال'; default: return status; } };
  const getStatusColor = (status: string) => { switch (status) { case 'delivered': return 'bg-emerald-100 text-emerald-700 border-emerald-200'; case 'failed': return 'bg-red-100 text-red-700 border-red-200'; case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200'; default: return 'bg-gray-100 text-gray-700 border-gray-200'; } };
  const getSourceLabel = (message: Message) => { if (message.messageType === 'admin_notification') return 'الاشتراكات'; const t = (message.template || '').trim(); if (t.includes('اشتراك')) return 'الاشتراكات'; if (t.includes('القسط')) return 'الأقساط'; if (t.includes('الرسوم')) return 'الرسوم'; return 'الاتصالات'; };
  const filteredBySearch = messageSearch.trim() ? messages.filter(m => (m.studentName || '').toLowerCase().includes(messageSearch.trim().toLowerCase())) : messages;
  const grades = ['all', ...Array.from(new Set(students.map(student => student.grade)))];
  const visibleStudents = (studentSearch.trim() ? filteredStudents.filter(s => (s.name || '').toLowerCase().includes(studentSearch.trim().toLowerCase())) : filteredStudents);
  const totalStudentPages = Math.max(1, Math.ceil(visibleStudents.length / studentsPerPage));
  const paginatedStudents = visibleStudents.slice((studentPage - 1) * studentsPerPage, studentPage * studentsPerPage);


  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const studentsResponse = user?.role === 'gradeManager' && user?.gradeLevels?.length ? await hybridApi.getStudents(user?.schoolId || '', user.gradeLevels) : await hybridApi.getStudents(user?.schoolId || '');
        if (studentsResponse.success && studentsResponse.data) setStudents(studentsResponse.data);
        const messagesResponse = await hybridApiMessages.getMessages(user?.schoolId || '', undefined, user?.role === 'gradeManager' && user?.gradeLevels?.length ? user.gradeLevels : undefined);
        if (messagesResponse?.success && messagesResponse?.data) setMessages(messagesResponse.data);
        const feesResponse = await hybridApi.getFees(user?.schoolId, undefined, user?.role === 'gradeManager' && user?.gradeLevels?.length ? user.gradeLevels : undefined);
        if (feesResponse?.success && feesResponse?.data) {
          let fetchedFees = feesResponse.data;
          const studentsWithCombined = new Set((fetchedFees || []).filter((fee: Fee) => fee.feeType === 'transportation_and_tuition').map((fee: Fee) => fee.studentId));
          setFees((fetchedFees || []).filter((fee: Fee) => { if (studentsWithCombined.has(fee.studentId)) return fee.feeType !== 'tuition' && fee.feeType !== 'transportation'; return true; }));
        }
        const installmentsResponse = await hybridApi.getInstallments(user?.schoolId, undefined, undefined, user?.role === 'gradeManager' && user?.gradeLevels?.length ? user.gradeLevels : undefined);
        if (installmentsResponse?.success && installmentsResponse?.data) setInstallments(installmentsResponse.data);
        setIsLoadingTemplates(true);
        const templatesResponse = await hybridApiMessages.getTemplates(user?.schoolId);
        if (templatesResponse?.success && templatesResponse?.data) setCustomTemplates(templatesResponse.data.map((t: any) => ({ id: t.id, name: t.name, message: convertTemplateToArabicDisplay(t.content) })));
        setIsLoadingTemplates(false);
      } catch { setError('حدث خطأ أثناء تحميل البيانات'); } finally { setIsLoading(false); }
    };
    loadData();
  }, [user]);

  useEffect(() => { if (selectedGrade === 'all') setFilteredStudents(students); else setFilteredStudents(students.filter(student => student.grade === selectedGrade)); }, [selectedGrade, students]);
  useEffect(() => { if (selectAll) setSelectedStudents(visibleStudents.map(student => student.id)); else setSelectedStudents([]); }, [selectAll, filteredStudents, studentSearch]);
  useEffect(() => { if (user?.schoolId) { const stored = localStorage.getItem(`customTemplates_${user.schoolId}`); if (stored) setCustomTemplates(JSON.parse(stored)); } }, [user?.schoolId]);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateId = e.target.value;
    setSelectedTemplate(templateId);
    if (templateId) {
      const predefinedTemplate = messageTemplates.find(t => t.id === templateId);
      const customTemplate = customTemplates.find(t => t.id === templateId);
      if (predefinedTemplate) setMessageText(predefinedTemplate.message);
      else if (customTemplate) setMessageText(customTemplate.message);
    } else setMessageText('');
  };

  const insertVariable = (variable: string) => { const variableMap: Record<string, string> = { '{{name}}': 'اسم الطالب', '{{amount}}': 'المبلغ', '{{date}}': 'التاريخ', '{{parent}}': 'ولي الأمر', '{{grade}}': 'الصف' }; setNewTemplateMessage(prev => prev + (variableMap[variable] || variable)); };

  const handleSaveTemplate = async () => {
    if (!newTemplateName || !newTemplateMessage) { setError('الرجاء إدخال اسم ونص القالب'); return; }
    try {
      setIsLoadingTemplates(true);
      const templateData = { id: editingTemplateId || uuidv4(), name: newTemplateName, content: convertArabicVariablesToTemplate(newTemplateMessage), type: 'message', school_id: user?.schoolId };
      const saveResponse = await hybridApiMessages.createTemplate(templateData);
      if (!saveResponse?.success) throw new Error('Failed');
      const newTemplate: MessageTemplate = { id: templateData.id, name: templateData.name, message: newTemplateMessage };
      const updatedTemplates = editingTemplateId ? customTemplates.map(t => t.id === editingTemplateId ? newTemplate : t) : [...customTemplates, newTemplate];
      setCustomTemplates(updatedTemplates);
      localStorage.setItem(`customTemplates_${user?.schoolId}`, JSON.stringify(updatedTemplates));
      setNewTemplateName(''); setNewTemplateMessage(''); setEditingTemplateId(null); setShowTemplateEditor(false);
      toast.success('تم حفظ القالب بنجاح');
    } catch { setError('حدث خطأ أثناء حفظ القالب'); } finally { setIsLoadingTemplates(false); }
  };

  const handleEditTemplate = (template: MessageTemplate) => { setNewTemplateName(template.name); setNewTemplateMessage(template.message); setEditingTemplateId(template.id); setShowTemplateEditor(true); };
  const handleDeleteTemplate = async (templateId: string) => { if (window.confirm('هل أنت متأكد من حذف هذا القالب؟')) { try { setIsLoadingTemplates(true); const deleteResponse = await hybridApiMessages.deleteTemplate(templateId); if (deleteResponse?.success) { const updatedTemplates = customTemplates.filter(t => t.id !== templateId); setCustomTemplates(updatedTemplates); localStorage.setItem(`customTemplates_${user?.schoolId}`, JSON.stringify(updatedTemplates)); toast.success('تم حذف القالب بنجاح'); } else toast.error('فشل حذف القالب'); } catch { toast.error('حدث خطأ أثناء حذف القالب'); } finally { setIsLoadingTemplates(false); } } };

  const handleStudentSelection = (id: string) => {
    if (selectedStudents.includes(id)) {
      setSelectedStudents(selectedStudents.filter(studentId => studentId !== id));
      setSelectAll(false);
      if (selectedStudents.length <= 1) { setSelectedStudentFees([]); setSelectedStudentInstallments([]); }
    } else {
      setSelectedStudents([...selectedStudents, id]);
      if (selectedStudents.length === 0) {
        const studentFees = fees.filter(fee => fee.studentId === id && (fee.status === 'unpaid' || fee.status === 'partial'));
        setSelectedStudentFees(studentFees);
        const studentInstallments = installments.filter(inst => inst.studentId === id && (inst.status === 'overdue' || inst.status === 'upcoming' || inst.status === 'partial'));
        setSelectedStudentInstallments(studentInstallments);
        if (studentFees.length > 0) { setPreviewAmount(studentFees.reduce((sum, fee) => sum + (fee.balance || 0), 0)); setActiveFinancialTab('fees'); }
        else if (studentInstallments.length > 0) { setPreviewAmount(studentInstallments[0].status === 'partial' ? (studentInstallments[0].amount - (studentInstallments[0].paidAmount || 0)) : studentInstallments[0].amount); setActiveFinancialTab('installments'); }
      }
      if (selectedStudents.length + 1 === visibleStudents.length) setSelectAll(true);
    }
  };

  const handleSendMessages = async () => {
    if (!messageText) { setError('يرجى إدخال نص الرسالة'); return; }
    if (selectedStudents.length === 0) { setError('يرجى اختيار طالب واحد على الأقل'); return; }
    setIsSending(true); setError(null);
    if (!navigator.onLine) toast.error('أنت حالياً غير متصل بالإنترنت.', { duration: 5000, icon: '⚠️' });
    try {
      const toastId = toast.loading(`جاري إرسال ${selectedStudents.length} رسالة...`, { position: 'top-center' });
      const promises = selectedStudents.map(async (studentId) => {
        const student = students.find(s => s.id === studentId);
        if (!student) return null;
        const templateMessage = convertArabicVariablesToTemplate(messageText);
        let finalMessage = templateMessage.replace(/{{name}}/g, student.name).replace(/{{amount}}/g, previewAmount.toString()).replace(/{{date}}/g, formatDate(previewDate)).replace(/{{grade}}/g, student.grade || '').replace(/{{parent}}/g, student.parentName || '');
        const message = { studentId: student.id, studentName: student.name, grade: student.grade, parentName: student.parentName, phone: student.phone, recipient: student.phone, template: selectedTemplate, message: finalMessage, sentAt: new Date().toISOString(), status: 'pending' as 'pending', schoolId: user?.schoolId || '', sentBy: user?.name || user?.email || 'Unknown', sentByRole: user?.role || 'unknown', sentByEmail: user?.email || '' };
        const saveMessageResponse = await hybridApiMessages.createMessage(message);
        const savedMessage = saveMessageResponse?.success ? saveMessageResponse.data : message;
        if (!saveMessageResponse?.success) return { success: false };
        if (navigator.onLine) {
          try {
            const response = await whatsappService.sendWhatsAppMessage(student.phone, finalMessage);
            if (savedMessage.id) { if (response && response.success) await hybridApiMessages.updateMessage(savedMessage.id, { ...savedMessage, status: 'delivered' as 'delivered' }); else await hybridApiMessages.updateMessage(savedMessage.id, { ...savedMessage, status: 'failed' as 'failed' }); }
            return response;
          } catch { if (savedMessage.id) await hybridApiMessages.updateMessage(savedMessage.id, { ...savedMessage, status: 'failed' as 'failed' }); return { success: false }; }
        } else return { success: true, pendingOffline: true };
      });
      const results = await Promise.all(promises);
      const successCount = results.filter(r => r && r.success).length;
      const messagesResponse = await hybridApiMessages.getMessages(user?.schoolId || '', undefined, user?.role === 'gradeManager' && user?.gradeLevels?.length ? user.gradeLevels : undefined);
      if (messagesResponse?.success && messagesResponse?.data) setMessages(messagesResponse.data);
      toast.success(`تم إرسال ${successCount} من ${selectedStudents.length} رسالة بنجاح`, { id: toastId, duration: 3000 });
      setSelectedStudents([]); if (!showTemplateEditor) { setMessageText(''); setSelectedTemplate(''); }
    } catch { setError('حدث خطأ أثناء إرسال الرسائل'); toast.error('حدث خطأ أثناء إرسال الرسائل'); } finally { setIsSending(false); }
  };

  const getMessagePreview = () => {
    if (!messageText || selectedStudents.length === 0) return '';
    const student = students.find(s => s.id === selectedStudents[0]);
    if (!student) return messageText;
    return convertArabicVariablesToTemplate(messageText).replace(/{{name}}/g, student.name).replace(/{{amount}}/g, previewAmount.toString()).replace(/{{date}}/g, formatDate(previewDate)).replace(/{{grade}}/g, student.grade || '').replace(/{{parent}}/g, student.parentName || '');
  };

  const handleDeleteMessages = async () => { if (selectedMessages.length === 0) { toast.error('يرجى اختيار رسائل للحذف'); return; } if (!window.confirm(`هل أنت متأكد من حذف ${selectedMessages.length} رسالة؟`)) return; try { const toastId = toast.loading(`جاري حذف ${selectedMessages.length} رسالة...`); for (const messageId of selectedMessages) await hybridApiMessages.deleteMessage(messageId); setMessages(prev => prev.filter(m => !selectedMessages.includes(m.id))); setSelectedMessages([]); setSelectAllMessages(false); toast.success(`تم حذف ${selectedMessages.length} رسالة بنجاح`, { id: toastId }); } catch { toast.error('حدث خطأ أثناء حذف الرسائل'); } };
  const handleSelectAllMessages = () => { if (selectAllMessages) { setSelectedMessages([]); setSelectAllMessages(false); } else { setSelectedMessages(filteredBySearch.map(m => m.id)); setSelectAllMessages(true); } };
  const handleToggleMessage = (messageId: string) => { setSelectedMessages(prev => prev.includes(messageId) ? prev.filter(id => id !== messageId) : [...prev, messageId]); };
  const handleExportMessages = () => { if (messages.length === 0) { toast.error('لا توجد رسائل للتصدير'); return; } const headers = ['اسم الطالب', 'الصف', 'رقم الهاتف', 'نوع الرسالة', 'محتوى الرسالة', 'تاريخ الإرسال', 'الحالة']; const csvRows = [headers.join(','), ...messages.map(message => { const cleanMessage = (message.message || '').replace(/"/g, '""').replace(/[\r\n]/g, ' ').trim(); return [`"${message.studentName || ''}"`, `"${message.grade || ''}"`, `"${message.phone || ''}"`, `"${message.template || ''}"`, `"${cleanMessage}"`, `"${formatDate(message.sentAt)}"`, `"${getStatusLabel(message.status)}"`].join(','); })]; const blob = new Blob(["\uFEFF" + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'سجل_المراسلات.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); };

  if (isLoading) return (<div className="h-full flex items-center justify-center min-h-[60vh]"><div className="text-center"><div className="animate-spin rounded-full h-16 w-16 border-4 border-[#800000] border-t-transparent mx-auto mb-4"></div><p className="text-gray-600 font-medium">جاري تحميل البيانات...</p></div></div>);


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b border-gray-200/50 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[#800000] p-2.5 rounded-xl shadow-sm">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">المراسلات</h1>
                <p className="text-xs text-gray-500">إرسال رسائل واتساب لأولياء الأمور</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-gray-100 rounded-xl">
                <div className="flex items-center gap-1.5"><div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center"><Users size={14} className="text-blue-600" /></div><span className="font-bold text-gray-800 text-sm">{students.length}</span></div>
                <div className="w-px h-5 bg-gray-300"></div>
                <div className="flex items-center gap-1.5"><div className="w-6 h-6 bg-emerald-100 rounded-md flex items-center justify-center"><MessageSquare size={14} className="text-emerald-600" /></div><span className="font-bold text-gray-800 text-sm">{messages.length}</span></div>
              </div>
              <button onClick={() => setShowTemplateEditor(true)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all shadow-sm text-sm"><Plus size={16} /><span className="hidden sm:inline">القوالب</span></button>
              <button onClick={() => setShowHistoryModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-800 text-white font-medium rounded-lg transition-all shadow-sm text-sm"><History size={16} /><span className="hidden sm:inline">السجل</span>{messages.length > 0 && <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs">{messages.length}</span>}</button>
            </div>
          </div>
        </div>
      </div>

      {error && (<div className="px-4 mt-4"><div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl flex items-center gap-3 shadow-sm"><AlertCircle size={20} className="text-red-500" /><span className="flex-1">{error}</span><button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-lg"><X size={18} /></button></div></div>)}

      {/* Main Content - Full Width */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          {/* Message Composer */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">
            <div className="bg-[#25D366] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 text-white fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </div>
                  <div><h2 className="text-lg font-bold text-white">إرسال رسالة واتساب</h2><p className="text-white/70 text-xs">اختر القالب والطلاب ثم أرسل</p></div>
                </div>
                <span className="bg-white/20 px-3 py-1.5 rounded-lg text-white font-bold text-sm">{selectedStudents.length} محدد</span>
              </div>
            </div>
            <div className="p-4 space-y-3 flex-1 flex flex-col">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5"><Sparkles size={14} className="text-[#25D366]" />اختر قالب الرسالة</label>
                <select value={selectedTemplate} onChange={handleTemplateChange} disabled={isLoadingTemplates} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-all bg-gray-50 hover:bg-white text-sm font-medium">
                  <option value="">-- اختر قالب --</option>
                  <optgroup label="📋 القوالب المدمجة">{messageTemplates.map(template => (<option key={template.id} value={template.id}>{template.name}</option>))}</optgroup>
                  {customTemplates.length > 0 && (<optgroup label="⭐ القوالب المخصصة">{customTemplates.map(template => (<option key={template.id} value={template.id}>{template.name}</option>))}</optgroup>)}
                </select>
              </div>
              <div className="flex-1 flex flex-col">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5"><FileText size={14} className="text-[#25D366]" />نص الرسالة</label>
                <textarea rows={6} value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="أدخل نص الرسالة هنا..." className="w-full flex-1 min-h-[120px] px-3 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-all resize-none text-sm leading-relaxed" />
              </div>
              {/* Inline Fees/Installments Selection */}
              {selectedStudents.length === 1 && (selectedStudentFees.length > 0 || selectedStudentInstallments.length > 0) && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-700">اختر من المستحقات:</span>
                    <div className="flex bg-white rounded border border-gray-200 overflow-hidden">
                      {selectedStudentFees.length > 0 && <button className={`px-2 py-1 text-[10px] font-medium ${activeFinancialTab === 'fees' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`} onClick={() => setActiveFinancialTab('fees')}>الرسوم ({selectedStudentFees.length})</button>}
                      {selectedStudentInstallments.length > 0 && <button className={`px-2 py-1 text-[10px] font-medium ${activeFinancialTab === 'installments' ? 'bg-emerald-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`} onClick={() => setActiveFinancialTab('installments')}>الأقساط ({selectedStudentInstallments.length})</button>}
                    </div>
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {activeFinancialTab === 'fees' && selectedStudentFees.map(fee => (
                      <button key={fee.id} onClick={() => setPreviewAmount(fee.balance)} className="w-full flex justify-between items-center p-1.5 bg-white hover:bg-orange-50 rounded border border-gray-200 text-right text-xs">
                        <span className="font-medium text-gray-800">{getFeeTypeLabel(fee.feeType)}</span>
                        <span className="font-bold text-orange-600">{fee.balance.toLocaleString()} {CURRENCY}</span>
                      </button>
                    ))}
                    {activeFinancialTab === 'installments' && selectedStudentInstallments.map(inst => (
                      <button key={inst.id} onClick={() => { setPreviewAmount(inst.status === 'partial' ? (inst.amount - (inst.paidAmount || 0)) : inst.amount); if (inst.dueDate) setPreviewDate(inst.dueDate); }} className="w-full p-1.5 bg-white hover:bg-emerald-50 rounded border border-gray-200 text-right text-xs">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-gray-800">{getFeeTypeLabel(inst.feeType)}</span>
                            <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${getInstallmentStatusColor(inst.status)}`}>{getInstallmentStatusLabel(inst.status)}</span>
                          </div>
                          <span className="font-bold text-emerald-600">{(inst.status === 'partial' ? (inst.amount - (inst.paidAmount || 0)) : inst.amount).toLocaleString()} {CURRENCY}</span>
                        </div>
                        <div className="text-[9px] text-gray-500 mt-0.5">📅 {inst.dueDate ? formatDate(inst.dueDate) : 'غير محدد'}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">المبلغ</label>
                  <div className="relative">
                    <input type="number" value={previewAmount} onChange={(e) => setPreviewAmount(Number(e.target.value))} min="0" className="w-full pl-14 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-all text-sm" />
                    <span className="absolute left-0 top-0 bottom-0 flex items-center justify-center bg-[#25D366] text-white px-3 rounded-r-lg text-xs font-bold">{CURRENCY}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">التاريخ</label>
                  <input type="date" value={previewDate} onChange={(e) => setPreviewDate(e.target.value)} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-all text-sm" />
                </div>
              </div>
              <button onClick={handleSendMessages} disabled={isSending || !messageText || selectedStudents.length === 0} className={`w-full py-3 rounded-lg font-bold text-base transition-all flex items-center justify-center gap-2 ${isSending || !messageText || selectedStudents.length === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#25D366] hover:bg-[#1da851] text-white shadow-md'}`}>
                {isSending ? (<><div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"></div>جاري الإرسال...</>) : (<><svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>إرسال لـ {selectedStudents.length} طالب</>)}
              </button>
            </div>
          </div>

          {/* Student Selection */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">
            <div className="bg-blue-600 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><Users size={20} className="text-white" /></div>
                  <div><h2 className="text-lg font-bold text-white">اختيار الطلاب</h2><p className="text-white/70 text-xs">{selectedStudents.length} محدد من {visibleStudents.length}</p></div>
                </div>
                <span className="bg-white/20 px-3 py-1.5 rounded-lg text-white font-bold text-sm">{visibleStudents.length}</span>
              </div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={studentSearch} onChange={(e) => { setStudentSearch(e.target.value); setStudentPage(1); }} placeholder="بحث عن طالب..." className="w-full pr-10 pl-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all bg-gray-50 hover:bg-white text-sm" />
                </div>
                <select value={selectedGrade} onChange={(e) => { setSelectedGrade(e.target.value); setStudentPage(1); }} className="px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all bg-gray-50 hover:bg-white font-medium text-sm min-w-[120px]">
                  <option value="all">جميع الصفوف</option>
                  {grades.filter(g => g !== 'all').map(grade => (<option key={grade} value={grade}>{grade}</option>))}
                </select>
              </div>
              
              {/* Select All */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selectAll ? 'bg-blue-600 border-blue-600' : 'border-gray-300 group-hover:border-blue-400'}`}>{selectAll && <CheckSquare size={12} className="text-white" />}</div>
                  <input type="checkbox" checked={selectAll} onChange={() => setSelectAll(!selectAll)} className="sr-only" />
                  <span className="font-medium text-gray-700 text-sm">تحديد الكل</span>
                </label>
                {selectedStudents.length > 0 && (<span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold">{selectedStudents.length} محدد</span>)}
              </div>
              
              {/* Students Grid - 10 per page */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">
                {paginatedStudents.length === 0 ? (
                  <div className="col-span-2 text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3"><Users size={24} className="text-gray-400" /></div>
                    <p className="text-gray-500 font-medium text-sm">لا يوجد طلاب</p>
                  </div>
                ) : (
                  paginatedStudents.map(student => (
                    <div key={student.id} onClick={() => handleStudentSelection(student.id)} className={`relative p-2.5 rounded-lg cursor-pointer transition-all duration-200 ${selectedStudents.includes(student.id) ? 'bg-blue-50 border-2 border-blue-400 shadow-sm' : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100 hover:border-gray-200'}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${selectedStudents.includes(student.id) ? 'bg-blue-600 text-white' : 'bg-white border-2 border-gray-300'}`}>{selectedStudents.includes(student.id) && <CheckSquare size={12} />}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 truncate text-sm">{student.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">{student.grade}</span>
                            <span className="text-[10px] text-gray-500 truncate">{student.phone}</span>
                          </div>
                        </div>
                      </div>
                      {selectedStudents.includes(student.id) && (<div className="absolute top-1.5 left-1.5"><div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div></div>)}
                    </div>
                  ))
                )}
              </div>
              
              {/* Pagination */}
              {visibleStudents.length > studentsPerPage && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">{(studentPage - 1) * studentsPerPage + 1}-{Math.min(studentPage * studentsPerPage, visibleStudents.length)} من {visibleStudents.length}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setStudentPage(p => Math.max(1, p - 1))} disabled={studentPage === 1} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors">السابق</button>
                    <span className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold">{studentPage}</span>
                    <button onClick={() => setStudentPage(p => Math.min(totalStudentPages, p + 1))} disabled={studentPage >= totalStudentPages} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors">التالي</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* Template Editor Modal */}
      {showTemplateEditor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[75vh] overflow-hidden">
            <div className="bg-[#800000] p-3 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><FileText size={18} /><h2 className="text-base font-bold">إدارة القوالب</h2></div>
                <button onClick={() => { setShowTemplateEditor(false); setNewTemplateName(''); setNewTemplateMessage(''); setEditingTemplateId(null); }} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={18} /></button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(75vh-56px)] space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <h3 className="font-semibold text-gray-800 mb-3 text-sm flex items-center gap-2"><Plus size={14} className="text-[#800000]" />{editingTemplateId ? 'تعديل القالب' : 'إنشاء قالب جديد'}</h3>
                <div className="space-y-3">
                  <input type="text" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#800000] text-sm" placeholder="اسم القالب" />
                  <textarea value={newTemplateMessage} onChange={(e) => setNewTemplateMessage(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#800000] resize-none text-sm" rows={3} placeholder="نص الرسالة..." />
                  <div className="flex flex-wrap gap-1.5">
                    {[{ v: '{{name}}', l: 'اسم الطالب' }, { v: '{{amount}}', l: 'المبلغ' }, { v: '{{date}}', l: 'التاريخ' }, { v: '{{parent}}', l: 'ولي الأمر' }, { v: '{{grade}}', l: 'الصف' }].map(item => (
                      <button key={item.v} type="button" onClick={() => insertVariable(item.v)} className="px-2 py-1 bg-white border border-gray-200 hover:border-[#800000] rounded text-xs">{item.l}</button>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => { setNewTemplateName(''); setNewTemplateMessage(''); setEditingTemplateId(null); }} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm">إلغاء</button>
                    <button type="button" onClick={handleSaveTemplate} disabled={isLoadingTemplates} className="px-3 py-1.5 bg-[#800000] text-white rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50">{isLoadingTemplates && <div className="animate-spin h-3 w-3 border-2 border-white rounded-full border-t-transparent"></div>}{editingTemplateId ? 'تحديث' : 'حفظ'}</button>
                  </div>
                </div>
              </div>
              {customTemplates.length > 0 && (<div><h3 className="font-semibold text-gray-800 mb-2 text-sm">القوالب المخصصة</h3><div className="space-y-1.5">{customTemplates.map(template => (<div key={template.id} className="border border-gray-200 rounded-lg p-2.5 bg-white"><div className="flex justify-between items-center mb-1"><h4 className="font-medium text-gray-800 text-sm">{template.name}</h4><div className="flex gap-2"><button onClick={() => handleEditTemplate(template)} className="text-blue-600 text-xs">تعديل</button><button onClick={() => handleDeleteTemplate(template.id)} className="text-red-600 text-xs">حذف</button></div></div><p className="text-xs text-gray-600 line-clamp-1">{template.message}</p></div>))}</div></div>)}
              <div><h3 className="font-semibold text-gray-800 mb-2 text-sm">القوالب المدمجة</h3><div className="space-y-1.5">{messageTemplates.map(template => (<div key={template.id} className="border border-gray-200 rounded-lg p-2.5 bg-gray-50"><h4 className="font-medium text-gray-800 text-sm">{template.name}</h4><p className="text-xs text-gray-600 line-clamp-1">{template.message}</p></div>))}</div></div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
            <div className="bg-gray-800 p-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="w-12 h-12 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center"><History size={24} /></div><div><h2 className="text-xl font-bold">سجل المراسلات</h2><p className="text-white/70 text-sm">{messages.length} رسالة</p></div></div>
                <div className="flex items-center gap-3">
                  <div className="relative"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50" /><input type="text" value={messageSearch} onChange={(e) => setMessageSearch(e.target.value)} placeholder="بحث..." className="w-48 pr-10 pl-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-white/30" /></div>
                  <button onClick={handleExportMessages} className="p-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors" title="تصدير"><Download size={18} /></button>
                  <button onClick={handleDeleteMessages} disabled={selectedMessages.length === 0} className={`p-2.5 rounded-xl transition-colors ${selectedMessages.length > 0 ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 cursor-not-allowed'}`} title="حذف"><Trash2 size={18} /></button>
                  <button onClick={async () => { const resp = await hybridApiMessages.getMessages(user?.schoolId || ''); if (resp?.success && resp?.data) setMessages(resp.data); toast.success('تم التحديث'); }} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors" title="تحديث"><RefreshCw size={18} /></button>
                  <button onClick={() => setShowHistoryModal(false)} className="p-2.5 hover:bg-white/20 rounded-xl transition-colors"><X size={20} /></button>
                </div>
              </div>
            </div>
            <div className="overflow-auto max-h-[calc(90vh-140px)]">
              {messages.length === 0 ? (<div className="p-16 text-center"><div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><MessageSquare size={40} className="text-gray-400" /></div><p className="text-xl font-medium text-gray-600">لا توجد رسائل مرسلة</p><p className="text-gray-500 mt-2">ستظهر الرسائل المرسلة هنا</p></div>) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-4 text-center w-12"><input type="checkbox" checked={selectAllMessages} onChange={handleSelectAllMessages} className="w-4 h-4 text-[#800000] rounded focus:ring-[#800000]" /></th>
                      <th className="px-4 py-4 text-right text-xs font-bold text-gray-600 uppercase">الطالب</th>
                      <th className="px-4 py-4 text-right text-xs font-bold text-gray-600 uppercase">الصف</th>
                      <th className="px-4 py-4 text-right text-xs font-bold text-gray-600 uppercase">الهاتف</th>
                      <th className="px-4 py-4 text-right text-xs font-bold text-gray-600 uppercase">المرسل</th>
                      <th className="px-4 py-4 text-right text-xs font-bold text-gray-600 uppercase">التاريخ</th>
                      <th className="px-4 py-4 text-right text-xs font-bold text-gray-600 uppercase">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => { const sorted = filteredBySearch.slice().reverse(); const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize)); const clampedPage = Math.min(currentPage, totalPages); const start = (clampedPage - 1) * pageSize; return sorted.slice(start, start + pageSize); })().map((message, idx) => (
                      <React.Fragment key={message.id || String(idx)}>
                        <tr className={`hover:bg-gray-50 transition-colors cursor-pointer ${expandedMessageId === message.id ? 'bg-blue-50' : ''}`} onClick={() => setExpandedMessageId(expandedMessageId === message.id ? null : message.id)}>
                          <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedMessages.includes(message.id)} onChange={() => handleToggleMessage(message.id)} className="w-4 h-4 text-[#800000] rounded focus:ring-[#800000]" /></td>
                          <td className="px-4 py-4"><span className="font-semibold text-gray-800">{message.studentName}</span></td>
                          <td className="px-4 py-4"><span className="inline-flex items-center px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">{message.grade}</span></td>
                          <td className="px-4 py-4"><span className="text-gray-600 font-mono text-sm">{message.phone}</span></td>
                          <td className="px-4 py-4"><span className="font-medium text-gray-700">{(message as any).sentBy || (message as any).sent_by || 'غير محدد'}</span></td>
                          <td className="px-4 py-4"><span className="text-gray-600 text-sm">{formatDate(message.sentAt)}</span></td>
                          <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${getStatusColor(message.status)}`}><span className={`w-2 h-2 rounded-full ${message.status === 'delivered' ? 'bg-emerald-500' : message.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'}`}></span>{getStatusLabel(message.status)}</span></td>
                        </tr>
                        {expandedMessageId === message.id && (
                          <tr className="bg-gray-50"><td colSpan={7} className="px-6 py-4"><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="bg-white p-4 rounded-xl border border-gray-200"><p className="text-xs text-gray-500 mb-1">القالب</p><p className="font-medium text-gray-800">{message.template || '—'}</p></div><div className="bg-white p-4 rounded-xl border border-gray-200"><p className="text-xs text-gray-500 mb-1">المصدر</p><p className="font-medium text-gray-800">{getSourceLabel(message)}</p></div><div className="bg-white p-4 rounded-xl border border-gray-200"><p className="text-xs text-gray-500 mb-1">الدور</p><p className="font-medium text-gray-800">{(() => { const role = (message as any).sentByRole || (message as any).sent_by_role; if (!role) return 'غير محدد'; if (role === 'schoolAdmin') return 'المدير المالي'; if (role === 'gradeManager') return 'مدير صف'; return role; })()}</p></div><div className="md:col-span-3 bg-white p-4 rounded-xl border border-gray-200"><p className="text-xs text-gray-500 mb-2">نص الرسالة</p><p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{message.message}</p></div></div></td></tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {messages.length > 0 && (<div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50"><div className="flex items-center gap-2"><span className="text-sm text-gray-600">عرض:</span><select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></div><div className="flex items-center gap-2"><button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">السابق</button><span className="text-sm text-gray-600 px-3">{currentPage} / {Math.max(1, Math.ceil(filteredBySearch.length / pageSize))}</span><button onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredBySearch.length / pageSize), p + 1))} disabled={currentPage >= Math.ceil(filteredBySearch.length / pageSize)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">التالي</button></div></div>)}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-gray-800"><svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#25D366]"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>معاينة الرسالة</DialogTitle>
            <button onClick={() => setShowPreviewModal(false)} className="absolute top-3 left-3 p-1.5 hover:bg-gray-100 rounded-full transition-colors"><X size={16} className="text-gray-500" /></button>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="bg-[#dcf8c6] border border-[#25D366]/30 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2"><svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#25D366]"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg><h4 className="font-semibold text-gray-800 text-sm">معاينة الرسالة</h4></div>
              <div className="bg-white p-3 rounded-lg border border-[#25D366]/20 shadow-sm"><p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-sm">{getMessagePreview()}</p></div>
            </div>
            {selectedStudents.length === 1 && (selectedStudentFees.length > 0 || selectedStudentInstallments.length > 0) && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5"><AlertTriangle size={14} className="text-blue-600" /><h4 className="font-semibold text-gray-800 text-sm">المعلومات المالية</h4></div>
                  <div className="flex bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <button className={`px-2.5 py-1 text-xs font-medium transition-colors ${activeFinancialTab === 'fees' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`} onClick={() => { setActiveFinancialTab('fees'); if (selectedStudentFees.length > 0) setPreviewAmount(selectedStudentFees.reduce((sum, fee) => sum + (fee.balance || 0), 0)); }}>الرسوم ({selectedStudentFees.length})</button>
                    <button className={`px-2.5 py-1 text-xs font-medium transition-colors ${activeFinancialTab === 'installments' ? 'bg-emerald-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`} onClick={() => { setActiveFinancialTab('installments'); if (selectedStudentInstallments.length > 0) { const first = selectedStudentInstallments[0]; setPreviewAmount(first.status === 'partial' ? (first.amount - (first.paidAmount || 0)) : first.amount); } }}>الأقساط ({selectedStudentInstallments.length})</button>
                  </div>
                </div>
                {activeFinancialTab === 'fees' && selectedStudentFees.length > 0 && (<div className="space-y-1.5 max-h-32 overflow-y-auto">{selectedStudentFees.map(fee => (<button key={fee.id} onClick={() => setPreviewAmount(fee.balance)} className="w-full flex justify-between items-center p-2 bg-white hover:bg-orange-50 rounded-lg border border-orange-200 transition-colors text-right text-sm"><span className="font-medium text-gray-800 text-xs">{getFeeTypeLabel(fee.feeType)}</span><span className="font-bold text-orange-600 text-xs">{fee.balance.toLocaleString()} {CURRENCY}</span></button>))}<div className="mt-2 p-2 bg-orange-100 rounded-lg border border-orange-200"><div className="flex justify-between items-center"><span className="font-medium text-gray-700 text-xs">الإجمالي:</span><span className="font-bold text-orange-700 text-sm">{selectedStudentFees.reduce((sum, fee) => sum + fee.balance, 0).toLocaleString()} {CURRENCY}</span></div></div></div>)}
                {activeFinancialTab === 'installments' && selectedStudentInstallments.length > 0 && (<div className="space-y-1.5 max-h-40 overflow-y-auto">{selectedStudentInstallments.map(inst => (<button key={inst.id} onClick={() => { const amount = inst.status === 'partial' ? (inst.amount - (inst.paidAmount || 0)) : inst.amount; setPreviewAmount(amount); if (inst.dueDate) setPreviewDate(inst.dueDate); }} className="w-full p-2 bg-white hover:bg-emerald-50 rounded-lg border border-emerald-200 transition-colors text-right"><div className="flex justify-between items-center mb-1"><div className="flex items-center gap-1.5"><span className="font-medium text-gray-800 text-xs">{getFeeTypeLabel(inst.feeType)}</span><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getInstallmentStatusColor(inst.status)}`}>{getInstallmentStatusLabel(inst.status)}</span></div><span className="font-bold text-emerald-600 text-xs">{(inst.status === 'partial' ? (inst.amount - (inst.paidAmount || 0)) : inst.amount).toLocaleString()} {CURRENCY}</span></div><div className="flex items-center gap-2 text-[10px] text-gray-500"><span>📅 {inst.dueDate ? formatDate(inst.dueDate) : 'غير محدد'}</span>{inst.status === 'partial' && <span>• مدفوع: {(inst.paidAmount || 0).toLocaleString()} {CURRENCY}</span>}</div></button>))}<div className="mt-2 p-2 bg-emerald-100 rounded-lg border border-emerald-200"><div className="flex justify-between items-center"><span className="font-medium text-gray-700 text-xs">الإجمالي:</span><span className="font-bold text-emerald-700 text-sm">{selectedStudentInstallments.reduce((sum, inst) => sum + (inst.status === 'partial' ? (inst.amount - (inst.paidAmount || 0)) : inst.amount), 0).toLocaleString()} {CURRENCY}</span></div></div></div>)}
              </div>
            )}
            <div className="flex gap-2 pt-3 border-t border-gray-200">
              <button onClick={() => setShowPreviewModal(false)} className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors text-sm">إغلاق</button>
              <button onClick={async () => { setShowPreviewModal(false); await handleSendMessages(); }} disabled={isSending || !messageText || selectedStudents.length === 0} className={`flex-1 px-3 py-2 font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 text-sm ${isSending || !messageText || selectedStudents.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}><Send size={14} />{isSending ? 'جاري الإرسال...' : 'إرسال الرسالة'}</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Communications;
