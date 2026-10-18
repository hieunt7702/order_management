import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Warehouse,
  Boxes,
  ArrowDownLeft,
  Sliders,
  History,
  ShieldCheck,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  MoreHorizontal,
  Plus,
  Package,
  PackagePlus,
  PackageX,
} from 'lucide-react';
import { inventoryApi } from '../../services/inventoryApi';
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
import { Button } from '../../components/ui/Button';
import { SystemMetricPairCard } from '../../components/ui/SystemMetricCard';
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../../components/ui/DropdownMenu';

const REASON_OPTIONS = [
  { value: 'INVENTORY_CHECK_DISCREPANCY', label: 'Kiểm kê định kỳ phát hiện chênh lệch' },
  { value: 'DAMAGE', label: 'Hàng hỏng vỡ, lỗi trong quá trình bảo quản' },
  { value: 'LOSS', label: 'Mất mát, thất thoát không rõ nguyên nhân' },
  { value: 'CORRECTION', label: 'Bút toán điều chỉnh sai sót nhập liệu' },
];

const generateReceiptCode = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PNK-${y}${m}${d}-${rand}`;
};

export const InventoryPage: React.FC = () => {
  const { selectedWarehouseId, warehouses, setSelectedWarehouseId } = useWorkspaceStore();

  const [activeTab, setActiveTab] = useState<'BALANCES' | 'LEDGER' | 'RECONCILIATION'>('BALANCES');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Balances state
  const [balances, setBalances] = useState<any[]>([]);
  const [balancePage, setBalancePage] = useState<number>(1);
  const [balanceLimit, setBalanceLimit] = useState<number>(25);
  const [isLoadingBalances, setIsLoadingBalances] = useState<boolean>(true);

  // Ledger state
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [ledgerPage, setLedgerPage] = useState<number>(1);
  const [ledgerLimit, setLedgerLimit] = useState<number>(25);
  const [isLoadingLedger, setIsLoadingLedger] = useState<boolean>(false);

  // Reconciliation state
  const [reconciliationResult, setReconciliationResult] = useState<any>(null);
  const [isReconciling, setIsReconciling] = useState<boolean>(false);
  const [reconciliationSearchTerm, setReconciliationSearchTerm] = useState<string>('');
  const [reconciliationFilter, setReconciliationFilter] = useState<'ALL' | 'DISCREPANCY' | 'BALANCED'>('ALL');
  const [reconciliationPage, setReconciliationPage] = useState<number>(1);
  const [reconciliationLimit, setReconciliationLimit] = useState<number>(25);

  // Modals
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState<boolean>(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState<boolean>(false);

  // Products & Variants list for dropdown selection
  const [allVariants, setAllVariants] = useState<any[]>([]);

  // Forms
  const [receiveForm, setReceiveForm] = useState({
    warehouseId: selectedWarehouseId || '',
    variantId: '',
    quantity: 1,
    unitCost: 0,
    referenceCode: generateReceiptCode(),
    note: '',
  });

  const [adjustForm, setAdjustForm] = useState({
    warehouseId: selectedWarehouseId || '',
    variantId: '',
    quantityChange: 0,
    reason: 'INVENTORY_CHECK_DISCREPANCY',
    note: '',
  });

  useEffect(() => {
    loadVariantsList();
  }, []);

  useEffect(() => {
    if (activeTab === 'BALANCES') {
      loadBalances();
    } else if (activeTab === 'LEDGER') {
      loadLedger();
    }
  }, [activeTab, selectedWarehouseId, searchTerm, ledgerPage]);

  // Keep modal forms synced with header warehouse selection
  useEffect(() => {
    if (selectedWarehouseId) {
      setReceiveForm((prev) => ({ ...prev, warehouseId: selectedWarehouseId }));
      setAdjustForm((prev) => ({ ...prev, warehouseId: selectedWarehouseId }));
    }
  }, [selectedWarehouseId]);

  const loadVariantsList = async () => {
    try {
      const res: any = await productsApi.findAll({ limit: 200 });
      const products = res?.data || res?.items || [];
      const flat = products.flatMap((p: any) =>
        (p.variants || []).map((v: any) => ({
          id: v.id,
          sku: v.sku,
          name: v.name,
          productName: p.name,
          barcode: v.barcode,
          costPrice: v.costPrice,
        }))
      );
      setAllVariants(flat);
    } catch (err) {
      console.error('Error loading variants for inventory forms:', err);
    }
  };

  const loadBalances = async () => {
    setIsLoadingBalances(true);
    try {
      const res: any = await inventoryApi.getBalances({
        warehouseId: selectedWarehouseId || undefined,
        search: searchTerm || undefined,
      });
      setBalances(res || []);
    } catch (err) {
      console.error('Error loading inventory balances:', err);
    } finally {
      setIsLoadingBalances(false);
    }
  };

  const loadLedger = async () => {
    setIsLoadingLedger(true);
    try {
      const res: any = await inventoryApi.getLedger({
        page: ledgerPage,
        limit: ledgerLimit,
        warehouseId: selectedWarehouseId || undefined,
      });
      setLedgerEntries(res?.data || res?.items || res || []);
    } catch (err) {
      console.error('Error loading inventory ledger:', err);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  const handleRunReconciliation = async () => {
    setIsReconciling(true);
    try {
      const res: any = await inventoryApi.reconcile(selectedWarehouseId || undefined);
      setReconciliationResult(res);
      toast.success('Kiểm toán đối soát hoàn tất!');
    } catch (err: any) {
      toast.error('Lỗi kiểm toán đối soát', err.message);
    } finally {
      setIsReconciling(false);
    }
  };

  // Submit Receive Stock
  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveForm.warehouseId || !receiveForm.variantId || receiveForm.quantity <= 0) {
      toast.warning('Vui lòng điền kho, biến thể và số lượng nhập lớn hơn 0');
      return;
    }
    const idempotencyKey = `rcv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    try {
      const qty = parseInt(String(receiveForm.quantity), 10);
      await inventoryApi.receiveStock(
        {
          warehouseId: receiveForm.warehouseId,
          items: [{ variantId: receiveForm.variantId, quantity: qty }],
          variantId: receiveForm.variantId,
          quantity: qty,
          unitCost: parseFloat(String(receiveForm.unitCost)) || undefined,
          referenceCode: receiveForm.referenceCode || undefined,
          note: receiveForm.note || undefined,
        },
        idempotencyKey
      );
      setIsReceiveModalOpen(false);
      setReceiveForm({
        warehouseId: selectedWarehouseId || '',
        variantId: '',
        quantity: 1,
        unitCost: 0,
        referenceCode: generateReceiptCode(),
        note: '',
      });
      loadBalances();
      toast.success('Nhập kho thành công!');
    } catch (err: any) {
      toast.error('Lỗi nhập kho', err.message);
    }
  };

  // Submit Adjust Stock
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustForm.warehouseId || !adjustForm.variantId || adjustForm.quantityChange === 0) {
      toast.warning('Vui lòng điền kho, biến thể và số lượng thay đổi khác 0');
      return;
    }
    const idempotencyKey = `adj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    try {
      const delta = parseInt(String(adjustForm.quantityChange), 10);
      await inventoryApi.adjustStock(
        {
          warehouseId: adjustForm.warehouseId,
          variantId: adjustForm.variantId,
          deltaOnHand: delta,
          quantityChange: delta,
          reason: adjustForm.reason,
          note: adjustForm.note || undefined,
        },
        idempotencyKey
      );
      setIsAdjustModalOpen(false);
      setAdjustForm({
        warehouseId: selectedWarehouseId || '',
        variantId: '',
        quantityChange: 0,
        reason: 'INVENTORY_CHECK_DISCREPANCY',
        note: '',
      });
      loadBalances();
      toast.success('Điều chỉnh tồn kho thành công!');
    } catch (err: any) {
      toast.error('Lỗi điều chỉnh tồn kho', err.message);
    }
  };

  const handleOpenReceiveModal = (variantId = '') => {
    const chosen = variantId ? allVariants.find((v) => v.id === variantId) : null;
    setReceiveForm({
      warehouseId: selectedWarehouseId || warehouses[0]?.id || '',
      variantId: variantId || '',
      quantity: 1,
      unitCost: chosen?.costPrice || 0,
      referenceCode: generateReceiptCode(),
      note: '',
    });
    setIsReceiveModalOpen(true);
  };

  const openReceiveForVariant = (variantId: string) => {
    handleOpenReceiveModal(variantId);
  };

  const openAdjustForVariant = (variantId: string) => {
    setAdjustForm((prev) => ({ ...prev, variantId }));
    setIsAdjustModalOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col min-h-fit md:min-h-0 space-y-3.5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-xl font-medium text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2 truncate">
            <Boxes size={18} className="text-[#5865f2] shrink-0 sm:w-5 sm:h-5" />
            <span className="truncate">Kho & Tồn kho</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate hidden sm:block">
            Theo dõi số dư thực tế, nhập kho, điều chỉnh kiểm kê và sổ cái biến động bất biến
          </p>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Link to="/purchase-receipts">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2 sm:px-3 gap-1 sm:gap-1.5 border-[#5865f2]/40 text-[#5865f2] dark:text-[#7b85f5] hover:bg-[#5865f2]/10 text-xs"
              title="Nhập hàng từ Nhà phân phối có công nợ"
            >
              <PackagePlus size={14} />
              <span className="hidden md:inline">Phiếu nhập NCC</span>
              <span className="hidden sm:inline md:hidden">Phiếu nhập</span>
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={() => handleOpenReceiveModal()}
            className="h-8 px-2 sm:px-3 gap-1 sm:gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            title="Nhập kho lẻ"
          >
            <ArrowDownLeft size={14} />
            <span className="hidden sm:inline">Nhập lẻ</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAdjustModalOpen(true)}
            className="h-8 px-2 sm:px-3 gap-1 sm:gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs"
            title="Điều chỉnh kiểm kê"
          >
            <Sliders size={14} />
            <span className="hidden sm:inline">Điều chỉnh</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              activeTab === 'BALANCES'
                ? loadBalances()
                : activeTab === 'LEDGER'
                  ? loadLedger()
                  : handleRunReconciliation()
            }
            className="h-8 w-8 sm:w-auto p-0 sm:px-2.5 sm:py-1 gap-1 text-xs"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={14} />
            <span className="hidden lg:inline text-xs">Làm mới</span>
          </Button>
        </div>
      </div>

      {/* KPI Summary Metric Cards matching Orders page */}
      {(() => {
        const totalOnHand = balances.reduce((acc, b) => acc + (b.onHand || 0), 0);
        const totalReserved = balances.reduce((acc, b) => acc + (b.reserved || 0), 0);
        const totalAvailable = balances.reduce((acc, b) => acc + (b.available ?? (b.onHand || 0) - (b.reserved || 0)), 0);
        const lowStockCount = balances.filter((b) => {
          const onHand = b.onHand || 0;
          const reserved = b.reserved || 0;
          const available = b.available ?? onHand - reserved;
          const minAlert = b.lowStockThreshold ?? b.variant?.lowStockThreshold ?? b.variant?.minStockAlert ?? 5;
          return available <= minAlert && available > 0;
        }).length;
        const outOfStockCount = balances.filter((b) => {
          const onHand = b.onHand || 0;
          const reserved = b.reserved || 0;
          const available = b.available ?? onHand - reserved;
          return available <= 0;
        }).length;

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5 shrink-0">
            <SystemMetricPairCard
              leftItem={{
                title: 'Tổng mặt hàng',
                value: balances.length,
                subtitle: 'SKU biến thể',
                icon: Boxes,
                colorScheme: 'blue',
              }}
              rightItem={{
                title: 'Tồn thực tế',
                value: totalOnHand.toLocaleString('vi-VN'),
                subtitle: 'on-hand kho',
                icon: Warehouse,
                colorScheme: 'green',
              }}
            />
            <SystemMetricPairCard
              leftItem={{
                title: 'Khả dụng xuất',
                value: totalAvailable.toLocaleString('vi-VN'),
                subtitle: 'available bán',
                icon: CheckCircle,
                colorScheme: 'purple',
              }}
              rightItem={{
                title: 'Đang giữ hàng',
                value: totalReserved.toLocaleString('vi-VN'),
                subtitle: 'reserved đơn',
                icon: ArrowUpRight,
                colorScheme: 'orange',
              }}
            />
            <SystemMetricPairCard
              leftItem={{
                title: 'Cảnh báo tồn',
                value: lowStockCount,
                subtitle: 'sắp hết hàng',
                icon: AlertTriangle,
                colorScheme: 'orange',
              }}
              rightItem={{
                title: 'Hết hàng tồn',
                value: outOfStockCount,
                subtitle: 'tồn kho = 0',
                icon: PackageX,
                colorScheme: 'red',
              }}
            />
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-gray-100/80 dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded w-full sm:w-fit shrink-0 max-w-full overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('BALANCES')}
          className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-2 cursor-pointer border-0 shrink-0 whitespace-nowrap ${
            activeTab === 'BALANCES'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <Boxes size={14} className="shrink-0" />
          <span>Số dư tồn kho ({balances.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-2 cursor-pointer border-0 shrink-0 whitespace-nowrap ${
            activeTab === 'LEDGER'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <History size={14} className="shrink-0" />
          <span className="hidden sm:inline">Sổ cái biến động (Inventory Ledger)</span>
          <span className="sm:hidden">Sổ cái biến động</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('RECONCILIATION');
            if (!reconciliationResult) handleRunReconciliation();
          }}
          className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-2 cursor-pointer border-0 shrink-0 whitespace-nowrap ${
            activeTab === 'RECONCILIATION'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <ShieldCheck size={14} className="shrink-0" />
          <span className="hidden sm:inline">Đối soát kiểm toán số dư</span>
          <span className="sm:hidden">Đối soát kiểm toán</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-fit md:min-h-0">
        {activeTab === 'BALANCES' &&
          (() => {
            const filteredBalances = balances.filter((b) => {
              if (selectedWarehouseId && b.warehouseId !== selectedWarehouseId) return false;
              if (!searchTerm) return true;
              const term = searchTerm.toLowerCase();
              const vObj = b.variant || allVariants.find((v) => v.id === b.variantId);
              const sku = (b.sku || vObj?.sku || b.variantId || '').toLowerCase();
              const prodName = (b.productName || vObj?.productName || vObj?.product?.name || '').toLowerCase();
              const varName = (b.variantName || vObj?.name || '').toLowerCase();
              const barcode = (b.barcode || vObj?.barcode || '').toLowerCase();
              return (
                sku.includes(term) ||
                prodName.includes(term) ||
                varName.includes(term) ||
                barcode.includes(term)
              );
            });
            const paginatedBalances = filteredBalances.slice(
              (balancePage - 1) * balanceLimit,
              balancePage * balanceLimit
            );

            return (
              <div className="flex-1 flex flex-col min-h-fit md:min-h-0 gap-3">
                {/* Warehouse and Search Filter */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded shrink-0">
                  <div className="relative flex-1 max-w-md w-full">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Tìm theo SKU nội bộ, tên sản phẩm, barcode..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-4 py-1.5 h-8 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">
                      Kho hàng:
                    </span>
                    <Select
                      value={selectedWarehouseId || ''}
                      onChange={(val: any) => setSelectedWarehouseId(val)}
                      options={[
                        { value: '', label: 'Tất cả kho', icon: Warehouse },
                        ...warehouses.map((wh) => ({
                          value: wh.id,
                          label: `${wh.name} (${wh.code})`,
                          icon: Warehouse,
                        })),
                      ]}
                      placeholder="Tất cả kho"
                      icon={Warehouse}
                      size="sm"
                      className="w-full sm:w-52"
                      menuWidth="w-60"
                    />
                  </div>
                </div>

                {/* Desktop Balances Table with Bottom-pinned Pagination */}
                <div className="hidden md:flex flex-1 flex-col min-h-0">
                  <SystemTableWrapper
                    tableClassName="min-w-[1000px]"
                    pagination={
                      <SystemPagination
                        page={balancePage - 1}
                        totalPages={Math.ceil(filteredBalances.length / balanceLimit) || 1}
                        totalItems={filteredBalances.length}
                        setPage={(p) => setBalancePage(p + 1)}
                        itemsPerPage={balanceLimit}
                        setItemsPerPage={(newLimit) => {
                          setBalanceLimit(newLimit);
                          setBalancePage(1);
                        }}
                      />
                    }
                  >
                  <SystemThead>
                    <SystemTh className="w-14 text-center" align="center">STT</SystemTh>
                    <SystemTh className="w-44">SKU Biến thể</SystemTh>
                    <SystemTh className="w-64">Tên sản phẩm</SystemTh>
                    <SystemTh className="w-40">Kho</SystemTh>
                    <SystemTh className="w-32 text-right">Thực có (onHand)</SystemTh>
                    <SystemTh className="w-32 text-right">Đã giữ (reserved)</SystemTh>
                    <SystemTh className="w-36 text-right">Có thể xuất (available)</SystemTh>
                    <SystemTh className="w-32 text-center">Tình trạng</SystemTh>
                    <SystemTh className="w-24 text-center">Thao tác</SystemTh>
                  </SystemThead>
                  <SystemTbody>
                    {isLoadingBalances ? (
                      <SystemTableSkeleton cols={9} rows={7} />
                    ) : filteredBalances.length === 0 ? (
                      <SystemTableEmpty
                        title="Không có dữ liệu tồn kho"
                        description="Không tìm thấy SKU nào phù hợp với bộ lọc hiện tại. Hãy thực hiện Nhập kho để khởi tạo số dư."
                        colSpan={9}
                      />
                    ) : (
                      paginatedBalances.map((b, index) => {
                        const onHand = b.onHand || 0;
                        const reserved = b.reserved || 0;
                        const available = b.available ?? onHand - reserved;
                        const vObj = b.variant || allVariants.find((v) => v.id === b.variantId);
                        const wObj = b.warehouse || warehouses.find((w) => w.id === b.warehouseId);
                        const sku = b.sku || vObj?.sku || b.variantId;
                        const productName = b.productName || vObj?.productName || vObj?.product?.name || '--';
                        const variantName = b.variantName || vObj?.name;
                        const warehouseName = b.warehouseName || wObj?.name || b.warehouseId;
                        const minAlert = b.lowStockThreshold ?? vObj?.lowStockThreshold ?? vObj?.minStockAlert ?? 5;
                        const isLowStock = available <= minAlert;
                        const isNegative = available < 0;
                        const stt = (balancePage - 1) * balanceLimit + index + 1;

                        return (
                          <SystemTr key={b.id || `${b.warehouseId}_${b.variantId}`}>
                            <SystemTd align="center" className="text-center font-medium text-gray-500 dark:text-gray-400 text-xs">
                              {stt}
                            </SystemTd>
                            <SystemTd>
                              <div className="font-mono font-bold text-[#5865f2]">
                                {sku}
                              </div>
                              {variantName && variantName !== sku && (
                                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                  {variantName}
                                </div>
                              )}
                              {vObj?.listingMappings && vObj.listingMappings.length > 0 && (
                                <div className="mt-1 flex items-center gap-1 flex-wrap">
                                  <span
                                    className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200/50"
                                    title={vObj.listingMappings
                                      .map((m: any) => `${m.sellerSku} (${m.shop?.code || 'Shopee'})`)
                                      .join(', ')}
                                  >
                                    Shopee: {vObj.listingMappings.length} SKU
                                  </span>
                                </div>
                              )}
                            </SystemTd>
                            <SystemTd>
                              <span className="font-semibold text-gray-900 dark:text-gray-100">
                                {productName}
                              </span>
                            </SystemTd>
                            <SystemTd className="text-gray-700 dark:text-gray-300 font-medium">
                              {warehouseName}
                            </SystemTd>
                            <SystemTd className="text-right font-medium text-gray-900 dark:text-white">
                              {onHand.toLocaleString('vi-VN')}
                            </SystemTd>
                            <SystemTd className="text-right text-amber-600 dark:text-amber-400 font-medium">
                              {reserved.toLocaleString('vi-VN')}
                            </SystemTd>
                            <SystemTd
                              className={`text-right font-medium ${
                                isNegative
                                  ? 'text-red-600 dark:text-red-400'
                                  : available === 0
                                    ? 'text-gray-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {available.toLocaleString('vi-VN')}
                            </SystemTd>
                            <SystemTd className="text-center">
                              {isNegative ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                  Âm tồn kho
                                </span>
                              ) : isLowStock ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  Tồn thấp (&le;{minAlert})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  Ổn định
                                </span>
                              )}
                            </SystemTd>
                            <SystemTd className="text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                                      title="Thao tác"
                                    >
                                      <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openReceiveForVariant(b.variantId)}>
                                      <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                                      <span>Nhập thêm hàng</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openAdjustForVariant(b.variantId)}>
                                      <Sliders className="w-4 h-4 text-amber-500" />
                                      <span>Điều chỉnh kiểm kê</span>
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

              {/* Mobile Card View (md:hidden) */}
              <div className="md:hidden flex-1 flex flex-col min-h-fit space-y-2.5">
                {isLoadingBalances ? (
                  <div className="py-8 text-center text-xs text-gray-400 font-normal">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin text-[#5865f2] mb-2" />
                    Đang tải số dư tồn kho...
                  </div>
                ) : filteredBalances.length === 0 ? (
                  <div className="py-10 text-center text-xs text-gray-400 font-normal bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 p-6">
                    <Boxes className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Không có dữ liệu tồn kho</p>
                    <p className="text-[11px] text-gray-400">Không tìm thấy SKU nào phù hợp với bộ lọc hiện tại.</p>
                  </div>
                ) : (
                  paginatedBalances.map((b) => {
                    const onHand = b.onHand || 0;
                    const reserved = b.reserved || 0;
                    const available = b.available ?? onHand - reserved;
                    const vObj = b.variant || allVariants.find((v) => v.id === b.variantId);
                    const wObj = b.warehouse || warehouses.find((w) => w.id === b.warehouseId);
                    const sku = b.sku || vObj?.sku || b.variantId;
                    const productName = b.productName || vObj?.productName || vObj?.product?.name || '--';
                    const variantName = b.variantName || vObj?.name;
                    const warehouseName = b.warehouseName || wObj?.name || b.warehouseId;
                    const minAlert = b.lowStockThreshold ?? vObj?.lowStockThreshold ?? vObj?.minStockAlert ?? 5;
                    const isLowStock = available <= minAlert;
                    const isNegative = available < 0;

                    return (
                      <div
                        key={b.id || `${b.warehouseId}_${b.variantId}`}
                        className="p-3.5 rounded bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 space-y-2.5 shadow-xs"
                      >
                        {/* Card Header: SKU & Status Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-mono font-bold text-xs text-[#5865f2] dark:text-[#7b85f5] truncate">
                              {sku}
                            </div>
                            <div className="font-medium text-xs text-gray-900 dark:text-white line-clamp-1 mt-0.5">
                              {productName}
                            </div>
                            {variantName && variantName !== sku && (
                              <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                {variantName}
                              </div>
                            )}
                          </div>
                          {isNegative ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 shrink-0">
                              Tồn âm
                            </span>
                          ) : available === 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 shrink-0">
                              Hết hàng
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 shrink-0">
                              Sắp hết
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shrink-0">
                              Còn hàng
                            </span>
                          )}
                        </div>

                        {/* Warehouse Badge & Shopee Mappings */}
                        <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-medium">
                            <Warehouse size={11} /> {warehouseName}
                          </span>
                          {vObj?.listingMappings && vObj.listingMappings.length > 0 && (
                            <span className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold">
                              Đã map {vObj.listingMappings.length} SKU sàn
                            </span>
                          )}
                        </div>

                        {/* 3 Metrics: Thực có, Đang giữ, Khả dụng */}
                        <div className="grid grid-cols-3 gap-2 p-2 rounded bg-gray-50 dark:bg-[#1a1e28] border border-gray-100 dark:border-gray-800/60 text-center">
                          <div>
                            <div className="text-[10px] text-gray-400">Thực có (onHand)</div>
                            <div className="font-mono font-medium text-xs text-gray-900 dark:text-white mt-0.5">
                              {onHand.toLocaleString('vi-VN')}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-amber-500">Đang giữ (đơn)</div>
                            <div className="font-mono font-medium text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                              {reserved.toLocaleString('vi-VN')}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-400">Khả dụng bán</div>
                            <div className={`font-mono font-bold text-xs mt-0.5 ${isNegative ? 'text-rose-600 dark:text-rose-400' : available === 0 ? 'text-gray-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {available.toLocaleString('vi-VN')}
                            </div>
                          </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100 dark:border-gray-800/80">
                          <button
                            type="button"
                            onClick={() => openReceiveForVariant(b.variantId)}
                            className="px-2.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1 font-medium cursor-pointer"
                          >
                            <ArrowDownLeft size={12} className="text-emerald-500" />
                            <span>Nhập thêm</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openAdjustForVariant(b.variantId)}
                            className="px-2.5 py-1 text-xs rounded bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1 font-medium cursor-pointer shadow-xs active:scale-95 transition-all"
                          >
                            <Sliders size={12} />
                            <span>Kiểm kê tồn</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Mobile Pagination */}
                <div className="rounded border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-[#14151a] shadow-none mt-2 shrink-0">
                  <SystemPagination
                    page={balancePage - 1}
                    totalPages={Math.ceil(filteredBalances.length / balanceLimit) || 1}
                    totalItems={filteredBalances.length}
                    setPage={(p) => setBalancePage(p + 1)}
                    itemsPerPage={balanceLimit}
                    setItemsPerPage={(newLimit) => {
                      setBalanceLimit(newLimit);
                      setBalancePage(1);
                    }}
                    className="border-t-0"
                  />
                </div>
              </div>
            </div>
          );
        })()}

        {activeTab === 'LEDGER' &&
          (() => {
            const paginatedLedger = ledgerEntries.slice(
              (ledgerPage - 1) * ledgerLimit,
              ledgerPage * ledgerLimit
            );

            return (
              <div className="flex-1 flex flex-col min-h-fit md:min-h-0 gap-3">
                <div className="bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 p-3 rounded flex items-start gap-3 shrink-0">
                  <History className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-800 dark:text-blue-300">
                    <span className="font-bold">Sổ cái biến động kho bất biến (Append-Only Ledger):</span>{' '}
                    Mọi hoạt động tăng giảm tồn kho (nhập, giữ, hủy giữ, xuất bán, trả hàng, điều chỉnh kiểm kê)
                    được ghi vĩnh viễn vào sổ cái. Không có thao tác sửa hay xóa bút toán trực tiếp.
                  </div>
                </div>

                {/* Desktop Ledger Table */}
                <div className="hidden md:flex flex-1 flex-col min-h-0">
                  <SystemTableWrapper
                    tableClassName="min-w-[1000px]"
                    pagination={
                      <SystemPagination
                        page={ledgerPage - 1}
                        totalPages={Math.ceil(ledgerEntries.length / ledgerLimit) || 1}
                        totalItems={ledgerEntries.length}
                        setPage={(p) => setLedgerPage(p + 1)}
                        itemsPerPage={ledgerLimit}
                        setItemsPerPage={(newLimit) => {
                          setLedgerLimit(newLimit);
                          setLedgerPage(1);
                        }}
                      />
                    }
                  >
                    <SystemThead>
                      <SystemTh className="w-14 text-center" align="center">STT</SystemTh>
                      <SystemTh className="w-40">Thời gian</SystemTh>
                      <SystemTh className="w-32">Loại bút toán</SystemTh>
                      <SystemTh className="w-44">SKU Biến thể</SystemTh>
                      <SystemTh className="w-36">Kho</SystemTh>
                      <SystemTh className="w-32 text-right">Biến động (Delta)</SystemTh>
                      <SystemTh className="w-32 text-right">Tồn sau GD</SystemTh>
                      <SystemTh className="w-40">Chứng từ / Đơn hàng</SystemTh>
                      <SystemTh className="w-48">Người thực hiện / Ghi chú</SystemTh>
                    </SystemThead>
                    <SystemTbody>
                      {isLoadingLedger ? (
                        <SystemTableSkeleton cols={9} rows={7} />
                      ) : ledgerEntries.length === 0 ? (
                        <SystemTableEmpty
                          title="Chưa có bút toán nào"
                          description="Chưa có bản ghi biến động nào trong sổ cái kho."
                          colSpan={9}
                        />
                      ) : (
                        paginatedLedger.map((l, index) => {
                          const isPositive = (l.deltaOnHand || l.quantityDelta || 0) > 0;
                          const delta = l.deltaOnHand ?? l.quantityDelta ?? 0;
                          const type = l.entryType || l.type || 'UNKNOWN';
                          const vObj = l.variant || allVariants.find((v) => v.id === l.variantId);
                          const wObj = l.warehouse || warehouses.find((w) => w.id === l.warehouseId);
                          const sku = l.sku || vObj?.sku || l.variantId;
                          const variantName = l.variantName || vObj?.name;
                          const warehouseName = l.warehouseName || wObj?.name || l.warehouseId;
                          const stt = (ledgerPage - 1) * ledgerLimit + index + 1;

                          return (
                            <SystemTr key={l.id}>
                              <SystemTd align="center" className="text-center font-medium text-gray-500 dark:text-gray-400 text-xs">
                                {stt}
                              </SystemTd>
                              <SystemTd className="text-gray-500 font-mono text-[11px] whitespace-nowrap">
                                {new Date(l.createdAt).toLocaleString('vi-VN')}
                              </SystemTd>
                              <SystemTd>
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                    type === 'RECEIVE'
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                      : type === 'DISPATCH'
                                        ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                                        : type === 'RESERVE'
                                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                          : type === 'RELEASE'
                                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                                            : type === 'RETURN_RECEIVE'
                                              ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30'
                                              : 'bg-gray-500/15 text-gray-600 dark:text-gray-400 border border-gray-500/30'
                                  }`}
                                >
                                  {type}
                                </span>
                              </SystemTd>
                              <SystemTd className="font-mono font-bold text-gray-900 dark:text-gray-100">
                                <div>{sku}</div>
                                {variantName && variantName !== sku && (
                                  <div className="text-[11px] font-normal text-gray-500 dark:text-gray-400">
                                    {variantName}
                                  </div>
                                )}
                              </SystemTd>
                              <SystemTd className="text-gray-700 dark:text-gray-300 font-medium">
                                {warehouseName}
                              </SystemTd>
                              <SystemTd
                                className={`text-right font-bold ${
                                  isPositive
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : delta < 0
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-gray-500'
                                }`}
                              >
                                {delta > 0 ? `+${delta}` : delta}
                              </SystemTd>
                              <SystemTd className="text-right font-medium text-gray-900 dark:text-white">
                                {l.afterOnHand ?? '--'}
                              </SystemTd>
                              <SystemTd className="font-mono text-[#5865f2] font-semibold">
                                {l.voucherCode || l.order?.orderSn || l.referenceCode || (l.referenceId ? (l.referenceType === 'PACKAGE' ? `Kiện ${l.referenceId.substring(0, 8)}` : l.referenceId.substring(0, 8)) : '--')}
                              </SystemTd>
                              <SystemTd className="text-gray-600 dark:text-gray-400 truncate max-w-xs">
                                {l.performerName || l.user?.name || l.user?.email || 'Hệ thống'}
                                {l.note && (
                                  <span className="block text-[11px] text-gray-400">{l.note}</span>
                                )}
                              </SystemTd>
                            </SystemTr>
                          );
                        })
                      )}
                    </SystemTbody>
                  </SystemTableWrapper>
                </div>

                {/* Mobile Card View (md:hidden) */}
                <div className="md:hidden flex-1 overflow-y-auto space-y-2.5 pb-20">
                  {isLoadingLedger ? (
                    <div className="py-8 text-center text-xs text-gray-400 font-normal">
                      <RefreshCw className="w-5 h-5 mx-auto animate-spin text-[#5865f2] mb-2" />
                      Đang tải sổ cái kho...
                    </div>
                  ) : ledgerEntries.length === 0 ? (
                    <div className="py-10 text-center text-xs text-gray-400 font-normal bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 p-6">
                      <History className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                      <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Chưa có bút toán nào</p>
                      <p className="text-[11px] text-gray-400">Chưa có bản ghi biến động nào trong sổ cái kho.</p>
                    </div>
                  ) : (
                    paginatedLedger.map((l, index) => {
                      const isPositive = (l.deltaOnHand || l.quantityDelta || 0) > 0;
                      const delta = l.deltaOnHand ?? l.quantityDelta ?? 0;
                      const type = l.entryType || l.type || 'UNKNOWN';
                      const vObj = l.variant || allVariants.find((v) => v.id === l.variantId);
                      const wObj = l.warehouse || warehouses.find((w) => w.id === l.warehouseId);
                      const sku = l.sku || vObj?.sku || l.variantId;
                      const variantName = l.variantName || vObj?.name;
                      const warehouseName = l.warehouseName || wObj?.name || l.warehouseId;
                      const stt = (ledgerPage - 1) * ledgerLimit + index + 1;

                      return (
                        <div
                          key={l.id}
                          className="p-3.5 rounded bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 space-y-2 shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-mono text-gray-400">#{stt}</span>
                                <span className="font-mono font-bold text-xs text-gray-900 dark:text-white truncate">
                                  {sku}
                                </span>
                              </div>
                              {variantName && variantName !== sku && (
                                <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                  {variantName}
                                </div>
                              )}
                            </div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                type === 'RECEIVE'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                  : type === 'DISPATCH'
                                    ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                                    : type === 'RESERVE'
                                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                      : type === 'RELEASE'
                                        ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                                        : type === 'RETURN_RECEIVE'
                                          ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30'
                                          : 'bg-gray-500/15 text-gray-600 dark:text-gray-400 border border-gray-500/30'
                              }`}
                            >
                              {type}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs py-1.5 px-2.5 rounded bg-gray-50 dark:bg-[#1a1b23] border border-gray-100 dark:border-gray-800">
                            <div>
                              <span className="text-[10px] text-gray-400 block">Biến động (Delta)</span>
                              <span
                                className={`font-mono font-bold text-xs ${
                                  isPositive
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : delta < 0
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-gray-500'
                                }`}
                              >
                                {delta > 0 ? `+${delta}` : delta}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-gray-400 block">Tồn sau GD</span>
                              <span className="font-mono font-medium text-xs text-gray-900 dark:text-white">
                                {l.afterOnHand ?? '--'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
                            <span className="truncate">
                              {warehouseName} • {new Date(l.createdAt).toLocaleString('vi-VN')}
                            </span>
                            <span className="font-mono text-gray-700 dark:text-gray-300 font-medium shrink-0">
                              {l.order?.orderSn || l.referenceCode || '--'}
                            </span>
                          </div>
                          {l.note && (
                            <div className="text-[11px] text-gray-400 italic">
                              Ghi chú: {l.note}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  {/* Mobile Pagination */}
                  <div className="rounded border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-[#14151a] shadow-none mt-2 shrink-0">
                    <SystemPagination
                      page={ledgerPage - 1}
                      totalPages={Math.ceil(ledgerEntries.length / ledgerLimit) || 1}
                      totalItems={ledgerEntries.length}
                      setPage={(p) => setLedgerPage(p + 1)}
                      itemsPerPage={ledgerLimit}
                      setItemsPerPage={(newLimit) => {
                        setLedgerLimit(newLimit);
                        setLedgerPage(1);
                      }}
                      className="border-t-0"
                    />
                  </div>
                </div>
              </div>
            );
          })()}

        {activeTab === 'RECONCILIATION' &&
          (() => {
            const rawItems: any[] =
              reconciliationResult?.items || reconciliationResult?.results || [];
            const totalAudited =
              reconciliationResult?.totalAudited ?? rawItems.length;
            const discrepancyCount =
              reconciliationResult?.discrepancyCount ??
              rawItems.filter(
                (r: any) =>
                  !r.isConsistent && r.difference !== 0 && !r.isBalanced,
              ).length;
            const matchingCount = Math.max(0, totalAudited - discrepancyCount);

            const filteredItems = rawItems.filter((r: any) => {
              const isBalanced =
                r.isConsistent ?? r.isBalanced ?? (r.difference === 0);

              if (reconciliationFilter === 'DISCREPANCY' && isBalanced)
                return false;
              if (reconciliationFilter === 'BALANCED' && !isBalanced)
                return false;

              if (!reconciliationSearchTerm) return true;
              const term = reconciliationSearchTerm.toLowerCase();
              return (
                (r.sku || '').toLowerCase().includes(term) ||
                (r.variantName || '').toLowerCase().includes(term) ||
                (r.warehouseCode || '').toLowerCase().includes(term)
              );
            });

            const paginatedItems = filteredItems.slice(
              (reconciliationPage - 1) * reconciliationLimit,
              reconciliationPage * reconciliationLimit,
            );

            return (
              <div className="flex-1 flex flex-col min-h-fit md:min-h-0 gap-3.5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded bg-[#5865f2]/10 text-[#5865f2] flex items-center justify-center border border-[#5865f2]/20 shrink-0">
                      <ShieldCheck size={19} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        Kiểm toán tính toàn vẹn sổ cái (Balance vs Ledger Reconciliation)
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        So sánh trực tiếp tổng phát sinh từ sổ cái bất biến với bảng số dư hiện tại để phát hiện chênh lệch.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleRunReconciliation}
                    disabled={isReconciling}
                    loading={isReconciling}
                    size="sm"
                    className="gap-1.5 shrink-0"
                  >
                    <RefreshCw size={13} className={isReconciling ? 'animate-spin' : ''} />
                    <span>{isReconciling ? 'Đang kiểm toán...' : 'Chạy kiểm toán ngay'}</span>
                  </Button>
                </div>

                {/* KPI Summary Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 shrink-0">
                  <SystemMetricPairCard
                    leftItem={{
                      title: 'Tổng SKU kiểm toán',
                      value: totalAudited,
                      subtitle: 'SKU có số dư tồn kho',
                      icon: Package,
                      colorScheme: 'blue',
                      isActive: reconciliationFilter === 'ALL',
                      onClick: () => {
                        setReconciliationFilter('ALL');
                        setReconciliationPage(1);
                      },
                    }}
                    rightItem={{
                      title: 'Số lượng khớp 100%',
                      value: matchingCount,
                      subtitle: 'Khớp sổ cái hoàn toàn',
                      icon: CheckCircle,
                      colorScheme: 'green',
                      isActive: reconciliationFilter === 'BALANCED',
                      onClick: () => {
                        setReconciliationFilter('BALANCED');
                        setReconciliationPage(1);
                      },
                    }}
                  />
                  <SystemMetricPairCard
                    leftItem={{
                      title: 'Số lượng sai lệch',
                      value: discrepancyCount,
                      subtitle:
                        discrepancyCount > 0
                          ? 'Phát hiện chênh lệch tồn'
                          : 'Không có chênh lệch',
                      icon: AlertTriangle,
                      colorScheme: discrepancyCount > 0 ? 'red' : 'purple',
                      isActive: reconciliationFilter === 'DISCREPANCY',
                      onClick: () => {
                        setReconciliationFilter('DISCREPANCY');
                        setReconciliationPage(1);
                      },
                    }}
                    rightItem={{
                      title: 'Tỷ lệ toàn vẹn sổ cái',
                      value: `${totalAudited > 0 ? ((matchingCount / totalAudited) * 100).toFixed(1) : 100}%`,
                      subtitle: discrepancyCount === 0 ? 'Đảm bảo chính xác 100%' : 'Cần rà soát sổ cái',
                      icon: ShieldCheck,
                      colorScheme: discrepancyCount === 0 ? 'green' : 'orange',
                    }}
                  />
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded shrink-0">
                  <div className="relative flex-1 max-w-md w-full">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Tìm theo SKU biến thể, tên sản phẩm..."
                      value={reconciliationSearchTerm}
                      onChange={(e) => {
                        setReconciliationSearchTerm(e.target.value);
                        setReconciliationPage(1);
                      }}
                      className="w-full pl-8 pr-4 py-1.5 h-8 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      Bộ lọc trạng thái:
                    </span>
                    <Select
                      value={reconciliationFilter}
                      onChange={(val: any) => {
                        setReconciliationFilter(val);
                        setReconciliationPage(1);
                      }}
                      options={[
                        { value: 'ALL', label: `Tất cả kết quả (${rawItems.length})`, icon: Boxes },
                        { value: 'DISCREPANCY', label: `Chỉ SKU sai lệch (${discrepancyCount})`, icon: AlertTriangle },
                        { value: 'BALANCED', label: `Chỉ SKU khớp 100% (${matchingCount})`, icon: CheckCircle },
                      ]}
                      size="sm"
                      className="w-56"
                      menuWidth="w-60"
                    />
                  </div>
                </div>

                {/* Desktop Reconciliation Table */}
                <div className="hidden md:flex flex-1 flex-col min-h-0">
                  <SystemTableWrapper
                    tableClassName="min-w-[850px]"
                    pagination={
                      <SystemPagination
                        page={reconciliationPage - 1}
                        totalPages={
                          Math.ceil(filteredItems.length / reconciliationLimit) || 1
                        }
                        totalItems={filteredItems.length}
                        setPage={(p) => setReconciliationPage(p + 1)}
                        itemsPerPage={reconciliationLimit}
                        setItemsPerPage={(newLimit) => {
                          setReconciliationLimit(newLimit);
                          setReconciliationPage(1);
                        }}
                      />
                    }
                  >
                    <SystemThead>
                      <SystemTh className="w-14 text-center" align="center">STT</SystemTh>
                      <SystemTh className="w-52">SKU & Biến thể</SystemTh>
                      <SystemTh className="w-36">Kho hàng</SystemTh>
                      <SystemTh className="w-40 text-right">Số dư Bảng Tồn (onHand)</SystemTh>
                      <SystemTh className="w-48 text-right">Tổng phát sinh Sổ cái (Sum Ledger)</SystemTh>
                      <SystemTh className="w-32 text-right">Chênh lệch</SystemTh>
                      <SystemTh className="w-40 text-center">Kết quả kiểm toán</SystemTh>
                    </SystemThead>
                    <SystemTbody>
                      {isReconciling ? (
                        <SystemTableSkeleton cols={7} rows={6} />
                      ) : filteredItems.length === 0 ? (
                        <SystemTableEmpty
                          title={
                            reconciliationResult
                              ? 'Không tìm thấy SKU nào phù hợp'
                              : 'Chưa có kết quả kiểm toán'
                          }
                          description={
                            reconciliationResult
                              ? 'Không có biến thể nào khớp với từ khóa tìm kiếm hoặc bộ lọc trạng thái hiện tại.'
                              : "Vui lòng bấm 'Chạy kiểm toán ngay' để quét và so khớp toàn bộ số dư với sổ cái bất biến."
                          }
                          colSpan={7}
                        />
                      ) : (
                        paginatedItems.map((r: any, idx: number) => {
                          const isBalanced =
                            r.isConsistent ??
                            r.isBalanced ??
                            (r.difference === 0);
                          const diff = r.difference ?? r.discrepancy ?? 0;
                          const onHand =
                            r.currentOnHand ?? r.balanceOnHand ?? 0;
                          const ledgerSum =
                            r.calculatedFromLedger ??
                            r.ledgerCalculatedOnHand ??
                            0;
                          const stt = (reconciliationPage - 1) * reconciliationLimit + idx + 1;

                          return (
                            <SystemTr
                              key={idx}
                              className={
                                !isBalanced
                                  ? 'bg-rose-50/40 dark:bg-rose-950/20'
                                  : ''
                              }
                            >
                              <SystemTd align="center" className="text-center font-medium text-gray-500 dark:text-gray-400 text-xs">
                                {stt}
                              </SystemTd>
                              <SystemTd>
                                <div className="font-mono font-bold text-xs text-gray-900 dark:text-white">
                                  {r.sku}
                                </div>
                                {r.variantName && (
                                  <div className="text-[11px] text-gray-400 font-normal truncate mt-0.5">
                                    {r.variantName}
                                  </div>
                                )}
                              </SystemTd>
                              <SystemTd className="text-gray-600 dark:text-gray-400 font-normal text-xs">
                                {r.warehouseCode ||
                                  warehouses.find(
                                    (w) => w.id === selectedWarehouseId,
                                  )?.name ||
                                  'Kho chính'}
                              </SystemTd>
                              <SystemTd className="text-right font-mono font-medium text-xs text-gray-900 dark:text-white">
                                {onHand.toLocaleString('vi-VN')}
                              </SystemTd>
                              <SystemTd className="text-right font-mono font-medium text-xs text-gray-900 dark:text-white">
                                {ledgerSum.toLocaleString('vi-VN')}
                              </SystemTd>
                              <SystemTd
                                className={`text-right font-mono font-bold text-xs ${
                                  diff !== 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-gray-500 dark:text-gray-400'
                                }`}
                              >
                                {diff > 0
                                  ? `+${diff.toLocaleString('vi-VN')}`
                                  : diff.toLocaleString('vi-VN')}
                              </SystemTd>
                              <SystemTd className="text-center">
                                {isBalanced ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle size={12} />
                                    <span>Khớp hoàn toàn</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse">
                                    <AlertTriangle size={12} />
                                    <span>
                                      Lệch {diff > 0 ? `+${diff}` : diff}
                                    </span>
                                  </span>
                                )}
                              </SystemTd>
                            </SystemTr>
                          );
                        })
                      )}
                    </SystemTbody>
                  </SystemTableWrapper>
                </div>

                {/* Mobile Card View (md:hidden) */}
                <div className="md:hidden flex-1 overflow-y-auto space-y-2.5 pb-20">
                  {isReconciling ? (
                    <div className="py-8 text-center text-xs text-gray-400 font-normal">
                      <RefreshCw className="w-5 h-5 mx-auto animate-spin text-[#5865f2] mb-2" />
                      Đang kiểm toán đối soát số dư...
                    </div>
                  ) : filteredItems.length === 0 ? (
                    <div className="py-10 text-center text-xs text-gray-400 font-normal bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 p-6">
                      <ShieldCheck className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                      <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {reconciliationResult ? 'Không tìm thấy SKU nào phù hợp' : 'Chưa có kết quả kiểm toán'}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {reconciliationResult
                          ? 'Không có biến thể nào khớp với bộ lọc hiện tại.'
                          : 'Bấm "Chạy kiểm toán ngay" để so khớp số dư với sổ cái bất biến.'}
                      </p>
                    </div>
                  ) : (
                    paginatedItems.map((r: any, idx: number) => {
                      const isBalanced =
                        r.isConsistent ??
                        r.isBalanced ??
                        (r.difference === 0);
                      const diff = r.difference ?? r.discrepancy ?? 0;
                      const onHand =
                        r.currentOnHand ?? r.balanceOnHand ?? 0;
                      const ledgerSum =
                        r.calculatedFromLedger ??
                        r.ledgerCalculatedOnHand ??
                        0;
                      const stt = (reconciliationPage - 1) * reconciliationLimit + idx + 1;

                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded bg-white dark:bg-[#14151a] border ${
                            !isBalanced
                              ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10'
                              : 'border-gray-200 dark:border-gray-800'
                          } space-y-2 shadow-xs`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-mono text-gray-400">#{stt}</span>
                                <span className="font-mono font-bold text-xs text-gray-900 dark:text-white truncate">
                                  {r.sku}
                                </span>
                              </div>
                              {r.variantName && (
                                <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                  {r.variantName}
                                </div>
                              )}
                            </div>
                            {isBalanced ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                                <CheckCircle size={11} /> Khớp
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0 animate-pulse">
                                <AlertTriangle size={11} /> Lệch {diff > 0 ? `+${diff}` : diff}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs py-2 px-2.5 rounded bg-gray-50 dark:bg-[#1a1b23] border border-gray-100 dark:border-gray-800 text-center">
                            <div>
                              <span className="text-[10px] text-gray-400 block">Số dư OnHand</span>
                              <span className="font-mono font-medium text-xs text-gray-900 dark:text-white">
                                {onHand.toLocaleString('vi-VN')}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-400 block">Sổ cái Sum</span>
                              <span className="font-mono font-medium text-xs text-gray-900 dark:text-white">
                                {ledgerSum.toLocaleString('vi-VN')}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-400 block">Chênh lệch</span>
                              <span
                                className={`font-mono font-bold text-xs ${
                                  diff !== 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                {diff > 0 ? `+${diff.toLocaleString('vi-VN')}` : diff.toLocaleString('vi-VN')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
                            <span>
                              Kho: {r.warehouseCode || 'Kho chính'}
                            </span>
                            <span className="text-[10px] font-medium text-gray-400">
                              {isBalanced ? 'Bút toán toàn vẹn' : 'Cần kiểm tra bút toán'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Mobile Pagination */}
                  <div className="rounded border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-[#14151a] shadow-none mt-2 shrink-0">
                    <SystemPagination
                      page={reconciliationPage - 1}
                      totalPages={Math.ceil(filteredItems.length / reconciliationLimit) || 1}
                      totalItems={filteredItems.length}
                      setPage={(p) => setReconciliationPage(p + 1)}
                      itemsPerPage={reconciliationLimit}
                      setItemsPerPage={(newLimit) => {
                        setReconciliationLimit(newLimit);
                        setReconciliationPage(1);
                      }}
                      className="border-t-0"
                    />
                  </div>
                </div>
              </div>
            );
          })()}
      </div>

      {/* MODAL 1: RECEIVE STOCK (NHẬP KHO) */}
      {isReceiveModalOpen && (
        <Modal
          isOpen={isReceiveModalOpen}
          onClose={() => setIsReceiveModalOpen(false)}
          title={<><span className="sm:hidden">Nhập kho hàng hóa</span><span className="hidden sm:inline">Tạo phiếu nhập kho hàng hóa</span></>}
          subtitle={<span className="line-clamp-1 sm:line-clamp-none">Ghi nhận số lượng thực nhập, tính lại giá vốn bình quân gia quyền và ghi sổ cái bất biến</span>}
          icon={ArrowDownLeft}
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleReceiveSubmit} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 sm:space-y-3.5 p-3 sm:p-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Kho nhập hàng *
                </label>
                <Select
                  value={receiveForm.warehouseId}
                  onChange={(val: any) =>
                    setReceiveForm({ ...receiveForm, warehouseId: val })
                  }
                  options={[
                    { value: '', label: '-- Chọn kho nhập --' },
                    ...warehouses.map((wh) => ({
                      value: wh.id,
                      label: `${wh.name} (${wh.code})`,
                    })),
                  ]}
                  placeholder="-- Chọn kho nhập --"
                  icon={Warehouse}
                  size="md"
                  className="w-full"
                  menuWidth="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Sản phẩm & Biến thể SKU *
                </label>
                <Select
                  value={receiveForm.variantId}
                  onChange={(val: any) => {
                    const chosen = allVariants.find((v) => v.id === val);
                    setReceiveForm((prev) => ({
                      ...prev,
                      variantId: val,
                      unitCost:
                        prev.unitCost === 0 && chosen?.costPrice
                          ? chosen.costPrice
                          : prev.unitCost,
                    }));
                  }}
                  options={[
                    { value: '', label: '-- Chọn biến thể SKU --' },
                    ...allVariants.map((v) => ({
                      value: v.id,
                      label: `[${v.sku}] ${v.productName} - ${v.name}`,
                    })),
                  ]}
                  placeholder="-- Chọn biến thể SKU --"
                  icon={Boxes}
                  searchable={true}
                  size="md"
                  className="w-full"
                  menuWidth="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Số lượng nhập *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={receiveForm.quantity}
                    onChange={(e) =>
                      setReceiveForm({
                        ...receiveForm,
                        quantity: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white font-bold focus:outline-none focus:border-[#5865f2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Đơn giá vốn nhập (VND)
                  </label>
                  <CurrencyInput
                    value={receiveForm.unitCost}
                    onChange={(val) =>
                      setReceiveForm({
                        ...receiveForm,
                        unitCost: val,
                      })
                    }
                    placeholder="0"
                    suffix="đ"
                    inputClassName="px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Số phiếu nhập kho
                  </label>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/50 text-[#5865f2] dark:text-indigo-400 font-medium">
                    Hệ thống tự cấp
                  </span>
                </div>
                <input
                  type="text"
                  readOnly
                  disabled
                  tabIndex={-1}
                  value={receiveForm.referenceCode || 'Hệ thống tự động cấp'}
                  title="Mã phiếu được hệ thống tự động sinh ngầm khi lưu để đảm bảo tuyệt đối không bị trùng lặp"
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-gray-100 dark:bg-[#131720] border border-gray-200 dark:border-gray-800 rounded text-gray-500 dark:text-gray-400 cursor-not-allowed select-none pointer-events-none"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Mã phiếu tự động sinh ngầm theo ngày và định danh duy nhất cam kết không bị trùng lặp
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Ghi chú nhập kho
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú chi tiết đợt nhập..."
                  value={receiveForm.note}
                  onChange={(e) => setReceiveForm({ ...receiveForm, note: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => setIsReceiveModalOpen(false)}
                className="flex-1 sm:flex-initial"
              >
                Hủy
              </ModalButton>
              <ModalButton variant="primary" type="submit" className="flex-1 sm:flex-initial">
                <span className="sm:hidden">Nhập kho</span>
                <span className="hidden sm:inline">Xác nhận nhập kho</span>
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* MODAL 2: ADJUST STOCK (ĐIỀU CHỈNH TỒN KHO) */}
      {isAdjustModalOpen && (
        <Modal
          isOpen={isAdjustModalOpen}
          onClose={() => setIsAdjustModalOpen(false)}
          title={<><span className="sm:hidden">Điều chỉnh kiểm kê</span><span className="hidden sm:inline">Điều chỉnh tồn kho kiểm kê</span></>}
          subtitle={<span className="line-clamp-1 sm:line-clamp-none">Lập biên bản điều chỉnh thừa/thiếu tồn kho thực tế và hạch toán sổ cái kiểm toán</span>}
          icon={Sliders}
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleAdjustSubmit} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 sm:space-y-3.5 p-3 sm:p-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Kho hàng *
                </label>
                <Select
                  value={adjustForm.warehouseId}
                  onChange={(val: any) =>
                    setAdjustForm({ ...adjustForm, warehouseId: val })
                  }
                  options={[
                    { value: '', label: '-- Chọn kho --' },
                    ...warehouses.map((wh) => ({
                      value: wh.id,
                      label: `${wh.name} (${wh.code})`,
                    })),
                  ]}
                  placeholder="-- Chọn kho --"
                  icon={Warehouse}
                  size="md"
                  className="w-full"
                  menuWidth="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Sản phẩm & Biến thể SKU *
                </label>
                <Select
                  value={adjustForm.variantId}
                  onChange={(val: any) => setAdjustForm({ ...adjustForm, variantId: val })}
                  options={[
                    { value: '', label: '-- Chọn biến thể SKU --' },
                    ...allVariants.map((v) => ({
                      value: v.id,
                      label: `[${v.sku}] ${v.productName} - ${v.name}`,
                    })),
                  ]}
                  placeholder="-- Chọn biến thể SKU --"
                  icon={Boxes}
                  searchable={true}
                  size="md"
                  className="w-full"
                  menuWidth="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  <span className="sm:hidden">Số lượng thay đổi (+ / -) *</span>
                  <span className="hidden sm:inline">Số lượng thay đổi (+ để tăng, - để giảm) *</span>
                </label>
                <input
                  type="number"
                  required
                  value={adjustForm.quantityChange}
                  onChange={(e) =>
                    setAdjustForm({
                      ...adjustForm,
                      quantityChange: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white font-mono font-bold focus:outline-none focus:border-[#5865f2]"
                  placeholder="VD: -2 hoặc +5"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  <span className="sm:hidden">Lý do điều chỉnh *</span>
                  <span className="hidden sm:inline">Lý do điều chỉnh (Bắt buộc theo chuẩn kế toán kho) *</span>
                </label>
                <Select
                  value={adjustForm.reason}
                  onChange={(val: any) => setAdjustForm({ ...adjustForm, reason: val })}
                  options={REASON_OPTIONS}
                  placeholder="-- Chọn lý do điều chỉnh --"
                  size="md"
                  className="w-full"
                  menuWidth="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Ghi chú giải trình chi tiết
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú thêm về biên bản kiểm kê hoặc đối tượng chịu trách nhiệm..."
                  value={adjustForm.note}
                  onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => setIsAdjustModalOpen(false)}
                className="flex-1 sm:flex-initial"
              >
                Hủy
              </ModalButton>
              <ModalButton variant="primary" type="submit" className="flex-1 sm:flex-initial">
                <span className="sm:hidden">Điều chỉnh</span>
                <span className="hidden sm:inline">Xác nhận điều chỉnh</span>
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default InventoryPage;
