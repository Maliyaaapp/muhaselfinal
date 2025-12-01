import { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import { CURRENCY, GRADE_LEVELS } from '../../../utils/constants';
import hybridApi from '../../../services/hybridApi';
import { toast } from 'react-hot-toast';
import {
  CreditCard,
  MessageSquare,
  Search,
  FileText,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  ArrowUpDown,
  Eye,
  X,
  Download
} from 'lucide-react';

interface TrackedFee {
  id: string;
  studentName: string;
  studentId: string;
  grade?: string;
  amount: number;
  paymentMethod?: string;
  paidBy?: string;
  paidByRole?: string;
  paidByEmail?: string;
  paymentRecordedAt?: string;
  paidDate?: string;
  feeType?: string;
  receiptNumber?: string;
}

interface TrackedInstallment {
  id: string;
  studentName: string;
  studentId: string;
  grade?: string;
  amount: number;
  paymentMethod?: string;
  paidBy?: string;
  paidByRole?: string;
  paidByEmail?: string;
  paymentRecordedAt?: string;
  paidDate?: string;
  feeType?: string;
  installmentMonth?: string;
  installmentNumber?: number;
  receiptNumber?: string;
}

interface TrackedMessage {
  id: string;
  studentName: string;
  studentId: string;
  grade?: string;
  content: string;
  sentBy?: string;
  sentByRole?: string;
  sentByEmail?: string;
  sentAt: string;
  type: string;
}

type TabType = 'fees' | 'installments' | 'messages';
type SortOrder = 'newest' | 'oldest';

const Tracker = () => {
  const { user } = useSupabaseAuth();
  const [activeTab, setActiveTab] = useState<TabType>('fees');
  const [fees, setFees] = useState<TrackedFee[]>([]);
  const [installments, setInstallments] = useState<TrackedInstallment[]>([]);
  const [messages, setMessages] = useState<TrackedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const [feesPage, setFeesPage] = useState(1);
  const [installmentsPage, setInstallmentsPage] = useState(1);
  const [messagesPage, setMessagesPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  // Message view modal
  const [selectedMessage, setSelectedMessage] = useState<TrackedMessage | null>(null);

  useEffect(() => {
    if (user?.schoolId) fetchData();
  }, [user?.schoolId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const feesResponse = await hybridApi.getFees(user?.schoolId || '');
      const feesData = feesResponse?.success ? feesResponse.data : [];

      const installmentsResponse = await hybridApi.getInstallments(user?.schoolId || '');
      const installmentsData = installmentsResponse?.success ? installmentsResponse.data : [];

      const messagesResponse = await hybridApi.getMessages(user?.schoolId || '');
      const messagesData = messagesResponse?.success ? messagesResponse.data : [];

      const trackedFees: TrackedFee[] = feesData
        .filter((fee: any) => fee.status === 'paid' || fee.status === 'partial')
        .map((fee: any) => ({
          id: fee.id, studentName: fee.studentName || 'غير معروف', studentId: fee.studentId,
          grade: fee.grade, amount: fee.paid || 0, paymentMethod: fee.paymentMethod,
          paidBy: fee.paidBy || fee.paid_by, paidByRole: fee.paidByRole || fee.paid_by_role,
          paidByEmail: fee.paidByEmail || fee.paid_by_email,
          paymentRecordedAt: fee.paymentRecordedAt || fee.payment_recorded_at || fee.paidDate || fee.paymentDate,
          paidDate: fee.paidDate || fee.paymentDate, feeType: fee.feeType, receiptNumber: fee.receiptNumber
        }));
      setFees(trackedFees);

      const trackedInstallments: TrackedInstallment[] = installmentsData
        .filter((inst: any) => inst.status === 'paid' || inst.status === 'partial')
        .map((inst: any) => ({
          id: inst.id, studentName: inst.studentName || 'غير معروف', studentId: inst.studentId,
          grade: inst.grade, amount: inst.paidAmount || inst.paid_amount || inst.amount || 0,
          paymentMethod: inst.paymentMethod, paidBy: inst.paidBy || inst.paid_by,
          paidByRole: inst.paidByRole || inst.paid_by_role, paidByEmail: inst.paidByEmail || inst.paid_by_email,
          paymentRecordedAt: inst.paymentRecordedAt || inst.payment_recorded_at || inst.paidDate,
          paidDate: inst.paidDate, feeType: inst.feeType, installmentMonth: inst.installmentMonth,
          installmentNumber: inst.installmentNumber, receiptNumber: inst.receiptNumber
        }));
      setInstallments(trackedInstallments);

      const trackedMessages: TrackedMessage[] = messagesData.map((msg: any) => ({
        id: msg.id, studentName: msg.studentName || 'غير معروف', studentId: msg.studentId,
        grade: msg.grade, content: msg.content || msg.message || '',
        sentBy: msg.sentBy || msg.sent_by, sentByRole: msg.sentByRole || msg.sent_by_role,
        sentByEmail: msg.sentByEmail || msg.sent_by_email,
        sentAt: msg.createdAt || msg.created_at || msg.sentAt, type: msg.type || 'whatsapp'
      }));
      setMessages(trackedMessages);
    } catch (error) {
      console.error('Error fetching tracker data:', error);
      toast.error('حدث خطأ أثناء تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role?: string) => {
    if (!role) return '-';
    switch (role) {
      case 'schoolAdmin': return 'المدير المالي';
      case 'gradeManager': return 'مدير الصف';
      case 'admin': return 'مسؤول النظام';
      default: return role;
    }
  };

  const getPaymentMethodLabel = (method?: string) => {
    if (!method) return '-';
    switch (method) {
      case 'cash': return 'نقداً';
      case 'visa': return 'بطاقة';
      case 'check': return 'شيك';
      case 'bank-transfer': return 'تحويل';
      default: return method;
    }
  };

  const getFeeTypeLabel = (type?: string) => {
    if (!type) return '-';
    switch (type) {
      case 'tuition': return 'رسوم دراسية';
      case 'transportation': return 'نقل مدرسي';
      case 'transportation_and_tuition': return 'رسوم دراسية ونقل';
      case 'activities': return 'أنشطة';
      case 'books': return 'كتب';
      case 'uniform': return 'زي مدرسي';
      default: return type;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    } catch { return dateStr; }
  };

  const filterByDateRange = (date?: string) => {
    if (dateRange === 'all' || !date) return true;
    const itemDate = new Date(date);
    const now = new Date();
    switch (dateRange) {
      case 'today': return itemDate.toDateString() === now.toDateString();
      case 'week': return itemDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month': return itemDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default: return true;
    }
  };

  const sortByDate = <T extends { paymentRecordedAt?: string; paidDate?: string; sentAt?: string }>(items: T[]): T[] => {
    return [...items].sort((a, b) => {
      const dateA = new Date((a as any).paymentRecordedAt || (a as any).paidDate || (a as any).sentAt || 0).getTime();
      const dateB = new Date((b as any).paymentRecordedAt || (b as any).paidDate || (b as any).sentAt || 0).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
  };

  const filteredFees = sortByDate(fees.filter(fee => {
    const matchesSearch = fee.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || fee.paidBy?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || fee.paidByRole === filterRole;
    const matchesGrade = filterGrade === 'all' || fee.grade === filterGrade;
    const matchesDate = filterByDateRange(fee.paymentRecordedAt || fee.paidDate);
    return matchesSearch && matchesRole && matchesGrade && matchesDate;
  }));

  const filteredInstallments = sortByDate(installments.filter(inst => {
    const matchesSearch = inst.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || inst.paidBy?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || inst.paidByRole === filterRole;
    const matchesGrade = filterGrade === 'all' || inst.grade === filterGrade;
    const matchesDate = filterByDateRange(inst.paymentRecordedAt || inst.paidDate);
    return matchesSearch && matchesRole && matchesGrade && matchesDate;
  }));

  const filteredMessages = sortByDate(messages.filter(message => {
    const matchesSearch = message.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || message.sentBy?.toLowerCase().includes(searchTerm.toLowerCase()) || message.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || message.sentByRole === filterRole;
    const matchesGrade = filterGrade === 'all' || message.grade === filterGrade;
    const matchesDate = filterByDateRange(message.sentAt);
    return matchesSearch && matchesRole && matchesGrade && matchesDate;
  }));

  const feesTotalPages = Math.ceil(filteredFees.length / ITEMS_PER_PAGE);
  const installmentsTotalPages = Math.ceil(filteredInstallments.length / ITEMS_PER_PAGE);
  const messagesTotalPages = Math.ceil(filteredMessages.length / ITEMS_PER_PAGE);

  const paginatedFees = filteredFees.slice((feesPage - 1) * ITEMS_PER_PAGE, feesPage * ITEMS_PER_PAGE);
  const paginatedInstallments = filteredInstallments.slice((installmentsPage - 1) * ITEMS_PER_PAGE, installmentsPage * ITEMS_PER_PAGE);
  const paginatedMessages = filteredMessages.slice((messagesPage - 1) * ITEMS_PER_PAGE, messagesPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setFeesPage(1); setInstallmentsPage(1); setMessagesPage(1);
  }, [searchTerm, filterRole, filterGrade, dateRange, sortOrder]);

  const totalFeesAmount = filteredFees.reduce((sum, f) => sum + f.amount, 0);
  const totalInstallmentsAmount = filteredInstallments.reduce((sum, i) => sum + i.amount, 0);
  const totalAmount = totalFeesAmount + totalInstallmentsAmount;

  // Export to Excel functions
  const exportToExcel = (data: any[], filename: string, headers: string[]) => {
    const BOM = '\uFEFF';
    const csvContent = BOM + [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const value = row[h] || '-';
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('تم تصدير البيانات بنجاح');
  };

  const exportFees = () => {
    const data = filteredFees.map(f => ({
      'الطالب': f.studentName,
      'الصف': f.grade || '-',
      'النوع': getFeeTypeLabel(f.feeType),
      'المبلغ': f.amount,
      'الطريقة': getPaymentMethodLabel(f.paymentMethod),
      'التاريخ': formatDate(f.paymentRecordedAt || f.paidDate),
      'سجل بواسطة': f.paidBy || '-',
      'الدور': getRoleLabel(f.paidByRole)
    }));
    exportToExcel(data, 'سجل_الرسوم', ['الطالب', 'الصف', 'النوع', 'المبلغ', 'الطريقة', 'التاريخ', 'سجل بواسطة', 'الدور']);
  };

  const exportInstallments = () => {
    const data = filteredInstallments.map(i => ({
      'الطالب': i.studentName,
      'الصف': i.grade || '-',
      'الشهر': i.installmentMonth || '-',
      'المبلغ': i.amount,
      'الطريقة': getPaymentMethodLabel(i.paymentMethod),
      'التاريخ': formatDate(i.paymentRecordedAt || i.paidDate),
      'سجل بواسطة': i.paidBy || '-',
      'الدور': getRoleLabel(i.paidByRole)
    }));
    exportToExcel(data, 'سجل_الأقساط', ['الطالب', 'الصف', 'الشهر', 'المبلغ', 'الطريقة', 'التاريخ', 'سجل بواسطة', 'الدور']);
  };

  const exportMessages = () => {
    const data = filteredMessages.map(m => ({
      'الطالب': m.studentName,
      'الصف': m.grade || '-',
      'التاريخ': formatDate(m.sentAt),
      'أرسل بواسطة': m.sentBy || '-',
      'الدور': getRoleLabel(m.sentByRole),
      'الرسالة': m.content
    }));
    exportToExcel(data, 'سجل_المراسلات', ['الطالب', 'الصف', 'التاريخ', 'أرسل بواسطة', 'الدور', 'الرسالة']);
  };

  const Pagination = ({ currentPage, totalPages, totalItems, onPageChange }: {
    currentPage: number; totalPages: number; totalItems: number; onPageChange: (page: number) => void;
  }) => {
    if (totalPages <= 1) return null;
    const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);
    return (
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t text-sm">
        <span className="text-gray-600">{startItem} - {endItem} من {totalItems}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}
            className={`p-1.5 rounded-md ${currentPage === 1 ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-200'}`}>
            <ChevronRight size={16} />
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum = totalPages <= 5 ? i + 1 : currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i;
            return (
              <button key={pageNum} onClick={() => onPageChange(pageNum)}
                className={`w-7 h-7 rounded-md text-xs font-medium ${currentPage === pageNum ? 'bg-[#800000] text-white' : 'text-gray-600 hover:bg-gray-200'}`}>
                {pageNum}
              </button>
            );
          })}
          <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}
            className={`p-1.5 rounded-md ${currentPage === totalPages ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-200'}`}>
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>
    );
  };


  return (
    <div className="p-4" dir="rtl">
      {/* Modern Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg">
          <div className="absolute top-0 left-0 w-20 h-20 bg-white/10 rounded-full -translate-x-10 -translate-y-10"></div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard size={18} className="opacity-80" />
              <span className="text-emerald-100 text-xs font-medium">الرسوم المدفوعة</span>
            </div>
            <p className="text-2xl font-bold">{totalFeesAmount.toLocaleString()} <span className="text-sm font-normal">{CURRENCY}</span></p>
            <p className="text-emerald-200 text-xs mt-1">{filteredFees.length} عملية</p>
          </div>
        </div>
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
          <div className="absolute top-0 left-0 w-20 h-20 bg-white/10 rounded-full -translate-x-10 -translate-y-10"></div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={18} className="opacity-80" />
              <span className="text-blue-100 text-xs font-medium">الأقساط المدفوعة</span>
            </div>
            <p className="text-2xl font-bold">{totalInstallmentsAmount.toLocaleString()} <span className="text-sm font-normal">{CURRENCY}</span></p>
            <p className="text-blue-200 text-xs mt-1">{filteredInstallments.length} عملية</p>
          </div>
        </div>
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-4 text-white shadow-lg">
          <div className="absolute top-0 left-0 w-20 h-20 bg-white/10 rounded-full -translate-x-10 -translate-y-10"></div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare size={18} className="opacity-80" />
              <span className="text-amber-100 text-xs font-medium">الرسائل المرسلة</span>
            </div>
            <p className="text-2xl font-bold">{filteredMessages.length}</p>
            <p className="text-amber-200 text-xs mt-1">رسالة</p>
          </div>
        </div>
        <div className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
          <div className="absolute top-0 left-0 w-20 h-20 bg-white/10 rounded-full -translate-x-10 -translate-y-10"></div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={18} className="opacity-80" />
              <span className="text-purple-100 text-xs font-medium">إجمالي التحصيل</span>
            </div>
            <p className="text-2xl font-bold">{totalAmount.toLocaleString()} <span className="text-sm font-normal">{CURRENCY}</span></p>
            <p className="text-purple-200 text-xs mt-1">{filteredFees.length + filteredInstallments.length} عملية</p>
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="bg-white rounded-xl shadow-sm border p-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[140px]">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input type="text" placeholder="بحث..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-7 pl-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000]" />
          </div>
          <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000] bg-white">
            <option value="all">كل الصفوف</option>
            {GRADE_LEVELS.map(grade => <option key={grade} value={grade}>{grade}</option>)}
          </select>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000] bg-white">
            <option value="all">كل الأدوار</option>
            <option value="schoolAdmin">المدير المالي</option>
            <option value="gradeManager">مدير الصف</option>
          </select>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000] bg-white">
            <option value="all">كل الفترات</option>
            <option value="today">اليوم</option>
            <option value="week">آخر أسبوع</option>
            <option value="month">آخر شهر</option>
          </select>
          <button onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
            className="flex items-center gap-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <ArrowUpDown size={14} />
            <span>{sortOrder === 'newest' ? 'الأحدث' : 'الأقدم'}</span>
          </button>
          <div className="h-6 w-px bg-gray-200 mx-1"></div>
          <button onClick={exportFees} className="flex items-center gap-1 px-2 py-1.5 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors" title="تصدير الرسوم">
            <Download size={14} />
            <span>الرسوم</span>
          </button>
          <button onClick={exportInstallments} className="flex items-center gap-1 px-2 py-1.5 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors" title="تصدير الأقساط">
            <Download size={14} />
            <span>الأقساط</span>
          </button>
          <button onClick={exportMessages} className="flex items-center gap-1 px-2 py-1.5 text-sm bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors" title="تصدير المراسلات">
            <Download size={14} />
            <span>المراسلات</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-0 bg-gray-100 p-1 rounded-t-xl">
        <button onClick={() => setActiveTab('fees')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'fees' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
          <CreditCard size={16} /> الرسوم <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-xs">{filteredFees.length}</span>
        </button>
        <button onClick={() => setActiveTab('installments')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'installments' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
          <FileText size={16} /> الأقساط <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">{filteredInstallments.length}</span>
        </button>
        <button onClick={() => setActiveTab('messages')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'messages' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
          <MessageSquare size={16} /> المراسلات <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-xs">{filteredMessages.length}</span>
        </button>
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-[60vh] bg-white rounded-b-xl shadow-sm border border-t-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#800000]"></div>
          </div>
        ) : activeTab === 'fees' ? (
          <>
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-[#800000]/5 to-[#800000]/10 sticky top-0">
                <tr>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">#</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">الطالب</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">الصف</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">النوع</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">المبلغ</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">الطريقة</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">التاريخ</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">سجل بواسطة</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">الدور</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedFees.length === 0 ? (
                  <tr><td colSpan={9} className="px-5 py-12 text-center text-gray-400 text-base">لا توجد رسوم مدفوعة</td></tr>
                ) : paginatedFees.map((fee, idx) => (
                  <tr key={fee.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 text-gray-900 font-semibold text-base">{(feesPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                    <td className="px-5 py-4 font-bold text-gray-900 text-base">{fee.studentName}</td>
                    <td className="px-5 py-4 text-gray-900 font-medium text-base">{fee.grade || '-'}</td>
                    <td className="px-5 py-4"><span className="bg-[#800000]/10 text-[#800000] px-2.5 py-1 rounded text-sm font-semibold">{getFeeTypeLabel(fee.feeType)}</span></td>
                    <td className="px-5 py-4 text-emerald-600 font-bold text-base">{fee.amount.toLocaleString()}</td>
                    <td className="px-5 py-4 text-gray-900 font-medium text-base">{getPaymentMethodLabel(fee.paymentMethod)}</td>
                    <td className="px-5 py-4 text-gray-900 font-medium text-base">{formatDate(fee.paymentRecordedAt || fee.paidDate)}</td>
                    <td className="px-5 py-4 text-gray-900 font-medium text-base">{fee.paidBy || <span className="text-gray-400">-</span>}</td>
                    <td className="px-5 py-4">{fee.paidByRole ? <span className={`px-2.5 py-1 text-sm rounded-full font-semibold ${fee.paidByRole === 'schoolAdmin' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>{getRoleLabel(fee.paidByRole)}</span> : <span className="text-gray-400">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination currentPage={feesPage} totalPages={feesTotalPages} totalItems={filteredFees.length} onPageChange={setFeesPage} />
          </>
        ) : activeTab === 'installments' ? (
          <>
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-[#800000]/5 to-[#800000]/10 sticky top-0">
                <tr>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">#</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">الطالب</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">الصف</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">الشهر</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">المبلغ</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">الطريقة</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">التاريخ</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">سجل بواسطة</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">الدور</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedInstallments.length === 0 ? (
                  <tr><td colSpan={9} className="px-5 py-12 text-center text-gray-400 text-base">لا توجد أقساط مدفوعة</td></tr>
                ) : paginatedInstallments.map((inst, idx) => (
                  <tr key={inst.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 text-gray-900 font-semibold text-base">{(installmentsPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                    <td className="px-5 py-4 font-bold text-gray-900 text-base">{inst.studentName}</td>
                    <td className="px-5 py-4 text-gray-900 font-medium text-base">{inst.grade || '-'}</td>
                    <td className="px-5 py-4"><span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded text-sm font-semibold">{inst.installmentMonth || '-'}</span></td>
                    <td className="px-5 py-4 text-blue-600 font-bold text-base">{inst.amount.toLocaleString()}</td>
                    <td className="px-5 py-4 text-gray-900 font-medium text-base">{getPaymentMethodLabel(inst.paymentMethod)}</td>
                    <td className="px-5 py-4 text-gray-900 font-medium text-base">{formatDate(inst.paymentRecordedAt || inst.paidDate)}</td>
                    <td className="px-5 py-4 text-gray-900 font-medium text-base">{inst.paidBy || <span className="text-gray-400">-</span>}</td>
                    <td className="px-5 py-4">{inst.paidByRole ? <span className={`px-2.5 py-1 text-sm rounded-full font-semibold ${inst.paidByRole === 'schoolAdmin' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>{getRoleLabel(inst.paidByRole)}</span> : <span className="text-gray-400">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination currentPage={installmentsPage} totalPages={installmentsTotalPages} totalItems={filteredInstallments.length} onPageChange={setInstallmentsPage} />
          </>
        ) : (
          <>
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-[#800000]/5 to-[#800000]/10 sticky top-0">
                <tr>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">#</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">الطالب</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">الصف</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">التاريخ</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">أرسل بواسطة</th>
                  <th className="px-5 py-4 text-right text-base font-bold text-[#800000]">الدور</th>
                  <th className="px-5 py-4 text-center text-base font-bold text-[#800000]">عرض</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedMessages.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400 text-base">لا توجد رسائل</td></tr>
                ) : paginatedMessages.map((msg, idx) => (
                  <tr key={msg.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 text-gray-900 font-semibold text-base">{(messagesPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                    <td className="px-5 py-4 font-bold text-gray-900 text-base">{msg.studentName}</td>
                    <td className="px-5 py-4 text-gray-900 font-medium text-base">{msg.grade || '-'}</td>
                    <td className="px-5 py-4 text-gray-900 font-medium text-base">{formatDate(msg.sentAt)}</td>
                    <td className="px-5 py-4 text-gray-900 font-medium text-base">{msg.sentBy || <span className="text-gray-400">-</span>}</td>
                    <td className="px-5 py-4">{msg.sentByRole ? <span className={`px-2.5 py-1 text-sm rounded-full font-semibold ${msg.sentByRole === 'schoolAdmin' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>{getRoleLabel(msg.sentByRole)}</span> : <span className="text-gray-400">-</span>}</td>
                    <td className="px-5 py-4 text-center">
                      <button onClick={() => setSelectedMessage(msg)} className="p-2 rounded-lg bg-[#800000]/10 text-[#800000] hover:bg-[#800000]/20 transition-colors" title="عرض الرسالة">
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination currentPage={messagesPage} totalPages={messagesTotalPages} totalItems={filteredMessages.length} onPageChange={setMessagesPage} />
          </>
        )}
      </div>

      {/* Message View Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedMessage(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[#800000] to-[#a00000] text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">محتوى الرسالة</h3>
              <button onClick={() => setSelectedMessage(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">الطالب:</span>
                  <p className="font-bold text-gray-900">{selectedMessage.studentName}</p>
                </div>
                <div>
                  <span className="text-gray-500">الصف:</span>
                  <p className="font-bold text-gray-900">{selectedMessage.grade || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500">التاريخ:</span>
                  <p className="font-bold text-gray-900">{formatDate(selectedMessage.sentAt)}</p>
                </div>
                <div>
                  <span className="text-gray-500">أرسل بواسطة:</span>
                  <p className="font-bold text-gray-900">{selectedMessage.sentBy || '-'}</p>
                </div>
              </div>
              <div>
                <span className="text-gray-500 text-sm">الدور:</span>
                {selectedMessage.sentByRole ? (
                  <span className={`mr-2 px-2 py-0.5 text-xs rounded-full font-semibold ${selectedMessage.sentByRole === 'schoolAdmin' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                    {getRoleLabel(selectedMessage.sentByRole)}
                  </span>
                ) : <span className="text-gray-400 mr-2">-</span>}
              </div>
              <div>
                <span className="text-gray-500 text-sm block mb-2">نص الرسالة:</span>
                <div className="bg-gray-50 border rounded-lg p-4 text-gray-900 whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {selectedMessage.content || 'لا يوجد محتوى'}
                </div>
              </div>
            </div>
            <div className="border-t p-4">
              <button onClick={() => setSelectedMessage(null)} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors">
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tracker;
