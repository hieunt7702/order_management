import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { purchaseReceiptsApi, PurchaseReceiptModel, CreatePurchaseReceiptPayload } from '../../services/purchaseReceiptsApi';
import { suppliersApi, SupplierItem } from '../../services/suppliersApi';
import { supplierPaymentsApi } from '../../services/supplierPaymentsApi';
import { productsApi } from '../../services/productsApi';
import { useWorkspaceStore } from '../../stores/workspaceStore';
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
import {
  SystemFilter,
  SystemFilterItem,
  SystemFilterSearch,
  SystemFilterReset,
} from '../../components/ui/SystemFilter';
import { Button } from '../../components/ui/Button';
import { SystemMetricCard } from '../../components/ui/SystemMetricCard';
import { Select } from '../../components/ui/Select';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import { toast } from '../../components/ui/Toast';
import { QuickCreateSupplierModal } from '../../components/suppliers/QuickCreateSupplierModal';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../../components/ui/DropdownMenu';

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

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedReceiptDetail, setSelectedReceiptDetail] = useState<PurchaseReceiptModel | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  // Quick Create Supplier Modal
  const [isQuickSupplierModalOpen, setIsQuickSupplierModalOpen] = useState<boolean>(false);
  const [quickSupplierInitialName, setQuickSupplierInitialName] = useState<string>('');

  // Quick Payment Modal
  const [quickPayReceipt, setQuickPayReceipt] = useState<PurchaseReceiptModel | null>(null);
  const [quickPayForm, setQuickPayForm] = useState({
    amount: 0,
    payerName: 'Chị Hồng',
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
        search: searchTerm.trim() || undefined,
      });

      const resp = (res as any)?.data || res;
      if (resp && resp.data) {
        setReceipts(resp.data);
        setTotal(resp.meta?.total || 0);
        setTotalPages(resp.meta?.totalPages || 1);
      } else {
        setReceipts(Array.isArray(resp) ? resp : []);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách phiếu nhập:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // KPI calculations
  const totalItemsVal = receipts.reduce((sum, r) => sum + Number(r.totalItemsAmount || 0), 0);
  const totalPayableVal = receipts.reduce((sum, r) => sum + Number(r.payableAmount || 0), 0);
  const totalPaidVal = receipts.reduce((sum, r) => sum + Number(r.paidAmount || 0), 0);
  const totalRemainingVal = receipts.reduce((sum, r) => sum + Number(r.remainingAmount || 0), 0);

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

  const generateNextReceiptCode = () => {
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PNK-${y}${m}${d}-${rand}`;
  };

  const handleOpenCreateModal = () => {
    loadSuppliers();
    loadVariants();
    const code = generateNextReceiptCode();
    setCreateForm({
      ...initialCreateForm,
      receiptCode: code,
      warehouseId: selectedWarehouseId || (warehouses[0]?.id || ''),
    });
    setIsCreateModalOpen(true);
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
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn hủy phiếu nhập "${code}"? Tồn kho thực tế sẽ bị đảo ngược và các phân bổ thanh toán sẽ bị xóa.`,
      )
    ) {
      return;
    }

    try {
      await purchaseReceiptsApi.delete(id);
      loadReceipts();
      toast.success('Đã hủy phiếu nhập kho thành công!');
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

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-3.5 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <PackagePlus size={20} className="text-[#5865f2]" />
            Quản lý Phiếu Nhập Kho
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Phân tách độc lập: Giá trị hàng thực nhận • Công nợ phải trả NCC • Tiền thực tế đã thanh toán
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleOpenCreateModal} className="gap-1.5">
            <Plus size={14} />
            <span>Tạo phiếu nhập mới</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadReceipts}
            className="gap-1.5"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <SystemMetricCard
          title="Hàng thực nhận"
          value={`${totalItemsVal.toLocaleString('vi-VN')}đ`}
          subtitle="Tổng giá trị nhập"
          icon={PackagePlus}
          colorScheme="blue"
        />
        <SystemMetricCard
          title="Công nợ phải trả"
          value={`${totalPayableVal.toLocaleString('vi-VN')}đ`}
          subtitle="Sau chiết khấu & cước"
          icon={Receipt}
          colorScheme="orange"
        />
        <SystemMetricCard
          title="Đã thanh toán"
          value={`${totalPaidVal.toLocaleString('vi-VN')}đ`}
          subtitle="Tiền thực tế đã chi"
          icon={CreditCard}
          colorScheme="green"
        />
        <SystemMetricCard
          title="Còn nợ NCC"
          value={`${totalRemainingVal.toLocaleString('vi-VN')}đ`}
          subtitle="Công nợ chưa thanh toán"
          icon={AlertCircle}
          colorScheme="red"
        />
      </div>

      {/* Filter Bar */}
      <SystemFilter>
        <SystemFilterSearch
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm mã phiếu, SKU, ghi chú..."
          className="w-56 sm:w-64"
        />

        <div className="w-52">
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

        <div className="w-48">
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

        <div className="w-48">
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

        <div className="w-48">
          <Select
            value={filterDueStatus}
            onChange={(val) => {
              setFilterDueStatus(String(val));
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'Tất cả hạn nợ', icon: Clock },
              { value: 'OVERDUE', label: 'Quá hạn nợ', icon: AlertCircle },
              { value: 'DUE_SOON', label: 'Đến hạn (<=7 ngày)', icon: Clock },
              { value: 'NOT_DUE', label: 'Chưa đến hạn', icon: CheckCircle2 },
            ]}
            icon={Clock}
            size="sm"
          />
        </div>

        {(searchTerm || selectedSupplierId !== 'ALL' || filterPaymentStatus !== 'ALL' || filterReceivingStatus !== 'ALL' || filterDueStatus !== 'ALL') && (
          <SystemFilterReset
            onClick={() => {
              setSearchTerm('');
              setSelectedSupplierId('ALL');
              setFilterPaymentStatus('ALL');
              setFilterReceivingStatus('ALL');
              setFilterDueStatus('ALL');
              setPage(1);
            }}
          />
        )}
      </SystemFilter>

      {/* Main Table */}
      <div className="hidden md:flex flex-1 flex-col min-h-0">
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
            <SystemTh className="w-44">
              <div className="flex items-center gap-1.5">
                <FileText size={12} className="text-gray-400 shrink-0" />
                <span>Mã Phiếu & Ngày</span>
              </div>
            </SystemTh>
            <SystemTh className="w-52">
              <div className="flex items-center gap-1.5">
                <Building2 size={12} className="text-gray-400 shrink-0" />
                <span>Nhà Cung Cấp</span>
              </div>
            </SystemTh>
            <SystemTh className="w-40">
              <div className="flex items-center gap-1.5">
                <Warehouse size={12} className="text-gray-400 shrink-0" />
                <span>Kho Nhập</span>
              </div>
            </SystemTh>
            <SystemTh className="w-36 text-right">
              <div className="flex items-center justify-end gap-1.5">
                <Boxes size={12} className="text-gray-400 shrink-0" />
                <span>Hàng Thực Nhận</span>
              </div>
            </SystemTh>
            <SystemTh className="w-36 text-right">
              <div className="flex items-center justify-end gap-1.5">
                <Receipt size={12} className="text-gray-400 shrink-0" />
                <span>Công Nợ Phải Trả</span>
              </div>
            </SystemTh>
            <SystemTh className="w-32 text-right">
              <div className="flex items-center justify-end gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                <span>Đã Trả</span>
              </div>
            </SystemTh>
            <SystemTh className="w-32 text-right">
              <div className="flex items-center justify-end gap-1.5">
                <AlertCircle size={12} className="text-rose-500 shrink-0" />
                <span>Còn Nợ</span>
              </div>
            </SystemTh>
            <SystemTh className="w-28 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <Clock size={12} className="text-gray-400 shrink-0" />
                <span>Hạn Nợ</span>
              </div>
            </SystemTh>
            <SystemTh className="w-32 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <ShieldCheck size={12} className="text-gray-400 shrink-0" />
                <span>Trạng Thái</span>
              </div>
            </SystemTh>
            <SystemTh className="w-16 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <SlidersHorizontal size={12} className="text-gray-400 shrink-0" />
                <span>Thao Tác</span>
              </div>
            </SystemTh>
          </SystemThead>
          <SystemTbody>
            {isLoading ? (
              <SystemTableSkeleton cols={10} rows={7} />
            ) : receipts.length === 0 ? (
              <SystemTableEmpty
                title="Không có phiếu nhập kho nào"
                description="Không tìm thấy phiếu nhập nào phù hợp với bộ lọc hiện tại."
                colSpan={10}
              />
            ) : (
              receipts.map((r) => {
                const isOverdue = r.dueStatus === 'OVERDUE';
                const isDueSoon = r.dueStatus === 'DUE_SOON';
                const hasRemaining = Number(r.remainingAmount) > 0;

                return (
                  <SystemTr
                    key={r.id}
                    onClick={() => {
                      setSelectedReceiptDetail(r);
                      setIsDetailModalOpen(true);
                    }}
                    className="cursor-pointer"
                  >
                    {/* Mã & Ngày */}
                    <SystemTd>
                      <div className="font-semibold font-mono text-indigo-600 dark:text-indigo-400 hover:underline">
                        {r.receiptCode}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(r.receiptDate).toLocaleDateString('vi-VN')}
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

                    {/* Hàng thực nhận */}
                    <SystemTd className="text-right font-medium text-gray-800 dark:text-gray-200">
                      {Number(r.totalItemsAmount).toLocaleString('vi-VN')}đ
                    </SystemTd>

                    {/* Công nợ phải trả */}
                    <SystemTd className="text-right font-semibold text-gray-900 dark:text-white">
                      <div>{Number(r.payableAmount).toLocaleString('vi-VN')}đ</div>
                      {Number(r.shippingFee) > 0 && (
                        <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                          Cước: {Number(r.shippingFee).toLocaleString('vi-VN')}đ ({r.shippingFeePayerType === 'PAID_TO_SUPPLIER' ? 'NCC' : 'Bên VC'})
                        </div>
                      )}
                    </SystemTd>

                    {/* Đã thanh toán */}
                    <SystemTd className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                      <div>{Number(r.paidAmount).toLocaleString('vi-VN')}đ</div>
                      {Number(r.returnDeductionAmount) > 0 && (
                        <div className="text-[10px] text-orange-500 mt-0.5">
                          - Trả: {Number(r.returnDeductionAmount).toLocaleString('vi-VN')}đ
                        </div>
                      )}
                    </SystemTd>

                    {/* Còn nợ */}
                    <SystemTd className="text-right font-bold text-rose-600 dark:text-rose-400">
                      {Number(r.remainingAmount).toLocaleString('vi-VN')}đ
                    </SystemTd>

                    {/* Hạn nợ */}
                    <SystemTd className="text-center">
                      {r.paymentDueDate ? (
                        <div>
                          <div className={`text-xs font-semibold ${isOverdue ? 'text-red-600 dark:text-red-400 animate-pulse' : isDueSoon ? 'text-orange-500' : 'text-gray-600 dark:text-gray-300'}`}>
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
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">Không hẹn</span>
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
                      <div className="flex items-center justify-center">
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

                            {hasRemaining && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setQuickPayReceipt(r);
                                  setQuickPayForm({
                                    amount: Number(r.remainingAmount),
                                    payerName: 'Chị Hồng',
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

      {/* MODAL 1: TẠO PHIẾU NHẬP MỚI */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Lập Phiếu Nhập Kho & Ghi Nhận Công Nợ NCC"
        subtitle="Cộng tồn kho thực tế (onHand) và hạch toán dòng công nợ nhà cung cấp"
        icon={PackagePlus}
        size="2xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-5">
          <ModalBody className="max-h-[75vh] overflow-y-auto space-y-4">
            {/* Header info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-gray-50/80 dark:bg-gray-900/60 rounded border border-gray-200 dark:border-gray-800">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Building2 size={13} className="text-[#5865f2]" />
                    <span>Nhà cung cấp *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickSupplierInitialName('');
                      setIsQuickSupplierModalOpen(true);
                    }}
                    className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#5865f2] hover:text-[#4752c4] hover:underline cursor-pointer"
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
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <Warehouse size={13} className="text-[#5865f2]" />
                  <span>Kho nhập hàng *</span>
                </label>
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
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <Store size={13} className="text-gray-400" />
                  <span>Shop sở hữu (Tùy chọn)</span>
                </label>
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
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <FileText size={13} className="text-[#5865f2]" />
                      <span>Mã phiếu nhập hàng *</span>
                    </label>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-medium">
                      Tự sinh
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreateForm((prev) => ({ ...prev, receiptCode: generateNextReceiptCode() }))}
                    className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                    title="Tạo mã phiếu mới ngẫu nhiên"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Đổi mã</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: PNK-20261015-ABCD"
                  value={createForm.receiptCode || ''}
                  onChange={(e) => setCreateForm({ ...createForm, receiptCode: e.target.value.toUpperCase() })}
                  className="w-full text-xs sm:text-sm font-mono uppercase bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                  <Calendar size={13} className="text-gray-400" />
                  <span>Ngày nhập hàng</span>
                </label>
                <input
                  type="date"
                  value={createForm.receiptDate || ''}
                  onChange={(e) => setCreateForm({ ...createForm, receiptDate: e.target.value })}
                  className="w-full text-xs sm:text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                  <Clock size={13} className="text-gray-400" />
                  <span>Hạn thanh toán công nợ</span>
                </label>
                <input
                  type="date"
                  value={createForm.paymentDueDate || ''}
                  onChange={(e) => setCreateForm({ ...createForm, paymentDueDate: e.target.value })}
                  className="w-full text-xs sm:text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide flex items-center gap-1.5">
                  <Boxes size={14} className="text-[#5865f2]" />
                  <span>Danh sách sản phẩm thực nhận (Cộng tồn kho onHand)</span>
                </span>
                <Button type="button" variant="outline" size="sm" onClick={addItemRow} className="flex items-center gap-1.5 text-xs">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm dòng</span>
                </Button>
              </div>

              <div className="border border-gray-200 dark:border-gray-800 rounded overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300">
                    <tr>
                      <th className="py-2 px-3 w-[30%]">
                        <div className="flex items-center gap-1">
                          <Package size={12} className="text-gray-400" />
                          <span>Biến Thể / SKU *</span>
                        </div>
                      </th>
                      <th className="py-2 px-2 text-center w-[12%]">
                        <div className="flex items-center justify-center gap-1">
                          <Boxes size={12} className="text-gray-400" />
                          <span>SL Đặt</span>
                        </div>
                      </th>
                      <th className="py-2 px-2 text-center w-[12%]">
                        <div className="flex items-center justify-center gap-1">
                          <CheckCircle2 size={12} className="text-indigo-500" />
                          <span>SL Thực Nhận</span>
                        </div>
                      </th>
                      <th className="py-2 px-2 text-center w-[12%]">
                        <div className="flex items-center justify-center gap-1">
                          <AlertCircle size={12} className="text-rose-500" />
                          <span>Lỗi/Thiếu</span>
                        </div>
                      </th>
                      <th className="py-2 px-3 text-right w-[16%]">
                        <div className="flex items-center justify-end gap-1">
                          <DollarSign size={12} className="text-gray-400" />
                          <span>Đơn Giá (đ)</span>
                        </div>
                      </th>
                      <th className="py-2 px-3 text-right w-[16%]">
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
                                  return {
                                    value: v.id,
                                    label: `[${v.sku || 'SKU'}] ${prodName}${varName}`,
                                    badge: v.costPrice ? `${Number(v.costPrice).toLocaleString('vi-VN')}đ` : undefined,
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
                            <input
                              type="number"
                              min="1"
                              value={row.orderedQuantity}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleItemChange(idx, 'orderedQuantity', Number(e.target.value))}
                              className="w-16 text-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1 text-xs"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={row.receivedQuantity}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleItemChange(idx, 'receivedQuantity', Number(e.target.value))}
                              className="w-16 text-center bg-white dark:bg-gray-800 border border-indigo-400 rounded p-1 text-xs font-bold text-indigo-600 dark:text-indigo-400"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={row.disputedQuantity || 0}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleItemChange(idx, 'disputedQuantity', Number(e.target.value))}
                              className="w-16 text-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1 text-xs text-rose-500"
                            />
                          </td>
                          <td className="p-2 text-right">
                            <CurrencyInput
                              value={row.unitPrice}
                              onChange={(val) => handleItemChange(idx, 'unitPrice', val)}
                              className="w-28 ml-auto"
                              inputClassName="text-right p-1"
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
            </div>

            {/* Financial Adjustments & Shipping Fee Attribution */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-gray-800">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <Percent size={13} className="text-emerald-500" />
                    <span>Chiết khấu / Giảm giá trực tiếp (đ)</span>
                  </label>
                  <CurrencyInput
                    value={createForm.discountAmount}
                    onChange={(val) => setCreateForm({ ...createForm, discountAmount: val })}
                    suffix="đ"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <Receipt size={13} className="text-indigo-500" />
                    <span>Thuế VAT (đ)</span>
                  </label>
                  <CurrencyInput
                    value={createForm.taxAmount}
                    onChange={(val) => setCreateForm({ ...createForm, taxAmount: val })}
                    suffix="đ"
                  />
                </div>

                {/* Shipping Fee Attribution */}
                <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                    <Truck className="w-4 h-4 text-amber-600" />
                    <span>Cước vận chuyển & Bốc xếp</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <CurrencyInput
                      placeholder="Số tiền cước (đ)"
                      value={createForm.shippingFee}
                      onChange={(val) => setCreateForm({ ...createForm, shippingFee: val })}
                      suffix="đ"
                      inputClassName="p-1.5"
                    />
                    <select
                      value={createForm.shippingFeePayerType}
                      onChange={(e) => setCreateForm({ ...createForm, shippingFeePayerType: e.target.value as any })}
                      className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1.5 text-xs font-medium cursor-pointer"
                    >
                      <option value="PAID_TO_SUPPLIER">Trả cho NCC (Cộng vào nợ NCC)</option>
                      <option value="PAID_TO_CARRIER">Trả riêng bên VC (Không cộng nợ NCC)</option>
                    </select>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {createForm.shippingFeePayerType === 'PAID_TO_SUPPLIER'
                      ? '✓ Phí vận chuyển sẽ được cộng vào tổng công nợ phải trả NCC.'
                      : '✓ Phí này trả riêng cho nhà xe/đơn vị VC, không tính vào công nợ NCC.'}
                  </p>
                </div>
              </div>

              {/* Summary Card */}
              <div className="bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded p-4 flex flex-col justify-between">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <Boxes size={12} className="text-gray-400" />
                      <span>1. Giá trị hàng thực nhận:</span>
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white font-mono">{formItemsSubtotal.toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <Percent size={12} className="text-emerald-500" />
                      <span>2. Chiết khấu:</span>
                    </span>
                    <span className="text-emerald-600 font-mono">-{Number(createForm.discountAmount || 0).toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <Receipt size={12} className="text-indigo-500" />
                      <span>3. Thuế VAT:</span>
                    </span>
                    <span className="font-mono">+{Number(createForm.taxAmount || 0).toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <Truck size={12} className="text-amber-500" />
                      <span>4. Cước vận chuyển tính vào nợ:</span>
                    </span>
                    <span className="font-mono">
                      +{createForm.shippingFeePayerType === 'PAID_TO_SUPPLIER' ? Number(createForm.shippingFee || 0).toLocaleString('vi-VN') : 0}đ
                    </span>
                  </div>
                  <div className="pt-2 border-t border-indigo-200 dark:border-indigo-800/60 flex justify-between items-center text-sm font-bold text-indigo-700 dark:text-indigo-300">
                    <span className="flex items-center gap-1.5">
                      <DollarSign size={14} />
                      <span>TỔNG CÔNG NỢ PHẢI TRẢ:</span>
                    </span>
                    <span className="text-base font-mono">{formPayable.toLocaleString('vi-VN')}đ</span>
                  </div>
                </div>

                {/* Immediate payment switch */}
                <div className="mt-4 pt-3 border-t border-indigo-100 dark:border-indigo-900/30 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-900 dark:text-white">
                    <input
                      type="checkbox"
                      checked={createForm.immediatePayment || false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setCreateForm({
                          ...createForm,
                          immediatePayment: checked,
                          immediatePaymentAmount: checked ? formPayable : 0,
                        });
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <Wallet size={14} className="text-emerald-500" />
                    <span>Thanh toán ngay khi nhập hàng (Tạo phiếu chi đồng thời)</span>
                  </label>

                  {createForm.immediatePayment && (
                    <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                      <div>
                        <label className="block text-[11px] text-gray-600 dark:text-gray-400 flex items-center gap-1 mb-1">
                          <DollarSign size={11} className="text-emerald-500" />
                          <span>Số tiền chi ngay (đ)</span>
                        </label>
                        <CurrencyInput
                          value={createForm.immediatePaymentAmount}
                          onChange={(val) => setCreateForm({ ...createForm, immediatePaymentAmount: val })}
                          suffix="đ"
                          inputClassName="font-bold text-emerald-600 dark:text-emerald-400 p-1"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-600 dark:text-gray-400 flex items-center gap-1 mb-1">
                          <User size={11} className="text-gray-400" />
                          <span>Người thanh toán</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Ví dụ: Chị Hồng, Bạn..."
                          value={createForm.immediatePayerName || ''}
                          onChange={(e) => setCreateForm({ ...createForm, immediatePayerName: e.target.value })}
                          className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1 text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] text-gray-600 dark:text-gray-400 flex items-center gap-1 mb-1">
                          <CreditCard size={11} className="text-gray-400" />
                          <span>Nguồn tiền chi</span>
                        </label>
                        <select
                          value={createForm.immediateFundSource || 'CASH_FUND'}
                          onChange={(e) => setCreateForm({ ...createForm, immediateFundSource: e.target.value as any })}
                          className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1 text-xs"
                        >
                          <option value="CASH_FUND">Quỹ tiền mặt của shop</option>
                          <option value="BANK_ACCOUNT">Tài khoản ngân hàng công ty</option>
                          <option value="PERSONAL_FUND">Tiền cá nhân (Chi hộ - Shop cần hoàn trả)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ModalBody>

          <ModalFooter>
            <ModalButton type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)} className="gap-1.5">
              <X size={14} />
              <span>Hủy bỏ</span>
            </ModalButton>
            <ModalButton type="submit" variant="primary" className="gap-1.5">
              <CheckCircle2 size={14} />
              <span>Xác nhận Nhập Kho</span>
            </ModalButton>
          </ModalFooter>
        </form>
      </Modal>

      {/* MODAL 2: XEM CHI TIẾT PHIẾU NHẬP */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Chi Tiết Phiếu Nhập: ${selectedReceiptDetail?.receiptCode || ''}`}
        subtitle="Thông tin 3 trục: Hàng thực nhận • Công nợ phải trả • Tiền thực tế đã thanh toán"
        icon={FileText}
        size="2xl"
      >
        {selectedReceiptDetail && (
          <>
            <ModalBody className="space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Top 3 axes info */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded text-xs">
                <div>
                  <span className="text-gray-400 flex items-center gap-1 mb-1">
                    <Boxes size={12} className="text-blue-500" />
                    <span>1. Hàng Thực Nhận</span>
                  </span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white font-mono">
                    {Number(selectedReceiptDetail.totalItemsAmount).toLocaleString('vi-VN')}đ
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 flex items-center gap-1 mb-1">
                    <Receipt size={12} className="text-indigo-500" />
                    <span>2. Công Nợ Phải Trả</span>
                  </span>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                    {Number(selectedReceiptDetail.payableAmount).toLocaleString('vi-VN')}đ
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 flex items-center gap-1 mb-1">
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    <span>3. Đã Thanh Toán</span>
                  </span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {Number(selectedReceiptDetail.paidAmount).toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="border border-gray-200 dark:border-gray-800 rounded overflow-hidden text-xs">
                <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Boxes size={13} className="text-[#5865f2]" />
                  <span>Sản phẩm trong phiếu nhập</span>
                </div>
                <div className="p-3 divide-y divide-gray-100 dark:divide-gray-800">
                  {selectedReceiptDetail.items?.map((it) => (
                    <div key={it.id} className="py-2 flex justify-between items-center">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                          <Package size={13} className="text-gray-400" />
                          <span>{it.productName} {it.variationName ? `(${it.variationName})` : ''}</span>
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
                    <Clock size={13} className="text-[#5865f2]" />
                    <span>Lịch sử các đợt thanh toán cho phiếu này</span>
                  </span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CreditCard size={12} />
                    <span>Còn nợ: {Number(selectedReceiptDetail.remainingAmount).toLocaleString('vi-VN')}đ</span>
                  </span>
                </div>
                <div className="p-3">
                  {selectedReceiptDetail.paymentAllocations && selectedReceiptDetail.paymentAllocations.length > 0 ? (
                    <div className="space-y-2">
                      {selectedReceiptDetail.paymentAllocations.map((alloc) => (
                        <div key={alloc.id} className="p-2 bg-gray-50 dark:bg-gray-900 rounded flex justify-between items-center">
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                              <DollarSign size={12} className="text-emerald-500" />
                              <span>{alloc.payment?.paymentCode} • {alloc.payment?.payerName} chi</span>
                            </div>
                            <div className="text-[11px] text-gray-400 ml-4">
                              Nguồn: {alloc.payment?.fundSource === 'PERSONAL_FUND' ? 'Tiền cá nhân chi hộ' : alloc.payment?.fundSource === 'BANK_ACCOUNT' ? 'Tài khoản ngân hàng' : 'Quỹ tiền mặt'} • {alloc.payment?.paymentDate ? new Date(alloc.payment.paymentDate).toLocaleDateString('vi-VN') : ''}
                            </div>
                          </div>
                          <div className="font-bold text-emerald-600 font-mono">
                            +{Number(alloc.allocatedAmount).toLocaleString('vi-VN')}đ
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 italic">Chưa có khoản thanh toán nào cho phiếu này.</p>
                  )}
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <ModalButton type="button" variant="secondary" onClick={() => setIsDetailModalOpen(false)} className="gap-1.5">
                <X size={14} />
                <span>Đóng</span>
              </ModalButton>
            </ModalFooter>
          </>
        )}
      </Modal>

      {/* MODAL 3: NHANH THANH TOÁN PHIẾU NÀY */}
      <Modal
        isOpen={!!quickPayReceipt}
        onClose={() => setQuickPayReceipt(null)}
        title={`Thanh Toán Cho Phiếu: ${quickPayReceipt?.receiptCode || ''}`}
        subtitle="Lập phiếu chi công nợ nhà cung cấp và ghi giảm số nợ của phiếu"
        icon={CreditCard}
        size="md"
      >
        <form onSubmit={handleQuickPaySubmit} className="space-y-4">
          <ModalBody className="space-y-3 text-xs sm:text-sm">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-900/30 flex justify-between">
              <div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <Building2 size={12} />
                  <span>Nhà cung cấp:</span>
                </div>
                <div className="font-bold text-gray-900 dark:text-white mt-0.5">{quickPayReceipt?.supplier?.name}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500 flex items-center justify-end gap-1">
                  <AlertCircle size={12} className="text-rose-500" />
                  <span>Số tiền còn nợ:</span>
                </div>
                <div className="font-bold text-rose-600 font-mono mt-0.5">
                  {Number(quickPayReceipt?.remainingAmount || 0).toLocaleString('vi-VN')}đ
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                <DollarSign size={13} className="text-emerald-500" />
                <span>Số tiền thanh toán (đ) *</span>
              </label>
              <CurrencyInput
                value={quickPayForm.amount}
                onChange={(val) => setQuickPayForm({ ...quickPayForm, amount: val })}
                suffix="đ"
                inputClassName="p-2 font-bold text-emerald-600 dark:text-emerald-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <User size={13} className="text-gray-400" />
                  <span>Người chi tiền *</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Chị Hồng, Bạn, Kế toán..."
                  value={quickPayForm.payerName}
                  onChange={(e) => setQuickPayForm({ ...quickPayForm, payerName: e.target.value })}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <Wallet size={13} className="text-gray-400" />
                  <span>Nguồn tiền *</span>
                </label>
                <select
                  value={quickPayForm.fundSource}
                  onChange={(e) => setQuickPayForm({ ...quickPayForm, fundSource: e.target.value as any })}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2"
                >
                  <option value="CASH_FUND">Quỹ tiền mặt</option>
                  <option value="BANK_ACCOUNT">Tài khoản công ty</option>
                  <option value="PERSONAL_FUND">Tiền cá nhân (Shop cần hoàn trả)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                <FileText size={13} className="text-gray-400" />
                <span>Mã giao dịch / UNC</span>
              </label>
              <input
                type="text"
                placeholder="Ví dụ: FT260101589..."
                value={quickPayForm.referenceCode}
                onChange={(e) => setQuickPayForm({ ...quickPayForm, referenceCode: e.target.value })}
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                <FileText size={13} className="text-gray-400" />
                <span>Ghi chú</span>
              </label>
              <input
                type="text"
                value={quickPayForm.note}
                onChange={(e) => setQuickPayForm({ ...quickPayForm, note: e.target.value })}
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2"
              />
            </div>
          </ModalBody>

          <ModalFooter>
            <ModalButton type="button" variant="outline" onClick={() => setQuickPayReceipt(null)} className="gap-1.5">
              <X size={14} />
              <span>Hủy</span>
            </ModalButton>
            <ModalButton type="submit" variant="primary" className="gap-1.5">
              <CheckCircle2 size={14} />
              <span>Xác nhận chi tiền</span>
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
    </div>
  );
};
