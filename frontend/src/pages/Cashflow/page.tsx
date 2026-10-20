import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  FileSpreadsheet,
  Plus,
  Minus,
  RotateCcw,
  Landmark,
  Tag,
  Building2,
  Calendar,
  Eye,
  DollarSign,
  TrendingUp,
  RefreshCw,
  ShieldCheck,
  Receipt,
  Trash2,
  Check,
  Store,
  Activity,
  Upload,
  MoreHorizontal,
  MoreVertical,
  ChevronRight,
  Clock,
  Package,
  FileText,
  CreditCard,
  Truck,
  ArrowUpDown,
  CircleDollarSign,
  ArrowRight,
  ShoppingBag,
  CheckCircle,
} from 'lucide-react';
import {
  cashflowApi,
  CashAccountModel,
  CashCategoryModel,
  CashTransactionModel,
  OrderReconciliationRecordModel,
  CashflowOverviewModel,
  CashTransactionType,
  OrderReconciliationStatus,
} from '../../services/cashflowApi';
import { shopsApi } from '../../services/shopsApi';
import { suppliersApi, SupplierItem } from '../../services/suppliersApi';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { SystemMetricPairCard } from '../../components/ui/SystemMetricCard';
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
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';
import { confirmModal } from '../../components/ui/ConfirmModal';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../../components/ui/DropdownMenu';
import { CreateTransactionModal } from './CreateTransactionModal';
import { InternalTransferModal } from './InternalTransferModal';
import { ImportSettlementModal } from './ImportSettlementModal';
import { CreateAccountModal } from './CreateAccountModal';
import { CreateCategoryModal } from './CreateCategoryModal';

type ActiveTab =
  | 'OVERVIEW'
  | 'TRANSACTIONS'
  | 'RECONCILIATION'
  | 'SUPPLIERS'
  | 'ACCOUNTS'
  | 'CATEGORIES';

const CASHFLOW_TABS = [
  { id: 'OVERVIEW', label: 'Tổng quan' },
  { id: 'TRANSACTIONS', label: 'Sổ thu chi' },
  { id: 'RECONCILIATION', label: 'Đối soát Shopee' },
  { id: 'SUPPLIERS', label: 'Thanh toán NCC' },
  { id: 'ACCOUNTS', label: 'Tài khoản & quỹ' },
  { id: 'CATEGORIES', label: 'Danh mục thu chi' },
] as const;

const formatDateTime = (dateStr?: string | Date | null) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${time} ${date}`;
};

export const CashflowPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedShopId: storeShopId, setSelectedShopId: setStoreShopId, shops: storeShops } =
    useWorkspaceStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>('OVERVIEW');
  const [overview, setOverview] = useState<CashflowOverviewModel | null>(null);
  const [accounts, setAccounts] = useState<CashAccountModel[]>([]);
  const [categories, setCategories] = useState<CashCategoryModel[]>([]);
  const [shops, setShops] = useState<Array<{ id: string; name: string }>>([]);
  const [supplierList, setSupplierList] = useState<SupplierItem[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Global Filters
  const [selectedShopId, setSelectedShopId] = useState<string>(storeShopId || 'ALL');
  const [datePreset, setDatePreset] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'TODAY') {
      const todayStr = now.toISOString().slice(0, 10);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'LAST_7_DAYS') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(past.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(firstDay.toISOString().slice(0, 10));
      setEndDate(lastDay.toISOString().slice(0, 10));
    } else if (preset === 'LAST_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(firstDay.toISOString().slice(0, 10));
      setEndDate(lastDay.toISOString().slice(0, 10));
    }
  };

  // Transactions Tab State
  const [transactions, setTransactions] = useState<CashTransactionModel[]>([]);
  const [txTotal, setTxTotal] = useState<number>(0);
  const [txPage, setTxPage] = useState<number>(1);
  const [txLimit, setTxLimit] = useState<number>(25);
  const [txLoading, setTxLoading] = useState<boolean>(false);
  const [txFilterType, setTxFilterType] = useState<string>('ALL');
  const [txFilterCategoryId, setTxFilterCategoryId] = useState<string>('ALL');
  const [txFilterAccountId, setTxFilterAccountId] = useState<string>('ALL');
  const [txFilterStatus, setTxFilterStatus] = useState<string>('ALL');
  const [txSearch, setTxSearch] = useState<string>('');

  // Reconciliation Tab State
  const [reconItems, setReconItems] = useState<OrderReconciliationRecordModel[]>([]);
  const [reconSummary, setReconSummary] = useState<any>(null);
  const [reconTotal, setReconTotal] = useState<number>(0);
  const [reconPage, setReconPage] = useState<number>(1);
  const [reconLimit, setReconLimit] = useState<number>(25);
  const [reconLoading, setReconLoading] = useState<boolean>(false);
  const [reconStatusFilter, setReconStatusFilter] = useState<string>('ALL');
  const [reconSearch, setReconSearch] = useState<string>('');

  // Modals
  const [isTxModalOpen, setIsTxModalOpen] = useState<boolean>(false);
  const [txModalType, setTxModalType] = useState<CashTransactionType>('EXPENSE');
  const [txModalDefaultCategory, setTxModalDefaultCategory] = useState<string | undefined>(undefined);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);

  // Keep workspace shop in sync if changed from header
  useEffect(() => {
    if (storeShopId && storeShopId !== selectedShopId) {
      setSelectedShopId(storeShopId);
    }
  }, [storeShopId]);

  // Load baseline
  useEffect(() => {
    loadBaseData();
  }, [selectedShopId, startDate, endDate]);

  const loadBaseData = async () => {
    try {
      setLoading(true);
      const [ovRes, accRes, catRes, shopRes, supRes] = await Promise.all([
        cashflowApi.getOverview({
          shopId: selectedShopId === 'ALL' ? undefined : selectedShopId,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
        cashflowApi.getAccounts(),
        cashflowApi.getCategories(),
        storeShops.length > 0 ? Promise.resolve(storeShops) : shopsApi.findAll(),
        suppliersApi.findAll(),
      ]);

      setOverview(ovRes);
      setAccounts(accRes || []);
      setCategories(catRes || []);
      setShops(Array.isArray(shopRes) ? shopRes : (shopRes as any)?.data || []);
      const supData = (supRes as any)?.data || (Array.isArray(supRes) ? supRes : []);
      setSupplierList(supData);
    } catch (e: any) {
      console.error(e);
      toast.error('Không thể tải dữ liệu sổ quỹ');
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliersData = async () => {
    setLoadingSuppliers(true);
    try {
      const res: any = await suppliersApi.findAll();
      const data = (res as any)?.data || (Array.isArray(res) ? res : []);
      setSupplierList(data);
    } catch (e) {
      console.error('Error loading suppliers in cashflow', e);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'SUPPLIERS') {
      loadSuppliersData();
    }
  }, [activeTab]);

  // Load Transactions when tab or filters change
  useEffect(() => {
    if (activeTab === 'TRANSACTIONS') {
      loadTransactions();
    }
  }, [
    activeTab,
    txPage,
    txLimit,
    txFilterType,
    txFilterCategoryId,
    txFilterAccountId,
    txFilterStatus,
    txSearch,
    selectedShopId,
  ]);

  const loadTransactions = async () => {
    try {
      setTxLoading(true);
      const res = await cashflowApi.getTransactions({
        page: txPage,
        limit: txLimit,
        type: txFilterType === 'ALL' ? undefined : txFilterType,
        categoryId: txFilterCategoryId === 'ALL' ? undefined : txFilterCategoryId,
        accountId: txFilterAccountId === 'ALL' ? undefined : txFilterAccountId,
        status: txFilterStatus === 'ALL' ? undefined : txFilterStatus,
        shopId: selectedShopId === 'ALL' ? undefined : selectedShopId,
        search: txSearch || undefined,
      });
      setTransactions(res.items || []);
      setTxTotal(res.total || 0);
    } catch (e) {
      console.error(e);
      toast.error('Không thể tải danh sách giao dịch');
    } finally {
      setTxLoading(false);
    }
  };

  // Load Reconciliation when tab or filters change
  useEffect(() => {
    if (activeTab === 'RECONCILIATION') {
      loadReconciliation();
    }
  }, [activeTab, reconPage, reconLimit, reconStatusFilter, reconSearch, selectedShopId]);

  const loadReconciliation = async () => {
    try {
      setReconLoading(true);
      const res = await cashflowApi.getReconciliation({
        page: reconPage,
        limit: reconLimit,
        shopId: selectedShopId === 'ALL' ? undefined : selectedShopId,
        reconciliationStatus:
          reconStatusFilter === 'ALL'
            ? undefined
            : (reconStatusFilter as OrderReconciliationStatus),
        search: reconSearch || undefined,
      });
      setReconItems(res.items || []);
      setReconTotal(res.total || 0);
      setReconSummary(res.summary);
    } catch (e) {
      console.error(e);
      toast.error('Không thể tải dữ liệu đối soát');
    } finally {
      setReconLoading(false);
    }
  };

  // Quick Action Handlers
  const handleOpenExpense = (categoryCode?: string) => {
    setTxModalType('EXPENSE');
    if (categoryCode) {
      const cat = categories.find((c) => c.code === categoryCode);
      setTxModalDefaultCategory(cat?.id);
    } else {
      setTxModalDefaultCategory(undefined);
    }
    setIsTxModalOpen(true);
  };

  const handleOpenIncome = () => {
    setTxModalType('INCOME');
    setTxModalDefaultCategory(undefined);
    setIsTxModalOpen(true);
  };

  const handleConfirmTx = async (txId: string) => {
    try {
      await cashflowApi.confirmTransaction(txId);
      toast.success('Đã xác nhận giao dịch và cập nhật số dư');
      loadBaseData();
      if (activeTab === 'TRANSACTIONS') loadTransactions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleCancelTx = async (txId: string) => {
    const reason = window.prompt('Nhập lý do hủy phiếu (để lưu vết lịch sử sổ cái):');
    if (reason === null) return;

    try {
      await cashflowApi.cancelTransaction(txId, reason);
      toast.success('Đã hủy phiếu và hoàn trả số dư');
      loadBaseData();
      if (activeTab === 'TRANSACTIONS') loadTransactions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleSyncOrders = async () => {
    try {
      const res = await cashflowApi.syncOrders(
        selectedShopId === 'ALL' ? undefined : selectedShopId,
      );
      toast.success(`Đã khởi tạo bản ghi đối soát cho ${res.syncedCount} đơn hàng mới`);
      loadReconciliation();
      loadBaseData();
    } catch (e) {
      toast.error('Không thể đồng bộ đơn hàng');
    }
  };

  const recentList =
    overview?.recentTransactions && overview.recentTransactions.length > 0
      ? overview.recentTransactions
      : transactions.slice(0, 5);

  const displayAccounts =
    accounts.length > 0
      ? accounts
      : overview?.accounts && overview.accounts.length > 0
      ? overview.accounts
      : [];

  return (
    <div className="flex-1 flex flex-col min-h-fit space-y-4 animate-in fade-in duration-300 max-w-full overflow-x-hidden min-w-0">
      {/* 1. Top Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-xl font-medium text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2 truncate">
            <CircleDollarSign size={18} className="text-[#5865f2] shrink-0 sm:w-5 sm:h-5" />
            <span className="truncate">Thu chi & đối soát</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate hidden sm:block">
            Theo dõi dòng tiền, quản lý quỹ và đối soát thanh toán.
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button
            size="sm"
            onClick={handleOpenIncome}
            className="gap-1.5 px-2.5 sm:px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
            title="Tạo phiếu thu tiền"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Thu tiền</span>
            <span className="sm:hidden">Thu</span>
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenExpense()}
            className="gap-1.5 px-2.5 sm:px-3 bg-[#5865f2] hover:bg-[#4752c4] text-white"
            title="Tạo phiếu chi tiền"
          >
            <Minus size={14} />
            <span className="hidden sm:inline">Chi tiền</span>
            <span className="sm:hidden">Chi</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTransferModalOpen(true)}
            className="gap-1.5 px-2.5 sm:px-3"
            title="Chuyển tiền giữa các tài khoản & rút tiền Shopee"
          >
            <ArrowLeftRight size={14} className="text-gray-500 dark:text-gray-400" />
            <span className="hidden sm:inline">Chuyển quỹ</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-8 h-8 p-0"
                title="Tùy chọn khác"
              >
                <MoreHorizontal size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[210px]">
              <DropdownMenuItem onClick={() => setIsAccountModalOpen(true)}>
                <Landmark size={14} className="mr-2 text-indigo-400" />
                Tạo tài khoản / Quỹ mới
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsCategoryModalOpen(true)}>
                <Tag size={14} className="mr-2 text-indigo-400" />
                Tạo danh mục thu chi
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSyncOrders}>
                <RefreshCw size={14} className="mr-2 text-emerald-400" />
                Đồng bộ đơn hàng đối soát
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/supplier-debts')}>
                <Building2 size={14} className="mr-2 text-rose-400" />
                Xem công nợ nhà cung cấp
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 2. Navigation Tabs (Horizontal Underline Style) */}
      <div className="flex items-center gap-6 sm:gap-8 border-b border-gray-200 dark:border-gray-800 overflow-x-auto scrollbar-none shrink-0 min-h-[42px]">
        {CASHFLOW_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={`pb-2.5 pt-1.5 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap cursor-pointer border-b-2 -mb-[1px] outline-none shrink-0 ${
                isActive
                  ? 'border-[#5865f2] text-[#5865f2] dark:text-[#5865f2] font-semibold'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Global Filter Bar */}
      <div className="bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded p-2.5 sm:p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs shrink-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          {/* Store Filter */}
          <div className="w-full sm:w-56">
            <Select
              value={selectedShopId}
              onChange={(val) => {
                const s = String(val || 'ALL');
                setSelectedShopId(s);
                setStoreShopId(s);
              }}
              options={[
                { value: 'ALL', label: 'Tất cả gian hàng', icon: Store },
                ...shops.map((s) => ({ value: s.id, label: s.name, icon: Store })),
              ]}
              icon={Store}
              size="sm"
              className="w-full bg-gray-50 dark:bg-[#161a26] border-gray-200 dark:border-[#262c3f] text-gray-800 dark:text-gray-200"
            />
          </div>

          {/* Date Presets Filter */}
          <div className="w-full sm:w-56">
            <Select
              value={datePreset}
              onChange={(val) => handleDatePresetChange(String(val || 'ALL'))}
              options={[
                { value: 'ALL', label: 'Khoảng thời gian', icon: Calendar },
                { value: 'TODAY', label: 'Hôm nay', icon: Calendar },
                { value: 'LAST_7_DAYS', label: '7 ngày qua', icon: Calendar },
                { value: 'THIS_MONTH', label: 'Tháng này', icon: Calendar },
                { value: 'LAST_MONTH', label: 'Tháng trước', icon: Calendar },
              ]}
              icon={Calendar}
              size="sm"
              className="w-full bg-gray-50 dark:bg-[#161a26] border-gray-200 dark:border-[#262c3f] text-gray-800 dark:text-gray-200"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadBaseData();
              if (activeTab === 'TRANSACTIONS') loadTransactions();
              if (activeTab === 'RECONCILIATION') loadReconciliation();
            }}
            className="gap-1.5"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            className="gap-1.5"
            title="Import file quyết toán Shopee"
          >
            <Upload size={13} />
            <span>Import đối soát</span>
          </Button>
        </div>
      </div>

      {/* 4. Tab Content */}

      {/* -------------------- TAB 1: TỔNG QUAN -------------------- */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Row 1: 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 shrink-0">
            <SystemMetricPairCard
              leftItem={{
                title: 'Số dư hiện tại',
                value: `${(overview?.totals.totalNetBalance || 0).toLocaleString('vi-VN')} đ`,
                subtitle: 'Tiền mặt, bank & ví sàn',
                icon: Wallet,
                colorScheme: 'blue',
              }}
              rightItem={{
                title: 'Dòng tiền thuần',
                value: `${(overview?.period.netOperatingCashflow || 0) >= 0 ? '+' : ''}${(overview?.period.netOperatingCashflow || 0).toLocaleString('vi-VN')} đ`,
                subtitle: `Thu ${(overview?.period.periodIncome || 0).toLocaleString('vi-VN')}đ · Chi ${(overview?.period.periodExpense || 0).toLocaleString('vi-VN')}đ`,
                icon: ArrowUpDown,
                colorScheme: (overview?.period.netOperatingCashflow || 0) >= 0 ? 'green' : 'red',
              }}
            />
            <SystemMetricPairCard
              leftItem={{
                title: 'Chờ Shopee về',
                value: `${(overview?.outstanding.pendingPlatformMoney || 0).toLocaleString('vi-VN')} đ`,
                subtitle: `${overview?.outstanding.pendingPlatformCount || 0} đơn chờ tiền`,
                icon: Clock,
                colorScheme: 'orange',
                onClick: () => setActiveTab('RECONCILIATION'),
              }}
              rightItem={{
                title: 'Nợ NCC',
                value: `${(overview?.outstanding.supplierDebt || 0).toLocaleString('vi-VN')} đ`,
                subtitle: `${overview?.outstanding.unpaidReceiptsCount || 0} phiếu chưa trả`,
                icon: Building2,
                colorScheme: 'purple',
                onClick: () => setActiveTab('SUPPLIERS'),
              }}
            />
          </div>

          {/* Row 2: Middle 2 Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {/* Left Card: Tài khoản & quỹ */}
            <div className="bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded p-4 sm:p-5 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white flex items-center gap-2">
                    <CreditCard size={18} className="text-[#5865f2]" />
                    Tài khoản & quỹ
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('ACCOUNTS')}
                    className="text-xs text-[#5865f2] hover:underline font-medium cursor-pointer"
                  >
                    Quản lý quỹ →
                  </button>
                </div>

                <div className="space-y-2.5">
                  {displayAccounts.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-400">
                      Chưa có tài khoản nào được tạo.
                    </div>
                  ) : (
                    displayAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="bg-gray-50/70 dark:bg-[#1a1f2e]/40 hover:bg-gray-100 dark:hover:bg-[#1a1f2e]/70 border border-gray-200 dark:border-gray-800 rounded p-2.5 sm:p-3 flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${
                              acc.type === 'CASH'
                                ? 'bg-blue-500/10 text-blue-500 dark:text-blue-400'
                                : acc.type === 'PLATFORM_WALLET'
                                ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400'
                                : 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400'
                            }`}
                          >
                            {acc.type === 'CASH' ? (
                              <Wallet size={16} />
                            ) : acc.type === 'PLATFORM_WALLET' ? (
                              <Wallet size={16} />
                            ) : (
                              <Landmark size={16} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {acc.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                              {acc.type === 'CASH'
                                ? 'Tiền mặt'
                                : acc.type === 'PLATFORM_WALLET'
                                ? 'Đã quyết toán về ví'
                                : `${acc.bankName || 'Ngân hàng'}${
                                    acc.accountNumber
                                      ? ' · ···· ' + acc.accountNumber.slice(-4)
                                      : ''
                                  }`}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {Number(acc.currentBalance || 0).toLocaleString('vi-VN')} đ
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded hover:bg-gray-200 dark:hover:bg-gray-800/60 cursor-pointer"
                              >
                                <MoreVertical size={16} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[190px]">
                              <DropdownMenuItem onClick={() => setIsTransferModalOpen(true)}>
                                <ArrowLeftRight size={14} className="mr-2 text-indigo-400" />
                                Chuyển tiền từ ví này
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setActiveTab('ACCOUNTS')}>
                                <Landmark size={14} className="mr-2 text-emerald-400" />
                                Chi tiết tài khoản
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Footer: Chuyển tiền giữa các quỹ */}
              <div
                onClick={() => setIsTransferModalOpen(true)}
                className="border-t border-gray-100 dark:border-gray-800 pt-3.5 mt-3 flex items-center justify-between text-xs sm:text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white cursor-pointer group transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ArrowLeftRight size={15} className="text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
                  <span>Chuyển tiền giữa các quỹ</span>
                </div>
                <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
              </div>
            </div>

            {/* Right Card: Ghi nhanh khoản chi */}
            <div className="bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded p-4 sm:p-5 flex flex-col justify-between shadow-xs">
              <div>
                <div className="pb-3 mb-2.5">
                  <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white flex items-center gap-2">
                    <FileText size={18} className="text-[#5865f2]" />
                    Ghi nhanh khoản chi
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Chọn khoản mục để lập phiếu chi
                  </p>
                </div>

                <div className="space-y-2">
                  <div
                    onClick={() => handleOpenExpense('CHI_VAT_TU_DONG_GOI')}
                    className="bg-gray-50/70 dark:bg-[#1a1f2e]/40 hover:bg-gray-100 dark:hover:bg-[#1a1f2e]/70 border border-gray-200 dark:border-gray-800 rounded p-2.5 sm:p-3 flex items-center justify-between cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-gray-200/60 dark:bg-gray-800/80 flex items-center justify-center text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                        <Package size={16} />
                      </div>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white">
                        Vật tư đóng gói
                      </span>
                    </div>
                    <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
                  </div>

                  <div
                    onClick={() => handleOpenExpense('CHI_GIAY_MUC_IN')}
                    className="bg-gray-50/70 dark:bg-[#1a1f2e]/40 hover:bg-gray-100 dark:hover:bg-[#1a1f2e]/70 border border-gray-200 dark:border-gray-800 rounded p-2.5 sm:p-3 flex items-center justify-between cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-gray-200/60 dark:bg-gray-800/80 flex items-center justify-center text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                        <FileText size={16} />
                      </div>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white">
                        Giấy in & mực in
                      </span>
                    </div>
                    <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
                  </div>

                  <div
                    onClick={() => handleOpenExpense('CHI_NHAP_HANG')}
                    className="bg-gray-50/70 dark:bg-[#1a1f2e]/40 hover:bg-gray-100 dark:hover:bg-[#1a1f2e]/70 border border-gray-200 dark:border-gray-800 rounded p-2.5 sm:p-3 flex items-center justify-between cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-gray-200/60 dark:bg-gray-800/80 flex items-center justify-center text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                        <CreditCard size={16} />
                      </div>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white">
                        Thanh toán nhà cung cấp
                      </span>
                    </div>
                    <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
                  </div>

                  <div
                    onClick={() => handleOpenExpense('CHI_VAN_CHUYEN_NGOAI')}
                    className="bg-gray-50/70 dark:bg-[#1a1f2e]/40 hover:bg-gray-100 dark:hover:bg-[#1a1f2e]/70 border border-gray-200 dark:border-gray-800 rounded p-2.5 sm:p-3 flex items-center justify-between cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-gray-200/60 dark:bg-gray-800/80 flex items-center justify-center text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                        <Truck size={16} />
                      </div>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white">
                        Vận chuyển ngoài sàn
                      </span>
                    </div>
                    <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
                  </div>

                  <div
                    onClick={() => handleOpenExpense('CHI_HOAN_TIEN_KHACH')}
                    className="bg-gray-50/70 dark:bg-[#1a1f2e]/40 hover:bg-gray-100 dark:hover:bg-[#1a1f2e]/70 border border-gray-200 dark:border-gray-800 rounded p-2.5 sm:p-3 flex items-center justify-between cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-gray-200/60 dark:bg-gray-800/80 flex items-center justify-center text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                        <RotateCcw size={16} />
                      </div>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white">
                        Hoàn tiền cho khách
                      </span>
                    </div>
                    <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Giao dịch gần đây */}
          <div className="bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Receipt size={18} className="text-[#5865f2]" />
                Giao dịch gần đây
              </h3>
              <button
                type="button"
                onClick={() => setActiveTab('TRANSACTIONS')}
                className="text-xs text-[#5865f2] hover:underline font-medium cursor-pointer"
              >
                Xem sổ thu chi →
              </button>
            </div>

            <div className="overflow-x-auto max-w-full">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead className="bg-gray-50 dark:bg-[#10141f]/80 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-[#22283a]">
                  <tr>
                    <th className="py-3 px-4">Mã phiếu / Ngày</th>
                    <th className="py-3 px-4">Khoản mục</th>
                    <th className="py-3 px-4">Số tiền</th>
                    <th className="py-3 px-4">Tài khoản</th>
                    <th className="py-3 px-4">Đối tượng / Ghi chú</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">···</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#22283a]/60 text-gray-700 dark:text-gray-300">
                  {recentList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        Chưa có phát sinh giao dịch nào gần đây.
                      </td>
                    </tr>
                  ) : (
                    recentList.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-[#1a1f2e]/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-gray-900 dark:text-white">{tx.transactionCode}</div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1 font-mono">
                            <Clock size={11} className="shrink-0 text-gray-400" />
                            <span>{formatDateTime(tx.transactionDate || tx.createdAt)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-200">
                          {tx.category?.name || '---'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              tx.type === 'INCOME' || tx.type === 'CAPITAL_IN'
                                ? 'text-emerald-600 dark:text-[#10b981]'
                                : 'text-rose-600 dark:text-[#f43f5e]'
                            }`}
                          >
                            {tx.type === 'INCOME' || tx.type === 'CAPITAL_IN' ? '+' : '-'}
                            {Number(tx.amount || 0).toLocaleString('vi-VN')} đ
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                          {tx.fromAccount?.name || tx.toAccount?.name || (tx.paymentMethod === 'DEBT_OFFSET' ? 'Cấn trừ nợ NCC' : '---')}
                        </td>
                        <td className="py-3 px-4 text-gray-500 dark:text-gray-400">
                          {tx.counterpartyName || tx.note || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              tx.status === 'CONFIRMED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-[#064e3b]/80 dark:text-[#34d399] dark:border-[#065f46]'
                                : tx.status === 'DRAFT'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-[#78350f]/60 dark:text-[#fbbf24] dark:border-[#92400e]'
                                : 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                            }`}
                          >
                            {tx.status === 'CONFIRMED'
                              ? 'Đã xác nhận'
                              : tx.status === 'DRAFT'
                              ? 'Lưu nháp'
                              : 'Đã hủy'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded hover:bg-gray-200 dark:hover:bg-gray-800/60 cursor-pointer"
                              >
                                <MoreHorizontal size={15} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[160px]">
                              {tx.status === 'DRAFT' && (
                                <DropdownMenuItem onClick={() => handleConfirmTx(tx.id)}>
                                  <Check size={14} className="mr-2 text-emerald-500" />
                                  Xác nhận phiếu
                                </DropdownMenuItem>
                              )}
                              {tx.status !== 'CANCELLED' && (
                                <DropdownMenuItem onClick={() => handleCancelTx(tx.id)} className="text-rose-500">
                                  <Trash2 size={14} className="mr-2" />
                                  Hủy phiếu
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 sm:px-4 border-t border-gray-200 dark:border-[#22283a] bg-gray-50/50 dark:bg-[#10141f]/50 text-xs text-gray-500 dark:text-gray-400">
              {recentList.length} giao dịch
            </div>
          </div>
        </div>
      )}

      {/* -------------------- TAB 2: SỔ THU CHI -------------------- */}
      {activeTab === 'TRANSACTIONS' && (
        <div className="space-y-3.5 animate-in fade-in duration-200">
          {/* Sub Filters */}
          <SystemFilter className="p-2 sm:p-2.5 flex-col sm:flex-row items-stretch sm:items-center shrink-0">
            <SystemFilterSearch
              value={txSearch}
              onChange={(e) => {
                setTxSearch(e.target.value);
                setTxPage(1);
              }}
              placeholder="Tìm mã phiếu, UNC, tên đối tượng..."
              className="w-full sm:w-60"
            />

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={txFilterType}
                onChange={(val) => {
                  setTxFilterType(String(val || 'ALL'));
                  setTxPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'Tất cả loại giao dịch' },
                  { value: 'EXPENSE', label: 'Khoản chi', icon: ArrowUpRight },
                  { value: 'INCOME', label: 'Khoản thu', icon: ArrowDownLeft },
                  { value: 'INTERNAL_TRANSFER', label: 'Chuyển nội bộ', icon: ArrowLeftRight },
                  { value: 'REIMBURSEMENT', label: 'Hoàn tiền ứng', icon: Wallet },
                  { value: 'CAPITAL_IN', label: 'Góp vốn', icon: TrendingUp },
                ]}
                size="sm"
                className="w-44"
              />

              <Select
                value={txFilterCategoryId}
                onChange={(val) => {
                  setTxFilterCategoryId(String(val || 'ALL'));
                  setTxPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'Tất cả khoản mục' },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
                searchable={true}
                size="sm"
                className="w-44"
              />

              <Select
                value={txFilterAccountId}
                onChange={(val) => {
                  setTxFilterAccountId(String(val || 'ALL'));
                  setTxPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'Tất cả tài khoản' },
                  ...accounts.map((a) => ({
                    value: a.id,
                    label: a.name,
                    icon: a.type === 'CASH' ? Wallet : a.type === 'BANK' ? Landmark : Store,
                  })),
                ]}
                searchable={true}
                size="sm"
                className="w-44"
              />

              <Select
                value={txFilterStatus}
                onChange={(val) => {
                  setTxFilterStatus(String(val || 'ALL'));
                  setTxPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'Tất cả trạng thái' },
                  { value: 'CONFIRMED', label: 'Đã xác nhận' },
                  { value: 'DRAFT', label: 'Lưu nháp' },
                  { value: 'CANCELLED', label: 'Đã hủy' },
                ]}
                size="sm"
                className="w-36"
              />

              {(txSearch ||
                txFilterType !== 'ALL' ||
                txFilterCategoryId !== 'ALL' ||
                txFilterAccountId !== 'ALL' ||
                txFilterStatus !== 'ALL') && (
                <SystemFilterReset
                  onClick={() => {
                    setTxSearch('');
                    setTxFilterType('ALL');
                    setTxFilterCategoryId('ALL');
                    setTxFilterAccountId('ALL');
                    setTxFilterStatus('ALL');
                    setTxPage(1);
                  }}
                />
              )}
            </div>
          </SystemFilter>

          {/* Desktop Transactions Table */}
          <div className="hidden md:flex bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs flex-1 flex-col">
            <SystemTableWrapper>
              <SystemThead>
                <SystemTr>
                  <SystemTh className="w-14 text-center" align="center">STT</SystemTh>
                  <SystemTh>Mã phiếu</SystemTh>
                  <SystemTh>Ngày</SystemTh>
                  <SystemTh>Khoản mục</SystemTh>
                  <SystemTh>Số tiền</SystemTh>
                  <SystemTh>Tài khoản tiền</SystemTh>
                  <SystemTh>Người trả / nhận</SystemTh>
                  <SystemTh>Người thực hiện</SystemTh>
                  <SystemTh>Shop</SystemTh>
                  <SystemTh>Trạng thái</SystemTh>
                  <SystemTh className="text-right">Hành động</SystemTh>
                </SystemTr>
              </SystemThead>
              <SystemTbody>
                {txLoading ? (
                  <SystemTableSkeleton rows={8} cols={11} />
                ) : transactions.length === 0 ? (
                  <SystemTableEmpty
                    title="Không có giao dịch nào"
                    description="Không tìm thấy bản ghi thu chi nào phù hợp với bộ lọc hiện tại."
                    colSpan={11}
                  />
                ) : (
                  transactions.map((tx, index) => {
                    const stt = (txPage - 1) * txLimit + index + 1;
                    return (
                      <SystemTr key={tx.id}>
                        <SystemTd align="center" className="text-center font-medium text-gray-500 dark:text-gray-400 text-xs">
                          {stt}
                        </SystemTd>
                        <SystemTd>
                          <div className="font-mono font-medium text-xs text-gray-900 dark:text-gray-100">
                            {tx.transactionCode}
                          </div>
                          {tx.referenceCode && (
                            <div className="text-[10px] text-gray-400">UNC: {tx.referenceCode}</div>
                          )}
                        </SystemTd>
                        <SystemTd className="text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap font-mono">
                        <div className="flex items-center gap-1">
                          <Clock size={11} className="shrink-0 text-gray-400" />
                          <span>{formatDateTime(tx.transactionDate || tx.createdAt)}</span>
                        </div>
                      </SystemTd>
                      <SystemTd>
                        <div className="font-medium text-xs text-gray-900 dark:text-white">
                          {tx.category?.name || '---'}
                        </div>
                        {tx.note && <div className="text-[11px] text-gray-400 max-w-xs truncate">{tx.note}</div>}
                      </SystemTd>
                      <SystemTd className="whitespace-nowrap">
                        <span
                          className={`font-semibold text-xs sm:text-sm ${
                            tx.type === 'INCOME'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : tx.type === 'EXPENSE'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-[#5865f2] dark:text-[#7b85f5]'
                          }`}
                        >
                          {tx.type === 'INCOME' ? '+' : tx.type === 'EXPENSE' ? '−' : ''}
                          {Number(tx.amount).toLocaleString('vi-VN')}đ
                        </span>
                      </SystemTd>
                      <SystemTd className="text-xs text-gray-600 dark:text-gray-300">
                        {tx.fromAccount?.name || tx.toAccount?.name || (tx.paymentMethod === 'DEBT_OFFSET' ? 'Cấn trừ nợ NCC' : 'Tiền cá nhân chi hộ')}
                      </SystemTd>
                      <SystemTd className="text-xs text-gray-700 dark:text-gray-300">
                        {tx.counterpartyName || '---'}
                      </SystemTd>
                      <SystemTd className="text-xs text-gray-500">
                        {tx.performedByName || '---'}
                      </SystemTd>
                      <SystemTd className="text-xs text-gray-500">
                        {tx.isCommonExpense ? (
                          <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-medium">
                            Chi chung
                          </span>
                        ) : (
                          tx.shop?.name || '---'
                        )}
                      </SystemTd>
                      <SystemTd>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            tx.status === 'CONFIRMED'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : tx.status === 'DRAFT'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          {tx.status === 'CONFIRMED'
                            ? 'Đã xác nhận'
                            : tx.status === 'DRAFT'
                            ? 'Lưu nháp'
                            : 'Đã hủy'}
                        </span>
                      </SystemTd>
                      <SystemTd className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {tx.status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => handleConfirmTx(tx.id)}
                              className="p-1.5 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition-colors cursor-pointer"
                              title="Xác nhận phiếu nháp này"
                            >
                              <Check size={14} />
                            </button>
                          )}
                          {tx.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              onClick={() => handleCancelTx(tx.id)}
                              className="p-1.5 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                              title="Hủy phiếu (hoàn trả số dư)"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          {tx.voucherImage && (
                            <a
                              href={tx.voucherImage}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-xs text-[#5865f2] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition-colors"
                              title="Xem ảnh chứng từ"
                            >
                              <Eye size={14} />
                            </a>
                          )}
                        </div>
                      </SystemTd>
                    </SystemTr>
                  );
                })
              )}
              </SystemTbody>
            </SystemTableWrapper>

            {/* Pagination */}
            <div className="border-t border-gray-200 dark:border-gray-800">
              <SystemPagination
                page={txPage - 1}
                totalPages={Math.ceil(txTotal / txLimit) || 1}
                totalItems={txTotal}
                setPage={(p) => setTxPage(p + 1)}
                itemsPerPage={txLimit}
                setItemsPerPage={(newLimit) => {
                  setTxLimit(newLimit);
                  setTxPage(1);
                }}
                className="border-t-0"
              />
            </div>
          </div>

          {/* Mobile Transactions Card View */}
          <div className="md:hidden flex-1 overflow-y-auto space-y-2 pb-16 max-w-full overflow-x-hidden">
            {txLoading ? (
              <div className="py-8 text-center text-xs text-gray-400">Đang tải phiếu thu chi...</div>
            ) : transactions.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">Không có giao dịch nào</div>
            ) : (
              transactions.map((tx, index) => {
                const stt = (txPage - 1) * txLimit + index + 1;
                return (
                  <div
                    key={tx.id}
                    className="p-3 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 space-y-2 max-w-full overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-5 h-5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-semibold text-gray-500 flex items-center justify-center shrink-0">
                            {stt}
                          </span>
                          <span className="font-mono font-bold text-xs text-[#5865f2] truncate">
                            {tx.transactionCode}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono mt-0.5 pl-6.5 shrink-0 whitespace-nowrap">
                          <Clock size={10} className="shrink-0 text-gray-400" />
                          <span>{formatDateTime(tx.transactionDate || tx.createdAt)}</span>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                          tx.status === 'CONFIRMED'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : tx.status === 'DRAFT'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        {tx.status === 'CONFIRMED'
                          ? 'Đã xác nhận'
                          : tx.status === 'DRAFT'
                          ? 'Lưu nháp'
                          : 'Đã hủy'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[180px]">
                        {tx.category?.name || '---'}
                      </div>
                      <span
                        className={`font-bold text-sm sm:text-base ${
                          tx.type === 'INCOME'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : tx.type === 'EXPENSE'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-[#5865f2] dark:text-[#7b85f5]'
                        }`}
                      >
                        {tx.type === 'INCOME' ? '+' : tx.type === 'EXPENSE' ? '−' : ''}
                        {Number(tx.amount).toLocaleString('vi-VN')}đ
                      </span>
                    </div>

                    {tx.note && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 italic">
                        {tx.note}
                      </div>
                    )}

                    <div className="p-2 bg-gray-50 dark:bg-[#14151a] rounded text-[11px] space-y-1 border border-gray-100 dark:border-gray-800 min-w-0">
                      <div className="flex items-center justify-between text-gray-600 dark:text-gray-300 gap-2 min-w-0">
                        <span className="text-gray-400 shrink-0">Tài khoản:</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200 truncate text-right">
                          {tx.fromAccount?.name || tx.toAccount?.name || (tx.paymentMethod === 'DEBT_OFFSET' ? 'Cấn trừ nợ NCC' : 'Tiền cá nhân')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-gray-600 dark:text-gray-300 gap-2 min-w-0">
                        <span className="text-gray-400 shrink-0">Đối tượng / Shop:</span>
                        <span className="truncate max-w-[160px] text-right">
                          {tx.counterpartyName || (tx.isCommonExpense ? 'Chi chung' : tx.shop?.name || '---')}
                        </span>
                      </div>
                      {tx.performedByName && (
                        <div className="flex items-center justify-between text-gray-400 text-[10px] gap-2 min-w-0">
                          <span className="shrink-0">Người tạo:</span>
                          <span className="truncate text-right">{tx.performedByName}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                      {tx.voucherImage && (
                        <a
                          href={tx.voucherImage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 text-xs text-[#5865f2] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition-colors flex items-center gap-1"
                        >
                          <Eye size={12} /> Chứng từ
                        </a>
                      )}
                      {tx.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={() => handleConfirmTx(tx.id)}
                          className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <Check size={12} /> Xác nhận
                        </button>
                      )}
                      {tx.status !== 'CANCELLED' && (
                        <button
                          type="button"
                          onClick={() => handleCancelTx(tx.id)}
                          className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded border border-rose-200 dark:border-rose-900/50 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={12} /> Hủy
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {txTotal > txLimit && (
              <div className="pt-2">
                <SystemPagination
                  page={txPage - 1}
                  totalPages={Math.ceil(txTotal / txLimit) || 1}
                  totalItems={txTotal}
                  setPage={(p) => setTxPage(p + 1)}
                  itemsPerPage={txLimit}
                  setItemsPerPage={(newLimit) => {
                    setTxLimit(newLimit);
                    setTxPage(1);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------- TAB 3: ĐỐI SOÁT TIỀN SHOPEE -------------------- */}
      {activeTab === 'RECONCILIATION' && (
        <div className="space-y-3.5 animate-in fade-in duration-200">
          {/* Important Rules Alert Banner */}
          <div className="p-3.5 sm:p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/40 rounded flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck size={20} className="text-[#5865f2] dark:text-[#7b85f5] shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-xs sm:text-sm text-indigo-950 dark:text-indigo-200">
                  Quy tắc đối soát tiền đơn hàng Shopee
                </h4>
                <p className="text-xs text-indigo-800 dark:text-indigo-300 mt-0.5 leading-relaxed">
                  Nhập file đơn hàng không đồng nghĩa đã thu được tiền. Tiền bán hàng chỉ được ghi nhận khi khớp từ <b>File quyết toán / Thu nhập Shopee</b>. Hệ thống <b>tự động loại trừ các đơn hàng bị hủy</b> (chỉ tính các đơn hiệu lực có phát sinh tiền hàng).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncOrders}
                className="flex-1 md:flex-none gap-1.5"
                title="Quét các đơn hàng mới để tạo bản ghi đối soát"
              >
                <RefreshCw size={13} />
                <span>Đồng bộ đơn mới</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setIsImportModalOpen(true)}
                className="flex-1 md:flex-none gap-1.5 bg-[#5865f2] hover:bg-[#4752c4] text-white"
                title="Tải lên file báo cáo quyết toán Shopee"
              >
                <FileSpreadsheet size={14} />
                <span>Import File Quyết Toán</span>
              </Button>
            </div>
          </div>

          {/* 4 Financial Columns Metric Overview */}
          {reconSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 shrink-0">
              <SystemMetricPairCard
                leftItem={{
                  title: '1. Giá trị hàng hóa',
                  value: `${(reconSummary.totalGoodsValue || 0).toLocaleString('vi-VN')} đ`,
                  subtitle: 'Tổng tiền SP các đơn không hủy',
                  icon: ShoppingBag,
                  colorScheme: 'blue',
                }}
                rightItem={{
                  title: '2. Tiền dự kiến nhận',
                  value: `${(reconSummary.totalEstimatedPayout || 0).toLocaleString('vi-VN')} đ`,
                  subtitle: 'Tạm tính (không gồm đơn hủy)',
                  icon: CircleDollarSign,
                  colorScheme: 'purple',
                }}
              />
              <SystemMetricPairCard
                leftItem={{
                  title: '3. Tiền đã quyết toán',
                  value: `${(reconSummary.totalSettledPayout || 0).toLocaleString('vi-VN')} đ`,
                  subtitle: 'Xác nhận file quyết toán',
                  icon: CheckCircle,
                  colorScheme: 'green',
                }}
                rightItem={{
                  title: '4. Điều chỉnh / Bồi hoàn',
                  value: `${(reconSummary.totalAdjustment || 0).toLocaleString('vi-VN')} đ`,
                  subtitle: 'Phát sinh khiếu nại, bù tiền',
                  icon: RefreshCw,
                  colorScheme: 'orange',
                }}
              />
            </div>
          )}

          {/* Filter Bar with Search and Status Pills */}
          <SystemFilter className="p-2 sm:p-2.5 flex-col sm:flex-row items-stretch sm:items-center shrink-0">
            <SystemFilterSearch
              value={reconSearch}
              onChange={(e) => {
                setReconSearch(e.target.value);
                setReconPage(1);
              }}
              placeholder="Tìm mã đơn Shopee (Order SN), mã vận đơn..."
              className="w-full sm:w-64"
            />

            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5 max-w-full">
              {[
                { key: 'ALL', label: 'Tất cả' },
                { key: 'MATCHED', label: 'Khớp hoàn toàn' },
                { key: 'UNMATCHED', label: 'Chưa khớp' },
                { key: 'NEEDS_CHECK', label: 'Cần kiểm tra' },
                { key: 'NO_DATA', label: 'Chưa có file quyết toán' },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    setReconStatusFilter(s.key);
                    setReconPage(1);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer border-0 shrink-0 ${
                    reconStatusFilter === s.key
                      ? 'bg-[#5865f2] text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1a1b23]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {(reconSearch || reconStatusFilter !== 'ALL') && (
              <SystemFilterReset
                onClick={() => {
                  setReconSearch('');
                  setReconStatusFilter('ALL');
                  setReconPage(1);
                }}
              />
            )}
          </SystemFilter>

          {/* Desktop Reconciliation Table */}
          <div className="hidden md:flex bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs flex-1 flex-col">
            <SystemTableWrapper>
              <SystemThead>
                <SystemTr>
                  <SystemTh className="w-14 text-center" align="center">STT</SystemTh>
                  <SystemTh>Mã đơn Shopee</SystemTh>
                  <SystemTh>Shop</SystemTh>
                  <SystemTh>1. Giá trị hàng hóa</SystemTh>
                  <SystemTh>2. Tiền dự kiến</SystemTh>
                  <SystemTh>3. Tiền đã quyết toán</SystemTh>
                  <SystemTh>4. Điều chỉnh</SystemTh>
                  <SystemTh>Chênh lệch</SystemTh>
                  <SystemTh>Trạng thái đối soát</SystemTh>
                </SystemTr>
              </SystemThead>
              <SystemTbody>
                {reconLoading ? (
                  <SystemTableSkeleton rows={8} cols={9} />
                ) : reconItems.length === 0 ? (
                  <SystemTableEmpty
                    title="Chưa có dữ liệu đối soát"
                    description="Không tìm thấy đơn hàng đối soát nào phù hợp với bộ lọc."
                    colSpan={9}
                  />
                ) : (
                  reconItems.map((rec, index) => {
                    const est = Number(rec.estimatedPayout || 0);
                    const setl = Number(rec.settledPayout || 0);
                    const diff = setl > 0 ? setl - est : 0;
                    const stt = (reconPage - 1) * reconLimit + index + 1;
                    return (
                      <SystemTr key={rec.id}>
                        <SystemTd align="center" className="text-center font-medium text-gray-500 dark:text-gray-400 text-xs">
                          {stt}
                        </SystemTd>
                        <SystemTd>
                          <div className="font-mono font-medium text-xs text-gray-900 dark:text-white">
                            {rec.externalOrderId}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            Mã nội bộ: {rec.order?.internalOrderCode}
                          </div>
                        </SystemTd>
                        <SystemTd className="text-xs text-gray-600 dark:text-gray-300">
                          {rec.shop?.name}
                        </SystemTd>
                        <SystemTd className="text-xs font-medium text-gray-800 dark:text-gray-200">
                          {Number(rec.orderItemAmount).toLocaleString('vi-VN')}đ
                        </SystemTd>
                        <SystemTd className="text-xs font-medium text-blue-600 dark:text-blue-400">
                          {est.toLocaleString('vi-VN')}đ
                        </SystemTd>
                        <SystemTd className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {setl > 0 ? `${setl.toLocaleString('vi-VN')}đ` : '---'}
                        </SystemTd>
                        <SystemTd className="text-xs font-medium text-amber-600 dark:text-amber-400">
                          {Number(rec.adjustmentAmount) !== 0
                            ? `${Number(rec.adjustmentAmount).toLocaleString('vi-VN')}đ`
                            : '0đ'}
                        </SystemTd>
                        <SystemTd className="text-xs font-mono">
                          {setl > 0 ? (
                            <span
                              className={
                                diff === 0
                                  ? 'text-gray-400'
                                  : diff > 0
                                  ? 'text-emerald-500 font-semibold'
                                  : 'text-rose-500 font-semibold'
                              }
                            >
                              {diff > 0
                                ? `+${diff.toLocaleString('vi-VN')}đ`
                                : `${diff.toLocaleString('vi-VN')}đ`}
                            </span>
                          ) : (
                            '---'
                          )}
                        </SystemTd>
                        <SystemTd>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                              rec.reconciliationStatus === 'MATCHED'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : rec.reconciliationStatus === 'NEEDS_CHECK'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                : rec.reconciliationStatus === 'UNMATCHED'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                            }`}
                          >
                            {rec.reconciliationStatus === 'MATCHED'
                              ? 'Khớp'
                              : rec.reconciliationStatus === 'NEEDS_CHECK'
                              ? 'Cần kiểm tra'
                              : rec.reconciliationStatus === 'UNMATCHED'
                              ? 'Chưa khớp'
                              : 'Chưa có dữ liệu'}
                          </span>
                        </SystemTd>
                      </SystemTr>
                    );
                  })
                )}
              </SystemTbody>
            </SystemTableWrapper>

            {/* Pagination */}
            <div className="border-t border-gray-200 dark:border-gray-800">
              <SystemPagination
                page={reconPage - 1}
                totalPages={Math.ceil(reconTotal / reconLimit) || 1}
                totalItems={reconTotal}
                setPage={(p) => setReconPage(p + 1)}
                itemsPerPage={reconLimit}
                setItemsPerPage={(newLimit) => {
                  setReconLimit(newLimit);
                  setReconPage(1);
                }}
                className="border-t-0"
              />
            </div>
          </div>

          {/* Mobile Reconciliation Card View */}
          <div className="md:hidden flex-1 overflow-y-auto space-y-2 pb-16">
            {reconLoading ? (
              <div className="py-8 text-center text-xs text-gray-400">Đang tải đối soát sàn...</div>
            ) : reconItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">Chưa có dữ liệu đối soát</div>
            ) : (
              reconItems.map((rec, index) => {
                const est = Number(rec.estimatedPayout || 0);
                const setl = Number(rec.settledPayout || 0);
                const diff = setl > 0 ? setl - est : 0;
                const stt = (reconPage - 1) * reconLimit + index + 1;

                return (
                  <div
                    key={rec.id}
                    className="p-3 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-5 h-5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-semibold text-gray-500 flex items-center justify-center shrink-0">
                          {stt}
                        </span>
                        <span className="font-mono font-bold text-xs text-gray-900 dark:text-white truncate">
                          {rec.externalOrderId}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                          rec.reconciliationStatus === 'MATCHED'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : rec.reconciliationStatus === 'NEEDS_CHECK'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            : rec.reconciliationStatus === 'UNMATCHED'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        {rec.reconciliationStatus === 'MATCHED'
                          ? 'Khớp'
                          : rec.reconciliationStatus === 'NEEDS_CHECK'
                          ? 'Cần kiểm tra'
                          : rec.reconciliationStatus === 'UNMATCHED'
                          ? 'Chưa khớp'
                          : 'Chưa có file'}
                      </span>
                    </div>

                    <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
                      <span>Shop: <strong className="text-gray-700 dark:text-gray-300">{rec.shop?.name || '--'}</strong></span>
                      {rec.order?.internalOrderCode && (
                        <span className="font-mono text-gray-400">Đơn: {rec.order?.internalOrderCode}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 p-2 bg-gray-50 dark:bg-[#14151a] rounded text-center border border-gray-100 dark:border-gray-800">
                      <div>
                        <div className="text-[10px] text-gray-400">Tiền hàng</div>
                        <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                          {Number(rec.orderItemAmount).toLocaleString('vi-VN')}đ
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400">Dự kiến nhận</div>
                        <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                          {est.toLocaleString('vi-VN')}đ
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400">Đã quyết toán</div>
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {setl > 0 ? `${setl.toLocaleString('vi-VN')}đ` : '---'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800 text-[11px]">
                      <span className="text-gray-400">Chênh lệch:</span>
                      {setl > 0 ? (
                        <span
                          className={`font-semibold ${
                            diff === 0
                              ? 'text-gray-400'
                              : diff > 0
                              ? 'text-emerald-500'
                              : 'text-rose-500'
                          }`}
                        >
                          {diff > 0
                            ? `+${diff.toLocaleString('vi-VN')}đ`
                            : `${diff.toLocaleString('vi-VN')}đ`}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Chưa quyết toán</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {reconTotal > reconLimit && (
              <div className="pt-2">
                <SystemPagination
                  page={reconPage - 1}
                  totalPages={Math.ceil(reconTotal / reconLimit) || 1}
                  totalItems={reconTotal}
                  setPage={(p) => setReconPage(p + 1)}
                  itemsPerPage={reconLimit}
                  setItemsPerPage={(newLimit) => {
                    setReconLimit(newLimit);
                    setReconPage(1);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------- TAB 4: THANH TOÁN NCC & CÔNG NỢ -------------------- */}
      {activeTab === 'SUPPLIERS' && (
        <div className="space-y-3.5 animate-in fade-in duration-200">
          <div className="p-4 sm:p-5 bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Building2 size={18} className="text-[#5865f2]" />
                Thanh toán nhập kho & Công nợ Nhà cung cấp
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Phiếu nhập ghi nhận hàng & nghĩa vụ phải trả; phiếu chi ghi nhận tiền thực tế thanh toán.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/supplier-debts')}
                className="gap-1.5"
                title="Mở toàn bộ sổ công nợ nhà cung cấp"
              >
                <span>Mở Sổ công nợ chi tiết</span>
                <ChevronRight size={13} />
              </Button>
              <Button
                size="sm"
                onClick={() => handleOpenExpense('CHI_NHAP_HANG')}
                className="gap-1.5 bg-[#5865f2] hover:bg-[#4752c4] text-white"
              >
                <Plus size={14} />
                <span>Tạo phiếu thanh toán NCC</span>
              </Button>
            </div>
          </div>

          {/* Top KPI Cards in Suppliers Tab */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 shrink-0">
            <SystemMetricPairCard
              leftItem={{
                title: 'Tổng nợ phải trả NCC',
                value: `${(overview?.outstanding.supplierDebt || 0).toLocaleString('vi-VN')} đ`,
                subtitle: 'Nghĩa vụ phải trả toàn shop',
                icon: Receipt,
                colorScheme: 'red',
                onClick: () => navigate('/supplier-debts'),
              }}
              rightItem={{
                title: 'Ứng trước / Đặt cọc',
                value: `${supplierList.reduce((sum, s) => sum + (s.advanceAmountHeld || 0), 0).toLocaleString('vi-VN')} đ`,
                subtitle: 'NCC đang giữ của shop',
                icon: ArrowDownLeft,
                colorScheme: 'blue',
                onClick: () => navigate('/supplier-debts'),
              }}
            />
          </div>

          {/* Unified Supplier Debts Summary Table */}
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Danh sách công nợ nhà cung cấp ({supplierList.length})
              </h4>
              <span className="text-[11px] text-gray-500">
                Số dư cuối kỳ = Nợ đầu kỳ + Phát sinh phải trả − Giảm trừ trả hàng − Tiền đã trả
              </span>
            </div>
            <SystemTableWrapper tableClassName="min-w-[850px]">
              <SystemThead>
                <SystemTr>
                  <SystemTh className="w-12 text-center">STT</SystemTh>
                  <SystemTh className="w-56">Mã & Nhà Cung Cấp</SystemTh>
                  <SystemTh align="right" className="w-32">Nợ đầu kỳ</SystemTh>
                  <SystemTh align="right" className="w-32">Phát sinh (+)</SystemTh>
                  <SystemTh align="right" className="w-32">Đã trả (-)</SystemTh>
                  <SystemTh align="right" className="w-32">Ứng trước / Dư</SystemTh>
                  <SystemTh align="right" className="w-36">Số dư nợ cuối kỳ</SystemTh>
                  <SystemTh align="center" className="w-28">Trạng thái</SystemTh>
                  <SystemTh align="right" className="w-32">Thao tác</SystemTh>
                </SystemTr>
              </SystemThead>
              <SystemTbody>
                {loadingSuppliers ? (
                  <SystemTableSkeleton rows={3} cols={9} />
                ) : supplierList.length === 0 ? (
                  <SystemTableEmpty title="Chưa có dữ liệu nhà cung cấp nào" description="Chưa có nhà cung cấp nào trong Workspace." colSpan={9} />
                ) : (
                supplierList.map((s, idx) => {
                  const isShopDebt = s.closingDebt > 0;
                  const isSupplierHoldsAdvance = s.closingDebt < 0;

                  return (
                    <SystemTr key={s.id}>
                      <SystemTd align="center" className="text-gray-400 font-mono text-xs">
                        {idx + 1}
                      </SystemTd>
                      <SystemTd>
                        <div className="font-semibold text-gray-900 dark:text-white truncate">
                          {s.name}
                        </div>
                        <div className="text-[11px] font-mono text-gray-500 flex items-center gap-1.5 mt-0.5">
                          <span className="px-1 py-0.2 bg-gray-100 dark:bg-gray-800 rounded font-medium">
                            {s.code}
                          </span>
                          {s.phone && <span>· {s.phone}</span>}
                        </div>
                      </SystemTd>
                      <SystemTd align="right" className="font-mono text-gray-600 dark:text-gray-400">
                        {Number(s.openingDebt || 0).toLocaleString('vi-VN')}đ
                      </SystemTd>
                      <SystemTd align="right" className="font-mono text-gray-700 dark:text-gray-300">
                        +{Number(s.totalPurchases || 0).toLocaleString('vi-VN')}đ
                      </SystemTd>
                      <SystemTd align="right" className="font-mono text-emerald-600 dark:text-emerald-400">
                        -{Number(s.totalPaid || 0).toLocaleString('vi-VN')}đ
                      </SystemTd>
                      <SystemTd align="right" className="font-mono text-blue-600 dark:text-blue-400 font-medium">
                        {Number(s.advanceAmountHeld || 0).toLocaleString('vi-VN')}đ
                      </SystemTd>
                      <SystemTd align="right">
                        <span
                          className={`font-mono font-bold text-xs ${
                            isShopDebt
                              ? 'text-rose-600 dark:text-rose-400'
                              : isSupplierHoldsAdvance
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {isShopDebt ? '+' : ''}
                          {Number(s.closingDebt || 0).toLocaleString('vi-VN')}đ
                        </span>
                      </SystemTd>
                      <SystemTd align="center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            isShopDebt
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                              : isSupplierHoldsAdvance
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          {isShopDebt ? 'Shop nợ NCC' : isSupplierHoldsAdvance ? 'NCC giữ tiền' : 'Cân bằng'}
                        </span>
                      </SystemTd>
                      <SystemTd align="right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate('/supplier-debts')}
                            className="h-7 px-2 text-[11px] text-[#5865f2] hover:bg-[#5865f2]/10"
                            title="Mở sổ công nợ chi tiết"
                          >
                            <span>Chi tiết</span>
                            <ArrowRight size={11} className="ml-1" />
                          </Button>
                        </div>
                      </SystemTd>
                    </SystemTr>
                  );
                })
              )}
            </SystemTbody>
          </SystemTableWrapper>
          </div>

          <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <span className="font-semibold">Quy tắc phân bổ & Chi hộ cá nhân:</span>
            <ul className="list-disc pl-5 mt-1.5 space-y-1">
              <li>Một lần chuyển tiền có thể phân bổ cho một hoặc nhiều phiếu nhập kho hoặc thanh toán nợ đầu kỳ.</li>
              <li>Nếu trả dư tiền hàng (Số dư cuối kỳ âm), phần dư được tự động theo dõi là <b>tiền ứng trước cho nhà cung cấp</b>.</li>
              <li>Nếu dùng tiền cá nhân trả hộ, chọn <i>"Tiền cá nhân chi hộ"</i>: hệ thống ghi nhận shop nợ cá nhân, không trừ quỹ shop, và khi hoàn trả sẽ không tính lại chi phí lần hai.</li>
            </ul>
          </div>
        </div>
      )}

      {/* -------------------- TAB 5: TÀI KHOẢN & QUỸ -------------------- */}
      {activeTab === 'ACCOUNTS' && (
        <div className="space-y-3.5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Landmark size={18} className="text-[#5865f2]" />
                Danh sách tài khoản tiền & số dư
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Quản lý số dư tiền mặt tại két, tài khoản ngân hàng và ví số dư trên sàn Shopee
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTransferModalOpen(true)}
                className="gap-1.5"
              >
                <ArrowLeftRight size={14} className="text-[#5865f2]" />
                <span>Chuyển tiền nội bộ</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setIsAccountModalOpen(true)}
                className="gap-1.5 bg-[#5865f2] hover:bg-[#4752c4] text-white"
              >
                <Plus size={14} />
                <span>Thêm tài khoản mới</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="p-4 sm:p-5 bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 shadow-xs space-y-3.5"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5865f2] dark:text-[#7b85f5]">
                      {acc.type}
                    </span>
                    <h4 className="font-semibold text-base text-gray-900 dark:text-white mt-0.5 truncate">
                      {acc.name}
                    </h4>
                    {acc.accountNumber && (
                      <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">
                        {acc.accountNumber} ({acc.bankName})
                      </p>
                    )}
                  </div>
                  <div className="p-2.5 rounded bg-gray-100 dark:bg-[#1a1b23] text-gray-600 dark:text-gray-400 shrink-0 ml-2">
                    <Landmark size={18} />
                  </div>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-[#1a1b23] rounded">
                  <span className="text-[11px] text-gray-400">Số dư hiện tại:</span>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    {Number(acc.currentBalance).toLocaleString('vi-VN')}đ
                  </div>
                </div>

                {acc.note && <p className="text-xs text-gray-500 italic truncate">{acc.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------- TAB 6: DANH MỤC THU CHI -------------------- */}
      {activeTab === 'CATEGORIES' && (
        <div className="space-y-3.5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Tag size={18} className="text-[#5865f2]" />
                Quản lý danh mục khoản mục thu / chi
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Cho phép thêm, đổi tên hoặc ngừng sử dụng. Khoản mục đã có giao dịch sẽ được bảo toàn lịch sử.
              </p>
            </div>

            <Button
              size="sm"
              onClick={() => setIsCategoryModalOpen(true)}
              className="gap-1.5 bg-[#5865f2] hover:bg-[#4752c4] text-white shrink-0"
            >
              <Plus size={14} />
              <span>Thêm khoản mục</span>
            </Button>
          </div>

          <div className="bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs">
            {/* Desktop Table */}
            <div className="hidden md:block">
              <SystemTableWrapper>
                <SystemThead>
                  <SystemTr>
                    <SystemTh className="w-14 text-center" align="center">STT</SystemTh>
                    <SystemTh>Mã khoản mục</SystemTh>
                    <SystemTh>Tên khoản mục</SystemTh>
                    <SystemTh>Loại nghiệp vụ</SystemTh>
                    <SystemTh>Mô tả / Ví dụ</SystemTh>
                    <SystemTh>Số giao dịch</SystemTh>
                    <SystemTh>Trạng thái</SystemTh>
                    <SystemTh className="text-right">Hành động</SystemTh>
                  </SystemTr>
                </SystemThead>
                <SystemTbody>
                  {categories.map((cat, index) => (
                    <SystemTr key={cat.id}>
                      <SystemTd align="center" className="text-center font-medium text-gray-500 dark:text-gray-400 text-xs">
                        {index + 1}
                      </SystemTd>
                      <SystemTd>
                        <span className="font-mono font-medium text-xs text-gray-800 dark:text-gray-200">
                          {cat.code}
                        </span>
                      </SystemTd>
                      <SystemTd>
                        <span className="font-medium text-xs text-gray-900 dark:text-white">
                          {cat.name}
                        </span>
                      </SystemTd>
                      <SystemTd>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            cat.type === 'INCOME'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : cat.type === 'EXPENSE'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                              : cat.type === 'INTERNAL_TRANSFER'
                              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}
                        >
                          {cat.type === 'INCOME'
                            ? 'Thu tiền'
                            : cat.type === 'EXPENSE'
                            ? 'Chi tiền'
                            : cat.type === 'INTERNAL_TRANSFER'
                            ? 'Chuyển nội bộ'
                            : cat.type === 'CAPITAL'
                            ? 'Vốn chủ shop'
                            : 'Hoàn tiền ứng'}
                        </span>
                      </SystemTd>
                      <SystemTd className="text-xs text-gray-500 max-w-sm">
                        {cat.description || '---'}
                      </SystemTd>
                      <SystemTd className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {cat._count?.transactions || 0}
                      </SystemTd>
                      <SystemTd>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            cat.isActive
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {cat.isActive ? 'Đang dùng' : 'Ngừng dùng'}
                        </span>
                      </SystemTd>
                      <SystemTd className="text-right">
                        {!cat.isSystemDefault && (cat._count?.transactions || 0) === 0 ? (
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await confirmModal({
                                title: 'Xóa khoản mục thu chi',
                                message: `Xác nhận xóa khoản mục "${cat.name}"?`,
                                description: 'Khoản mục này sẽ bị xóa khỏi danh mục phân loại thu chi.',
                                confirmText: 'Xác nhận xóa',
                                variant: 'danger',
                              });
                              if (!ok) return;
                              try {
                                await cashflowApi.deleteCategory(cat.id);
                                toast.success('Đã xóa khoản mục');
                                loadBaseData();
                              } catch (e: any) {
                                toast.error(e?.response?.data?.message || 'Không thể xóa');
                              }
                            }}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <span className="text-[11px] text-gray-400 italic">Cố định</span>
                        )}
                      </SystemTd>
                    </SystemTr>
                  ))}
                </SystemTbody>
              </SystemTableWrapper>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-2.5 p-3 pb-20">
              {categories.map((cat, index) => (
                <div
                  key={cat.id}
                  className="p-3.5 rounded bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 space-y-2 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono text-gray-400">#{index + 1}</span>
                        <span className="font-semibold text-xs text-gray-900 dark:text-white truncate">
                          {cat.name}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-gray-500 block mt-0.5">
                        {cat.code}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        cat.type === 'INCOME'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : cat.type === 'EXPENSE'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                          : cat.type === 'INTERNAL_TRANSFER'
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}
                    >
                      {cat.type === 'INCOME'
                        ? 'Thu tiền'
                        : cat.type === 'EXPENSE'
                        ? 'Chi tiền'
                        : cat.type === 'INTERNAL_TRANSFER'
                        ? 'Chuyển nội bộ'
                        : 'Khác'}
                    </span>
                  </div>

                  {cat.description && (
                    <div className="text-[11px] text-gray-500 italic">
                      {cat.description}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium ${
                          cat.isActive
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {cat.isActive ? 'Đang dùng' : 'Ngừng dùng'}
                      </span>
                      <span>{cat._count?.transactions || 0} giao dịch</span>
                    </div>

                    {!cat.isSystemDefault && (cat._count?.transactions || 0) === 0 ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await confirmModal({
                            title: 'Xóa khoản mục chi',
                            message: `Xác nhận xóa khoản mục "${cat.name}"?`,
                            description: 'Khoản mục này sẽ bị xóa khỏi danh mục phân loại chi phí.',
                            confirmText: 'Xác nhận xóa',
                            variant: 'danger',
                          });
                          if (!ok) return;
                          try {
                            await cashflowApi.deleteCategory(cat.id);
                            toast.success('Đã xóa khoản mục');
                            loadBaseData();
                          } catch (e: any) {
                            toast.error(e?.response?.data?.message || 'Không thể xóa');
                          }
                        }}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors"
                        title="Xóa khoản mục"
                      >
                        <Trash2 size={13} />
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-400 italic">Mặc định</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <CreateTransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        onSuccess={() => {
          loadBaseData();
          if (activeTab === 'TRANSACTIONS') loadTransactions();
        }}
        initialType={txModalType}
        defaultCategoryId={txModalDefaultCategory}
        accounts={accounts}
        categories={categories}
      />

      <InternalTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onSuccess={() => {
          loadBaseData();
          if (activeTab === 'TRANSACTIONS') loadTransactions();
        }}
        accounts={accounts}
      />

      <ImportSettlementModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          loadBaseData();
          if (activeTab === 'RECONCILIATION') loadReconciliation();
        }}
        shops={shops}
        accounts={accounts}
      />

      <CreateAccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        onSuccess={() => loadBaseData()}
        shops={shops}
      />

      <CreateCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSuccess={() => loadBaseData()}
      />
    </div>
  );
};

export default CashflowPage;
