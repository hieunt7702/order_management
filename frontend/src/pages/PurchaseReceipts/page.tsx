import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PackagePlus,
  Search,
  Filter,
  Plus,
  Calendar,
  AlertCircle,
  Clock,
  DollarSign,
  Truck,
  Eye,
  Trash2,
  CreditCard,
  Building2,
  ChevronRight,
  Receipt,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileText,
  RefreshCw,
  MoreHorizontal,
  Warehouse,
  Store,
  Boxes,
  Package,
  ShieldCheck,
  User,
  Wallet,
  Percent,
  X,
  SlidersHorizontal,
  QrCode,
  TrendingUp,
  Pencil,
} from 'lucide-react';
import { purchaseReceiptsApi, PurchaseReceiptModel, CreatePurchaseReceiptPayload, PurchaseReceiptsSummary } from '../../services/purchaseReceiptsApi';
import { suppliersApi, SupplierItem } from '../../services/suppliersApi';
import { supplierPaymentsApi } from '../../services/supplierPaymentsApi';
import { productsApi } from '../../services/productsApi';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import { confirmModal } from '../../components/ui/ConfirmModal';
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
import {
  SystemFilter,
  SystemFilterItem,
  SystemFilterSearch,
  SystemFilterReset,
} from '../../components/ui/SystemFilter';
import { Button } from '../../components/ui/Button';
import { SystemMetricPairCard } from '../../components/ui/SystemMetricCard';
import { Select } from '../../components/ui/Select';
import { SystemDatePicker } from '../../components/ui/SystemDatePicker';
import { Checkbox } from '../../components/ui/Checkbox';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import { toast } from '../../components/ui/Toast';
import { QuickCreateSupplierModal } from '../../components/suppliers/QuickCreateSupplierModal';
import { EditPurchaseReceiptModal } from '../../components/suppliers/EditPurchaseReceiptModal';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../../components/ui/DropdownMenu';

const formatDateTime = (dateStr?: string | Date | null) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${time} ${date}`;
};

export const PurchaseReceiptsPage: React.FC = () => {
  const { warehouses, shops, selectedWarehouseId } = useWorkspaceStore();

  const [receipts, setReceipts] = useState<PurchaseReceiptModel[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [allVariants, setAllVariants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('ALL');
  const [selectedShopId, setSelectedShopId] = useState<string>('ALL');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('ALL');
  const [filterReceivingStatus, setFilterReceivingStatus] = useState<string>('ALL');
  const [filterDueStatus, setFilterDueStatus] = useState<string>('ALL');
  const [datePreset, setDatePreset] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [apiSummary, setApiSummary] = useState<PurchaseReceiptsSummary | null>(null);

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedReceiptDetail, setSelectedReceiptDetail] = useState<PurchaseReceiptModel | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingReceipt, setEditingReceipt] = useState<PurchaseReceiptModel | null>(null);

  // Receipt Items Modal (Xem danh sách hàng nhập)
  const [selectedReceiptForItems, setSelectedReceiptForItems] = useState<PurchaseReceiptModel | null>(null);
  const [isReceiptItemsModalOpen, setIsReceiptItemsModalOpen] = useState<boolean>(false);

  const handleOpenReceiptItemsModal = (receipt: PurchaseReceiptModel) => {
    setSelectedReceiptForItems(receipt);
    setIsReceiptItemsModalOpen(true);
  };

  // Quick Create Supplier Modal
  const [isQuickSupplierModalOpen, setIsQuickSupplierModalOpen] = useState<boolean>(false);
  const [quickSupplierInitialName, setQuickSupplierInitialName] = useState<string>('');

  // Quick Payment Modal
  const [quickPayReceipt, setQuickPayReceipt] = useState<PurchaseReceiptModel | null>(null);
  const [quickPayForm, setQuickPayForm] = useState({
    amount: 0,
    payerName: 'HieuNT',
    fundSource: 'CASH_FUND' as 'CASH_FUND' | 'BANK_ACCOUNT' | 'PERSONAL_FUND',
    paymentMethod: 'BANK_TRANSFER',
    referenceCode: '',
    note: '',
  });

  // Create Form State
  const initialCreateForm: CreatePurchaseReceiptPayload = {
    supplierId: '',
    warehouseId: selectedWarehouseId || (warehouses[0]?.id || ''),
    shopId: undefined,
    receiptCode: '',
    receiptDate: new Date().toISOString().split('T')[0],
    paymentDueDate: '',
    discountAmount: 0,
    taxAmount: 0,
    shippingFee: 0,
    shippingFeePayerType: 'PAID_TO_SUPPLIER',
    note: '',
    items: [
      {
        variantId: '',
        productName: '',
        variationName: '',
        sku: '',
        orderedQuantity: 1,
        receivedQuantity: 1,
        disputedQuantity: 0,
        unitPrice: 0,
        note: '',
      },
    ],
    immediatePayment: false,
    immediatePaymentAmount: 0,
    immediatePayerName: 'Kế toán',
    immediateFundSource: 'BANK_ACCOUNT',
    immediatePaymentMethod: 'BANK_TRANSFER',
  };

  const [createForm, setCreateForm] = useState<CreatePurchaseReceiptPayload>(initialCreateForm);

  useEffect(() => {
    loadSuppliers();
    loadVariants();
  }, []);

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    setPage(1);
    const now = new Date();
    const formatYMD = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'TODAY') {
      const todayStr = formatYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'YESTERDAY') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = formatYMD(yesterday);
      setStartDate(yesterdayStr);
      setEndDate(yesterdayStr);
    } else if (preset === 'LAST_7_DAYS') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(formatYMD(past));
      setEndDate(formatYMD(now));
    } else if (preset === 'LAST_30_DAYS') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStartDate(formatYMD(past));
      setEndDate(formatYMD(now));
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(lastDay));
    } else if (preset === 'LAST_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(lastDay));
    } else if (preset === 'CUSTOM') {
      // Giữ nguyên khoảng ngày tùy chọn
    }
  };

  useEffect(() => {
    loadReceipts();
  }, [
    page,
    limit,
    selectedSupplierId,
    selectedShopId,
    filterPaymentStatus,
    filterReceivingStatus,
    filterDueStatus,
    startDate,
    endDate,
  ]);

  const loadSuppliers = async () => {
    try {
      const res: any = await suppliersApi.findAll({ status: 'ACTIVE' });
      const data = res?.data || (Array.isArray(res) ? res : res?.items || []);
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Lỗi tải nhà cung cấp:', err);
    }
  };

  const loadVariants = async () => {
    try {
      const res: any = await productsApi.findAllVariants({ limit: 1000 });
      const items = res?.items || res?.data || (Array.isArray(res) ? res : []);
      setAllVariants(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error('Lỗi tải danh mục biến thể:', err);
    }
  };

  const loadReceipts = async () => {
    try {
      setIsLoading(true);
      const res = await purchaseReceiptsApi.findAll({
        page,
        limit,
        supplierId: selectedSupplierId === 'ALL' ? undefined : selectedSupplierId,
        shopId: selectedShopId === 'ALL' ? undefined : selectedShopId,
        paymentStatus: filterPaymentStatus === 'ALL' ? undefined : filterPaymentStatus,
        receivingStatus: filterReceivingStatus === 'ALL' ? undefined : filterReceivingStatus,
        dueStatus: filterDueStatus === 'ALL' ? undefined : filterDueStatus,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: searchTerm.trim() || undefined,
      });

      const resp = (res as any)?.data || res;
      const list = resp?.items || resp?.data || (Array.isArray(resp) ? resp : []);
      setReceipts(Array.isArray(list) ? list : []);
      setTotal(resp?.total || resp?.meta?.total || (Array.isArray(list) ? list.length : 0));
      setTotalPages(resp?.totalPages || resp?.meta?.totalPages || 1);
      if (resp?.summary) {
        setApiSummary(resp.summary);
      } else {
        setApiSummary(null);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách phiếu nhập:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // KPI calculations (Ưu tiên summary tổng hợp toàn bộ từ backend, fallback theo list hiển thị)
  const totalItemsVal = apiSummary
    ? apiSummary.totalItemsAmount
    : receipts.reduce((sum, r) => sum + Number(r.totalItemsAmount || 0), 0);

  const totalPayableVal = apiSummary
    ? apiSummary.payableAmount
    : receipts.reduce((sum, r) => sum + Number(r.payableAmount || 0), 0);

  const totalPaidOnlyVal = apiSummary
    ? apiSummary.paidAmount
    : receipts.reduce((sum, r) => sum + Number(r.paidAmount || 0), 0);

  const totalReturnDeductionVal = apiSummary
    ? apiSummary.returnDeductionAmount
    : receipts.reduce((sum, r) => sum + Number(r.returnDeductionAmount || 0), 0);

  // Đã thanh toán / Cấn trừ = Tiền mặt/CK đã trả + Tiền trả hàng cấn trừ nợ NCC
  const totalPaidAndOffsetVal = apiSummary
    ? apiSummary.totalPaidAndOffsetAmount
    : receipts.reduce(
        (sum, r) => sum + Number(r.paidAmount || 0) + Number(r.returnDeductionAmount || 0),
        0,
      );

  const totalRemainingVal = apiSummary
    ? apiSummary.remainingAmount
    : receipts.reduce((sum, r) => sum + Number(r.remainingAmount || 0), 0);

  // Form Item Handlers
  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...createForm.items];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-fill product info if variantId changed
    if (field === 'variantId') {
      const v = allVariants.find((item) => item.id === value);
      if (v) {
        updated[index].sku = v.sku || '';
        updated[index].productName = v.product?.name || v.productName || v.name || '';
        updated[index].variationName =
          v.name && v.name !== 'Mặc định' && v.name !== (v.product?.name || v.productName)
            ? v.name
            : '';
        updated[index].unitPrice = Number(v.costPrice || 0);
      } else {
        updated[index].sku = '';
        updated[index].productName = '';
        updated[index].variationName = '';
        updated[index].unitPrice = 0;
      }
    }

    setCreateForm({ ...createForm, items: updated });
  };

  const addItemRow = () => {
    setCreateForm({
      ...createForm,
      items: [
        ...createForm.items,
        {
          variantId: '',
          productName: '',
          variationName: '',
          sku: '',
          orderedQuantity: 1,
          receivedQuantity: 1,
          disputedQuantity: 0,
          unitPrice: 0,
          note: '',
        },
      ],
    });
  };

  const removeItemRow = (index: number) => {
    if (createForm.items.length <= 1) return;
    setCreateForm({
      ...createForm,
      items: createForm.items.filter((_, i) => i !== index),
    });
  };

  // Computed totals for create form
  const formItemsSubtotal = createForm.items.reduce(
    (sum, it) => sum + Number(it.receivedQuantity || 0) * Number(it.unitPrice || 0),
    0,
  );
  const formPayable =
    formItemsSubtotal -
    Number(createForm.discountAmount || 0) +
    Number(createForm.taxAmount || 0) +
    (createForm.shippingFeePayerType === 'PAID_TO_SUPPLIER' ? Number(createForm.shippingFee || 0) : 0);

  // Số dư NCC đang nợ shop / tiền ứng trước khả dụng
  const selectedCreateSupplier = suppliers.find((s) => s.id === createForm.supplierId);
  const supplierAdvanceHeld =
    selectedCreateSupplier && Number(selectedCreateSupplier.closingDebt) < 0
      ? Math.abs(Number(selectedCreateSupplier.closingDebt))
      : Number(selectedCreateSupplier?.advanceAmountHeld || 0);

  const autoDeductAmount = Math.min(formPayable, supplierAdvanceHeld);
  const actualPayable = Math.max(0, formPayable - autoDeductAmount);

  const getVariantStock = (variantId: string, warehouseId?: string) => {
    if (!variantId) return 0;
    const v = allVariants.find((it) => it.id === variantId);
    if (!v) return 0;
    if (warehouseId && (v as any).inventoryBalances && Array.isArray((v as any).inventoryBalances)) {
      const wb = (v as any).inventoryBalances.find((b: any) => b.warehouseId === warehouseId);
      if (wb) return Number(wb.onHand || 0);
    }
    if ((v as any).inventoryBalances && Array.isArray((v as any).inventoryBalances)) {
      return (v as any).inventoryBalances.reduce((sum: number, b: any) => sum + Number(b.onHand || 0), 0);
    }
    return Number((v as any).onHand || 0);
  };

  const generateNextReceiptCode = () => {
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PNK-${y}${m}${d}-${rand}`;
  };

  const handleOpenCreateModal = async () => {
    loadSuppliers();
    loadVariants();
    let code = '';
    try {
      const res: any = await purchaseReceiptsApi.getNextCode();
      code = res?.code || res?.data?.code || '';
    } catch {
      // ignore
    }
    if (!code) code = generateNextReceiptCode();

    setCreateForm({
      ...initialCreateForm,
      receiptCode: code,
      warehouseId: selectedWarehouseId || (warehouses[0]?.id || ''),
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (receipt: PurchaseReceiptModel) => {
    loadSuppliers();
    loadVariants();
    setEditingReceipt(receipt);
    setIsEditModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.supplierId) {
      toast.warning('Vui lòng chọn nhà cung cấp');
      return;
    }
    if (!createForm.warehouseId) {
      toast.warning('Vui lòng chọn kho nhập hàng');
      return;
    }
    for (const it of createForm.items) {
      if (!it.variantId || !it.sku) {
        toast.warning('Vui lòng chọn đầy đủ biến thể sản phẩm cho tất cả các dòng hàng');
        return;
      }
    }

    try {
      await purchaseReceiptsApi.create(createForm);
      setIsCreateModalOpen(false);
      loadReceipts();
      toast.success('Tạo phiếu nhập kho thành công!');
    } catch (err: any) {
      toast.error('Lỗi khi tạo phiếu nhập kho', err?.response?.data?.message || err?.message);
    }
  };

  const handleDeleteReceipt = async (id: string, code: string) => {
    const ok = await confirmModal({
      title: 'Hủy phiếu nhập kho',
      message: `Bạn có chắc chắn muốn hủy phiếu nhập "${code}"?`,
      description:
        'Tồn kho thực tế sẽ bị trừ lại. Nếu phiếu đã thanh toán từ quỹ tiền mặt/ngân hàng, tiền sẽ được cộng hoàn trả lại vào quỹ; các khoản cấn trừ công nợ sẽ được khôi phục.',
      confirmText: 'Xác nhận hủy phiếu',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const res: any = await purchaseReceiptsApi.delete(id);
      loadReceipts();
      let successMsg = 'Đã hủy phiếu nhập kho thành công!';
      if (res?.totalRefundedToCash > 0) {
        successMsg += ` Đã hoàn lại ${new Intl.NumberFormat('vi-VN').format(res.totalRefundedToCash)}đ vào quỹ tài khoản.`;
      }
      if (res?.totalAdvanceRestored > 0) {
        successMsg += ` Đã khôi phục ${new Intl.NumberFormat('vi-VN').format(res.totalAdvanceRestored)}đ tiền ứng trước NCC.`;
      }
      toast.success(successMsg);
    } catch (err: any) {
      toast.error('Không thể hủy phiếu nhập', err?.response?.data?.message || err?.message);
    }
  };

  // Quick Pay Submit
  const handleQuickPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPayReceipt) return;

    if (quickPayForm.amount <= 0) {
      toast.warning('Số tiền thanh toán phải lớn hơn 0');
      return;
    }

    try {
      await supplierPaymentsApi.create({
        supplierId: quickPayReceipt.supplierId,
        amount: quickPayForm.amount,
        payerName: quickPayForm.payerName,
        fundSource: quickPayForm.fundSource,
        paymentMethod: quickPayForm.paymentMethod,
        referenceCode: quickPayForm.referenceCode || undefined,
        note: quickPayForm.note || `Thanh toán phiếu ${quickPayReceipt.receiptCode}`,
        allocations: [
          {
            receiptId: quickPayReceipt.id,
            amount: Math.min(quickPayForm.amount, Number(quickPayReceipt.remainingAmount)),
            note: `Trả trực tiếp cho phiếu ${quickPayReceipt.receiptCode}`,
          },
        ],
      });

      setQuickPayReceipt(null);
      loadReceipts();
      toast.success('Đã lập phiếu chi thanh toán thành công!');
    } catch (err: any) {
      toast.error('Lỗi khi thanh toán', err?.response?.data?.message || err?.message);
    }
  };

  const handleOpenDetailModal = async (receipt: PurchaseReceiptModel) => {
    setSelectedReceiptDetail(receipt);
    setIsDetailModalOpen(true);
    try {
      const full = await purchaseReceiptsApi.findOne(receipt.id);
      if (full) {
        setSelectedReceiptDetail(full);
      }
    } catch {
      // keep initial receipt
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-fit md:min-h-0 md:h-full md:overflow-hidden space-y-2.5 sm:space-y-3 animate-in fade-in duration-300 max-w-full min-w-0">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-xl font-medium text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2 truncate">
            <PackagePlus size={18} className="text-[#5865f2] shrink-0 sm:w-5 sm:h-5" />
            <span className="sm:hidden truncate">Phiếu nhập kho</span>
            <span className="hidden sm:inline truncate">Quản lý Phiếu Nhập Kho</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate hidden sm:block">
            Phân tách độc lập: Giá trị hàng thực nhận • Công nợ phải trả NCC • Tiền thực tế đã thanh toán
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Link to="/purchase-reports">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 px-2.5 sm:px-3 text-[#5865f2] border-[#5865f2]/30 hover:bg-[#5865f2]/10"
              title="Báo cáo phân tích nhập hàng"
            >
              <TrendingUp size={14} />
              <span className="hidden sm:inline">Báo cáo nhập hàng</span>
            </Button>
          </Link>
          <Button size="sm" onClick={handleOpenCreateModal} className="gap-1.5 px-2.5 sm:px-3">
            <Plus size={14} />
            <span className="hidden sm:inline">Tạo phiếu nhập mới</span>
            <span className="sm:hidden">Tạo mới</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadReceipts}
            className="gap-1.5 p-2 lg:px-3"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden lg:inline">Làm mới</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Row matching Orders page */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 shrink-0">
        <SystemMetricPairCard
          leftItem={{
            title: 'Hàng thực nhận',
            value: `${Math.max(0, totalItemsVal - totalReturnDeductionVal).toLocaleString('vi-VN')}đ`,
            subtitle:
              totalReturnDeductionVal > 0
                ? `Đã trừ hàng trả: -${totalReturnDeductionVal.toLocaleString('vi-VN')}đ (Gốc: ${totalItemsVal.toLocaleString('vi-VN')}đ)`
                : 'Tổng giá trị nhập kho',
            icon: PackagePlus,
            colorScheme: 'blue',
          }}
          rightItem={{
            title: 'Tổng tiền hàng',
            value: `${Math.max(0, totalPayableVal - totalReturnDeductionVal).toLocaleString('vi-VN')}đ`,
            subtitle:
              totalReturnDeductionVal > 0
                ? `Đã trừ hàng trả: -${totalReturnDeductionVal.toLocaleString('vi-VN')}đ (Gốc: ${totalPayableVal.toLocaleString('vi-VN')}đ)`
                : 'Sau chiết khấu & cước',
            icon: Receipt,
            colorScheme: 'orange',
          }}
        />
        <SystemMetricPairCard
          leftItem={{
            title: 'Đã thanh toán',
            value: `${totalPaidOnlyVal.toLocaleString('vi-VN')}đ`,
            subtitle:
              totalReturnDeductionVal > 0
                ? `Thực chi: ${totalPaidOnlyVal.toLocaleString('vi-VN')}đ • Hàng trả trừ nợ: ${totalReturnDeductionVal.toLocaleString('vi-VN')}đ`
                : 'Thực tế đã chi trả cho NCC',
            icon: CreditCard,
            colorScheme: 'green',
          }}
          rightItem={{
            title: 'Còn nợ NCC',
            value: `${totalRemainingVal.toLocaleString('vi-VN')}đ`,
            subtitle: 'Công nợ thực tế phải trả',
            icon: AlertCircle,
            colorScheme: totalRemainingVal > 0 ? 'red' : 'green',
          }}
        />
      </div>

      {/* Filter Bar */}
      <SystemFilter className="p-2.5 sm:p-3 flex-col sm:flex-row items-stretch sm:items-center shrink-0">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <SystemFilterSearch
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm mã phiếu, SKU, ghi chú..."
            className="flex-1 sm:w-64"
          />
          {(searchTerm ||
            selectedSupplierId !== 'ALL' ||
            filterPaymentStatus !== 'ALL' ||
            filterReceivingStatus !== 'ALL' ||
            filterDueStatus !== 'ALL' ||
            datePreset !== 'ALL' ||
            startDate ||
            endDate) && (
            <SystemFilterReset
              onClick={() => {
                setSearchTerm('');
                setSelectedSupplierId('ALL');
                setFilterPaymentStatus('ALL');
                setFilterReceivingStatus('ALL');
                setFilterDueStatus('ALL');
                setDatePreset('ALL');
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
              className="shrink-0"
            />
          )}
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Bộ lọc ngày / khoảng thời gian */}
          <div className="w-full sm:w-[240px]">
            <SystemDatePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(start, end) => {
                setStartDate(start || '');
                setEndDate(end || '');
                setDatePreset(start || end ? 'CUSTOM' : 'ALL');
                setPage(1);
              }}
              size="sm"
              className="w-full"
              placeholder="Khoảng ngày nhập..."
            />
          </div>

          <div className="w-full sm:w-52">
            <Select
              value={selectedSupplierId}
              onChange={(val) => {
                setSelectedSupplierId(String(val));
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Tất cả Nhà Cung Cấp', icon: Building2 },
                ...suppliers.map((s) => ({ value: s.id, label: `${s.code} - ${s.name}`, icon: Building2 })),
              ]}
              icon={Building2}
              size="sm"
            />
          </div>

          <div className="w-full sm:w-48">
            <Select
              value={filterPaymentStatus}
              onChange={(val) => {
                setFilterPaymentStatus(String(val));
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái nợ', icon: DollarSign },
                { value: 'UNPAID', label: 'Chưa thanh toán', icon: AlertCircle },
                { value: 'PARTIALLY_PAID', label: 'Thanh toán 1 phần', icon: Clock },
                { value: 'PAID', label: 'Đã thanh toán đủ', icon: CheckCircle2 },
              ]}
              icon={DollarSign}
              size="sm"
            />
          </div>

          <div className="w-full sm:w-48">
            <Select
              value={filterReceivingStatus}
              onChange={(val) => {
                setFilterReceivingStatus(String(val));
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Tất cả nhận hàng', icon: Truck },
                { value: 'RECEIVED', label: 'Nhận đủ hàng', icon: CheckCircle2 },
                { value: 'PARTIALLY_RECEIVED', label: 'Nhận 1 phần', icon: Clock },
                { value: 'PENDING_RECEIVE', label: 'Chờ nhận', icon: AlertCircle },
              ]}
              icon={Truck}
              size="sm"
            />
          </div>

          <div className="w-full sm:w-56">
            <Select
              value={filterDueStatus}
              onChange={(val) => {
                setFilterDueStatus(String(val));
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Tất cả hạn nợ', icon: Clock },
                { value: 'NOT_DUE', label: 'Chưa đến hạn (hoặc không hẹn)', icon: CheckCircle2 },
                { value: 'DUE_SOON', label: 'Sắp đến hạn (<=7 ngày)', icon: Clock },
                { value: 'OVERDUE', label: 'Quá hạn nợ', icon: AlertCircle },
              ]}
              icon={Clock}
              size="sm"
            />
          </div>
        </div>
      </SystemFilter>

      {/* Desktop Table View */}
      <div className="hidden md:flex flex-1 flex-col min-h-0 overflow-hidden">
        <SystemTableWrapper
          tableClassName="min-w-[1100px]"
          pagination={
            <SystemPagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              itemsPerPage={limit}
              onPageChange={(p) => setPage(p)}
              onLimitChange={(l) => {
                setLimit(l);
                setPage(1);
              }}
            />
          }
        >
          <SystemThead>
            <SystemTh className="w-14 text-center" align="center">STT</SystemTh>
            <SystemTh className="w-44">
              <div className="inline-flex items-center gap-1.5 leading-none">
                <FileText size={13} className="text-gray-400 shrink-0 -translate-y-[0.5px]" />
                <span className="leading-none">Mã Phiếu & Ngày</span>
              </div>
            </SystemTh>
            <SystemTh className="w-52">
              <div className="inline-flex items-center gap-1.5 leading-none">
                <Building2 size={13} className="text-gray-400 shrink-0 -translate-y-[0.5px]" />
                <span className="leading-none">Nhà Cung Cấp</span>
              </div>
            </SystemTh>
            <SystemTh className="w-40">
              <div className="inline-flex items-center gap-1.5 leading-none">
                <Warehouse size={13} className="text-gray-400 shrink-0 -translate-y-[0.5px]" />
                <span className="leading-none">Kho Nhập</span>
              </div>
            </SystemTh>
            <SystemTh className="w-64 min-w-[220px]">
              <div className="inline-flex items-center gap-1.5 leading-none">
                <Boxes size={13} className="text-gray-400 shrink-0 -translate-y-[0.5px]" />
                <span className="leading-none">Hàng Thực Nhận</span>
              </div>
            </SystemTh>
            <SystemTh className="w-36 text-right" align="right">
              <div className="inline-flex items-center justify-end gap-1.5 leading-none">
                <Receipt size={13} className="text-gray-400 shrink-0 -translate-y-[0.5px]" />
                <span className="leading-none">Tổng Tiền Hàng</span>
              </div>
            </SystemTh>
            <SystemTh className="w-36 text-right" align="right">
              <div className="inline-flex items-center justify-end gap-1.5 leading-none">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0 -translate-y-[0.5px]" />
                <span className="leading-none">Đã Trả / Cấn Trừ</span>
              </div>
            </SystemTh>
            <SystemTh className="w-32 text-right" align="right">
              <div className="inline-flex items-center justify-end gap-1.5 leading-none">
                <AlertCircle size={13} className="text-rose-500 shrink-0 -translate-y-[0.5px]" />
                <span className="leading-none">Còn Nợ NCC</span>
              </div>
            </SystemTh>
            <SystemTh className="w-28 text-center" align="center">
              <div className="inline-flex items-center justify-center gap-1.5 leading-none">
                <Clock size={13} className="text-gray-400 shrink-0 -translate-y-[0.5px]" />
                <span className="leading-none">Hạn Nợ</span>
              </div>
            </SystemTh>
            <SystemTh className="w-32 text-center" align="center">
              <div className="inline-flex items-center justify-center gap-1.5 leading-none">
                <ShieldCheck size={13} className="text-gray-400 shrink-0 -translate-y-[0.5px]" />
                <span className="leading-none">Trạng Thái</span>
              </div>
            </SystemTh>
            <SystemTh className="w-16 text-center" align="center">
              <div className="inline-flex items-center justify-center gap-1.5 leading-none">
                <SlidersHorizontal size={13} className="text-gray-400 shrink-0 -translate-y-[0.5px]" />
                <span className="leading-none">Thao Tác</span>
              </div>
            </SystemTh>
          </SystemThead>
          <SystemTbody>
            {isLoading ? (
              <SystemTableSkeleton cols={11} rows={7} />
            ) : receipts.length === 0 ? (
              <SystemTableEmpty
                title="Không có phiếu nhập kho nào"
                description="Không tìm thấy phiếu nhập nào phù hợp với bộ lọc hiện tại."
                colSpan={11}
              />
            ) : (
              receipts.map((r, index) => {
                const isOverdue = r.dueStatus === 'OVERDUE';
                const isDueSoon = r.dueStatus === 'DUE_SOON';
                const hasRemaining = Number(r.remainingAmount) > 0;
                const stt = (page - 1) * limit + index + 1;

                const isOffsetFromAdvance = r.paymentAllocations?.some((a: any) =>
                  a.note?.includes('cấn trừ') || a.note?.includes('ứng trước')
                );
                const offsetAmount = r.paymentAllocations?.reduce((sum: number, a: any) => {
                  if (a.note?.includes('cấn trừ') || a.note?.includes('ứng trước')) {
                    return sum + Number(a.allocatedAmount || 0);
                  }
                  return sum;
                }, 0) || 0;

                return (
                  <SystemTr
                    key={r.id}
                    onClick={() => handleOpenDetailModal(r)}
                    className="cursor-pointer"
                  >
                    <SystemTd align="center" className="text-center font-medium text-gray-500 dark:text-gray-400 text-xs">
                      {stt}
                    </SystemTd>
                    {/* Mã & Ngày */}
                    <SystemTd>
                      <div className="font-semibold font-mono text-indigo-600 dark:text-indigo-400 hover:underline">
                        {r.receiptCode}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1 font-mono">
                        <Clock size={11} className="shrink-0 text-gray-400" />
                        <span>{formatDateTime(r.receiptDate || r.createdAt)}</span>
                      </div>
                    </SystemTd>

                    {/* NCC */}
                    <SystemTd>
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {r.supplier?.name || 'N/A'}
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                        {r.supplier?.code}
                      </div>
                    </SystemTd>

                    {/* Kho */}
                    <SystemTd>
                      <div className="text-gray-700 dark:text-gray-300 truncate">
                        {r.warehouse?.name || 'Kho chính'}
                      </div>
                      {r.shop && (
                        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 mt-0.5">
                          {r.shop.name}
                        </span>
                      )}
                    </SystemTd>

                    {/* Hàng thực nhận: Hiển thị 1 sản phẩm nhập, nếu > 1 thêm +n, click mở danh sách hàng */}
                    <SystemTd
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenReceiptItemsModal(r);
                      }}
                      className="cursor-pointer group hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-colors"
                      title={
                        r.items && r.items.length > 0
                          ? `Bấm để xem danh sách ${r.items.length} sản phẩm nhập`
                          : 'Bấm để xem danh sách hàng nhập'
                      }
                    >
                      {r.items && r.items.length > 0 ? (
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-medium text-xs text-gray-900 dark:text-white truncate max-w-[170px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {r.items[0].productName}
                              {r.items[0].variationName ? ` (${r.items[0].variationName})` : ''}
                            </span>
                            {r.items.length > 1 && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80 shrink-0 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/60 transition-colors">
                                +{r.items.length - 1}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 min-w-0">
                            <span className="font-mono text-gray-600 dark:text-gray-300 truncate max-w-[110px]">
                              {r.items[0].sku || 'SKU N/A'}
                            </span>
                            <span>•</span>
                            <span className="font-semibold text-gray-800 dark:text-gray-200">
                              SL: {Number(r.items[0].receivedQuantity || 0).toLocaleString('vi-VN')}
                            </span>
                            {r.items.length > 1 && (
                              <span className="text-[10px] text-gray-400">
                                (Tổng {r.items.reduce((s, it) => s + Number(it.receivedQuantity || 0), 0).toLocaleString('vi-VN')})
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 italic">
                          {Number(r.totalItemsAmount) > 0
                            ? `${Number(r.totalItemsAmount).toLocaleString('vi-VN')}đ`
                            : 'Không có sản phẩm'}
                        </div>
                      )}
                    </SystemTd>

                    {/* Tổng tiền hàng */}
                    <SystemTd className="text-right font-semibold text-gray-900 dark:text-white">
                      {Number(r.returnDeductionAmount) > 0 ? (
                        <div>
                          <div>
                            {Math.max(0, Number(r.payableAmount) - Number(r.returnDeductionAmount)).toLocaleString('vi-VN')}đ
                          </div>
                          <div className="text-[10px] text-orange-500 font-normal mt-0.5">
                            Đã trừ trả: -{Number(r.returnDeductionAmount).toLocaleString('vi-VN')}đ (Gốc: {Number(r.payableAmount).toLocaleString('vi-VN')}đ)
                          </div>
                        </div>
                      ) : (
                        <div>{Number(r.payableAmount).toLocaleString('vi-VN')}đ</div>
                      )}
                      {isOffsetFromAdvance && offsetAmount > 0 ? (
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                          Trừ nợ NCC: -{offsetAmount.toLocaleString('vi-VN')}đ
                        </div>
                      ) : Number(r.shippingFee) > 0 ? (
                        <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                          Cước: {Number(r.shippingFee).toLocaleString('vi-VN')}đ ({r.shippingFeePayerType === 'PAID_TO_SUPPLIER' ? 'NCC' : 'Bên VC'})
                        </div>
                      ) : null}
                    </SystemTd>

                    {/* Đã thanh toán / Cấn trừ */}
                    <SystemTd className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                      <div>{Number(r.paidAmount).toLocaleString('vi-VN')}đ</div>
                      {isOffsetFromAdvance ? (
                        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-medium mt-0.5">
                          Đã cấn trừ nợ NCC
                        </span>
                      ) : Number(r.returnDeductionAmount) > 0 ? (
                        <div className="text-[10px] text-orange-500 mt-0.5">
                          - Trả: {Number(r.returnDeductionAmount).toLocaleString('vi-VN')}đ
                        </div>
                      ) : null}
                    </SystemTd>

                    {/* Còn nợ NCC */}
                    <SystemTd className="text-right font-bold">
                      {Number(r.remainingAmount) > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400">
                          {Number(r.remainingAmount).toLocaleString('vi-VN')}đ
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          0đ
                        </span>
                      )}
                    </SystemTd>

                    {/* Hạn nợ */}
                    <SystemTd className="text-center">
                      {r.paymentDueDate ? (
                        <div>
                          <div className={`text-xs font-semibold ${isOverdue && hasRemaining ? 'text-red-600 dark:text-red-400 animate-pulse' : isDueSoon && hasRemaining ? 'text-orange-500' : 'text-gray-600 dark:text-gray-300'}`}>
                            {new Date(r.paymentDueDate).toLocaleDateString('vi-VN')}
                          </div>
                          {isOverdue && hasRemaining && (
                            <span className="inline-block px-1.5 py-0.2 rounded text-[10px] bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 font-bold mt-0.5">
                              Quá hạn
                            </span>
                          )}
                          {isDueSoon && hasRemaining && (
                            <span className="inline-block px-1.5 py-0.2 rounded text-[10px] bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-300 font-medium mt-0.5">
                              Sắp đến hạn
                            </span>
                          )}
                          {!hasRemaining && (
                            <span className="inline-block px-1.5 py-0.2 rounded text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                              Đã xong
                            </span>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="text-gray-400 text-xs">Không hẹn</span>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">Chưa đến hạn</div>
                        </div>
                      )}
                    </SystemTd>

                    {/* Trạng thái thanh toán (Chip status đặt ở cuối ngay trước Thao tác) */}
                    <SystemTd className="text-center">
                      {r.paymentStatus === 'PAID' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" /> Đã xong
                        </span>
                      ) : r.paymentStatus === 'PARTIALLY_PAID' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                          Trả 1 phần
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                          Chưa trả
                        </span>
                      )}
                    </SystemTd>

                    {/* Thao tác */}
                    <SystemTd className="text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(r)}
                          className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                          title="Sửa phiếu nhập & giá vốn"
                        >
                          <Pencil size={13} />
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                              title="Thao tác"
                            >
                              <MoreHorizontal size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedReceiptDetail(r);
                                setIsDetailModalOpen(true);
                              }}
                            >
                              <Eye size={13} className="text-gray-400" />
                              <span>Xem chi tiết</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => handleOpenEditModal(r)}
                            >
                              <Pencil size={13} className="text-amber-500" />
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                Sửa phiếu nhập
                              </span>
                            </DropdownMenuItem>

                            {hasRemaining && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setQuickPayReceipt(r);
                                  setQuickPayForm({
                                    amount: Number(r.remainingAmount),
                                    payerName: 'HieuNT',
                                    fundSource: 'CASH_FUND',
                                    paymentMethod: 'BANK_TRANSFER',
                                    referenceCode: '',
                                    note: `Thanh toán phiếu nhập ${r.receiptCode}`,
                                  });
                                }}
                              >
                                <CreditCard size={13} className="text-emerald-500" />
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  Thanh toán công nợ
                                </span>
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => handleDeleteReceipt(r.id, r.receiptCode)}
                            >
                              <Trash2 size={13} />
                              <span>Hủy phiếu nhập kho</span>
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

      {/* Mobile Card View */}
      <div className="md:hidden flex-1 flex flex-col min-h-fit space-y-2.5 pb-8 max-w-full overflow-x-hidden">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-gray-400 font-normal">
            <RefreshCw className="w-5 h-5 mx-auto animate-spin text-[#5865f2] mb-2" />
            Đang tải danh sách phiếu nhập...
          </div>
        ) : receipts.length === 0 ? (
          <div className="py-10 text-center text-xs text-gray-400 font-normal bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 p-6">
            <PackagePlus className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Chưa có phiếu nhập kho nào</p>
            <p className="text-[11px] text-gray-400">Bấm &quot;Tạo phiếu nhập mới&quot; để ghi nhận hàng thực tế từ Nhà phân phối.</p>
          </div>
        ) : (
          receipts.map((r) => {
            const hasRemaining = Number(r.remainingAmount) > 0;
            const isDueSoon = r.dueStatus === 'DUE_SOON';
            const isOverdue = r.dueStatus === 'OVERDUE';

            const isOffsetFromAdvance = r.paymentAllocations?.some((a: any) =>
              a.note?.includes('cấn trừ') || a.note?.includes('ứng trước')
            );
            const offsetAmount = r.paymentAllocations?.reduce((sum: number, a: any) => {
              if (a.note?.includes('cấn trừ') || a.note?.includes('ứng trước')) {
                return sum + Number(a.allocatedAmount || 0);
              }
              return sum;
            }, 0) || 0;

            return (
              <div
                key={r.id}
                onClick={() => handleOpenDetailModal(r)}
                className="p-3.5 rounded-[4px] bg-white dark:bg-[#14151a] border border-gray-200/80 dark:border-white/[0.08] space-y-2.5 shadow-none cursor-pointer active:scale-[0.99] transition-all max-w-full overflow-hidden"
              >
                {/* Header: Receipt code, Datetime & status badge */}
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileText size={14} className="text-[#5865f2] shrink-0" />
                      <span className="font-mono font-bold text-xs text-gray-900 dark:text-white truncate">
                        {r.receiptCode}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[10px] text-gray-400 mt-0.5 pl-5 shrink-0 whitespace-nowrap">
                      <Clock size={10} className="shrink-0 text-gray-400" />
                      <span>{formatDateTime(r.receiptDate || r.createdAt)}</span>
                    </div>
                  </div>
                  {r.paymentStatus === 'PAID' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shrink-0">
                      <CheckCircle2 className="w-3 h-3" /> Đã xong
                    </span>
                  ) : r.paymentStatus === 'PARTIALLY_PAID' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 shrink-0">
                      Trả 1 phần
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 shrink-0">
                      Chưa trả
                    </span>
                  )}
                </div>

                {/* Supplier & Warehouse */}
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Building2 size={12} className="text-gray-400 shrink-0" />
                    <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                      {r.supplier?.name || 'Nhà cung cấp'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-400 min-w-0">
                    <Warehouse size={11} className="shrink-0" />
                    <span className="truncate">{r.warehouse?.name || 'Kho chính'}</span>
                  </div>
                </div>

                {/* Product preview line with +n (Clickable to open receipt items modal) */}
                {r.items && r.items.length > 0 && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenReceiptItemsModal(r);
                    }}
                    className="p-2 rounded bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 text-xs cursor-pointer active:bg-gray-100 dark:active:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Boxes size={13} className="text-indigo-500 shrink-0" />
                      <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                        {r.items[0].productName}
                        {r.items[0].variationName ? ` (${r.items[0].variationName})` : ''}
                      </span>
                      {r.items.length > 1 && (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0">
                          +{r.items.length - 1}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-gray-500 shrink-0">
                      SL: {r.items.reduce((sum: number, it: any) => sum + Number(it.receivedQuantity || 0), 0).toLocaleString('vi-VN')}
                    </span>
                  </div>
                )}

                {/* Financial 3-column stats - Flat without nested card */}
                <div className="grid grid-cols-3 gap-2 py-2 border-t border-dashed border-gray-100 dark:border-gray-800/80 text-center text-xs">
                  <div>
                    <div className="text-[10px] text-gray-400">Hàng thực nhận</div>
                    <div className="font-mono font-medium text-xs text-gray-900 dark:text-white mt-0.5">
                      {Math.max(0, Number(r.totalItemsAmount || 0) - Number(r.returnDeductionAmount || 0)).toLocaleString('vi-VN')}đ
                    </div>
                    {Number(r.returnDeductionAmount || 0) > 0 && (
                      <div className="text-[9px] text-orange-500 mt-0.5">
                        - Trả: {Number(r.returnDeductionAmount).toLocaleString('vi-VN')}đ
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400">Tổng tiền hàng</div>
                    <div className="font-mono font-semibold text-xs text-gray-900 dark:text-white mt-0.5">
                      {Math.max(0, Number(r.payableAmount || 0) - Number(r.returnDeductionAmount || 0)).toLocaleString('vi-VN')}đ
                    </div>
                    {Number(r.returnDeductionAmount || 0) > 0 && (
                      <div className="text-[9px] text-orange-500 mt-0.5">
                        - Trả: {Number(r.returnDeductionAmount).toLocaleString('vi-VN')}đ
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400">Còn nợ NCC</div>
                    <div className={`font-mono font-bold text-xs mt-0.5 ${hasRemaining ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {Number(r.remainingAmount || 0).toLocaleString('vi-VN')}đ
                    </div>
                  </div>
                </div>

                {/* Offset notice on mobile if applicable */}
                {isOffsetFromAdvance && offsetAmount > 0 && (
                  <div className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded">
                    <CheckCircle2 size={12} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>Đã cấn trừ {offsetAmount.toLocaleString('vi-VN')}đ vào tiền NCC nợ</span>
                  </div>
                )}

                {/* Overdue alert if applicable */}
                {isOverdue && hasRemaining && (
                  <div className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/30 px-2 py-1 rounded">
                    <AlertCircle size={12} className="shrink-0" />
                    <span>Nợ đã quá hạn ({r.paymentDueDate ? new Date(r.paymentDueDate).toLocaleDateString('vi-VN') : ''})</span>
                  </div>
                )}
                {isDueSoon && hasRemaining && !isOverdue && (
                  <div className="flex items-center gap-1 text-[11px] text-orange-600 dark:text-orange-400 font-semibold bg-orange-50 dark:bg-orange-950/30 px-2 py-1 rounded">
                    <Clock size={12} className="shrink-0" />
                    <span>Sắp đến hạn ({r.paymentDueDate ? new Date(r.paymentDueDate).toLocaleDateString('vi-VN') : ''})</span>
                  </div>
                )}

                {/* Card Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100 dark:border-gray-800/80" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => handleDeleteReceipt(r.id, r.receiptCode)}
                    className="px-2 py-1 text-xs rounded border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1 font-medium cursor-pointer"
                    title="Hủy phiếu nhập kho"
                  >
                    <Trash2 size={12} />
                    <span>Hủy</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(r)}
                    className="px-2 py-1 text-xs rounded border border-amber-200 dark:border-amber-900/60 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-1 font-medium cursor-pointer"
                    title="Sửa phiếu nhập & giá vốn"
                  >
                    <Pencil size={12} />
                    <span>Sửa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenDetailModal(r)}
                    className="px-2.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <Eye size={12} />
                    <span>Chi tiết</span>
                  </button>
                  {hasRemaining && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickPayReceipt(r);
                        setQuickPayForm({
                          amount: Number(r.remainingAmount),
                          payerName: 'HieuNT',
                          fundSource: 'CASH_FUND',
                          paymentMethod: 'BANK_TRANSFER',
                          referenceCode: '',
                          note: `Thanh toán phiếu nhập ${r.receiptCode}`,
                        });
                      }}
                      className="px-3 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 font-semibold cursor-pointer shadow-xs active:scale-95 transition-all"
                    >
                      <CreditCard size={12} />
                      <span>Trả nợ ngay</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Mobile Pagination */}
        <div className="rounded border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-[#14151a] shadow-none mt-2 shrink-0">
          <SystemPagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            itemsPerPage={limit}
            onPageChange={(p) => setPage(p)}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
            className="border-t-0"
          />
        </div>
        <div className="h-6 md:hidden shrink-0" aria-hidden="true" />
      </div>

      {/* MODAL 1: TẠO PHIẾU NHẬP MỚI */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={
          <div className="flex items-center gap-2 min-w-0">
            <span className="sm:hidden font-semibold truncate">Lập phiếu nhập</span>
            <span className="hidden sm:inline font-semibold truncate">Lập phiếu nhập kho</span>
          </div>
        }
        subtitle={
          <div className="min-w-0 truncate">
            <span className="sm:hidden truncate">Cộng tồn & ghi nhận công nợ NCC</span>
            <span className="hidden sm:inline truncate">Cộng tồn kho thực tế & ghi nhận công nợ NCC</span>
          </div>
        }
        icon={PackagePlus}
        size="2xl"
      >
        <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 min-h-0">
          <ModalBody className="space-y-3.5 p-3 sm:p-5">
            {/* Header info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 sm:p-3.5 bg-gray-50/70 dark:bg-gray-900/50 rounded border border-gray-200/80 dark:border-gray-800">
              <div>
                <div className="flex items-center justify-between h-5 mb-1.5">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 leading-none">
                    <Building2 size={13} className="text-[#5865f2] shrink-0" />
                    <span>Nhà cung cấp *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickSupplierInitialName('');
                      setIsQuickSupplierModalOpen(true);
                    }}
                    className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#5865f2] hover:text-[#4752c4] hover:underline cursor-pointer shrink-0 leading-none"
                  >
                    <Plus size={12} />
                    <span>Thêm nhanh</span>
                  </button>
                </div>
                <Select
                  value={createForm.supplierId}
                  onChange={(val) => setCreateForm({ ...createForm, supplierId: String(val) })}
                  options={[
                    { value: '', label: '-- Chọn Nhà Cung Cấp --' },
                    ...suppliers.map((s) => ({
                      value: s.id,
                      label: `${s.code} - ${s.name}`,
                    })),
                  ]}
                  placeholder="-- Chọn Nhà Cung Cấp --"
                  searchable={true}
                  size="sm"
                  className="w-full"
                  footerAction={{
                    label: 'Thêm mới nhà cung cấp',
                    icon: Plus,
                    onClick: () => {
                      setQuickSupplierInitialName('');
                      setIsQuickSupplierModalOpen(true);
                    },
                  }}
                  emptyAction={{
                    label: 'Thêm nhanh nhà cung cấp này',
                    onClick: (term) => {
                      setQuickSupplierInitialName(term);
                      setIsQuickSupplierModalOpen(true);
                    },
                  }}
                />
                {selectedCreateSupplier && (
                  <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700/80 rounded text-xs space-y-1 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Công nợ NCC trước giao dịch:</span>
                      <span
                        className={`font-mono font-bold ${
                          Number(selectedCreateSupplier.closingDebt || 0) > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : Number(selectedCreateSupplier.closingDebt || 0) < 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {Number(selectedCreateSupplier.closingDebt || 0) > 0
                          ? `Nợ NCC ${Number(selectedCreateSupplier.closingDebt || 0).toLocaleString('vi-VN')}đ`
                          : Number(selectedCreateSupplier.closingDebt || 0) < 0
                          ? `NCC giữ cọc ${Math.abs(Number(selectedCreateSupplier.closingDebt || 0)).toLocaleString('vi-VN')}đ`
                          : '0đ (Cân bằng)'}
                      </span>
                    </div>
                    {supplierAdvanceHeld > 0 && (
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={12} className="shrink-0" />
                        <span>Sẽ tự động cấn trừ {autoDeductAmount.toLocaleString('vi-VN')}đ tiền cọc vào phiếu này.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between h-5 mb-1.5">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 leading-none">
                    <Warehouse size={13} className="text-[#5865f2] shrink-0" />
                    <span>Kho nhập hàng *</span>
                  </label>
                </div>
                <Select
                  value={createForm.warehouseId}
                  onChange={(val) => setCreateForm({ ...createForm, warehouseId: String(val) })}
                  options={warehouses.map((w) => ({
                    value: w.id,
                    label: `${w.code} - ${w.name}`,
                    badge: w.status === 'ACTIVE' ? 'Hoạt động' : undefined,
                  }))}
                  placeholder="-- Chọn Kho Nhập Hàng --"
                  searchable={true}
                  size="sm"
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex items-center justify-between h-5 mb-1.5">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 leading-none">
                    <Store size={13} className="text-gray-400 shrink-0" />
                    <span>Shop sở hữu (Tùy chọn)</span>
                  </label>
                </div>
                <Select
                  value={createForm.shopId || ''}
                  onChange={(val) => setCreateForm({ ...createForm, shopId: val ? String(val) : undefined })}
                  options={[
                    { value: '', label: '-- Dùng chung toàn workspace --' },
                    ...shops.map((s) => ({
                      value: s.id,
                      label: `${s.code} - ${s.name}`,
                    })),
                  ]}
                  placeholder="-- Dùng chung toàn workspace --"
                  searchable={true}
                  size="sm"
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex items-center justify-between h-5 mb-1.5">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 leading-none">
                    <FileText size={13} className="text-[#5865f2] shrink-0" />
                    <span>Mã phiếu nhập</span>
                  </label>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-[#5865f2] dark:text-indigo-400 font-medium leading-none shrink-0">
                    Hệ thống tự cấp
                  </span>
                </div>
                <input
                  type="text"
                  readOnly
                  disabled
                  tabIndex={-1}
                  value={createForm.receiptCode || 'Hệ thống tự động cấp'}
                  title="Mã phiếu được hệ thống tự động sinh ngầm khi lưu để đảm bảo tuyệt đối không bị trùng lặp"
                  className="w-full h-8 px-2.5 text-xs font-mono uppercase font-bold bg-gray-100 dark:bg-[#131720] border border-gray-200 dark:border-gray-800 rounded text-gray-500 dark:text-gray-400 cursor-not-allowed select-none transition-colors pointer-events-none box-border leading-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between h-5 mb-1.5">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 leading-none">
                    <Calendar size={13} className="text-gray-400 shrink-0" />
                    <span>Ngày nhập hàng</span>
                  </label>
                </div>
                <input
                  type="date"
                  value={createForm.receiptDate || ''}
                  onChange={(e) => setCreateForm({ ...createForm, receiptDate: e.target.value })}
                  className="w-full h-8 px-2.5 py-0 text-xs bg-white dark:bg-[#161b26] border border-gray-200 dark:border-gray-700/80 rounded text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2] transition-colors box-border"
                />
              </div>

              <div>
                <div className="flex items-center justify-between h-5 mb-1.5">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 leading-none">
                    <Clock size={13} className="text-gray-400 shrink-0" />
                    <span>Hạn thanh toán nợ</span>
                  </label>
                </div>
                <input
                  type="date"
                  value={createForm.paymentDueDate || ''}
                  onChange={(e) => setCreateForm({ ...createForm, paymentDueDate: e.target.value })}
                  className="w-full h-8 px-2.5 py-0 text-xs bg-white dark:bg-[#161b26] border border-gray-200 dark:border-gray-700/80 rounded text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2] transition-colors box-border"
                />
              </div>
            </div>

            {/* Items Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide flex items-center gap-1.5">
                  <Boxes size={14} className="text-[#5865f2]" />
                  <span className="sm:hidden">Sản phẩm thực nhận</span>
                  <span className="hidden sm:inline">Danh sách sản phẩm thực nhận (Cộng tồn kho onHand)</span>
                </span>
                <Button type="button" variant="outline" size="sm" onClick={addItemRow} className="flex items-center gap-1 text-xs py-1 h-7">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm dòng</span>
                </Button>
              </div>

              {/* Desktop Table View (hidden on mobile) */}
              <div className="hidden md:block border border-gray-200 dark:border-gray-800 rounded overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300">
                    <tr>
                      <th className="py-2 px-3 w-[26%]">
                        <div className="flex items-center gap-1">
                          <Package size={12} className="text-gray-400" />
                          <span>Biến Thể / SKU *</span>
                        </div>
                      </th>
                      <th className="py-2 px-2 text-center w-[12%]">
                        <div className="flex items-center justify-center gap-1" title="Số lượng tồn kho thực tế trước khi nhập hàng">
                          <Boxes size={12} className="text-blue-500" />
                          <span>Tồn Trước Nhập</span>
                        </div>
                      </th>
                      <th className="py-2 px-2 text-center w-[10%]">
                        <div className="flex items-center justify-center gap-1">
                          <Boxes size={12} className="text-gray-400" />
                          <span>SL Đặt</span>
                        </div>
                      </th>
                      <th className="py-2 px-2 text-center w-[11%]">
                        <div className="flex items-center justify-center gap-1">
                          <CheckCircle2 size={12} className="text-indigo-500" />
                          <span>SL Thực Nhận</span>
                        </div>
                      </th>
                      <th className="py-2 px-2 text-center w-[10%]">
                        <div className="flex items-center justify-center gap-1">
                          <AlertCircle size={12} className="text-rose-500" />
                          <span>Lỗi/Thiếu</span>
                        </div>
                      </th>
                      <th className="py-2 px-3 text-right w-[14%]">
                        <div className="flex items-center justify-end gap-1">
                          <DollarSign size={12} className="text-gray-400" />
                          <span>Đơn Giá (đ)</span>
                        </div>
                      </th>
                      <th className="py-2 px-3 text-right w-[13%]">
                        <div className="flex items-center justify-end gap-1">
                          <Receipt size={12} className="text-gray-400" />
                          <span>Thành Tiền</span>
                        </div>
                      </th>
                      <th className="py-2 px-2 text-center w-[4%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {createForm.items.map((row, idx) => {
                      const rowSubtotal = (row.receivedQuantity || 0) * (row.unitPrice || 0);
                      const currentStock = getVariantStock(row.variantId, createForm.warehouseId);
                      const stockAfter = currentStock + Number(row.receivedQuantity || 0);

                      return (
                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                          <td className="p-2.5">
                            <Select
                              value={row.variantId}
                              onChange={(val) => handleItemChange(idx, 'variantId', String(val))}
                              options={[
                                { value: '', label: '-- Chọn biến thể SKU --' },
                                ...allVariants.map((v) => {
                                  const prodName = v.product?.name || v.productName || '';
                                  const varName =
                                    v.name && v.name !== 'Mặc định' && v.name !== prodName
                                      ? ` (${v.name})`
                                      : '';
                                  const stock = getVariantStock(v.id, createForm.warehouseId);
                                  return {
                                    value: v.id,
                                    label: `[${v.sku || 'SKU'}] ${prodName}${varName} (Tồn: ${stock})`,
                                    badge: `Tồn: ${stock} • ${v.costPrice ? `${Number(v.costPrice).toLocaleString('vi-VN')}đ` : 'Chưa có giá vốn'}`,
                                  };
                                }),
                              ]}
                              placeholder="-- Chọn biến thể SKU --"
                              searchable={true}
                              size="sm"
                              className="w-full"
                            />
                            <input
                              type="text"
                              placeholder="Ghi chú hàng lỗi/hỏng (nếu có)"
                              value={row.note || ''}
                              onChange={(e) => handleItemChange(idx, 'note', e.target.value)}
                              className="w-full mt-1.5 bg-transparent border-0 border-b border-gray-200 dark:border-gray-700/80 p-0.5 text-[11px] text-gray-600 dark:text-gray-400 focus:outline-none focus:border-indigo-500"
                            />
                          </td>
                          <td className="p-2 text-center">
                            {row.variantId ? (
                              <div>
                                <span
                                  className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 inline-block"
                                  title="Số lượng tồn kho thực tế trước khi nhập hàng"
                                >
                                  {currentStock.toLocaleString('vi-VN')}
                                </span>
                                <div
                                  className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold mt-0.5"
                                  title="Dự kiến tồn kho sau khi hoàn tất nhập phiếu này"
                                >
                                  Sau: {stockAfter.toLocaleString('vi-VN')}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={row.orderedQuantity}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleItemChange(idx, 'orderedQuantity', Number(e.target.value))}
                              className="h-8 w-16 text-center bg-white dark:bg-[#161b26] border border-gray-200 dark:border-gray-700/80 rounded px-1 text-xs font-semibold text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2]"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={row.receivedQuantity}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleItemChange(idx, 'receivedQuantity', Number(e.target.value))}
                              className="h-8 w-16 text-center bg-white dark:bg-[#161b26] border border-[#5865f2]/60 rounded px-1 text-xs font-bold text-[#5865f2] dark:text-indigo-400 focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={row.disputedQuantity || 0}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleItemChange(idx, 'disputedQuantity', Number(e.target.value))}
                              className="h-8 w-16 text-center bg-white dark:bg-[#161b26] border border-rose-300 dark:border-rose-700/80 rounded px-1 text-xs text-rose-600 dark:text-rose-400 font-semibold focus:outline-none focus:ring-1 focus:ring-rose-500"
                            />
                          </td>
                          <td className="p-2 text-right">
                            <CurrencyInput
                              value={row.unitPrice}
                              onChange={(val) => handleItemChange(idx, 'unitPrice', val)}
                              className="w-28 ml-auto"
                              inputClassName="h-8 text-right px-2 text-xs font-mono font-semibold"
                            />
                          </td>
                          <td className="p-2 text-right font-semibold font-mono text-gray-900 dark:text-white">
                            {rowSubtotal.toLocaleString('vi-VN')}đ
                          </td>
                          <td className="p-2 text-center">
                            {createForm.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItemRow(idx)}
                                className="text-gray-400 hover:text-rose-500 cursor-pointer"
                                title="Xóa dòng"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Dedicated Item Cards View (md:hidden) */}
              <div className="md:hidden space-y-2.5">
                {createForm.items.map((row, idx) => {
                  const rowSubtotal = (row.receivedQuantity || 0) * (row.unitPrice || 0);
                  const currentStock = getVariantStock(row.variantId, createForm.warehouseId);
                  const stockAfter = currentStock + Number(row.receivedQuantity || 0);

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-white dark:bg-gray-800/90 rounded border border-gray-200 dark:border-gray-700/80 shadow-xs space-y-2.5"
                    >
                      {/* Header with Item # and Delete Button */}
                      <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 dark:border-gray-700/60">
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                          <Package size={13} className="text-[#5865f2]" />
                          <span>Sản phẩm #{idx + 1}</span>
                        </span>
                        {createForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1 font-semibold cursor-pointer"
                          >
                            <Trash2 size={13} />
                            <span>Xóa</span>
                          </button>
                        )}
                      </div>

                      {/* Full-width SKU Selection */}
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                          Biến thể / SKU *
                        </label>
                        <Select
                          value={row.variantId}
                          onChange={(val) => handleItemChange(idx, 'variantId', String(val))}
                          options={[
                            { value: '', label: '-- Chọn biến thể SKU --' },
                            ...allVariants.map((v) => {
                              const prodName = v.product?.name || v.productName || '';
                              const varName =
                                v.name && v.name !== 'Mặc định' && v.name !== prodName
                                  ? ` (${v.name})`
                                  : '';
                              const stock = getVariantStock(v.id, createForm.warehouseId);
                              return {
                                value: v.id,
                                label: `[${v.sku || 'SKU'}] ${prodName}${varName} (Tồn: ${stock})`,
                                badge: `Tồn: ${stock} • ${v.costPrice ? `${Number(v.costPrice).toLocaleString('vi-VN')}đ` : 'Chưa có giá vốn'}`,
                              };
                            }),
                          ]}
                          placeholder="-- Chọn biến thể SKU --"
                          searchable={true}
                          size="sm"
                          className="w-full"
                        />

                        {/* View Stock Quantity Before Import on Mobile */}
                        {row.variantId && (
                          <div className="mt-2 flex items-center justify-between px-2.5 py-1.5 rounded bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 text-xs">
                            <span className="text-blue-700 dark:text-blue-300 flex items-center gap-1 font-medium">
                              <Boxes size={12} className="text-blue-500" />
                              <span>Số lượng trước nhập:</span>
                            </span>
                            <div className="flex items-center gap-1.5 font-mono text-[11px]">
                              <span className="font-bold text-blue-800 dark:text-blue-200">
                                {currentStock.toLocaleString('vi-VN')} cái
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400" title="Dự kiến tồn kho sau nhập">
                                Sau: {stockAfter.toLocaleString('vi-VN')} cái
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 3 Quantities Grid: Đặt, Nhận, Lỗi */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-1.5 rounded bg-gray-50/80 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/70 text-center">
                          <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5 font-medium">
                            SL Đặt
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={row.orderedQuantity}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleItemChange(idx, 'orderedQuantity', Number(e.target.value))}
                            className="h-8 w-full text-center bg-white dark:bg-[#161b26] border border-gray-200 dark:border-gray-700/80 rounded py-1 text-xs font-semibold text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2]"
                          />
                        </div>

                        <div className="p-1.5 rounded bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 text-center">
                          <label className="block text-[10px] text-[#5865f2] dark:text-indigo-400 mb-0.5 font-bold">
                            Thực nhận
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={row.receivedQuantity}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleItemChange(idx, 'receivedQuantity', Number(e.target.value))}
                            className="h-8 w-full text-center bg-white dark:bg-[#161b26] border border-[#5865f2]/60 rounded py-1 text-xs font-bold text-[#5865f2] dark:text-indigo-400 focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
                          />
                        </div>

                        <div className="p-1.5 rounded bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/60 text-center">
                          <label className="block text-[10px] text-rose-600 dark:text-rose-400 mb-0.5 font-medium">
                            Lỗi/Thiếu
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={row.disputedQuantity || 0}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleItemChange(idx, 'disputedQuantity', Number(e.target.value))}
                            className="h-8 w-full text-center bg-white dark:bg-[#161b26] border border-rose-300 dark:border-rose-700/80 rounded py-1 text-xs text-rose-600 dark:text-rose-400 font-semibold focus:outline-none focus:ring-1 focus:ring-rose-500"
                          />
                        </div>
                      </div>

                      {/* Price and Subtotal Grid */}
                      <div className="grid grid-cols-2 gap-2 p-2 rounded bg-gray-50/70 dark:bg-gray-900/40 border border-gray-200/80 dark:border-gray-700/60 items-center">
                        <div>
                          <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">
                            Đơn giá nhập (đ)
                          </label>
                          <CurrencyInput
                            value={row.unitPrice}
                            onChange={(val) => handleItemChange(idx, 'unitPrice', val)}
                            inputClassName="h-8 p-1 text-xs font-semibold font-mono"
                          />
                        </div>
                        <div className="text-right">
                          <span className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-medium">
                            Thành tiền
                          </span>
                          <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">
                            {rowSubtotal.toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                      </div>

                      {/* Note */}
                      <div>
                        <input
                          type="text"
                          placeholder="Ghi chú hàng lỗi/hỏng (nếu có)..."
                          value={row.note || ''}
                          onChange={(e) => handleItemChange(idx, 'note', e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-gray-200 dark:border-gray-700 p-1 text-[11px] text-gray-600 dark:text-gray-400 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Financial Adjustments & Shipping Fee Attribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4 pt-2 border-t border-gray-200 dark:border-gray-800">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <Percent size={13} className="text-emerald-500" />
                    <span>Chiết khấu / Giảm giá trực tiếp (đ)</span>
                  </label>
                  <CurrencyInput
                    value={createForm.discountAmount}
                    onChange={(val) => setCreateForm({ ...createForm, discountAmount: val })}
                    suffix="đ"
                    inputClassName="h-8 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <Receipt size={13} className="text-indigo-500" />
                    <span>Thuế VAT (đ)</span>
                  </label>
                  <CurrencyInput
                    value={createForm.taxAmount}
                    onChange={(val) => setCreateForm({ ...createForm, taxAmount: val })}
                    suffix="đ"
                    inputClassName="h-8 text-xs font-mono"
                  />
                </div>

                {/* Shipping Fee Attribution */}
                <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
                    <Truck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Cước vận chuyển & Bốc xếp</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <CurrencyInput
                      placeholder="Số tiền cước (đ)"
                      value={createForm.shippingFee}
                      onChange={(val) => setCreateForm({ ...createForm, shippingFee: val })}
                      suffix="đ"
                      inputClassName="h-8 text-xs font-mono"
                    />
                    <Select
                      value={createForm.shippingFeePayerType}
                      onChange={(val) => setCreateForm({ ...createForm, shippingFeePayerType: val })}
                      options={[
                        { value: 'PAID_TO_SUPPLIER', label: 'Trả cho NCC (Cộng vào nợ NCC)' },
                        { value: 'PAID_TO_CARRIER', label: 'Trả riêng bên VC (Không tính nợ)' },
                      ]}
                      size="sm"
                      className="w-full"
                    />
                  </div>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 font-normal leading-relaxed">
                    {createForm.shippingFeePayerType === 'PAID_TO_SUPPLIER'
                      ? '✓ Phí vận chuyển sẽ được cộng vào tổng công nợ phải trả NCC.'
                      : '✓ Phí này trả riêng cho nhà xe/đơn vị VC, không tính vào công nợ NCC.'}
                  </p>
                </div>
              </div>

              {/* Summary Card */}
              <div className="bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded p-3.5 sm:p-4 flex flex-col justify-between">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1.5 font-normal">
                      <Boxes size={12} className="text-gray-400" />
                      <span>1. Giá trị hàng thực nhận:</span>
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white font-mono">{formItemsSubtotal.toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1.5 font-normal">
                      <Percent size={12} className="text-emerald-500" />
                      <span>2. Chiết khấu:</span>
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">-{Number(createForm.discountAmount || 0).toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1.5 font-normal">
                      <Receipt size={12} className="text-indigo-500" />
                      <span>3. Thuế VAT:</span>
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white font-mono">+{Number(createForm.taxAmount || 0).toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1.5 font-normal">
                      <Truck size={12} className="text-amber-500" />
                      <span>4. Cước vận chuyển tính vào nợ:</span>
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white font-mono">
                      +{createForm.shippingFeePayerType === 'PAID_TO_SUPPLIER' ? Number(createForm.shippingFee || 0).toLocaleString('vi-VN') : 0}đ
                    </span>
                  </div>
                  <div className="pt-2.5 border-t border-indigo-200/80 dark:border-indigo-800/60 flex justify-between items-center">
                    <span className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                      <DollarSign size={14} />
                      <span>TỔNG CÔNG NỢ PHẢI TRẢ:</span>
                    </span>
                    <span className="text-sm sm:text-base font-bold font-mono text-[#5865f2] dark:text-indigo-300">{formPayable.toLocaleString('vi-VN')}đ</span>
                  </div>

                  {supplierAdvanceHeld > 0 && (
                    <div className="p-2 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/50 rounded flex justify-between items-center text-emerald-800 dark:text-emerald-300">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Wallet size={13} className="text-emerald-600 dark:text-emerald-400" />
                        <span>5. Trừ tiền NCC đang nợ shop:</span>
                      </span>
                      <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        -{autoDeductAmount.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  )}

                  {supplierAdvanceHeld > 0 && (
                    <div className="pt-2 border-t border-emerald-200/80 dark:border-emerald-800/60 flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        <DollarSign size={14} />
                        <span>CÒN PHẢI THANH TOÁN THÊM:</span>
                      </span>
                      <div className="text-right">
                        <div className="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-300">
                          {actualPayable.toLocaleString('vi-VN')}đ
                        </div>
                        {actualPayable === 0 && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            (Được cấn trừ hết 100%)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bảng đối chiếu biến động công nợ NCC TRƯỚC & SAU khi tạo phiếu nhập */}
                {selectedCreateSupplier && (
                  <div className="mt-3.5 p-3 rounded bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-200 pb-1.5 border-b border-amber-200/60 dark:border-amber-900/40">
                      <span>Đối chiếu công nợ NCC: {selectedCreateSupplier.name}</span>
                      <span className="text-[10px] font-normal text-slate-400">Thời gian thực</span>
                    </div>

                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                      <span>1. Công nợ NCC TRƯỚC giao dịch:</span>
                      <span
                        className={`font-mono font-bold ${
                          Number(selectedCreateSupplier.closingDebt || 0) > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : Number(selectedCreateSupplier.closingDebt || 0) < 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {Number(selectedCreateSupplier.closingDebt || 0) > 0
                          ? `${Number(selectedCreateSupplier.closingDebt || 0).toLocaleString('vi-VN')}đ (Shop nợ NCC)`
                          : Number(selectedCreateSupplier.closingDebt || 0) < 0
                          ? `Cọc/Ứng trước ${Math.abs(Number(selectedCreateSupplier.closingDebt || 0)).toLocaleString('vi-VN')}đ`
                          : '0đ (Cân bằng)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                      <span>2. Tổng giá trị phiếu nhập mới (+):</span>
                      <span className="font-mono font-bold text-gray-900 dark:text-white">
                        +{formPayable.toLocaleString('vi-VN')}đ
                      </span>
                    </div>

                    {(autoDeductAmount > 0 || (createForm.immediatePayment && Number(createForm.immediatePaymentAmount || 0) > 0)) && (
                      <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                        <span>3. Cấn trừ cọc / Chi trả ngay (-):</span>
                        <span className="font-mono font-bold">
                          -{(autoDeductAmount + (createForm.immediatePayment ? Number(createForm.immediatePaymentAmount || 0) : 0)).toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    )}

                    <div className="pt-1.5 border-t border-amber-200/80 dark:border-amber-900/40 flex items-center justify-between font-semibold">
                      <span className="text-gray-800 dark:text-gray-200">DỰ KIẾN CÔNG NỢ NCC SAU GIAO DỊCH:</span>
                      {(() => {
                        const projectedDebt =
                          Number(selectedCreateSupplier.closingDebt || 0) +
                          formPayable -
                          autoDeductAmount -
                          (createForm.immediatePayment ? Number(createForm.immediatePaymentAmount || 0) : 0);
                        return (
                          <span
                            className={`font-mono font-bold text-sm ${
                              projectedDebt > 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : projectedDebt < 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-indigo-600 dark:text-indigo-400'
                            }`}
                          >
                            {projectedDebt > 0
                              ? `${projectedDebt.toLocaleString('vi-VN')}đ (Nợ NCC)`
                              : projectedDebt < 0
                              ? `Dư cọc: ${Math.abs(projectedDebt).toLocaleString('vi-VN')}đ`
                              : '0đ (Sạch nợ)'}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Immediate payment switch */}
                <div className="mt-4 pt-3 border-t border-indigo-100 dark:border-indigo-900/30 space-y-2">
                  {supplierAdvanceHeld > 0 && actualPayable === 0 ? (
                    <div className="p-2.5 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded flex items-start gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-emerald-900 dark:text-emerald-200">
                          Tiền hàng được trừ 100% từ tiền NCC nợ shop!
                        </div>
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                          Phiếu nhập này sẽ được ghi nhận là <strong>Đã thanh toán (PAID)</strong> ngay khi tạo. Không cần chi thêm tiền.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        onClick={() => {
                          const nextChecked = !createForm.immediatePayment;
                          setCreateForm({
                            ...createForm,
                            immediatePayment: nextChecked,
                            immediatePaymentAmount: nextChecked ? actualPayable : 0,
                          });
                        }}
                        className="flex items-center gap-2 cursor-pointer select-none group"
                      >
                        <Checkbox
                          checked={createForm.immediatePayment || false}
                          onChange={() => {
                            const nextChecked = !createForm.immediatePayment;
                            setCreateForm({
                              ...createForm,
                              immediatePayment: nextChecked,
                              immediatePaymentAmount: nextChecked ? actualPayable : 0,
                            });
                          }}
                          size="sm"
                        />
                        <span className="text-[11px] font-normal text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                          Thanh toán ngay khi nhập hàng (Tạo phiếu chi đồng thời)
                        </span>
                      </div>

                      {createForm.immediatePayment && (
                        <div className="w-full space-y-2.5 pt-2 text-xs">

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1 mb-1">
                                <DollarSign size={11} className="text-emerald-500" />
                                <span>Số tiền chi ngay (đ)</span>
                              </label>
                              <CurrencyInput
                                value={createForm.immediatePaymentAmount}
                                onChange={(val) => setCreateForm({ ...createForm, immediatePaymentAmount: val })}
                                suffix="đ"
                                inputClassName="h-8 font-bold text-emerald-600 dark:text-emerald-400 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1 mb-1">
                                <User size={11} className="text-gray-400" />
                                <span>Người thanh toán</span>
                              </label>
                              <input
                                type="text"
                                placeholder="Ví dụ: HieuNT, Bạn..."
                                value={createForm.immediatePayerName || ''}
                                onChange={(e) => setCreateForm({ ...createForm, immediatePayerName: e.target.value })}
                                className="w-full h-8 px-2.5 bg-white dark:bg-[#161b26] border border-gray-200 dark:border-gray-700/80 rounded text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-[#5865f2] focus:ring-1 focus:ring-[#5865f2]"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1 mb-1">
                              <CreditCard size={11} className="text-gray-400" />
                              <span>Nguồn tiền chi</span>
                            </label>
                            <Select
                              value={createForm.immediateFundSource || 'CASH_FUND'}
                              onChange={(val) => setCreateForm({ ...createForm, immediateFundSource: val })}
                              options={[
                                { value: 'CASH_FUND', label: 'Quỹ tiền mặt của shop' },
                                { value: 'BANK_ACCOUNT', label: 'Tài khoản ngân hàng công ty' },
                                { value: 'PERSONAL_FUND', label: 'Tiền cá nhân (Chi hộ - Shop cần hoàn trả)' },
                              ]}
                              size="sm"
                              className="w-full"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </ModalBody>

          <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
            <ModalButton
              type="button"
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
              className="gap-1.5 flex-none px-4 py-2.5 sm:py-1.5 text-xs font-semibold shrink-0"
            >
              <X size={14} />
              <span>Hủy bỏ</span>
            </ModalButton>
            <ModalButton
              type="submit"
              variant="primary"
              className="gap-1.5 flex-1 sm:flex-none py-2.5 sm:py-1.5 px-4 font-semibold text-xs active:scale-95 justify-center"
            >
              <CheckCircle2 size={14} />
              <span className="sm:hidden">Nhập kho</span>
              <span className="hidden sm:inline">Xác nhận Nhập Kho</span>
            </ModalButton>
          </ModalFooter>
        </form>
      </Modal>

      {/* MODAL 2: XEM CHI TIẾT PHIẾU NHẬP */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Chi tiết: ${selectedReceiptDetail?.receiptCode || ''}`}
        subtitle={
          <span className="truncate block max-w-full">
            {`Nhập lúc: ${formatDateTime(selectedReceiptDetail?.receiptDate || selectedReceiptDetail?.createdAt)} • Hàng thực nhận • Công nợ`}
          </span>
        }
        icon={FileText}
        size="2xl"
      >
        {selectedReceiptDetail && (() => {
          const debtBefore =
            selectedReceiptDetail.supplierDebtBefore ??
            Number((selectedReceiptDetail.supplier as any)?.closingDebt || 0) -
              Number(selectedReceiptDetail.payableAmount || 0) +
              Number(selectedReceiptDetail.paidAmount || 0);
          const debtAfter =
            selectedReceiptDetail.supplierDebtAfter ??
            debtBefore +
              Number(selectedReceiptDetail.payableAmount || 0) -
              Number(selectedReceiptDetail.paidAmount || 0);

          return (
            <>
              <ModalBody className="space-y-3.5 sm:space-y-4">
                {/* Top 3 axes info - Responsive no wrap */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-900/80 rounded border border-gray-200/60 dark:border-gray-800 text-xs">
                  <div className="min-w-0">
                    <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1 text-[10px] sm:text-xs font-medium min-w-0 truncate">
                      <Boxes size={12} className="text-blue-500 shrink-0" />
                      <span className="truncate">
                        <span className="sm:hidden">1. Thực nhận</span>
                        <span className="hidden sm:inline">1. Hàng Thực Nhận</span>
                      </span>
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white font-mono truncate block">
                      {Number(selectedReceiptDetail.totalItemsAmount).toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1 text-[10px] sm:text-xs font-medium min-w-0 truncate">
                      <Receipt size={12} className="text-indigo-500 shrink-0" />
                      <span className="truncate">
                        <span className="sm:hidden">2. Nợ phải trả</span>
                        <span className="hidden sm:inline">2. Công Nợ Phải Trả</span>
                      </span>
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono truncate block">
                      {Number(selectedReceiptDetail.payableAmount).toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1 text-[10px] sm:text-xs font-medium min-w-0 truncate">
                      <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                      <span className="truncate">
                        <span className="sm:hidden">3. Đã trả</span>
                        <span className="hidden sm:inline">3. Đã Thanh Toán</span>
                      </span>
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono truncate block">
                      {Number(selectedReceiptDetail.paidAmount).toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                </div>

                {/* Lịch sử công nợ trước & sau phiếu nhập này */}
                <div className="border border-indigo-100 dark:border-indigo-900/40 rounded overflow-hidden text-xs bg-indigo-50/20 dark:bg-indigo-950/20">
                  <div className="bg-indigo-50/70 dark:bg-indigo-950/50 px-3 py-1.5 font-semibold text-indigo-900 dark:text-indigo-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Building2 size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span>Lịch sử tiền công nợ NCC trước & sau giao dịch này</span>
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 font-normal">
                      NCC: <b className="text-gray-800 dark:text-gray-200">{selectedReceiptDetail.supplier?.name}</b>
                    </span>
                  </div>
                  <div className="p-2.5 sm:p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 rounded bg-white dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800">
                      <span className="text-[10px] text-gray-400 block">Nợ trước khi nhập:</span>
                      <span className="font-mono font-bold text-xs sm:text-sm text-gray-800 dark:text-gray-200 block mt-0.5">
                        {debtBefore.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800">
                      <span className="text-[10px] text-gray-400 block">Phát sinh từ phiếu:</span>
                      <span className="font-mono font-bold text-xs sm:text-sm text-rose-600 dark:text-rose-400 block mt-0.5">
                        +{Number(selectedReceiptDetail.payableAmount).toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800">
                      <span className="text-[10px] text-gray-400 block">Đã trả / cấn trừ:</span>
                      <span className="font-mono font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 block mt-0.5">
                        -{Number(selectedReceiptDetail.paidAmount).toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800">
                      <span className="text-[10px] text-gray-400 block">Nợ sau giao dịch:</span>
                      <span className="font-mono font-bold text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 block mt-0.5">
                        {debtAfter.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="border border-gray-200 dark:border-gray-800 rounded overflow-hidden text-xs">
                  <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Boxes size={13} className="text-[#5865f2] shrink-0" />
                    <span>Sản phẩm trong phiếu nhập ({selectedReceiptDetail.items?.length || 0})</span>
                  </div>
                  <div className="p-3 divide-y divide-gray-100 dark:divide-gray-800">
                    {selectedReceiptDetail.items?.map((it) => (
                      <div key={it.id} className="py-2 flex justify-between items-center">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                            <Package size={13} className="text-gray-400 shrink-0" />
                            <span>
                              {it.productName} {it.variationName ? `(${it.variationName})` : ''}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400 font-mono ml-4">SKU: {it.sku}</div>
                        </div>
                        <div className="text-right">
                          <div>
                            {it.receivedQuantity} cái x {Number(it.unitPrice).toLocaleString('vi-VN')}đ
                          </div>
                          <div className="font-semibold font-mono text-gray-900 dark:text-white">
                            {Number(it.subtotal).toLocaleString('vi-VN')}đ
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment allocations history */}
                <div className="border border-gray-200 dark:border-gray-800 rounded overflow-hidden text-xs">
                  <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <Clock size={13} className="text-[#5865f2] shrink-0" />
                      <span>Lịch sử các đợt thanh toán cho phiếu này</span>
                    </span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <CreditCard size={12} className="shrink-0" />
                      <span>Còn nợ: {Number(selectedReceiptDetail.remainingAmount).toLocaleString('vi-VN')}đ</span>
                    </span>
                  </div>
                  <div className="p-3">
                    {selectedReceiptDetail.paymentAllocations && selectedReceiptDetail.paymentAllocations.length > 0 ? (
                      <div className="space-y-2">
                        {selectedReceiptDetail.paymentAllocations.map((alloc) => {
                          const fundSourceLabel =
                            alloc.payment?.fundSource === 'PERSONAL_FUND'
                              ? 'Tiền cá nhân chi hộ'
                              : alloc.payment?.fundSource === 'BANK_ACCOUNT'
                              ? 'Tài khoản ngân hàng'
                              : 'Quỹ tiền mặt';
                          const cashTx = alloc.cashTransaction;
                          return (
                            <div
                              key={alloc.id}
                              className="p-2.5 bg-gray-50 dark:bg-gray-900/80 rounded border border-gray-100 dark:border-gray-800 space-y-1"
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                                    <DollarSign size={12} className="text-emerald-500 shrink-0" />
                                    <span>
                                      {alloc.payment?.paymentCode} • {alloc.payment?.payerName} chi
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-gray-400 ml-4">
                                    Nguồn: {fundSourceLabel} •{' '}
                                    {alloc.payment?.paymentDate
                                      ? new Date(alloc.payment.paymentDate).toLocaleDateString('vi-VN')
                                      : ''}
                                  </div>
                                </div>
                                <div className="font-bold text-emerald-600 font-mono text-xs sm:text-sm">
                                  +{Number(alloc.allocatedAmount).toLocaleString('vi-VN')}đ
                                </div>
                              </div>
                              {cashTx && cashTx.balanceBefore !== undefined && (
                                <div className="ml-4 pt-1 border-t border-dashed border-gray-200 dark:border-gray-800 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                                  <span>Tiền quỹ trước chi: {Number(cashTx.balanceBefore).toLocaleString('vi-VN')}đ</span>
                                  <span>Chi: -{Number(alloc.allocatedAmount).toLocaleString('vi-VN')}đ</span>
                                  <span>Sau chi: {Number(cashTx.balanceAfter ?? (cashTx.balanceBefore - Number(alloc.allocatedAmount))).toLocaleString('vi-VN')}đ</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-400 italic">Chưa có khoản thanh toán nào cho phiếu này.</p>
                    )}
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className="flex items-center justify-between gap-1.5 sm:gap-2.5 w-full">
                <ModalButton
                  type="button"
                  variant="danger"
                  onClick={() => {
                    const receipt = selectedReceiptDetail;
                    setIsDetailModalOpen(false);
                    handleDeleteReceipt(receipt.id, receipt.receiptCode);
                  }}
                  className="gap-1.5 px-2.5 sm:px-3 text-xs sm:text-sm whitespace-nowrap shrink-0"
                >
                  <Trash2 size={13} className="shrink-0" />
                  <span className="whitespace-nowrap">
                    <span className="sm:hidden">Hủy phiếu</span>
                    <span className="hidden sm:inline">Hủy phiếu nhập</span>
                  </span>
                </ModalButton>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <ModalButton
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const rc = selectedReceiptDetail;
                      setIsDetailModalOpen(false);
                      handleOpenEditModal(rc);
                    }}
                    className="gap-1.5 px-2.5 sm:px-3 text-xs sm:text-sm whitespace-nowrap shrink-0 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                  >
                    <Pencil size={13} className="shrink-0" />
                    <span className="whitespace-nowrap">
                      <span className="sm:hidden">Sửa phiếu</span>
                      <span className="hidden sm:inline">Sửa phiếu nhập</span>
                    </span>
                  </ModalButton>
                  <ModalButton
                    type="button"
                    variant="secondary"
                    onClick={() => setIsDetailModalOpen(false)}
                    className="gap-1.5 px-2.5 sm:px-3 text-xs sm:text-sm whitespace-nowrap shrink-0"
                  >
                    <X size={13} className="shrink-0" />
                    <span className="whitespace-nowrap">Đóng</span>
                  </ModalButton>
                </div>
              </ModalFooter>
            </>
          );
        })()}
      </Modal>

      {/* MODAL 3: NHANH THANH TOÁN PHIẾU NÀY */}
      <Modal
        isOpen={!!quickPayReceipt}
        onClose={() => setQuickPayReceipt(null)}
        title={
          <div className="flex items-center gap-2 min-w-0">
            <span className="sm:hidden font-semibold truncate">Thanh toán: {quickPayReceipt?.receiptCode || ''}</span>
            <span className="hidden sm:inline font-semibold truncate">Thanh Toán Cho Phiếu: {quickPayReceipt?.receiptCode || ''}</span>
          </div>
        }
        subtitle={
          <div className="min-w-0 truncate">
            <span className="sm:hidden truncate">Chi trả nợ NCC & giảm nợ phiếu</span>
            <span className="hidden sm:inline truncate">Lập phiếu chi công nợ nhà cung cấp và ghi giảm số nợ của phiếu</span>
          </div>
        }
        icon={CreditCard}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleQuickPaySubmit} className="space-y-4">
          <ModalBody className="p-3 sm:p-5 text-xs sm:text-sm">
            {(() => {
              const targetSupplier =
                (quickPayReceipt?.supplier?.bankAccount ? quickPayReceipt.supplier : null) ||
                suppliers.find((s) => s.id === quickPayReceipt?.supplierId) ||
                quickPayReceipt?.supplier;

              return (
                <div className="w-full space-y-2.5">
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-900/30 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-[11px] text-gray-500 flex items-center gap-1">
                          <Building2 size={12} />
                          <span>Nhà cung cấp:</span>
                        </div>
                        <div className="font-bold text-gray-900 dark:text-white mt-0.5 text-xs">
                          {targetSupplier?.name || quickPayReceipt?.supplier?.name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-gray-500 flex items-center justify-end gap-1">
                          <AlertCircle size={12} className="text-rose-500" />
                          <span>Tiền nợ cũ trước giao dịch:</span>
                        </div>
                        <div className="font-bold text-rose-600 font-mono mt-0.5 text-xs">
                          {Number(quickPayReceipt?.remainingAmount || 0).toLocaleString('vi-VN')}đ
                        </div>
                      </div>
                    </div>

                    {Number(quickPayForm.amount || 0) > 0 && (
                      <div className="pt-2 border-t border-amber-200/80 dark:border-amber-900/40 flex items-center justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400">Dự kiến nợ còn lại sau giao dịch:</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {Math.max(0, Number(quickPayReceipt?.remainingAmount || 0) - Number(quickPayForm.amount || 0)).toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                      <DollarSign size={13} className="text-emerald-500" />
                      <span>Số tiền thanh toán (đ) *</span>
                    </label>
                    <CurrencyInput
                      value={quickPayForm.amount}
                      onChange={(val) => setQuickPayForm({ ...quickPayForm, amount: val })}
                      suffix="đ"
                      inputClassName="p-2 font-bold text-emerald-600 dark:text-emerald-400 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                        <User size={13} className="text-gray-400" />
                        <span>Người chi tiền *</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="HieuNT, Bạn, Kế toán..."
                        value={quickPayForm.payerName}
                        onChange={(e) => setQuickPayForm({ ...quickPayForm, payerName: e.target.value })}
                        className="w-full bg-white dark:bg-[#161a22] border border-gray-200 dark:border-gray-700 rounded p-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                        <Wallet size={13} className="text-[#5865f2]" />
                        <span>Nguồn tiền *</span>
                      </label>
                      <Select
                        value={quickPayForm.fundSource}
                        onChange={(val) => setQuickPayForm({ ...quickPayForm, fundSource: val })}
                        options={[
                          { value: 'CASH_FUND', label: 'Quỹ tiền mặt' },
                          { value: 'BANK_ACCOUNT', label: 'Tài khoản công ty' },
                          { value: 'PERSONAL_FUND', label: 'Tiền cá nhân (Chi hộ)' },
                        ]}
                        size="sm"
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <FileText size={13} className="text-indigo-500" />
                        <span>Mã phiếu chi / GD</span>
                      </label>
                      <span className="text-[10px] text-gray-400 font-normal">Hệ thống tự cấp</span>
                    </div>
                    <input
                      type="text"
                      readOnly
                      disabled
                      tabIndex={-1}
                      value={quickPayForm.referenceCode || 'Hệ thống tự động cấp'}
                      title="Mã phiếu được hệ thống tự động sinh ngầm khi lưu để đảm bảo tuyệt đối không bị trùng lặp"
                      className="w-full bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded p-2 text-xs font-mono uppercase font-bold text-gray-500 dark:text-gray-400 cursor-not-allowed select-none pointer-events-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                      <FileText size={13} className="text-gray-400" />
                      <span>Ghi chú</span>
                    </label>
                    <input
                      type="text"
                      value={quickPayForm.note}
                      onChange={(e) => setQuickPayForm({ ...quickPayForm, note: e.target.value })}
                      className="w-full bg-white dark:bg-[#161a22] border border-gray-200 dark:border-gray-700 rounded p-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#5865f2]"
                    />
                  </div>
                </div>
              );
            })()}
          </ModalBody>

          <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
            <ModalButton
              type="button"
              variant="outline"
              onClick={() => setQuickPayReceipt(null)}
              className="gap-1.5 flex-none px-4 py-2.5 sm:py-1.5 text-xs font-semibold shrink-0"
            >
              <X size={14} />
              <span>Hủy</span>
            </ModalButton>
            <ModalButton
              type="submit"
              variant="primary"
              className="gap-1.5 flex-1 sm:flex-none py-2.5 sm:py-1.5 px-4 font-semibold text-xs active:scale-95 justify-center"
            >
              <CheckCircle2 size={14} />
              <span className="sm:hidden">Chi tiền</span>
              <span className="hidden sm:inline">Xác nhận chi tiền</span>
            </ModalButton>
          </ModalFooter>
        </form>
      </Modal>

      {/* Quick Create Supplier Modal */}
      <QuickCreateSupplierModal
        isOpen={isQuickSupplierModalOpen}
        onClose={() => setIsQuickSupplierModalOpen(false)}
        initialName={quickSupplierInitialName}
        onSuccess={(newSupplier) => {
          setSuppliers((prev) => [newSupplier, ...prev.filter((s) => s.id !== newSupplier.id)]);
          setCreateForm((prev) => ({ ...prev, supplierId: newSupplier.id }));
          setIsQuickSupplierModalOpen(false);
        }}
      />

      {/* Edit Purchase Receipt Modal */}
      <EditPurchaseReceiptModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingReceipt(null);
        }}
        receipt={editingReceipt}
        suppliers={suppliers}
        warehouses={warehouses}
        shops={shops}
        allVariants={allVariants}
        onSuccess={(updated) => {
          loadReceipts();
          loadSuppliers();
          loadVariants();
          if (selectedReceiptDetail && updated && selectedReceiptDetail.id === updated.id) {
            setSelectedReceiptDetail(updated);
          }
        }}
      />

      {/* Modal xem danh sách hàng thực nhận của phiếu nhập */}
      <Modal
        isOpen={isReceiptItemsModalOpen}
        onClose={() => {
          setIsReceiptItemsModalOpen(false);
          setSelectedReceiptForItems(null);
        }}
        title={`Danh sách hàng thực nhận: ${selectedReceiptForItems?.receiptCode || ''}`}
        icon={Boxes}
        size="2xl"
      >
        {selectedReceiptForItems && (() => {
          const items = selectedReceiptForItems.items || [];
          const totalQty = items.reduce((sum, it) => sum + Number(it.receivedQuantity || 0), 0);
          const totalDisputed = items.reduce((sum, it) => sum + Number(it.disputedQuantity || 0), 0);
          const totalAmount = Number(selectedReceiptForItems.totalItemsAmount || 0);
          const returnDed = Number(selectedReceiptForItems.returnDeductionAmount || 0);

          return (
            <>
              <ModalBody className="space-y-3.5 p-3 sm:p-5">
                {/* Header Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded bg-gray-50 dark:bg-gray-900/60 border border-gray-200/60 dark:border-gray-800">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Nhà cung cấp:</span>
                    <span className="font-semibold text-gray-900 dark:text-white truncate block mt-0.5" title={selectedReceiptForItems.supplier?.name}>
                      {selectedReceiptForItems.supplier?.name || 'N/A'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {selectedReceiptForItems.supplier?.code}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-gray-50 dark:bg-gray-900/60 border border-gray-200/60 dark:border-gray-800">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Kho nhận & Ngày:</span>
                    <span className="font-semibold text-gray-900 dark:text-white truncate block mt-0.5">
                      {selectedReceiptForItems.warehouse?.name || 'Kho chính'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {formatDateTime(selectedReceiptForItems.receiptDate || selectedReceiptForItems.createdAt)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 block font-medium">Tổng thực nhận:</span>
                    <span className="font-bold text-sm text-indigo-700 dark:text-indigo-300 font-mono block mt-0.5">
                      {totalQty.toLocaleString('vi-VN')} <span className="text-[11px] font-normal">sản phẩm</span>
                    </span>
                    <span className="text-[10px] text-indigo-500 dark:text-indigo-400">
                      {items.length} mã SKU
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">Tổng tiền hàng:</span>
                    <span className="font-bold text-sm text-emerald-700 dark:text-emerald-300 font-mono block mt-0.5">
                      {totalAmount.toLocaleString('vi-VN')}đ
                    </span>
                    {returnDed > 0 ? (
                      <span className="text-[10px] text-orange-600 dark:text-orange-400">
                        Đã trừ trả: -{returnDed.toLocaleString('vi-VN')}đ
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        {selectedReceiptForItems.paymentStatus === 'PAID' ? 'Đã thanh toán đủ' : 'Chưa trả hết'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Products Table */}
                <div className="border border-gray-200 dark:border-gray-800 rounded overflow-hidden">
                  <div className="bg-gray-100 dark:bg-gray-800/80 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Package size={13} className="text-[#5865f2] shrink-0" />
                      <span>Chi tiết các mặt hàng ({items.length})</span>
                    </div>
                    {totalDisputed > 0 && (
                      <span className="text-[10px] font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded">
                        Có {totalDisputed} hàng lỗi/thiếu
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto max-h-[420px] custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-gray-50/80 dark:bg-[#1a1b23] border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
                        <tr>
                          <th className="py-2 px-3 text-center w-10 text-gray-500 font-medium">#</th>
                          <th className="py-2 px-3 w-32 text-gray-500 font-medium">Mã SKU</th>
                          <th className="py-2 px-3 text-gray-500 font-medium">Sản phẩm & Phân loại</th>
                          <th className="py-2 px-3 text-center w-24 text-gray-500 font-medium">SL Nhận</th>
                          <th className="py-2 px-3 text-right w-28 text-gray-500 font-medium">Đơn giá</th>
                          <th className="py-2 px-3 text-right w-32 text-gray-500 font-medium">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-gray-400 italic">
                              Phiếu này không có dữ liệu sản phẩm chi tiết.
                            </td>
                          </tr>
                        ) : (
                          items.map((it, idx) => (
                            <tr key={it.id || idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
                              <td className="py-2.5 px-3 text-center font-mono text-gray-400 text-[11px]">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-mono font-medium text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-200/50 dark:border-indigo-800/50 select-all">
                                  {it.sku || 'N/A'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {it.productName}
                                </div>
                                {it.variationName && (
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                    Phân loại: <span className="text-gray-700 dark:text-gray-300 font-medium">{it.variationName}</span>
                                  </div>
                                )}
                                {it.note && (
                                  <div className="text-[10px] text-gray-400 italic mt-0.5">
                                    Ghi chú: {it.note}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono">
                                  {Number(it.receivedQuantity || 0).toLocaleString('vi-VN')}
                                </span>
                                {Number(it.disputedQuantity || 0) > 0 && (
                                  <div className="text-[10px] text-rose-500 mt-0.5">
                                    Lỗi: {it.disputedQuantity}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-gray-700 dark:text-gray-300">
                                {Number(it.unitPrice || 0).toLocaleString('vi-VN')}đ
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-gray-900 dark:text-white">
                                {Number(it.subtotal || 0).toLocaleString('vi-VN')}đ
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {items.length > 0 && (
                        <tfoot className="bg-gray-50 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-800 font-semibold text-xs">
                          <tr>
                            <td colSpan={3} className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">
                              Tổng cộng:
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                              {totalQty.toLocaleString('vi-VN')}
                            </td>
                            <td></td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                              {totalAmount.toLocaleString('vi-VN')}đ
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className="flex items-center justify-between gap-2 w-full">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const r = selectedReceiptForItems;
                    setIsReceiptItemsModalOpen(false);
                    setSelectedReceiptForItems(null);
                    if (r) handleOpenDetailModal(r);
                  }}
                  className="gap-1.5 text-xs text-[#5865f2] border-[#5865f2]/40 hover:bg-[#5865f2]/10"
                >
                  <FileText size={14} />
                  <span>Xem chi tiết công nợ & thanh toán</span>
                </Button>
                <ModalButton
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsReceiptItemsModalOpen(false);
                    setSelectedReceiptForItems(null);
                  }}
                  className="text-xs px-4"
                >
                  Đóng
                </ModalButton>
              </ModalFooter>
            </>
          );
        })()}
      </Modal>
    </div>
  );
};
