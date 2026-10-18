import React, { useState, useEffect } from 'react';
import {
  Landmark,
  Plus,
  Search,
  DollarSign,
  Calendar,
  Eye,
  CreditCard,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  MoreHorizontal,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  X,
  UserCheck,
  FileText,
  QrCode,
  Building2,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import {
  supplierLoansApi,
  SupplierLoanModel,
  CreateSupplierLoanPayload,
  CreateSupplierLoanRepaymentPayload,
} from '../../services/supplierLoansApi';
import { SupplierItem } from '../../services/suppliersApi';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { CurrencyInput } from '../ui/CurrencyInput';
import { toast } from '../ui/Toast';
import {
  SystemTableWrapper,
  SystemThead,
  SystemTh,
  SystemTbody,
  SystemTr,
  SystemTd,
  SystemTableEmpty,
  SystemTableSkeleton,
} from '../ui/SystemTable';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/DropdownMenu';
import { SupplierBankQr } from './SupplierBankQr';
import { formatCurrency } from '../../utils';

export interface SupplierLoansTabProps {
  suppliers: SupplierItem[];
  onRefreshData?: () => void;
}

export const SupplierLoansTab: React.FC<SupplierLoansTabProps> = ({
  suppliers,
  onRefreshData,
}) => {
  const [loans, setLoans] = useState<SupplierLoanModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BORROWED_FROM_SUPPLIER' | 'LENT_TO_SUPPLIER'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PARTIALLY_REPAID' | 'SETTLED'>('ALL');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [summary, setSummary] = useState({
    totalBorrowed: 0,
    totalRemainingDebt: 0,
    totalLent: 0,
    totalRemainingReceivable: 0,
  });

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateSupplierLoanPayload>({
    supplierId: '',
    type: 'BORROWED_FROM_SUPPLIER',
    amount: 0,
    interestRate: 0,
    loanDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    fundSource: 'BANK_ACCOUNT',
    paymentMethod: 'BANK_TRANSFER',
    referenceCode: '',
    note: '',
  });

  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
  const [selectedLoanForRepay, setSelectedLoanForRepay] = useState<SupplierLoanModel | null>(null);
  const [repayForm, setRepayForm] = useState<CreateSupplierLoanRepaymentPayload>({
    loanId: '',
    amount: 0,
    repaymentDate: new Date().toISOString().split('T')[0],
    payerName: 'HieuNT',
    fundSource: 'BANK_ACCOUNT',
    paymentMethod: 'BANK_TRANSFER',
    referenceCode: '',
    note: '',
  });

  const [selectedLoanDetail, setSelectedLoanDetail] = useState<SupplierLoanModel | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [qrModalLoan, setQrModalLoan] = useState<SupplierLoanModel | null>(null);

  useEffect(() => {
    loadLoans();
  }, [typeFilter, statusFilter, page]);

  const loadLoans = async () => {
    try {
      setIsLoading(true);
      const res = await supplierLoansApi.findAll({
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: searchTerm.trim() || undefined,
        page,
        limit,
      });

      const list = res.items || res.data || [];
      setLoans(list);
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err: any) {
      console.error('Lỗi tải danh sách khoản vay:', err);
      toast.error('Không thể tải danh sách khoản vay');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateModal = (type: 'BORROWED_FROM_SUPPLIER' | 'LENT_TO_SUPPLIER' = 'BORROWED_FROM_SUPPLIER') => {
    setCreateForm({
      supplierId: suppliers[0]?.id || '',
      type,
      amount: 0,
      interestRate: 0,
      loanDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      fundSource: 'BANK_ACCOUNT',
      paymentMethod: 'BANK_TRANSFER',
      referenceCode: '',
      note: '',
    });
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.supplierId) {
      toast.error('Vui lòng chọn Nhà cung cấp');
      return;
    }
    if (createForm.amount <= 0) {
      toast.error('Số tiền vay/cho vay phải lớn hơn 0');
      return;
    }

    try {
      await supplierLoansApi.create(createForm);
      toast.success(
        createForm.type === 'BORROWED_FROM_SUPPLIER'
          ? 'Đã tạo hợp đồng vay vốn từ NCC thành công'
          : 'Đã tạo hợp đồng cho NCC vay vốn thành công',
      );
      setIsCreateModalOpen(false);
      loadLoans();
      onRefreshData?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi tạo khoản vay');
    }
  };

  const handleOpenRepayModal = (loan: SupplierLoanModel) => {
    setSelectedLoanForRepay(loan);
    setRepayForm({
      loanId: loan.id,
      amount: loan.remainingAmount,
      repaymentDate: new Date().toISOString().split('T')[0],
      payerName: 'HieuNT',
      fundSource: 'BANK_ACCOUNT',
      paymentMethod: 'BANK_TRANSFER',
      referenceCode: '',
      note: '',
    });
    setIsRepayModalOpen(true);
  };

  const handleRepaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanForRepay) return;
    if (repayForm.amount <= 0) {
      toast.error('Số tiền trả phải lớn hơn 0');
      return;
    }
    if (repayForm.amount > selectedLoanForRepay.remainingAmount) {
      toast.error('Số tiền trả không được vượt quá số dư nợ còn lại');
      return;
    }

    try {
      await supplierLoansApi.repay(repayForm);
      toast.success('Đã ghi nhận thanh toán trả nợ vay thành công');
      setIsRepayModalOpen(false);
      loadLoans();
      onRefreshData?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi trả nợ vay');
    }
  };

  const handleOpenDetail = (loan: SupplierLoanModel) => {
    setSelectedLoanDetail(loan);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="space-y-3.5">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h3 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
            <Landmark size={15} className="text-[#5865f2]" />
            <span>Đối tác Tài chính: Vay Vốn & Cho Vay Nhà Cung Cấp</span>
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            Quản lý dòng tiền vay vốn kinh doanh, ứng vốn nguyên liệu và theo dõi lịch sử trả nợ theo từng NCC
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            onClick={() => handleOpenCreateModal('BORROWED_FROM_SUPPLIER')}
            className="gap-1.5 bg-[#5865f2] hover:bg-[#4752c4] text-white"
          >
            <Plus size={14} />
            <span>+ Vay tiền từ NCC</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenCreateModal('LENT_TO_SUPPLIER')}
            className="gap-1.5 text-blue-600 border-blue-200 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-950/20"
          >
            <ArrowUpRight size={14} />
            <span>+ Cho NCC vay vốn</span>
          </Button>
          <Button size="sm" variant="outline" onClick={loadLoans} className="p-2" title="Làm mới">
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* 2. Mini KPI Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
        <div className="p-2.5 sm:p-3 rounded bg-white dark:bg-[#161a22] border border-gray-200 dark:border-gray-800">
          <div className="text-gray-500 flex items-center gap-1 text-[11px]">
            <ArrowDownLeft size={12} className="text-purple-500" />
            <span>Tổng tiền đã vay NCC</span>
          </div>
          <div className="text-sm sm:text-base font-bold font-mono text-purple-600 dark:text-purple-400 mt-0.5">
            {formatCurrency(summary.totalBorrowed)} đ
          </div>
        </div>

        <div className="p-2.5 sm:p-3 rounded bg-white dark:bg-[#161a22] border border-gray-200 dark:border-gray-800">
          <div className="text-gray-500 flex items-center gap-1 text-[11px]">
            <AlertTriangle size={12} className="text-rose-500" />
            <span>Dư nợ vay còn phải trả</span>
          </div>
          <div className="text-sm sm:text-base font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
            {formatCurrency(summary.totalRemainingDebt)} đ
          </div>
        </div>

        <div className="p-2.5 sm:p-3 rounded bg-white dark:bg-[#161a22] border border-gray-200 dark:border-gray-800">
          <div className="text-gray-500 flex items-center gap-1 text-[11px]">
            <ArrowUpRight size={12} className="text-blue-500" />
            <span>Tổng tiền cho NCC vay</span>
          </div>
          <div className="text-sm sm:text-base font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
            {formatCurrency(summary.totalLent)} đ
          </div>
        </div>

        <div className="p-2.5 sm:p-3 rounded bg-white dark:bg-[#161a22] border border-gray-200 dark:border-gray-800">
          <div className="text-gray-500 flex items-center gap-1 text-[11px]">
            <CheckCircle2 size={12} className="text-emerald-500" />
            <span>Dư nợ NCC còn nợ shop</span>
          </div>
          <div className="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
            {formatCurrency(summary.totalRemainingReceivable)} đ
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 bg-white dark:bg-[#161a22] rounded border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-sm">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm theo mã khoản vay, tên NCC, ghi chú..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadLoans()}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-[#111318] border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:border-[#5865f2]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={typeFilter}
            onChange={(val) => setTypeFilter(val as any)}
            options={[
              { value: 'ALL', label: 'Tất cả hình thức' },
              { value: 'BORROWED_FROM_SUPPLIER', label: 'Shop vay từ NCC' },
              { value: 'LENT_TO_SUPPLIER', label: 'Shop cho NCC vay' },
            ]}
            size="sm"
            className="w-44"
          />

          <Select
            value={statusFilter}
            onChange={(val) => setStatusFilter(val as any)}
            options={[
              { value: 'ALL', label: 'Tất cả trạng thái' },
              { value: 'ACTIVE', label: 'Đang còn nợ' },
              { value: 'PARTIALLY_REPAID', label: 'Đã trả một phần' },
              { value: 'SETTLED', label: 'Đã tất toán' },
            ]}
            size="sm"
            className="w-40"
          />
        </div>
      </div>

      {/* 4. Desktop Table View */}
      <div className="hidden md:block">
        <SystemTableWrapper tableClassName="min-w-[1050px]">
          <SystemThead>
            <SystemTh className="w-14 text-center">STT</SystemTh>
            <SystemTh className="w-40">Mã Khoản Vay</SystemTh>
            <SystemTh className="w-56">Nhà Cung Cấp</SystemTh>
            <SystemTh className="w-40 text-center">Hình Thức</SystemTh>
            <SystemTh className="w-32 text-right">Số Tiền Vay</SystemTh>
            <SystemTh className="w-32 text-right">Đã Trả / Thu</SystemTh>
            <SystemTh className="w-32 text-right">Dư Nợ Còn Lại</SystemTh>
            <SystemTh className="w-32 text-center">Ngày Vay / Hạn</SystemTh>
            <SystemTh className="w-32 text-center">Trạng Thái</SystemTh>
            <SystemTh className="w-24 text-center">Thao Tác</SystemTh>
          </SystemThead>
          <SystemTbody>
            {isLoading ? (
              <SystemTableSkeleton cols={10} rows={5} />
            ) : loans.length === 0 ? (
              <SystemTableEmpty
                title="Chưa có khoản vay nào"
                description="Bạn chưa tạo hợp đồng vay vốn hoặc cho vay nào với các nhà cung cấp."
                colSpan={10}
              />
            ) : (
              loans.map((loan, idx) => {
                const isBorrow = loan.type === 'BORROWED_FROM_SUPPLIER';
                const isSettled = loan.status === 'SETTLED';

                return (
                  <SystemTr key={loan.id} className="cursor-pointer" onClick={() => handleOpenDetail(loan)}>
                    <SystemTd align="center" className="text-gray-400 text-xs">
                      {idx + 1}
                    </SystemTd>
                    <SystemTd>
                      <div className="font-mono font-bold text-xs text-[#5865f2] hover:underline">
                        {loan.loanCode}
                      </div>
                      {loan.referenceCode && (
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                          Số GD: {loan.referenceCode}
                        </div>
                      )}
                    </SystemTd>
                    <SystemTd>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {loan.supplier?.name}
                      </div>
                      <div className="text-[11px] font-mono text-gray-400 mt-0.5">
                        {loan.supplier?.code} • {loan.supplier?.phone || 'Chưa có SĐT'}
                      </div>
                    </SystemTd>
                    <SystemTd align="center">
                      {isBorrow ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                          <ArrowDownLeft size={11} />
                          <span>Shop vay NCC</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                          <ArrowUpRight size={11} />
                          <span>Cho NCC vay</span>
                        </span>
                      )}
                    </SystemTd>
                    <SystemTd className="text-right font-mono font-medium text-gray-900 dark:text-white">
                      {formatCurrency(loan.amount)} đ
                    </SystemTd>
                    <SystemTd className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(loan.repaidAmount)} đ
                    </SystemTd>
                    <SystemTd className="text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      {formatCurrency(loan.remainingAmount)} đ
                    </SystemTd>
                    <SystemTd align="center" className="text-xs text-gray-500">
                      <div>{loan.loanDate ? new Date(loan.loanDate).toLocaleDateString('vi-VN') : ''}</div>
                      {loan.dueDate && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                          Hạn: {new Date(loan.dueDate).toLocaleDateString('vi-VN')}
                        </div>
                      )}
                    </SystemTd>
                    <SystemTd align="center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isSettled
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : loan.status === 'PARTIALLY_REPAID'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {isSettled
                          ? 'Đã tất toán'
                          : loan.status === 'PARTIALLY_REPAID'
                          ? 'Đã trả 1 phần'
                          : 'Đang còn nợ'}
                      </span>
                    </SystemTd>
                    <SystemTd align="center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {!isSettled && (
                          <button
                            type="button"
                            onClick={() => handleOpenRepayModal(loan)}
                            className="px-2 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium cursor-pointer shadow-2xs active:scale-95 transition-all"
                            title={isBorrow ? 'Trả nợ vay cho NCC' : 'Thu nợ từ NCC'}
                          >
                            <span>{isBorrow ? 'Trả nợ' : 'Thu nợ'}</span>
                          </button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                            >
                              <MoreHorizontal size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDetail(loan)}>
                              <Eye size={13} className="text-[#5865f2]" />
                              <span>Xem chi tiết hợp đồng</span>
                            </DropdownMenuItem>
                            {!isSettled && (
                              <DropdownMenuItem onClick={() => handleOpenRepayModal(loan)}>
                                <CreditCard size={13} className="text-emerald-500" />
                                <span>{isBorrow ? 'Ghi nhận đợt trả nợ' : 'Ghi nhận thu nợ'}</span>
                              </DropdownMenuItem>
                            )}
                            {loan.supplier?.bankAccount && (
                              <DropdownMenuItem onClick={() => setQrModalLoan(loan)}>
                                <QrCode size={13} className="text-indigo-500" />
                                <span>Xem VietQR chuyển khoản</span>
                              </DropdownMenuItem>
                            )}
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
      <div className="md:hidden space-y-2.5">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-gray-400">Đang tải danh sách khoản vay...</div>
        ) : loans.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">Chưa có khoản vay nào</div>
        ) : (
          loans.map((loan) => {
            const isBorrow = loan.type === 'BORROWED_FROM_SUPPLIER';
            const isSettled = loan.status === 'SETTLED';

            return (
              <div
                key={loan.id}
                onClick={() => handleOpenDetail(loan)}
                className="p-3 bg-white dark:bg-[#161a22] rounded border border-gray-200 dark:border-gray-800 space-y-2 text-xs cursor-pointer shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono font-bold text-xs text-[#5865f2]">{loan.loanCode}</div>
                    <div className="font-semibold text-gray-900 dark:text-white mt-0.5">
                      {loan.supplier?.name}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      isSettled
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    {isSettled ? 'Đã tất toán' : 'Còn nợ'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 p-2 bg-gray-50 dark:bg-[#12151b] rounded text-[11px]">
                  <div>
                    <span className="text-gray-400">Số tiền vay:</span>
                    <div className="font-mono font-medium text-gray-900 dark:text-white">
                      {formatCurrency(loan.amount)} đ
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Dư nợ còn lại:</span>
                    <div className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      {formatCurrency(loan.remainingAmount)} đ
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
                  <span>{loan.loanDate ? new Date(loan.loanDate).toLocaleDateString('vi-VN') : ''}</span>
                  {!isSettled && (
                    <button
                      type="button"
                      onClick={() => handleOpenRepayModal(loan)}
                      className="px-2.5 py-1 text-xs rounded bg-emerald-600 text-white font-semibold"
                    >
                      {isBorrow ? 'Trả nợ' : 'Thu nợ'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: TẠO HỢP ĐỒNG VAY VỐN / CHO VAY */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={
          createForm.type === 'BORROWED_FROM_SUPPLIER'
            ? 'Lập Hợp Đồng Vay Vốn Từ Nhà Cung Cấp'
            : 'Lập Hợp Đồng Cho Nhà Cung Cấp Vay Vốn'
        }
        subtitle="Hệ thống tự động ghi nhận tiền vào/ra Sổ Quỹ và theo dõi công nợ vay"
        icon={Landmark}
        size="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <ModalBody className="space-y-3 p-3 sm:p-5 text-xs">
            <div>
              <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                <Building2 size={13} className="text-[#5865f2]" />
                <span>Nhà Cung Cấp đối tác *</span>
              </label>
              <Select
                value={createForm.supplierId}
                onChange={(val) => setCreateForm({ ...createForm, supplierId: val })}
                options={suppliers.map((s) => ({
                  value: s.id,
                  label: `${s.code} - ${s.name}`,
                }))}
                size="sm"
                searchable
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <ArrowDownLeft size={13} className="text-purple-500" />
                  <span>Hình thức hợp đồng *</span>
                </label>
                <Select
                  value={createForm.type}
                  onChange={(val) => setCreateForm({ ...createForm, type: val as any })}
                  options={[
                    { value: 'BORROWED_FROM_SUPPLIER', label: 'Shop vay tiền từ NCC (+ Quỹ shop)' },
                    { value: 'LENT_TO_SUPPLIER', label: 'Shop cho NCC vay vốn (- Quỹ shop)' },
                  ]}
                  size="sm"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <DollarSign size={13} className="text-emerald-500" />
                  <span>Số tiền vay (đ) *</span>
                </label>
                <CurrencyInput
                  value={createForm.amount}
                  onChange={(amt) => setCreateForm({ ...createForm, amount: amt })}
                  suffix="đ"
                  inputClassName="h-8 font-mono font-bold text-emerald-600 dark:text-emerald-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <Calendar size={13} className="text-blue-500" />
                  <span>Ngày vay vốn</span>
                </label>
                <input
                  type="date"
                  value={createForm.loanDate}
                  onChange={(e) => setCreateForm({ ...createForm, loanDate: e.target.value })}
                  className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <Clock size={13} className="text-amber-500" />
                  <span>Hạn thanh toán nợ vay</span>
                </label>
                <input
                  type="date"
                  value={createForm.dueDate}
                  onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
                  className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <Wallet size={13} className="text-[#5865f2]" />
                  <span>Tài khoản tiền giải ngân</span>
                </label>
                <Select
                  value={createForm.fundSource}
                  onChange={(val) => setCreateForm({ ...createForm, fundSource: val as any })}
                  options={[
                    { value: 'BANK_ACCOUNT', label: 'Tài khoản ngân hàng công ty' },
                    { value: 'CASH_FUND', label: 'Quỹ tiền mặt của shop' },
                  ]}
                  size="sm"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <FileText size={13} className="text-gray-400" />
                  <span>Mã GD / Số hợp đồng</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: HDV-20261018-01..."
                  value={createForm.referenceCode}
                  onChange={(e) => setCreateForm({ ...createForm, referenceCode: e.target.value })}
                  className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs font-mono uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Ghi chú mục đích vay</label>
              <input
                type="text"
                placeholder="VD: Vay vốn nhập hàng cao điểm mùa đông, lãi suất thỏa thuận..."
                value={createForm.note}
                onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })}
                className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs"
              />
            </div>
          </ModalBody>

          <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
            <ModalButton type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Hủy
            </ModalButton>
            <ModalButton type="submit" variant="primary" className="bg-[#5865f2] text-white">
              <CheckCircle2 size={14} />
              <span>Xác nhận tạo hợp đồng</span>
            </ModalButton>
          </ModalFooter>
        </form>
      </Modal>

      {/* MODAL 2: TRẢ NỢ / THU NỢ VAY */}
      <Modal
        isOpen={isRepayModalOpen}
        onClose={() => setIsRepayModalOpen(false)}
        title={
          selectedLoanForRepay?.type === 'BORROWED_FROM_SUPPLIER'
            ? 'Ghi Nhận Trả Nợ Vay Cho NCC'
            : 'Ghi Nhận Thu Nợ Cho NCC Vay'
        }
        subtitle={selectedLoanForRepay ? `Hợp đồng: ${selectedLoanForRepay.loanCode} - ${selectedLoanForRepay.supplier?.name}` : ''}
        icon={CreditCard}
        size="md"
      >
        <form onSubmit={handleRepaySubmit} className="space-y-4">
          <ModalBody className="space-y-3 p-3 sm:p-5 text-xs">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-900/30 flex justify-between">
              <div>
                <span className="text-gray-400">Tiền gốc vay:</span>
                <div className="font-mono font-bold text-gray-900 dark:text-white mt-0.5">
                  {formatCurrency(selectedLoanForRepay?.amount || 0)} đ
                </div>
              </div>
              <div className="text-right">
                <span className="text-rose-500 font-medium">Dư nợ còn lại:</span>
                <div className="font-mono font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                  {formatCurrency(selectedLoanForRepay?.remainingAmount || 0)} đ
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                <DollarSign size={13} className="text-emerald-500" />
                <span>Số tiền thanh toán đợt này (đ) *</span>
              </label>
              <CurrencyInput
                value={repayForm.amount}
                onChange={(amt) => setRepayForm({ ...repayForm, amount: amt })}
                suffix="đ"
                inputClassName="h-8 font-mono font-bold text-emerald-600 dark:text-emerald-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <UserCheck size={13} className="text-purple-500" />
                  <span>Người thực hiện</span>
                </label>
                <input
                  type="text"
                  value={repayForm.payerName}
                  onChange={(e) => setRepayForm({ ...repayForm, payerName: e.target.value })}
                  className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <Wallet size={13} className="text-[#5865f2]" />
                  <span>Nguồn tiền chi/thu</span>
                </label>
                <Select
                  value={repayForm.fundSource}
                  onChange={(val) => setRepayForm({ ...repayForm, fundSource: val as any })}
                  options={[
                    { value: 'BANK_ACCOUNT', label: 'Tài khoản ngân hàng' },
                    { value: 'CASH_FUND', label: 'Quỹ tiền mặt' },
                  ]}
                  size="sm"
                  className="w-full"
                />
              </div>
            </div>

            {/* VietQR if paying back to supplier */}
            {selectedLoanForRepay?.type === 'BORROWED_FROM_SUPPLIER' && selectedLoanForRepay.supplier && (
              <SupplierBankQr
                supplier={selectedLoanForRepay.supplier}
                amount={repayForm.amount}
                description={repayForm.referenceCode || `Tra no hop dong ${selectedLoanForRepay.loanCode}`}
              />
            )}
          </ModalBody>

          <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
            <ModalButton type="button" variant="outline" onClick={() => setIsRepayModalOpen(false)}>
              Hủy
            </ModalButton>
            <ModalButton type="submit" variant="primary" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 size={14} />
              <span>Xác nhận thanh toán nợ</span>
            </ModalButton>
          </ModalFooter>
        </form>
      </Modal>

      {/* MODAL 3: CHI TIẾT KHOẢN VAY & LỊCH SỬ TRẢ */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Chi tiết: ${selectedLoanDetail?.loanCode || ''}`}
        subtitle={`${selectedLoanDetail?.supplier?.name} • ${
          selectedLoanDetail?.type === 'BORROWED_FROM_SUPPLIER' ? 'Shop vay NCC' : 'Shop cho NCC vay'
        }`}
        icon={Landmark}
        size="lg"
      >
        <ModalBody className="space-y-4 p-4 text-xs">
          <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded text-center">
            <div>
              <span className="text-gray-400">Tiền gốc vay</span>
              <div className="font-mono font-bold text-gray-900 dark:text-white text-sm mt-0.5">
                {formatCurrency(selectedLoanDetail?.amount || 0)} đ
              </div>
            </div>
            <div>
              <span className="text-gray-400">Đã thanh toán</span>
              <div className="font-mono font-bold text-emerald-600 text-sm mt-0.5">
                {formatCurrency(selectedLoanDetail?.repaidAmount || 0)} đ
              </div>
            </div>
            <div>
              <span className="text-gray-400">Dư nợ còn lại</span>
              <div className="font-mono font-bold text-rose-600 text-sm mt-0.5">
                {formatCurrency(selectedLoanDetail?.remainingAmount || 0)} đ
              </div>
            </div>
          </div>

          <div className="border border-gray-200 dark:border-gray-800 rounded overflow-hidden">
            <div className="bg-gray-100 dark:bg-gray-800/80 px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">
              Lịch sử các đợt thanh toán trả nợ ({selectedLoanDetail?.repayments?.length || 0})
            </div>
            <div className="p-3">
              {selectedLoanDetail?.repayments && selectedLoanDetail.repayments.length > 0 ? (
                <div className="space-y-2">
                  {selectedLoanDetail.repayments.map((rep) => (
                    <div key={rep.id} className="p-2.5 bg-gray-50 dark:bg-[#12151b] rounded flex justify-between items-center">
                      <div>
                        <div className="font-mono font-bold text-gray-900 dark:text-white">
                          {rep.repaymentCode}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {rep.payerName} chi • {rep.repaymentDate ? new Date(rep.repaymentDate).toLocaleDateString('vi-VN') : ''}
                        </div>
                      </div>
                      <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        +{formatCurrency(rep.amount)} đ
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-400 py-3 italic">Chưa có đợt thanh toán nào</div>
              )}
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <ModalButton variant="outline" onClick={() => setIsDetailModalOpen(false)}>
            Đóng
          </ModalButton>
        </ModalFooter>
      </Modal>

      {/* MODAL 4: QR CODE VIETQR */}
      {qrModalLoan && (
        <Modal
          isOpen={!!qrModalLoan}
          onClose={() => setQrModalLoan(null)}
          title={`Mã QR Chuyển khoản - ${qrModalLoan.supplier?.name}`}
          icon={QrCode}
          size="md"
        >
          <ModalBody className="p-4">
            <SupplierBankQr
              supplier={qrModalLoan.supplier}
              amount={qrModalLoan.remainingAmount}
              description={`Tra no hop dong ${qrModalLoan.loanCode}`}
            />
          </ModalBody>
          <ModalFooter>
            <ModalButton variant="outline" onClick={() => setQrModalLoan(null)}>
              Đóng
            </ModalButton>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
};
