import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Truck,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Search,
  CheckCircle,
  MoreHorizontal,
  Building2,
  Receipt,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText,
  DollarSign,
  Boxes,
  Hash,
  Landmark,
  UserCheck,
  X,
  Check,
  QrCode,
} from 'lucide-react';
import { SupplierBankQr } from '../../components/suppliers/SupplierBankQr';
import { suppliersApi, SupplierItem } from '../../services/suppliersApi';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import {
  SystemTableWrapper,
  SystemThead,
  SystemTh,
  SystemTbody,
  SystemTr,
  SystemTd,
  SystemTableEmpty,
  SystemTableSkeleton,
  SystemPagination,
} from '../../components/ui/SystemTable';
import { SystemMetricPairCard } from '../../components/ui/SystemMetricCard';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../../components/ui/DropdownMenu';
import { toast } from '../../components/ui/Toast';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import { formatCurrency } from '../../utils';

export const SuppliersPage: React.FC = () => {
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [debtFilter, setDebtFilter] = useState<'ALL' | 'PAYABLE' | 'ADVANCE' | 'BALANCED'>('ALL');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedSupplierForEdit, setSelectedSupplierForEdit] = useState<SupplierItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [selectedSupplierForDelete, setSelectedSupplierForDelete] = useState<SupplierItem | null>(null);
  const [viewingQrSupplier, setViewingQrSupplier] = useState<SupplierItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Create Form
  const [createForm, setCreateForm] = useState({
    code: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    bankName: '',
    bankAccount: '',
    bankBeneficiary: '',
    openingDebt: 0,
    status: 'ACTIVE',
    note: '',
  });

  // Edit Form
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    bankName: '',
    bankAccount: '',
    bankBeneficiary: '',
    openingDebt: 0,
    status: 'ACTIVE',
    note: '',
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setIsLoading(true);
    try {
      const res: any = await suppliersApi.findAll();
      const list: SupplierItem[] = res?.data || res || [];
      setSuppliers(list);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Không thể tải danh sách nhà cung cấp');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateModal = async () => {
    let nextCode = '';
    try {
      const res: any = await suppliersApi.getNextCode();
      nextCode = res?.code || res?.data?.code || '';
    } catch {
      // ignore
    }
    if (!nextCode) {
      let maxNum = 0;
      for (const s of suppliers) {
        const match = s.code.match(/^NCC(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      nextCode = `NCC${String(maxNum + 1).padStart(3, '0')}`;
    }

    setCreateForm({
      code: nextCode,
      name: '',
      phone: '',
      email: '',
      address: '',
      bankName: '',
      bankAccount: '',
      bankBeneficiary: '',
      openingDebt: 0,
      status: 'ACTIVE',
      note: '',
    });
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      toast.warning('Vui lòng nhập Tên Nhà cung cấp');
      return;
    }

    setIsSubmitting(true);
    try {
      await suppliersApi.create({
        code: createForm.code.trim().toUpperCase(),
        name: createForm.name.trim(),
        phone: createForm.phone.trim() || undefined,
        email: createForm.email.trim() || undefined,
        address: createForm.address.trim() || undefined,
        bankName: createForm.bankName.trim() || undefined,
        bankAccount: createForm.bankAccount.trim() || undefined,
        bankBeneficiary: createForm.bankBeneficiary.trim() || undefined,
        openingDebt: Number(createForm.openingDebt) || 0,
        status: createForm.status,
        note: createForm.note.trim() || undefined,
      });

      toast.success('Thêm mới nhà cung cấp thành công!');
      setIsCreateModalOpen(false);
      loadSuppliers();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Lỗi thêm nhà cung cấp');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = (supplier: SupplierItem) => {
    setSelectedSupplierForEdit(supplier);
    setEditForm({
      name: supplier.name || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      bankName: supplier.bankName || '',
      bankAccount: supplier.bankAccount || '',
      bankBeneficiary: supplier.bankBeneficiary || '',
      openingDebt: supplier.openingDebt || 0,
      status: supplier.status || 'ACTIVE',
      note: supplier.note || '',
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierForEdit) return;
    if (!editForm.name.trim()) {
      toast.warning('Vui lòng nhập tên nhà cung cấp');
      return;
    }

    setIsSubmitting(true);
    try {
      await suppliersApi.update(selectedSupplierForEdit.id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || undefined,
        email: editForm.email.trim() || undefined,
        address: editForm.address.trim() || undefined,
        bankName: editForm.bankName.trim() || undefined,
        bankAccount: editForm.bankAccount.trim() || undefined,
        bankBeneficiary: editForm.bankBeneficiary.trim() || undefined,
        openingDebt: Number(editForm.openingDebt) || 0,
        status: editForm.status,
        note: editForm.note.trim() || undefined,
      });

      toast.success('Cập nhật thông tin nhà cung cấp thành công!');
      setIsEditModalOpen(false);
      setSelectedSupplierForEdit(null);
      loadSuppliers();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Lỗi cập nhật nhà cung cấp');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDeleteModal = (supplier: SupplierItem) => {
    setSelectedSupplierForDelete(supplier);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!selectedSupplierForDelete) return;

    setIsSubmitting(true);
    try {
      await suppliersApi.delete(selectedSupplierForDelete.id);
      toast.success(`Đã xóa nhà cung cấp "${selectedSupplierForDelete.name}" thành công!`);
      setIsDeleteModalOpen(false);
      setSelectedSupplierForDelete(null);
      loadSuppliers();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Không thể xóa nhà cung cấp');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter calculation
  const filteredSuppliers = suppliers.filter((s) => {
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (debtFilter === 'PAYABLE' && s.closingDebt <= 0) return false;
    if (debtFilter === 'ADVANCE' && s.closingDebt >= 0) return false;
    if (debtFilter === 'BALANCED' && s.closingDebt !== 0) return false;

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.code.toLowerCase().includes(term) ||
      s.name.toLowerCase().includes(term) ||
      (s.phone || '').toLowerCase().includes(term) ||
      (s.email || '').toLowerCase().includes(term) ||
      (s.address || '').toLowerCase().includes(term)
    );
  });

  const paginatedSuppliers = filteredSuppliers.slice((page - 1) * limit, page * limit);
  const totalPages = Math.ceil(filteredSuppliers.length / limit) || 1;

  // KPI Calculations
  const totalSuppliersCount = suppliers.length;
  const activeSuppliersCount = suppliers.filter((s) => s.status === 'ACTIVE').length;
  const withDebtCount = suppliers.filter((s) => s.closingDebt > 0).length;
  const totalPayableDebt = suppliers.reduce((sum, s) => sum + (s.closingDebt > 0 ? s.closingDebt : 0), 0);

  return (
    <div className="flex-1 flex flex-col min-h-fit md:min-h-0 space-y-3.5 animate-in fade-in duration-300">
      {/* 1. Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-xl font-medium text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2 truncate">
            <Truck size={18} className="text-[#5865f2] shrink-0 sm:w-5 sm:h-5" />
            <span className="truncate sm:hidden">Nhà cung cấp</span>
            <span className="hidden sm:inline truncate">Quản lý Nhà cung cấp</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate hidden sm:block">
            Danh bạ đối tác cung ứng, liên hệ, tài khoản thanh toán và theo dõi công nợ mua hàng
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button
            size="sm"
            onClick={handleOpenCreateModal}
            className="gap-1.5 px-2.5 sm:px-3"
            title="Thêm nhà cung cấp mới"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Thêm nhà cung cấp mới</span>
            <span className="sm:hidden">Thêm</span>
          </Button>

          <Link to="/supplier-debts">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 px-2 sm:px-3"
              title="Xem Sổ công nợ và Lập phiếu chi thanh toán"
            >
              <Building2 size={13} />
              <span className="hidden sm:inline">Sổ công nợ NCC</span>
              <span className="sm:hidden">Công nợ</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={loadSuppliers}
            className="gap-1.5 p-2 lg:px-3"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden lg:inline">Làm mới</span>
          </Button>
        </div>
      </div>

      {/* 2. Metric KPI Cards matching Orders page */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 shrink-0">
        <SystemMetricPairCard
          leftItem={{
            title: 'Tổng nhà cung cấp',
            value: totalSuppliersCount,
            subtitle: 'Đối tác danh bạ',
            icon: Truck,
            colorScheme: 'blue',
            isActive: statusFilter === 'ALL' && debtFilter === 'ALL',
            onClick: () => {
              setStatusFilter('ALL');
              setDebtFilter('ALL');
              setPage(1);
            },
          }}
          rightItem={{
            title: 'Đang giao dịch',
            value: activeSuppliersCount,
            subtitle: 'Đang hoạt động',
            icon: CheckCircle,
            colorScheme: 'green',
            isActive: statusFilter === 'ACTIVE',
            onClick: () => {
              setStatusFilter('ACTIVE');
              setDebtFilter('ALL');
              setPage(1);
            },
          }}
        />
        <SystemMetricPairCard
          leftItem={{
            title: 'Có phát sinh nợ',
            value: withDebtCount,
            subtitle: 'NCC còn số dư nợ',
            icon: AlertTriangle,
            colorScheme: 'orange',
            isActive: debtFilter === 'PAYABLE',
            onClick: () => {
              setDebtFilter('PAYABLE');
              setPage(1);
            },
          }}
          rightItem={{
            title: 'Tổng nợ phải trả',
            value: `${formatCurrency(totalPayableDebt)} đ`,
            subtitle: 'Chưa thanh toán',
            icon: Receipt,
            colorScheme: 'purple',
          }}
        />
      </div>

      {/* 3. Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded shrink-0">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo mã NCC, tên nhà cung cấp, SĐT, email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-8 pr-4 py-1.5 h-8 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
          />
        </div>

        <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap w-full sm:w-auto">
          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">
              Trạng thái:
            </span>
            <Select
              value={statusFilter}
              onChange={(val: any) => {
                setStatusFilter(val);
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái' },
                { value: 'ACTIVE', label: 'Đang hoạt động (ACTIVE)' },
                { value: 'INACTIVE', label: 'Tạm dừng (INACTIVE)' },
              ]}
              size="sm"
              className="w-full sm:w-44"
              menuWidth="w-52"
            />
          </div>

          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">
              Công nợ:
            </span>
            <Select
              value={debtFilter}
              onChange={(val: any) => {
                setDebtFilter(val);
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Tất cả công nợ' },
                { value: 'PAYABLE', label: 'Có nợ phải trả (> 0)' },
                { value: 'ADVANCE', label: 'Có tiền ứng trước (< 0)' },
                { value: 'BALANCED', label: 'Cân bằng (= 0)' },
              ]}
              size="sm"
              className="w-full sm:w-44"
              menuWidth="w-52"
            />
          </div>
        </div>
      </div>

      {/* 4. Desktop Table View */}
      <div className="hidden md:flex flex-1 flex-col min-h-0">
        <SystemTableWrapper
          tableClassName="min-w-[1000px]"
          pagination={
            <SystemPagination
              page={page - 1}
              totalPages={totalPages}
              totalItems={filteredSuppliers.length}
              setPage={(p) => setPage(p + 1)}
              itemsPerPage={limit}
              setItemsPerPage={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
            />
          }
        >
          <SystemThead>
            <SystemTh className="w-14 text-center" align="center">STT</SystemTh>
            <SystemTh className="w-56">Mã & Tên Nhà Cung Cấp</SystemTh>
            <SystemTh className="w-44">Thông tin liên hệ</SystemTh>
            <SystemTh className="w-56">Địa chỉ</SystemTh>
            <SystemTh className="w-52">Tài khoản thanh toán</SystemTh>
            <SystemTh className="w-36 text-right">Tổng mua hàng</SystemTh>
            <SystemTh className="w-36 text-right">Dư nợ hiện tại</SystemTh>
            <SystemTh className="w-28 text-center">Trạng thái</SystemTh>
            <SystemTh className="w-20 text-center">Thao tác</SystemTh>
          </SystemThead>
          <SystemTbody>
            {isLoading ? (
              <SystemTableSkeleton cols={9} rows={7} />
            ) : filteredSuppliers.length === 0 ? (
              <SystemTableEmpty
                title="Không có nhà cung cấp nào"
                description={
                  searchTerm || statusFilter !== 'ALL' || debtFilter !== 'ALL'
                    ? 'Không tìm thấy nhà cung cấp phù hợp với bộ lọc hiện tại.'
                    : 'Chưa có nhà cung cấp nào. Hãy bấm "Thêm nhà cung cấp mới" để khởi tạo danh bạ.'
                }
                colSpan={9}
              />
            ) : (
              paginatedSuppliers.map((s, index) => {
                const closingDebt = s.closingDebt || 0;
                const isPayable = closingDebt > 0;
                const isAdvance = closingDebt < 0;
                const stt = (page - 1) * limit + index + 1;

                return (
                  <SystemTr key={s.id}>
                    <SystemTd align="center" className="text-center font-medium text-gray-500 dark:text-gray-400 text-xs">
                      {stt}
                    </SystemTd>
                    <SystemTd>
                      <div className="font-mono font-bold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                        <span className="text-[#5865f2]">{s.code}</span>
                      </div>
                      <div className="font-medium text-xs text-gray-800 dark:text-gray-200 truncate mt-0.5" title={s.name}>
                        {s.name}
                      </div>
                      {s.receiptCount !== undefined && s.receiptCount > 0 && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {s.receiptCount} phiếu nhập kho
                        </div>
                      )}
                      {((s.totalLoanDebt || 0) > 0 || (s.totalBorrowedProducts || 0) > 0) && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {(s.totalLoanDebt || 0) > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
                              Vay: {formatCurrency(s.totalLoanDebt || 0)}đ
                            </span>
                          )}
                          {(s.totalBorrowedProducts || 0) > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
                              Mượn {s.totalBorrowedProducts} sp
                            </span>
                          )}
                        </div>
                      )}
                    </SystemTd>

                    <SystemTd>
                      {s.phone ? (
                        <div className="flex items-center gap-1.5 text-xs text-gray-800 dark:text-gray-200">
                          <Phone size={11} className="text-gray-400 shrink-0" />
                          <span>{s.phone}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">--</span>
                      )}
                      {s.email && (
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 truncate mt-0.5" title={s.email}>
                          <Mail size={11} className="shrink-0" />
                          <span className="truncate">{s.email}</span>
                        </div>
                      )}
                    </SystemTd>

                    <SystemTd>
                      {s.address ? (
                        <div className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-300 line-clamp-2" title={s.address}>
                          <MapPin size={12} className="text-gray-400 shrink-0 mt-0.5" />
                          <span>{s.address}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">Chưa cập nhật</span>
                      )}
                    </SystemTd>

                    <SystemTd>
                      {s.bankAccount ? (
                        <div className="space-y-0.5 text-xs">
                          <div className="flex items-center gap-1.5 font-mono font-semibold text-gray-900 dark:text-white">
                            <span>{s.bankAccount}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingQrSupplier(s);
                              }}
                              className="p-0.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded cursor-pointer transition-colors shrink-0"
                              title="Xem mã QR thanh toán VietQR"
                            >
                              <QrCode size={13} />
                            </button>
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400">
                            {s.bankName} {s.bankBeneficiary ? `• ${s.bankBeneficiary}` : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">Chưa lưu TK</span>
                      )}
                    </SystemTd>

                    <SystemTd className="text-right font-mono font-medium text-xs text-gray-900 dark:text-white">
                      {formatCurrency(s.totalPurchases || 0)} đ
                    </SystemTd>

                    <SystemTd className="text-right font-mono text-xs">
                      {isPayable ? (
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {formatCurrency(closingDebt)} đ
                        </span>
                      ) : isAdvance ? (
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          -{formatCurrency(Math.abs(closingDebt))} đ
                        </span>
                      ) : (
                        <span className="text-gray-400">0 đ</span>
                      )}
                    </SystemTd>

                    <SystemTd className="text-center">
                      <span
                        className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded ${
                          s.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        {s.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'}
                      </span>
                    </SystemTd>

                    <SystemTd className="text-center">
                      <div className="flex items-center justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                              title="Thao tác"
                            >
                              <MoreHorizontal size={15} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => navigate(`/supplier-debts?supplierId=${s.id}`)}
                            >
                              <Receipt size={14} className="text-[#5865f2]" />
                              <span>Xem sổ công nợ</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => navigate(`/supplier-debts?tab=LOANS&supplierId=${s.id}`)}
                            >
                              <Landmark size={14} className="text-amber-500" />
                              <span>Vay vốn & Cho vay</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => navigate(`/supplier-debts?tab=PRODUCT_BORROWS&supplierId=${s.id}`)}
                            >
                              <Boxes size={14} className="text-blue-500" />
                              <span>Mượn / Vay sản phẩm</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setViewingQrSupplier(s)}
                            >
                              <QrCode size={14} className="text-indigo-500" />
                              <span>Xem mã QR VietQR</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleOpenEditModal(s)}
                            >
                              <Edit2 size={14} className="text-gray-400" />
                              <span>Chỉnh sửa thông tin</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => handleOpenDeleteModal(s)}
                            >
                              <Trash2 size={14} />
                              <span>Xóa nhà cung cấp</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </SystemTd>
                  </SystemTr>
                );
              })
            )}
          </SystemTbody>
        </SystemTableWrapper>
      </div>

      {/* 5. Mobile Cards View */}
      <div className="md:hidden flex-1 flex flex-col min-h-fit space-y-3">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-gray-400 font-normal">
            Đang tải danh sách nhà cung cấp...
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400 font-normal">
            Không tìm thấy nhà cung cấp nào
          </div>
        ) : (
          paginatedSuppliers.map((s) => {
            const closingDebt = s.closingDebt || 0;
            const isPayable = closingDebt > 0;
            const isAdvance = closingDebt < 0;

            return (
              <div
                key={s.id}
                className="p-3.5 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 space-y-2.5 shadow-none"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold text-xs text-[#5865f2]">
                      {s.code}
                    </span>
                    <h3 className="font-semibold text-xs text-gray-900 dark:text-white mt-0.5">
                      {s.name}
                    </h3>
                    {((s.totalLoanDebt || 0) > 0 || (s.totalBorrowedProducts || 0) > 0) && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {(s.totalLoanDebt || 0) > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
                            Vay: {formatCurrency(s.totalLoanDebt || 0)}đ
                          </span>
                        )}
                        {(s.totalBorrowedProducts || 0) > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
                            Mượn {s.totalBorrowedProducts} sp
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        s.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                      }`}
                    >
                      {s.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/supplier-debts?supplierId=${s.id}`)}>
                          <Receipt size={14} className="text-[#5865f2]" />
                          <span>Xem sổ công nợ</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/supplier-debts?tab=LOANS&supplierId=${s.id}`)}>
                          <Landmark size={14} className="text-amber-500" />
                          <span>Vay vốn & Cho vay</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/supplier-debts?tab=PRODUCT_BORROWS&supplierId=${s.id}`)}>
                          <Boxes size={14} className="text-blue-500" />
                          <span>Mượn / Vay sản phẩm</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setViewingQrSupplier(s)}>
                          <QrCode size={14} className="text-indigo-500" />
                          <span>Xem mã QR VietQR</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenEditModal(s)}>
                          <Edit2 size={14} className="text-gray-400" />
                          <span>Chỉnh sửa</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => handleOpenDeleteModal(s)}>
                          <Trash2 size={14} />
                          <span>Xóa</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-gray-100 dark:border-gray-800">
                  <div>
                    <span className="text-[11px] text-gray-400 block">Liên hệ</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {s.phone || s.email || '--'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-gray-400 block">Dư nợ hiện tại</span>
                    <span
                      className={`font-mono font-bold ${
                        isPayable
                          ? 'text-rose-600 dark:text-rose-400'
                          : isAdvance
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-400'
                      }`}
                    >
                      {isPayable
                        ? `${formatCurrency(closingDebt)} đ`
                        : isAdvance
                        ? `-${formatCurrency(Math.abs(closingDebt))} đ`
                        : '0 đ'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {filteredSuppliers.length > limit && (
          <div className="pt-2 pb-6">
            <SystemPagination
              page={page - 1}
              totalPages={totalPages}
              totalItems={filteredSuppliers.length}
              setPage={(p) => setPage(p + 1)}
              itemsPerPage={limit}
              setItemsPerPage={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* MODAL 1: CREATE SUPPLIER */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => !isSubmitting && setIsCreateModalOpen(false)}
          title={
            <div className="flex items-center gap-2 min-w-0">
              <span className="sm:hidden font-semibold truncate">Thêm NCC mới</span>
              <span className="hidden sm:inline font-semibold truncate">Thêm mới Nhà cung cấp</span>
            </div>
          }
          subtitle={
            <div className="min-w-0 truncate">
              <span className="sm:hidden truncate">Tạo đối tác để quản lý nhập kho & công nợ</span>
              <span className="hidden sm:inline truncate">
                Tạo mới đối tác cung ứng vào hệ thống để quản lý nhập kho và công nợ
              </span>
            </div>
          }
          icon={Truck}
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 sm:space-y-3.5 text-xs p-3 sm:p-5">
              {/* 1. THÔNG TIN CƠ BẢN */}
              <div className="p-3 sm:p-3.5 bg-gray-50/80 dark:bg-gray-900/60 rounded border border-gray-200/80 dark:border-gray-800 space-y-2.5 sm:space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800 text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                  <Building2 className="w-3.5 h-3.5 text-[#5865f2]" />
                  <span>Thông tin định danh</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Hash size={13} className="text-[#5865f2]" />
                        <span>Mã NCC</span>
                      </span>
                      <span className="text-[10px] text-gray-400 font-normal">Hệ thống tự cấp</span>
                    </label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      tabIndex={-1}
                      value={createForm.code || 'Hệ thống tự động cấp'}
                      title="Mã được hệ thống tự động sinh ngầm khi lưu để đảm bảo tuyệt đối không bị trùng lặp"
                      className="w-full px-2.5 py-1.5 h-8 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded text-xs text-gray-500 dark:text-gray-400 font-mono font-bold cursor-not-allowed select-none pointer-events-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                      <Truck size={13} className="text-[#5865f2]" />
                      <span>Tên Nhà cung cấp *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      placeholder="VD: Công ty TNHH Phân Phối Hàng Tiêu Dùng Á Châu"
                      className="w-full px-2.5 py-1.5 h-8 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                      <Phone size={13} className="text-emerald-500" />
                      <span>Số điện thoại</span>
                    </label>
                    <input
                      type="text"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                      placeholder="0912 345 678"
                      className="w-full px-2.5 py-1.5 h-8 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                      <Mail size={13} className="text-blue-500" />
                      <span>Email</span>
                    </label>
                    <input
                      type="email"
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      placeholder="supplier@company.vn"
                      className="w-full px-2.5 py-1.5 h-8 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <MapPin size={13} className="text-amber-500" />
                    <span>Địa chỉ kho / Trụ sở</span>
                  </label>
                  <input
                    type="text"
                    value={createForm.address}
                    onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                    placeholder="VD: Cụm Công nghiệp Triều Khúc, Tân Triều, Thanh Trì, Hà Nội"
                    className="w-full px-2.5 py-1.5 h-8 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
                  />
                </div>
              </div>

              {/* 2. TÀI KHOẢN NGÂN HÀNG */}
              <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded border border-indigo-100 dark:border-indigo-900/40 space-y-2.5">
                <div className="flex items-center gap-1.5 pb-2 border-b border-indigo-100 dark:border-indigo-900/30 text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Tài khoản nhận thanh toán</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                      <Landmark size={12} className="text-indigo-500" />
                      <span>Ngân hàng</span>
                    </label>
                    <input
                      type="text"
                      value={createForm.bankName}
                      onChange={(e) => setCreateForm({ ...createForm, bankName: e.target.value })}
                      placeholder="MB, VCB, ACB..."
                      className="w-full px-2.5 py-1.5 h-8 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                      <CreditCard size={12} className="text-indigo-500" />
                      <span>Số tài khoản</span>
                    </label>
                    <input
                      type="text"
                      value={createForm.bankAccount}
                      onChange={(e) => setCreateForm({ ...createForm, bankAccount: e.target.value })}
                      placeholder="0123456789..."
                      className="w-full px-2.5 py-1.5 h-8 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                      <UserCheck size={12} className="text-indigo-500" />
                      <span>Chủ tài khoản</span>
                    </label>
                    <input
                      type="text"
                      value={createForm.bankBeneficiary}
                      onChange={(e) => setCreateForm({ ...createForm, bankBeneficiary: e.target.value })}
                      placeholder="NGUYEN VAN A"
                      className="w-full px-2.5 py-1.5 h-8 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 uppercase focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
                    />
                  </div>
                </div>
              </div>

              {/* 3. NỢ ĐẦU KỲ & TRẠNG THÁI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <DollarSign size={13} className="text-amber-500" />
                    <span>Nợ đầu kỳ (VND)</span>
                  </label>
                  <CurrencyInput
                    value={createForm.openingDebt}
                    onChange={(val) => setCreateForm({ ...createForm, openingDebt: val })}
                    placeholder="0"
                    suffix="đ"
                    inputClassName="px-2.5 py-1.5 h-8 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <CheckCircle size={13} className="text-emerald-500" />
                    <span>Trạng thái hoạt động</span>
                  </label>
                  <Select
                    value={createForm.status}
                    onChange={(val) => setCreateForm({ ...createForm, status: String(val) })}
                    options={[
                      { value: 'ACTIVE', label: 'Đang hoạt động (ACTIVE)' },
                      { value: 'INACTIVE', label: 'Tạm dừng (INACTIVE)' },
                    ]}
                    size="sm"
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                  <FileText size={13} className="text-gray-400" />
                  <span>Ghi chú thêm</span>
                </label>
                <textarea
                  value={createForm.note}
                  onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })}
                  placeholder="Ghi chú thêm về điều khoản công nợ, thời hạn thanh toán..."
                  rows={2}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal resize-none"
                />
              </div>
            </ModalBody>
            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                type="button"
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isSubmitting}
                className="gap-1.5 flex-none px-4 py-2.5 sm:py-1.5 text-xs font-semibold shrink-0"
              >
                <X size={14} />
                <span>Hủy</span>
              </ModalButton>
              <ModalButton
                type="submit"
                variant="primary"
                disabled={isSubmitting || !createForm.name.trim()}
                className="gap-1.5 flex-1 sm:flex-none py-2.5 sm:py-1.5 px-4 font-semibold text-xs active:scale-95 justify-center"
              >
                <Check size={14} />
                <span className="sm:hidden">{isSubmitting ? 'Đang tạo...' : 'Tạo NCC'}</span>
                <span className="hidden sm:inline">{isSubmitting ? 'Đang tạo...' : 'Tạo nhà cung cấp'}</span>
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* MODAL 2: EDIT SUPPLIER */}
      {isEditModalOpen && selectedSupplierForEdit && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => !isSubmitting && setIsEditModalOpen(false)}
          title={
            <div className="flex items-center gap-2 min-w-0">
              <span className="sm:hidden font-semibold truncate">Sửa: {selectedSupplierForEdit.code}</span>
              <span className="hidden sm:inline font-semibold truncate">Chỉnh sửa Nhà cung cấp: {selectedSupplierForEdit.code}</span>
            </div>
          }
          subtitle={
            <div className="min-w-0 truncate">
              <span className="sm:hidden truncate">Cập nhật: {selectedSupplierForEdit.name}</span>
              <span className="hidden sm:inline truncate">Cập nhật thông tin đối tác "{selectedSupplierForEdit.name}"</span>
            </div>
          }
          icon={Edit2}
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 sm:space-y-3.5 text-xs p-3 sm:p-5">
              {/* 1. THÔNG TIN CƠ BẢN */}
              <div className="p-3 sm:p-3.5 bg-gray-50/80 dark:bg-gray-900/60 rounded border border-gray-200/80 dark:border-gray-800 space-y-2.5 sm:space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800 text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                  <Building2 className="w-3.5 h-3.5 text-[#5865f2]" />
                  <span>Thông tin đối tác</span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <Truck size={13} className="text-[#5865f2]" />
                    <span>Tên Nhà cung cấp *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-2.5 py-1.5 h-8 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                      <Phone size={13} className="text-emerald-500" />
                      <span>Số điện thoại</span>
                    </label>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-2.5 py-1.5 h-8 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                      <Mail size={13} className="text-blue-500" />
                      <span>Email</span>
                    </label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-2.5 py-1.5 h-8 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <MapPin size={13} className="text-amber-500" />
                    <span>Địa chỉ</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full px-2.5 py-1.5 h-8 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
                  />
                </div>
              </div>

              {/* 2. TÀI KHOẢN NGÂN HÀNG */}
              <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded border border-indigo-100 dark:border-indigo-900/40 space-y-2.5">
                <div className="flex items-center gap-1.5 pb-2 border-b border-indigo-100 dark:border-indigo-900/30 text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Tài khoản nhận thanh toán</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                      <Landmark size={12} className="text-indigo-500" />
                      <span>Ngân hàng</span>
                    </label>
                    <input
                      type="text"
                      value={editForm.bankName}
                      onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
                      placeholder="Ngân hàng"
                      className="w-full px-2.5 py-1.5 h-8 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                      <CreditCard size={12} className="text-indigo-500" />
                      <span>Số tài khoản</span>
                    </label>
                    <input
                      type="text"
                      value={editForm.bankAccount}
                      onChange={(e) => setEditForm({ ...editForm, bankAccount: e.target.value })}
                      placeholder="Số tài khoản"
                      className="w-full px-2.5 py-1.5 h-8 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 font-mono focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                      <UserCheck size={12} className="text-indigo-500" />
                      <span>Chủ tài khoản</span>
                    </label>
                    <input
                      type="text"
                      value={editForm.bankBeneficiary}
                      onChange={(e) => setEditForm({ ...editForm, bankBeneficiary: e.target.value })}
                      placeholder="Chủ tài khoản"
                      className="w-full px-2.5 py-1.5 h-8 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 uppercase focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
                    />
                  </div>
                </div>
              </div>

              {/* 3. NỢ ĐẦU KỲ & TRẠNG THÁI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <DollarSign size={13} className="text-amber-500" />
                    <span>Nợ đầu kỳ (VND)</span>
                  </label>
                  <CurrencyInput
                    value={editForm.openingDebt}
                    onChange={(val) => setEditForm({ ...editForm, openingDebt: val })}
                    placeholder="0"
                    suffix="đ"
                    inputClassName="px-2.5 py-1.5 h-8 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <CheckCircle size={13} className="text-emerald-500" />
                    <span>Trạng thái</span>
                  </label>
                  <Select
                    value={editForm.status}
                    onChange={(val) => setEditForm({ ...editForm, status: String(val) })}
                    options={[
                      { value: 'ACTIVE', label: 'Đang hoạt động (ACTIVE)' },
                      { value: 'INACTIVE', label: 'Tạm dừng (INACTIVE)' },
                    ]}
                    size="sm"
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                  <FileText size={13} className="text-gray-400" />
                  <span>Ghi chú</span>
                </label>
                <textarea
                  value={editForm.note}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  rows={2}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal resize-none"
                />
              </div>
            </ModalBody>
            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSubmitting}
                className="gap-1.5 flex-none px-4 py-2.5 sm:py-1.5 text-xs font-semibold shrink-0"
              >
                <X size={14} />
                <span>Hủy</span>
              </ModalButton>
              <ModalButton
                type="submit"
                variant="primary"
                disabled={isSubmitting || !editForm.name.trim()}
                className="gap-1.5 flex-1 sm:flex-none py-2.5 sm:py-1.5 px-4 font-semibold text-xs active:scale-95 justify-center"
              >
                <Check size={14} />
                <span className="sm:hidden">{isSubmitting ? 'Đang lưu...' : 'Lưu'}</span>
                <span className="hidden sm:inline">{isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* MODAL 3: DELETE SUPPLIER */}
      {isDeleteModalOpen && selectedSupplierForDelete && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => !isSubmitting && setIsDeleteModalOpen(false)}
          title="Xác nhận xóa Nhà cung cấp"
          subtitle={`Bạn có chắc muốn xóa đối tác "${selectedSupplierForDelete.name}" (${selectedSupplierForDelete.code})?`}
          icon={Trash2}
          maxWidth="max-w-md"
        >
          <div className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3">
              <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Ràng buộc giao dịch hệ thống:</p>
                  <p className="text-amber-700 dark:text-amber-400/90 leading-relaxed">
                    - Không thể xóa nếu Nhà cung cấp đã có phát sinh phiếu nhập kho hoặc các chứng từ công nợ liên quan.<br />
                    - Nếu tạm dừng hợp tác, bạn nên chuyển trạng thái sang <strong>Tạm dừng (INACTIVE)</strong>.
                  </p>
                </div>
              </div>
            </ModalBody>
            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isSubmitting}
                className="gap-1.5 flex-none px-4 py-2.5 sm:py-1.5 text-xs font-semibold shrink-0"
              >
                Hủy
              </ModalButton>
              <ModalButton
                variant="danger"
                onClick={handleDeleteSubmit}
                disabled={isSubmitting}
                className="gap-1.5 flex-1 sm:flex-none py-2.5 sm:py-1.5 px-4 font-semibold text-xs active:scale-95 justify-center"
              >
                <span>{isSubmitting ? 'Đang xóa...' : 'Xác nhận xóa'}</span>
              </ModalButton>
            </ModalFooter>
          </div>
        </Modal>
      )}

      {/* MODAL XEM MÃ QR THANH TOÁN VIETQR */}
      <Modal
        isOpen={!!viewingQrSupplier}
        onClose={() => setViewingQrSupplier(null)}
        title={
          <div className="flex items-center gap-2">
            <span>Mã QR Chuyển Khoản VietQR</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              Napas 247
            </span>
          </div>
        }
        subtitle={viewingQrSupplier ? `${viewingQrSupplier.code} - ${viewingQrSupplier.name}` : ''}
        icon={QrCode}
        size="sm"
      >
        <ModalBody className="p-3 sm:p-5">
          {viewingQrSupplier && (
            <SupplierBankQr
              supplier={viewingQrSupplier}
              amount={viewingQrSupplier.closingDebt > 0 ? viewingQrSupplier.closingDebt : 0}
              description={`Thanh toan NCC ${viewingQrSupplier.code}`}
            />
          )}
        </ModalBody>
        <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
          <ModalButton
            type="button"
            variant="outline"
            onClick={() => setViewingQrSupplier(null)}
            className="gap-1.5 px-4 py-2 sm:py-1.5 text-xs font-semibold"
          >
            <X size={14} />
            <span>Đóng</span>
          </ModalButton>
          {viewingQrSupplier && (
            <ModalButton
              type="button"
              variant="primary"
              onClick={() => {
                const sId = viewingQrSupplier.id;
                setViewingQrSupplier(null);
                navigate(`/supplier-debts?supplierId=${sId}`);
              }}
              className="gap-1.5 px-4 py-2 sm:py-1.5 text-xs font-semibold"
            >
              <Receipt size={14} />
              <span>Xem công nợ & chi trả</span>
            </ModalButton>
          )}
        </ModalFooter>
      </Modal>
    </div>
  );
};
