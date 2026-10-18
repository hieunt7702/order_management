import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Search,
  RotateCcw,
  ShoppingCart,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Warehouse,
  Building2,
  Trash2,
  RefreshCw,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  MoreHorizontal,
} from 'lucide-react';
import {
  supplierProductBorrowsApi,
  SupplierProductBorrowModel,
  CreateSupplierProductBorrowPayload,
  ReturnSupplierProductBorrowPayload,
  ConvertBorrowToPurchasePayload,
} from '../../services/supplierProductBorrowsApi';
import { SupplierItem } from '../../services/suppliersApi';
import { productsApi } from '../../services/productsApi';
import { useWorkspaceStore } from '../../stores/workspaceStore';
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
} from '../ui/DropdownMenu';
import { formatCurrency } from '../../utils';

export interface SupplierProductBorrowsTabProps {
  suppliers: SupplierItem[];
  onRefreshData?: () => void;
}

export const SupplierProductBorrowsTab: React.FC<SupplierProductBorrowsTabProps> = ({
  suppliers,
  onRefreshData,
}) => {
  const { warehouses, selectedWarehouseId } = useWorkspaceStore();

  const [borrows, setBorrows] = useState<SupplierProductBorrowModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BORROW_FROM_SUPPLIER' | 'LEND_TO_SUPPLIER'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [allVariants, setAllVariants] = useState<any[]>([]);

  const [summary, setSummary] = useState({
    totalBorrowedRemaining: 0,
    totalEstimatedBorrowedValue: 0,
    totalLentRemaining: 0,
    overdueCount: 0,
  });

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateSupplierProductBorrowPayload>({
    supplierId: '',
    warehouseId: '',
    type: 'BORROW_FROM_SUPPLIER',
    borrowDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    note: '',
    items: [
      {
        variantId: '',
        sku: '',
        productName: '',
        variationName: '',
        borrowQuantity: 1,
        unitPrice: 0,
        note: '',
      },
    ],
  });

  // Return Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedBorrowForReturn, setSelectedBorrowForReturn] = useState<SupplierProductBorrowModel | null>(null);
  const [returnForm, setReturnForm] = useState<{
    borrowId: string;
    items: Array<{ itemId: string; sku: string; productName: string; remainingQuantity: number; returnQuantity: number }>;
    note: string;
  }>({
    borrowId: '',
    items: [],
    note: '',
  });

  // Convert to Purchase Modal State
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [selectedBorrowForConvert, setSelectedBorrowForConvert] = useState<SupplierProductBorrowModel | null>(null);
  const [convertForm, setConvertForm] = useState<{
    borrowId: string;
    receiptCode: string;
    paymentDueDate: string;
    items: Array<{ itemId: string; sku: string; productName: string; remainingQuantity: number; purchaseQuantity: number; unitPrice: number }>;
    note: string;
  }>({
    borrowId: '',
    receiptCode: '',
    paymentDueDate: '',
    items: [],
    note: '',
  });

  // Detail Modal State
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedBorrowDetail, setSelectedBorrowDetail] = useState<SupplierProductBorrowModel | null>(null);

  useEffect(() => {
    loadBorrows();
    loadVariants();
  }, [typeFilter, statusFilter, selectedWarehouse, page]);

  const loadVariants = async () => {
    try {
      const res: any = await productsApi.findAllVariants({ limit: 1000 });
      const items = res?.items || res?.data || (Array.isArray(res) ? res : []);
      setAllVariants(items);
    } catch (err) {
      console.error('Lỗi tải biến thể sản phẩm:', err);
    }
  };

  const loadBorrows = async () => {
    try {
      setIsLoading(true);
      const res = await supplierProductBorrowsApi.findAll({
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        status: statusFilter === 'ALL' ? undefined : (statusFilter as any),
        warehouseId: selectedWarehouse === 'ALL' ? undefined : selectedWarehouse,
        search: searchTerm.trim() || undefined,
        page,
        limit,
      });

      const list = res.items || res.data || [];
      setBorrows(list);
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách mượn hàng:', err);
      toast.error('Không thể tải danh sách mượn hàng');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateModal = (type: 'BORROW_FROM_SUPPLIER' | 'LEND_TO_SUPPLIER' = 'BORROW_FROM_SUPPLIER') => {
    setCreateForm({
      supplierId: suppliers[0]?.id || '',
      warehouseId: selectedWarehouseId || warehouses[0]?.id || '',
      type,
      borrowDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      note: '',
      items: [
        {
          variantId: '',
          sku: '',
          productName: '',
          variationName: '',
          borrowQuantity: 1,
          unitPrice: 0,
          note: '',
        },
      ],
    });
    setIsCreateModalOpen(true);
  };

  const handleAddItemRow = () => {
    setCreateForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          variantId: '',
          sku: '',
          productName: '',
          variationName: '',
          borrowQuantity: 1,
          unitPrice: 0,
          note: '',
        },
      ],
    }));
  };

  const handleRemoveItemRow = (idx: number) => {
    if (createForm.items.length <= 1) return;
    setCreateForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const handleItemVariantSelect = (index: number, variantId: string) => {
    const v = allVariants.find((item) => item.id === variantId);
    if (!v) return;

    setCreateForm((prev) => {
      const nextItems = [...prev.items];
      nextItems[index] = {
        ...nextItems[index],
        variantId: v.id,
        sku: v.sku,
        productName: v.product?.name || v.name || '',
        variationName: v.name !== v.product?.name ? v.name : '',
        unitPrice: Number(v.costPrice) || 0,
      };
      return { ...prev, items: nextItems };
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.supplierId) {
      toast.error('Vui lòng chọn Nhà cung cấp');
      return;
    }
    if (!createForm.warehouseId) {
      toast.error('Vui lòng chọn Kho hàng');
      return;
    }

    const invalidItem = createForm.items.find((it) => !it.variantId || it.borrowQuantity <= 0);
    if (invalidItem) {
      toast.error('Vui lòng chọn SKU hợp lệ và số lượng lớn hơn 0 cho tất cả các dòng');
      return;
    }

    try {
      await supplierProductBorrowsApi.create(createForm);
      toast.success(
        createForm.type === 'BORROW_FROM_SUPPLIER'
          ? 'Đã tạo phiếu mượn hàng từ NCC và cộng tồn kho thành công'
          : 'Đã tạo phiếu cho NCC mượn hàng thành công',
      );
      setIsCreateModalOpen(false);
      loadBorrows();
      onRefreshData?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi tạo phiếu mượn hàng');
    }
  };

  // Open Return Modal
  const handleOpenReturnModal = (borrow: SupplierProductBorrowModel) => {
    setSelectedBorrowForReturn(borrow);
    const validItems = (borrow.items || [])
      .filter((it) => it.remainingQuantity > 0)
      .map((it) => ({
        itemId: it.id,
        sku: it.sku,
        productName: it.productName,
        remainingQuantity: it.remainingQuantity,
        returnQuantity: it.remainingQuantity,
      }));

    setReturnForm({
      borrowId: borrow.id,
      items: validItems,
      note: '',
    });
    setIsReturnModalOpen(true);
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeReturns = returnForm.items.filter((it) => it.returnQuantity > 0);
    if (activeReturns.length === 0) {
      toast.error('Vui lòng nhập số lượng trả lớn hơn 0 cho ít nhất 1 sản phẩm');
      return;
    }

    try {
      await supplierProductBorrowsApi.returnItems({
        borrowId: returnForm.borrowId,
        note: returnForm.note,
        items: activeReturns.map((it) => ({
          itemId: it.itemId,
          returnQuantity: it.returnQuantity,
        })),
      });

      toast.success('Đã xuất trả hàng mượn và cập nhật trừ kho thành công');
      setIsReturnModalOpen(false);
      loadBorrows();
      onRefreshData?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi trả hàng mượn');
    }
  };

  // Open Convert To Purchase Modal
  const handleOpenConvertModal = (borrow: SupplierProductBorrowModel) => {
    setSelectedBorrowForConvert(borrow);
    const validItems = (borrow.items || [])
      .filter((it) => it.remainingQuantity > 0)
      .map((it) => ({
        itemId: it.id,
        sku: it.sku,
        productName: it.productName,
        remainingQuantity: it.remainingQuantity,
        purchaseQuantity: it.remainingQuantity,
        unitPrice: Number(it.unitPrice) || 0,
      }));

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();

    setConvertForm({
      borrowId: borrow.id,
      receiptCode: `PNK-MUA-${dateStr}-${rand}`,
      paymentDueDate: '',
      items: validItems,
      note: `Mua đứt từ phiếu mượn ${borrow.borrowCode}`,
    });
    setIsConvertModalOpen(true);
  };

  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeItems = convertForm.items.filter((it) => it.purchaseQuantity > 0);
    if (activeItems.length === 0) {
      toast.error('Vui lòng nhập số lượng mua đứt lớn hơn 0');
      return;
    }

    try {
      const res = await supplierProductBorrowsApi.convertToPurchase({
        borrowId: convertForm.borrowId,
        receiptCode: convertForm.receiptCode,
        paymentDueDate: convertForm.paymentDueDate || undefined,
        note: convertForm.note,
        items: activeItems.map((it) => ({
          itemId: it.itemId,
          purchaseQuantity: it.purchaseQuantity,
          unitPrice: it.unitPrice,
        })),
      });

      toast.success(
        `Đã chuyển thành công sang Phiếu nhập kho ${res.purchaseReceipt.receiptCode} & ghi nhận công nợ (Không cộng kho lần 2)!`,
      );
      setIsConvertModalOpen(false);
      loadBorrows();
      onRefreshData?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi chuyển sang mua hàng');
    }
  };

  const handleOpenDetail = (borrow: SupplierProductBorrowModel) => {
    setSelectedBorrowDetail(borrow);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="space-y-3.5">
      {/* 1. Top Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h3 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
            <Boxes size={15} className="text-indigo-500" />
            <span>Mượn / Vay Sản Phẩm & Mẫu Hàng Từ Nhà Cung Cấp</span>
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            Mượn hàng về kho để kịp đóng đơn Shopee hoặc livestream; xuất trả hoặc chuyển đổi mua đứt linh hoạt
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            onClick={() => handleOpenCreateModal('BORROW_FROM_SUPPLIER')}
            className="gap-1.5 bg-[#5865f2] hover:bg-[#4752c4] text-white"
          >
            <Plus size={14} />
            <span>Mượn hàng từ NCC</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenCreateModal('LEND_TO_SUPPLIER')}
            className="gap-1.5 text-blue-600 border-blue-200 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-950/20"
          >
            <ArrowUpRight size={14} />
            <span>Cho NCC mượn</span>
          </Button>
          <Button size="sm" variant="outline" onClick={loadBorrows} className="p-2" title="Làm mới">
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* 2. KPI Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
        <div className="p-2.5 sm:p-3 rounded bg-white dark:bg-[#161a22] border border-gray-200 dark:border-gray-800">
          <div className="text-gray-500 flex items-center gap-1 text-[11px]">
            <Boxes size={12} className="text-indigo-500" />
            <span>SL sản phẩm đang mượn</span>
          </div>
          <div className="text-sm sm:text-base font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
            {summary.totalBorrowedRemaining.toLocaleString('vi-VN')} cái
          </div>
        </div>

        <div className="p-2.5 sm:p-3 rounded bg-white dark:bg-[#161a22] border border-gray-200 dark:border-gray-800">
          <div className="text-gray-500 flex items-center gap-1 text-[11px]">
            <Package size={12} className="text-emerald-500" />
            <span>Giá trị hàng mượn ước tính</span>
          </div>
          <div className="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
            {formatCurrency(summary.totalEstimatedBorrowedValue)} đ
          </div>
        </div>

        <div className="p-2.5 sm:p-3 rounded bg-white dark:bg-[#161a22] border border-gray-200 dark:border-gray-800">
          <div className="text-gray-500 flex items-center gap-1 text-[11px]">
            <ArrowUpRight size={12} className="text-blue-500" />
            <span>SL sản phẩm cho NCC mượn</span>
          </div>
          <div className="text-sm sm:text-base font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
            {summary.totalLentRemaining.toLocaleString('vi-VN')} cái
          </div>
        </div>

        <div className="p-2.5 sm:p-3 rounded bg-white dark:bg-[#161a22] border border-gray-200 dark:border-gray-800">
          <div className="text-gray-500 flex items-center gap-1 text-[11px]">
            <AlertTriangle size={12} className="text-rose-500" />
            <span>Phiếu mượn quá hạn trả</span>
          </div>
          <div className="text-sm sm:text-base font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
            {summary.overdueCount} phiếu
          </div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 bg-white dark:bg-[#161a22] rounded border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-sm">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm theo mã phiếu, tên NCC, SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadBorrows()}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-[#111318] border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:border-[#5865f2]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={typeFilter}
            onChange={(val) => setTypeFilter(val as any)}
            options={[
              { value: 'ALL', label: 'Tất cả loại mượn' },
              { value: 'BORROW_FROM_SUPPLIER', label: 'Shop mượn NCC' },
              { value: 'LEND_TO_SUPPLIER', label: 'Shop cho NCC mượn' },
            ]}
            size="sm"
            className="w-40"
          />

          <Select
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            options={[
              { value: 'ALL', label: 'Tất cả trạng thái' },
              { value: 'BORROWED', label: 'Đang mượn' },
              { value: 'PARTIALLY_RETURNED', label: 'Đã trả 1 phần' },
              { value: 'RETURNED', label: 'Đã trả lại đủ' },
              { value: 'CONVERTED_TO_PURCHASE', label: 'Đã mua đứt' },
            ]}
            size="sm"
            className="w-40"
          />

          <Select
            value={selectedWarehouse}
            onChange={(val) => setSelectedWarehouse(val)}
            options={[
              { value: 'ALL', label: 'Tất cả kho' },
              ...warehouses.map((w) => ({ value: w.id, label: w.name })),
            ]}
            size="sm"
            className="w-36"
          />
        </div>
      </div>

      {/* 4. Desktop Table View */}
      <div className="hidden md:block">
        <SystemTableWrapper tableClassName="min-w-[1100px]">
          <SystemThead>
            <SystemTh className="w-14 text-center">STT</SystemTh>
            <SystemTh className="w-40">Mã Phiếu Mượn</SystemTh>
            <SystemTh className="w-56">Nhà Cung Cấp</SystemTh>
            <SystemTh className="w-36 text-center">Kho Hàng</SystemTh>
            <SystemTh className="w-32 text-center">Hình Thức</SystemTh>
            <SystemTh className="w-28 text-center">Tổng SL</SystemTh>
            <SystemTh className="w-28 text-center">Đã Trả / Mua</SystemTh>
            <SystemTh className="w-28 text-center">Còn Đang Mượn</SystemTh>
            <SystemTh className="w-32 text-center">Ngày Mượn / Hạn</SystemTh>
            <SystemTh className="w-32 text-center">Trạng Thái</SystemTh>
            <SystemTh className="w-24 text-center">Thao Tác</SystemTh>
          </SystemThead>
          <SystemTbody>
            {isLoading ? (
              <SystemTableSkeleton cols={11} rows={5} />
            ) : borrows.length === 0 ? (
              <SystemTableEmpty
                title="Chưa có phiếu mượn sản phẩm nào"
                description="Bạn chưa tạo phiếu mượn mẫu, vay hàng hoặc cho NCC mượn hàng nào."
                colSpan={11}
              />
            ) : (
              borrows.map((b, idx) => {
                const isBorrow = b.type === 'BORROW_FROM_SUPPLIER';
                const hasRemaining = b.remainingQuantity > 0;

                return (
                  <SystemTr key={b.id} className="cursor-pointer" onClick={() => handleOpenDetail(b)}>
                    <SystemTd align="center" className="text-gray-400 text-xs">
                      {idx + 1}
                    </SystemTd>
                    <SystemTd>
                      <div className="font-mono font-bold text-xs text-[#5865f2] hover:underline">
                        {b.borrowCode}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                        {b.items?.length || 0} sản phẩm
                      </div>
                    </SystemTd>
                    <SystemTd>
                      <div className="font-semibold text-gray-900 dark:text-white">{b.supplier?.name}</div>
                      <div className="text-[11px] font-mono text-gray-400 mt-0.5">{b.supplier?.code}</div>
                    </SystemTd>
                    <SystemTd align="center">
                      <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                        {b.warehouse?.name}
                      </span>
                    </SystemTd>
                    <SystemTd align="center">
                      {isBorrow ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                          <ArrowDownLeft size={11} />
                          <span>Shop mượn NCC</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                          <ArrowUpRight size={11} />
                          <span>Cho NCC mượn</span>
                        </span>
                      )}
                    </SystemTd>
                    <SystemTd align="center" className="font-mono font-semibold text-gray-900 dark:text-white">
                      {b.totalQuantity.toLocaleString('vi-VN')}
                    </SystemTd>
                    <SystemTd align="center" className="font-mono text-emerald-600 dark:text-emerald-400">
                      {(b.returnedQuantity + b.purchasedQuantity).toLocaleString('vi-VN')}
                      {b.purchasedQuantity > 0 && (
                        <span className="text-[10px] text-blue-500 ml-1">({b.purchasedQuantity} mua)</span>
                      )}
                    </SystemTd>
                    <SystemTd align="center" className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      {b.remainingQuantity.toLocaleString('vi-VN')}
                    </SystemTd>
                    <SystemTd align="center" className="text-xs text-gray-500">
                      <div>{b.borrowDate ? new Date(b.borrowDate).toLocaleDateString('vi-VN') : ''}</div>
                      {b.dueDate && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                          Hạn: {new Date(b.dueDate).toLocaleDateString('vi-VN')}
                        </div>
                      )}
                    </SystemTd>
                    <SystemTd align="center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${b.status === 'RETURNED'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : b.status === 'CONVERTED_TO_PURCHASE'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : b.status === 'PARTIALLY_RETURNED'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                          }`}
                      >
                        {b.status === 'RETURNED'
                          ? 'Đã trả đủ'
                          : b.status === 'CONVERTED_TO_PURCHASE'
                            ? 'Đã mua đứt'
                            : b.status === 'PARTIALLY_RETURNED'
                              ? 'Đã trả 1 phần'
                              : 'Đang mượn'}
                      </span>
                    </SystemTd>
                    <SystemTd align="center" onClick={(e) => e.stopPropagation()}>
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
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => handleOpenDetail(b)}>
                              <Eye size={13} className="text-[#5865f2]" />
                              <span>Xem danh sách sản phẩm</span>
                            </DropdownMenuItem>
                            {hasRemaining && (
                              <>
                                <DropdownMenuItem onClick={() => handleOpenReturnModal(b)}>
                                  <RotateCcw size={13} className="text-orange-500" />
                                  <span className="text-orange-600 dark:text-orange-400 font-medium">
                                    Xuất trả lại hàng cho NCC
                                  </span>
                                </DropdownMenuItem>
                                {isBorrow && (
                                  <DropdownMenuItem onClick={() => handleOpenConvertModal(b)}>
                                    <ShoppingCart size={13} className="text-emerald-500" />
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                      Mua đứt (Chuyển sang mua hàng)
                                    </span>
                                  </DropdownMenuItem>
                                )}
                              </>
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
          <div className="py-8 text-center text-xs text-gray-400">Đang tải danh sách mượn hàng...</div>
        ) : borrows.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">Chưa có phiếu mượn hàng nào</div>
        ) : (
          borrows.map((b) => {
            const isBorrow = b.type === 'BORROW_FROM_SUPPLIER';
            const hasRemaining = b.remainingQuantity > 0;

            return (
              <div
                key={b.id}
                onClick={() => handleOpenDetail(b)}
                className="p-3 bg-white dark:bg-[#161a22] rounded border border-gray-200 dark:border-gray-800 space-y-2 text-xs cursor-pointer shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono font-bold text-xs text-[#5865f2]">{b.borrowCode}</div>
                    <div className="font-semibold text-gray-900 dark:text-white mt-0.5">
                      {b.supplier?.name}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${!hasRemaining
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                      }`}
                  >
                    {!hasRemaining ? 'Hoàn tất' : 'Đang mượn'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 p-2 bg-gray-50 dark:bg-[#12151b] rounded text-[11px]">
                  <div>
                    <span className="text-gray-400">Tổng mượn:</span>
                    <div className="font-mono font-medium text-gray-900 dark:text-white">
                      {b.totalQuantity} cái
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Còn đang mượn:</span>
                    <div className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      {b.remainingQuantity} cái
                    </div>
                  </div>
                </div>

                <div
                  className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span>{b.borrowDate ? new Date(b.borrowDate).toLocaleDateString('vi-VN') : ''}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="px-2.5 py-1 rounded flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      >
                        <MoreHorizontal size={13} />
                        <span>Thao tác</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={() => handleOpenDetail(b)}>
                        <Eye size={13} className="text-[#5865f2]" />
                        <span>Xem danh sách sản phẩm</span>
                      </DropdownMenuItem>
                      {hasRemaining && (
                        <>
                          <DropdownMenuItem onClick={() => handleOpenReturnModal(b)}>
                            <RotateCcw size={13} className="text-orange-500" />
                            <span className="text-orange-600 dark:text-orange-400 font-medium">
                              Xuất trả lại hàng cho NCC
                            </span>
                          </DropdownMenuItem>
                          {isBorrow && (
                            <DropdownMenuItem onClick={() => handleOpenConvertModal(b)}>
                              <ShoppingCart size={13} className="text-emerald-500" />
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                Mua đứt (Chuyển sang mua hàng)
                              </span>
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: TẠO PHIẾU MƯỢN HÀNG */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={
          createForm.type === 'BORROW_FROM_SUPPLIER'
            ? 'Lập Phiếu Mượn Sản Phẩm Từ Nhà Cung Cấp'
            : 'Lập Phiếu Cho Nhà Cung Cấp Mượn Sản Phẩm'
        }
        subtitle="Hệ thống tự động điều chỉnh tồn kho và ghi nhận sổ cái kho bất biến"
        icon={Boxes}
        size="2xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <ModalBody className="space-y-3 p-3 sm:p-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <Building2 size={13} className="text-[#5865f2]" />
                  <span>Nhà Cung Cấp *</span>
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

              <div>
                <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <Warehouse size={13} className="text-amber-500" />
                  <span>Kho nhập/xuất *</span>
                </label>
                <Select
                  value={createForm.warehouseId}
                  onChange={(val) => setCreateForm({ ...createForm, warehouseId: val })}
                  options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                  size="sm"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <ArrowDownLeft size={13} className="text-purple-500" />
                  <span>Hình thức *</span>
                </label>
                <Select
                  value={createForm.type}
                  onChange={(val) => setCreateForm({ ...createForm, type: val as any })}
                  options={[
                    { value: 'BORROW_FROM_SUPPLIER', label: 'Shop mượn NCC (+ Tồn kho)' },
                    { value: 'LEND_TO_SUPPLIER', label: 'Shop cho NCC mượn (- Tồn kho)' },
                  ]}
                  size="sm"
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <Calendar size={13} className="text-blue-500" />
                  <span>Ngày mượn</span>
                </label>
                <input
                  type="date"
                  value={createForm.borrowDate}
                  onChange={(e) => setCreateForm({ ...createForm, borrowDate: e.target.value })}
                  className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                  <Clock size={13} className="text-amber-500" />
                  <span>Hạn trả hàng (Dự kiến)</span>
                </label>
                <input
                  type="date"
                  value={createForm.dueDate}
                  onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
                  className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>

            {/* Items Table */}
            <div className="border border-gray-200 dark:border-gray-800 rounded overflow-hidden">
              <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 flex justify-between items-center">
                <span>Danh sách sản phẩm mượn ({createForm.items.length})</span>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="text-[11px] text-[#5865f2] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Plus size={12} />
                  <span>Thêm dòng sản phẩm</span>
                </button>
              </div>

              <div className="p-3 space-y-2.5 max-h-64 overflow-y-auto">
                {createForm.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded bg-gray-50 dark:bg-[#12151b] border border-gray-100 dark:border-gray-800">
                    <div className="sm:col-span-5">
                      <label className="block text-[10px] text-gray-400 mb-0.5">Chọn sản phẩm / SKU *</label>
                      <Select
                        value={it.variantId}
                        onChange={(val) => handleItemVariantSelect(idx, val)}
                        options={allVariants.map((v) => ({
                          value: v.id,
                          label: `${v.sku} - ${v.product?.name || v.name} (${v.name})`,
                        }))}
                        placeholder="-- Chọn biến thể SKU --"
                        searchable
                        size="sm"
                        className="w-full"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-gray-400 mb-0.5">SL mượn *</label>
                      <input
                        type="number"
                        min="1"
                        value={it.borrowQuantity}
                        onChange={(e) => {
                          const qty = Math.max(1, Number(e.target.value) || 1);
                          setCreateForm((prev) => {
                            const next = [...prev.items];
                            next[idx] = { ...next[idx], borrowQuantity: qty };
                            return { ...prev, items: next };
                          });
                        }}
                        className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs font-mono font-bold text-center"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[10px] text-gray-400 mb-0.5">Đơn giá tham chiếu (đ)</label>
                      <CurrencyInput
                        value={it.unitPrice || 0}
                        onChange={(val) => {
                          setCreateForm((prev) => {
                            const next = [...prev.items];
                            next[idx] = { ...next[idx], unitPrice: val };
                            return { ...prev, items: next };
                          });
                        }}
                        suffix="đ"
                        inputClassName="h-7 text-xs font-mono"
                      />
                    </div>

                    <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-1 pt-3 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        disabled={createForm.items.length <= 1}
                        className="p-1 text-gray-400 hover:text-rose-500 disabled:opacity-30 cursor-pointer"
                        title="Xóa dòng"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Ghi chú phiếu mượn</label>
              <input
                type="text"
                placeholder="VD: Mượn hàng mẫu livestream TikTok, trả lại sau 3 ngày..."
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
              <span>Xác nhận lập phiếu mượn</span>
            </ModalButton>
          </ModalFooter>
        </form>
      </Modal>

      {/* MODAL 2: TRẢ HÀNG MƯỢN */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title="Xuất Trả Lại Hàng Mượn Cho Nhà Cung Cấp"
        subtitle={selectedBorrowForReturn ? `Phiếu: ${selectedBorrowForReturn.borrowCode} - ${selectedBorrowForReturn.supplier?.name}` : ''}
        icon={RotateCcw}
        size="lg"
      >
        <form onSubmit={handleReturnSubmit} className="space-y-4">
          <ModalBody className="space-y-3 p-3 sm:p-5 text-xs">
            <div className="border border-gray-200 dark:border-gray-800 rounded overflow-hidden">
              <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">
                Nhập số lượng xuất trả cho từng sản phẩm
              </div>
              <div className="p-3 space-y-2">
                {returnForm.items.map((it, idx) => (
                  <div key={it.itemId} className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-[#12151b]">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="font-semibold text-gray-900 dark:text-white truncate">{it.productName}</div>
                      <div className="text-[11px] font-mono text-gray-400">{it.sku} • Còn mượn: {it.remainingQuantity}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] text-gray-500">Trả:</span>
                      <input
                        type="number"
                        min="0"
                        max={it.remainingQuantity}
                        value={it.returnQuantity}
                        onChange={(e) => {
                          const val = Math.min(it.remainingQuantity, Math.max(0, Number(e.target.value) || 0));
                          setReturnForm((prev) => {
                            const next = [...prev.items];
                            next[idx] = { ...next[idx], returnQuantity: val };
                            return { ...prev, items: next };
                          });
                        }}
                        className="w-20 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs font-mono font-bold text-center"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Ghi chú đợt trả</label>
              <input
                type="text"
                placeholder="VD: Trả hàng nguyên tem mác sau phiên live..."
                value={returnForm.note}
                onChange={(e) => setReturnForm({ ...returnForm, note: e.target.value })}
                className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs"
              />
            </div>
          </ModalBody>

          <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
            <ModalButton type="button" variant="outline" onClick={() => setIsReturnModalOpen(false)}>
              Hủy
            </ModalButton>
            <ModalButton type="submit" variant="primary" className="bg-orange-600 hover:bg-orange-700 text-white">
              <RotateCcw size={14} />
              <span>Xác nhận xuất trả hàng</span>
            </ModalButton>
          </ModalFooter>
        </form>
      </Modal>

      {/* MODAL 3: CHUYỂN THÀNH MUA HÀNG (MUA ĐỨT) */}
      <Modal
        isOpen={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        title="Chuyển Hàng Mượn Thành Hàng Mua Đứt"
        subtitle="Hệ thống tự động sinh Phiếu Nhập Kho & ghi nhận công nợ (KHÔNG cộng kho lần 2)"
        icon={ShoppingCart}
        size="lg"
      >
        <form onSubmit={handleConvertSubmit} className="space-y-4">
          <ModalBody className="space-y-3 p-3 sm:p-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Mã phiếu nhập mua hàng</label>
                <input
                  type="text"
                  value={convertForm.receiptCode}
                  onChange={(e) => setConvertForm({ ...convertForm, receiptCode: e.target.value })}
                  className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Hạn thanh toán tiền hàng</label>
                <input
                  type="date"
                  value={convertForm.paymentDueDate}
                  onChange={(e) => setConvertForm({ ...convertForm, paymentDueDate: e.target.value })}
                  className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-800 rounded overflow-hidden">
              <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">
                Sản phẩm mua đứt & Đơn giá nhập mua
              </div>
              <div className="p-3 space-y-2.5">
                {convertForm.items.map((it, idx) => (
                  <div key={it.itemId} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded bg-gray-50 dark:bg-[#12151b]">
                    <div className="sm:col-span-5">
                      <div className="font-semibold text-gray-900 dark:text-white truncate">{it.productName}</div>
                      <div className="text-[11px] font-mono text-gray-400">{it.sku} • Còn mượn: {it.remainingQuantity}</div>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[10px] text-gray-400 mb-0.5">SL mua đứt</label>
                      <input
                        type="number"
                        min="0"
                        max={it.remainingQuantity}
                        value={it.purchaseQuantity}
                        onChange={(e) => {
                          const val = Math.min(it.remainingQuantity, Math.max(0, Number(e.target.value) || 0));
                          setConvertForm((prev) => {
                            const next = [...prev.items];
                            next[idx] = { ...next[idx], purchaseQuantity: val };
                            return { ...prev, items: next };
                          });
                        }}
                        className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs font-mono font-bold text-center"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-[10px] text-gray-400 mb-0.5">Đơn giá mua chính thức (đ)</label>
                      <CurrencyInput
                        value={it.unitPrice}
                        onChange={(val) => {
                          setConvertForm((prev) => {
                            const next = [...prev.items];
                            next[idx] = { ...next[idx], unitPrice: val };
                            return { ...prev, items: next };
                          });
                        }}
                        suffix="đ"
                        inputClassName="h-7 text-xs font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Ghi chú</label>
              <input
                type="text"
                value={convertForm.note}
                onChange={(e) => setConvertForm({ ...convertForm, note: e.target.value })}
                className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs"
              />
            </div>
          </ModalBody>

          <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
            <ModalButton type="button" variant="outline" onClick={() => setIsConvertModalOpen(false)}>
              Hủy
            </ModalButton>
            <ModalButton type="submit" variant="primary" className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <ShoppingCart size={14} />
              <span>Xác nhận mua đứt & Tạo phiếu nhập</span>
            </ModalButton>
          </ModalFooter>
        </form>
      </Modal>

      {/* MODAL 4: XEM CHI TIẾT PHIẾU MƯỢN */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Chi tiết: ${selectedBorrowDetail?.borrowCode || ''}`}
        subtitle={`${selectedBorrowDetail?.supplier?.name} • Kho: ${selectedBorrowDetail?.warehouse?.name}`}
        icon={Boxes}
        size="lg"
      >
        <ModalBody className="space-y-4 p-4 text-xs">
          <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded text-center">
            <div>
              <span className="text-gray-400">Tổng mượn</span>
              <div className="font-mono font-bold text-gray-900 dark:text-white text-sm mt-0.5">
                {selectedBorrowDetail?.totalQuantity} cái
              </div>
            </div>
            <div>
              <span className="text-gray-400">Đã trả / Đã mua</span>
              <div className="font-mono font-bold text-emerald-600 text-sm mt-0.5">
                {Number(selectedBorrowDetail?.returnedQuantity || 0) + Number(selectedBorrowDetail?.purchasedQuantity || 0)} cái
              </div>
            </div>
            <div>
              <span className="text-gray-400">Còn đang mượn</span>
              <div className="font-mono font-bold text-rose-600 text-sm mt-0.5">
                {selectedBorrowDetail?.remainingQuantity} cái
              </div>
            </div>
          </div>

          <div className="border border-gray-200 dark:border-gray-800 rounded overflow-hidden">
            <div className="bg-gray-100 dark:bg-gray-800/80 px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">
              Danh sách sản phẩm trong phiếu ({selectedBorrowDetail?.items?.length || 0})
            </div>
            <div className="p-3">
              {selectedBorrowDetail?.items && selectedBorrowDetail.items.length > 0 ? (
                <div className="space-y-2">
                  {selectedBorrowDetail.items.map((it) => (
                    <div key={it.id} className="p-2.5 bg-gray-50 dark:bg-[#12151b] rounded flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">{it.productName}</div>
                        <div className="text-[11px] font-mono text-gray-400 mt-0.5">
                          SKU: {it.sku} {it.variationName ? `• ${it.variationName}` : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-gray-900 dark:text-white">
                          Mượn: {it.borrowQuantity}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          Trả: {it.returnedQuantity} • Mua: {it.purchasedQuantity} • <span className="text-rose-500 font-bold">Còn: {it.remainingQuantity}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-400 py-3 italic">Chưa có sản phẩm nào</div>
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
    </div>
  );
};
