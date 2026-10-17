import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  FileSpreadsheet,
  Plus,
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
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { SystemMetricCard } from '../../components/ui/SystemMetricCard';
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
  { id: 'OVERVIEW', label: 'Tổng quan tiền', icon: TrendingUp },
  { id: 'TRANSACTIONS', label: 'Sổ thu chi', icon: Receipt },
  { id: 'RECONCILIATION', label: 'Đối soát tiền Shopee', icon: ShieldCheck },
  { id: 'SUPPLIERS', label: 'Thanh toán NCC & Công nợ', icon: Building2 },
  { id: 'ACCOUNTS', label: 'Tài khoản & Quỹ', icon: Landmark },
  { id: 'CATEGORIES', label: 'Danh mục thu chi', icon: Tag },
] as const;

export const CashflowPage: React.FC = () => {
  const { selectedShopId: storeShopId, setSelectedShopId: setStoreShopId, shops: storeShops } =
    useWorkspaceStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>('OVERVIEW');
  const [overview, setOverview] = useState<CashflowOverviewModel | null>(null);
  const [accounts, setAccounts] = useState<CashAccountModel[]>([]);
  const [categories, setCategories] = useState<CashCategoryModel[]>([]);
  const [shops, setShops] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Global Filters
  const [selectedShopId, setSelectedShopId] = useState<string>(storeShopId || 'ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

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
      const [ovRes, accRes, catRes, shopRes] = await Promise.all([
        cashflowApi.getOverview({
          shopId: selectedShopId === 'ALL' ? undefined : selectedShopId,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
        cashflowApi.getAccounts(),
        cashflowApi.getCategories(),
        storeShops.length > 0 ? Promise.resolve(storeShops) : shopsApi.findAll(),
      ]);

      setOverview(ovRes);
      setAccounts(accRes || []);
      setCategories(catRes || []);
      setShops(Array.isArray(shopRes) ? shopRes : (shopRes as any)?.data || []);
    } catch (e: any) {
      console.error(e);
      toast.error('Không thể tải dữ liệu sổ quỹ');
    } finally {
      setLoading(false);
    }
  };

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

  const hasGlobalFilter = selectedShopId !== 'ALL' || startDate || endDate;

  return (
    <div className="flex-1 flex flex-col min-h-fit md:min-h-0 space-y-3.5 animate-in fade-in duration-300">
      {/* 1. Top Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-xl font-medium text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2 truncate">
            <Wallet size={18} className="text-[#5865f2] shrink-0 sm:w-5 sm:h-5" />
            <span className="sm:hidden truncate">Thu chi & Quỹ</span>
            <span className="hidden sm:inline truncate">Thu chi & Đối soát tiền</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate hidden sm:block">
            Quản lý dòng tiền, quỹ tiền mặt, ngân hàng, đối soát tiền sàn Shopee và công nợ nhà cung cấp
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button
            size="sm"
            onClick={handleOpenIncome}
            className="gap-1.5 px-2.5 sm:px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
            title="Tạo phiếu thu tiền"
          >
            <ArrowDownLeft size={14} className="stroke-[2.5]" />
            <span className="hidden sm:inline">Thu tiền</span>
            <span className="sm:hidden">Thu</span>
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenExpense()}
            className="gap-1.5 px-2.5 sm:px-3 bg-rose-600 hover:bg-rose-700 text-white"
            title="Tạo phiếu chi tiền"
          >
            <ArrowUpRight size={14} className="stroke-[2.5]" />
            <span className="hidden sm:inline">Chi tiền</span>
            <span className="sm:hidden">Chi</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTransferModalOpen(true)}
            className="gap-1.5 p-2 sm:px-3"
            title="Chuyển tiền giữa các tài khoản & rút tiền Shopee"
          >
            <ArrowLeftRight size={14} className="text-[#5865f2]" />
            <span className="hidden sm:inline">Chuyển quỹ</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            className="gap-1.5 p-2 sm:px-3"
            title="Import file quyết toán Shopee"
          >
            <FileSpreadsheet size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Import đối soát</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadBaseData();
              if (activeTab === 'TRANSACTIONS') loadTransactions();
              if (activeTab === 'RECONCILIATION') loadReconciliation();
            }}
            className="gap-1.5 p-2 lg:px-3"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden lg:inline">Làm mới</span>
          </Button>
        </div>
      </div>

      {/* 2. Top 5 KPI Summary Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3 shrink-0">
        <SystemMetricCard
          title="Tổng số dư khả dụng"
          value={`${(overview?.totals.totalNetBalance || 0).toLocaleString('vi-VN')}đ`}
          subtitle="Tiền mặt, bank & ví sàn"
          icon={Wallet}
          colorScheme="blue"
          isActive={activeTab === 'ACCOUNTS'}
          onClick={() => setActiveTab('ACCOUNTS')}
        />
        <SystemMetricCard
          title="Ví sàn Shopee"
          value={`${(overview?.totals.totalPlatformWallet || 0).toLocaleString('vi-VN')}đ`}
          subtitle="Đã quyết toán về ví"
          icon={TrendingUp}
          colorScheme="purple"
          isActive={activeTab === 'RECONCILIATION'}
          onClick={() => setActiveTab('RECONCILIATION')}
        />
        <SystemMetricCard
          title="Dòng tiền trong kỳ"
          value={`${(overview?.period.netOperatingCashflow || 0).toLocaleString('vi-VN')}đ`}
          subtitle={`Thu: ${(overview?.period.periodIncome || 0).toLocaleString('vi-VN')}đ | Chi: ${(overview?.period.periodExpense || 0).toLocaleString('vi-VN')}đ`}
          icon={DollarSign}
          colorScheme="green"
          isActive={activeTab === 'TRANSACTIONS'}
          onClick={() => setActiveTab('TRANSACTIONS')}
        />
        <SystemMetricCard
          title="Chờ Shopee quyết toán"
          value={`${(overview?.outstanding.pendingPlatformMoney || 0).toLocaleString('vi-VN')}đ`}
          subtitle={`${overview?.outstanding.pendingPlatformCount || 0} đơn đang giao/chờ tiền`}
          icon={ShieldCheck}
          colorScheme="orange"
          isActive={activeTab === 'RECONCILIATION'}
          onClick={() => setActiveTab('RECONCILIATION')}
        />
        <SystemMetricCard
          title="Nợ NCC phải trả"
          value={`${(overview?.outstanding.supplierDebt || 0).toLocaleString('vi-VN')}đ`}
          subtitle={`${overview?.outstanding.unpaidReceiptsCount || 0} phiếu nhập chưa thanh toán`}
          icon={Building2}
          colorScheme="red"
          isActive={activeTab === 'SUPPLIERS'}
          onClick={() => setActiveTab('SUPPLIERS')}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* 3. Main Navigation & Global Filter Bar */}
      <SystemFilter className="p-2.5 sm:p-3 flex-col lg:flex-row items-stretch lg:items-center">
        <SystemFilterItem icon={Activity} label="Phân hệ:" className="w-full lg:w-auto">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5 max-w-full">
            {CASHFLOW_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as ActiveTab)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs whitespace-nowrap transition-colors cursor-pointer border-0 shrink-0 ${
                    isActive
                      ? 'bg-[#5865f2] text-white font-medium shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1a1b23] font-normal'
                  }`}
                >
                  <Icon size={13} className="shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </SystemFilterItem>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto lg:ml-auto">
          {/* Gian hàng Filter */}
          <div className="w-full sm:w-48">
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
              className="w-full"
            />
          </div>

          {/* Date Range Picker */}
          <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 h-8 text-xs w-full sm:w-auto">
            <Calendar size={13} className="text-gray-400 shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-gray-800 dark:text-gray-200 text-xs focus:outline-none font-normal min-w-0"
              title="Từ ngày"
            />
            <span className="text-gray-400 text-xs">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-gray-800 dark:text-gray-200 text-xs focus:outline-none font-normal min-w-0"
              title="Đến ngày"
            />
          </div>

          {hasGlobalFilter && (
            <SystemFilterReset
              onClick={() => {
                setSelectedShopId('ALL');
                setStoreShopId('ALL');
                setStartDate('');
                setEndDate('');
              }}
            />
          )}
        </div>
      </SystemFilter>

      {/* 4. Tab Content */}

      {/* -------------------- TAB 1: TỔNG QUAN TIỀN -------------------- */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-3.5 animate-in fade-in duration-200">
          {/* Quick Expense Shortcut Buttons */}
          <div className="p-3.5 sm:p-4 bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 shadow-xs">
            <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2.5">
              Ghi nhanh khoản chi thường dùng:
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleOpenExpense('CHI_VAT_TU_DONG_GOI')}
                className="px-3 py-1.5 bg-gray-50 dark:bg-[#1a1b23] text-xs font-medium text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 hover:border-[#5865f2] hover:text-[#5865f2] dark:hover:text-white transition-all flex items-center gap-1.5 shadow-none"
              >
                📦 Mua vật tư đóng gói (xốp, băng dính, thùng)
              </button>
              <button
                type="button"
                onClick={() => handleOpenExpense('CHI_GIAY_MUC_IN')}
                className="px-3 py-1.5 bg-gray-50 dark:bg-[#1a1b23] text-xs font-medium text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 hover:border-[#5865f2] hover:text-[#5865f2] dark:hover:text-white transition-all flex items-center gap-1.5 shadow-none"
              >
                🖨️ Giấy in vận đơn & Mực in
              </button>
              <button
                type="button"
                onClick={() => handleOpenExpense('CHI_NHAP_HANG')}
                className="px-3 py-1.5 bg-gray-50 dark:bg-[#1a1b23] text-xs font-medium text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 hover:border-[#5865f2] hover:text-[#5865f2] dark:hover:text-white transition-all flex items-center gap-1.5 shadow-none"
              >
                🚚 Thanh toán tiền nhập hàng NCC
              </button>
              <button
                type="button"
                onClick={() => handleOpenExpense('CHI_VAN_CHUYEN_NGOAI')}
                className="px-3 py-1.5 bg-gray-50 dark:bg-[#1a1b23] text-xs font-medium text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 hover:border-[#5865f2] hover:text-[#5865f2] dark:hover:text-white transition-all flex items-center gap-1.5 shadow-none"
              >
                🛵 Phí xe ba gác, vận chuyển ngoài sàn
              </button>
              <button
                type="button"
                onClick={() => handleOpenExpense('CHI_HOAN_TIEN_KHACH')}
                className="px-3 py-1.5 bg-gray-50 dark:bg-[#1a1b23] text-xs font-medium text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 hover:border-[#5865f2] hover:text-[#5865f2] dark:hover:text-white transition-all flex items-center gap-1.5 shadow-none"
              >
                🤝 Hoàn tiền trực tiếp cho khách
              </button>
            </div>
          </div>

          {/* Accounts Overview Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="p-4 sm:p-5 bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col justify-between"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5865f2] dark:text-[#7b85f5]">
                      {acc.type === 'CASH'
                        ? 'Quỹ tiền mặt'
                        : acc.type === 'PLATFORM_WALLET'
                        ? 'Ví sàn Shopee'
                        : 'Tài khoản ngân hàng'}
                    </span>
                    <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white mt-0.5 truncate">
                      {acc.name}
                    </h3>
                    {acc.accountNumber && (
                      <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">
                        {acc.accountNumber} {acc.bankName ? `(${acc.bankName})` : ''}
                      </p>
                    )}
                  </div>
                  <div className="p-2 rounded bg-gray-100 dark:bg-[#1a1b23] text-gray-600 dark:text-gray-400 shrink-0 ml-2">
                    <Landmark size={18} />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-end justify-between">
                  <div>
                    <span className="text-[11px] text-gray-400">Số dư hiện tại:</span>
                    <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                      {Number(acc.currentBalance).toLocaleString('vi-VN')}đ
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(true)}
                    className="text-xs text-[#5865f2] hover:text-[#4752c4] font-medium flex items-center gap-1 cursor-pointer"
                  >
                    Chuyển tiền <ArrowLeftRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Transactions Table */}
          <div className="bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Receipt size={16} className="text-[#5865f2]" />
                Giao dịch thu chi gần đây
              </h3>
              <button
                type="button"
                onClick={() => setActiveTab('TRANSACTIONS')}
                className="text-xs font-medium text-[#5865f2] hover:underline cursor-pointer"
              >
                Xem tất cả trong sổ thu chi →
              </button>
            </div>

            <SystemTableWrapper>
              <SystemThead>
                <SystemTr>
                  <SystemTh>Mã phiếu</SystemTh>
                  <SystemTh>Ngày</SystemTh>
                  <SystemTh>Khoản mục</SystemTh>
                  <SystemTh>Số tiền</SystemTh>
                  <SystemTh>Tài khoản</SystemTh>
                  <SystemTh>Đối tượng / Ghi chú</SystemTh>
                  <SystemTh>Trạng thái</SystemTh>
                </SystemTr>
              </SystemThead>
              <SystemTbody>
                {(overview?.recentTransactions || []).length === 0 ? (
                  <SystemTableEmpty
                    title="Chưa có giao dịch"
                    description="Chưa có phát sinh giao dịch thu chi nào gần đây."
                    colSpan={7}
                  />
                ) : (
                  (overview?.recentTransactions || []).map((tx) => (
                    <SystemTr key={tx.id}>
                      <SystemTd>
                        <span className="font-mono font-medium text-xs text-gray-900 dark:text-gray-100">
                          {tx.transactionCode}
                        </span>
                      </SystemTd>
                      <SystemTd className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(tx.transactionDate).toLocaleDateString('vi-VN')}
                      </SystemTd>
                      <SystemTd>
                        <span className="font-medium text-xs text-gray-900 dark:text-white">
                          {tx.category?.name || '---'}
                        </span>
                      </SystemTd>
                      <SystemTd className="whitespace-nowrap">
                        <span
                          className={`font-semibold text-xs ${
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
                        {tx.fromAccount?.name || tx.toAccount?.name || 'Tiền cá nhân ứng hộ'}
                      </SystemTd>
                      <SystemTd className="text-xs text-gray-600 dark:text-gray-300 max-w-xs truncate">
                        {tx.counterpartyName && <span className="font-medium">{tx.counterpartyName}: </span>}
                        {tx.note || '---'}
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
                    </SystemTr>
                  ))
                )}
              </SystemTbody>
            </SystemTableWrapper>
          </div>
        </div>
      )}

      {/* -------------------- TAB 2: SỔ THU CHI -------------------- */}
      {activeTab === 'TRANSACTIONS' && (
        <div className="space-y-3.5 animate-in fade-in duration-200">
          {/* Sub Filters */}
          <SystemFilter className="p-2 sm:p-2.5 flex-col sm:flex-row items-stretch sm:items-center">
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

          {/* Transactions Table */}
          <div className="bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs flex-1 flex flex-col">
            <SystemTableWrapper>
              <SystemThead>
                <SystemTr>
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
                  <SystemTableSkeleton rows={8} cols={10} />
                ) : transactions.length === 0 ? (
                  <SystemTableEmpty
                    title="Không có giao dịch nào"
                    description="Không tìm thấy bản ghi thu chi nào phù hợp với bộ lọc hiện tại."
                    colSpan={10}
                  />
                ) : (
                  transactions.map((tx) => (
                    <SystemTr key={tx.id}>
                      <SystemTd>
                        <div className="font-mono font-medium text-xs text-gray-900 dark:text-gray-100">
                          {tx.transactionCode}
                        </div>
                        {tx.referenceCode && (
                          <div className="text-[10px] text-gray-400">UNC: {tx.referenceCode}</div>
                        )}
                      </SystemTd>
                      <SystemTd className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(tx.transactionDate).toLocaleDateString('vi-VN')}
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
                        {tx.fromAccount?.name || tx.toAccount?.name || 'Tiền cá nhân chi hộ'}
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
                  ))
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
                  Nhập file đơn hàng không đồng nghĩa đã thu được tiền. Tiền bán hàng chỉ được ghi nhận khi khớp từ <b>File quyết toán / Thu nhập Shopee</b>. Khi rút tiền về tài khoản ngân hàng, thực hiện <b>Chuyển quỹ nội bộ</b> để tránh tính doanh thu 2 lần!
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="p-3.5 sm:p-4 bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 shadow-xs">
                <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase">
                  1. Giá trị hàng hóa
                </span>
                <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                  {(reconSummary.totalGoodsValue || 0).toLocaleString('vi-VN')}đ
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">Tổng tiền sản phẩm theo đơn</p>
              </div>

              <div className="p-3.5 sm:p-4 bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 shadow-xs">
                <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase">
                  2. Tiền dự kiến nhận
                </span>
                <div className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                  {(reconSummary.totalEstimatedPayout || 0).toLocaleString('vi-VN')}đ
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">Tạm tính trừ các loại phí sàn</p>
              </div>

              <div className="p-3.5 sm:p-4 bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 shadow-xs">
                <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase">
                  3. Tiền đã quyết toán
                </span>
                <div className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {(reconSummary.totalSettledPayout || 0).toLocaleString('vi-VN')}đ
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">Xác nhận từ file quyết toán</p>
              </div>

              <div className="p-3.5 sm:p-4 bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 shadow-xs">
                <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase">
                  4. Điều chỉnh / Hoàn tiền
                </span>
                <div className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                  {(reconSummary.totalAdjustment || 0).toLocaleString('vi-VN')}đ
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">Phát sinh khiếu nại, bồi thường</p>
              </div>
            </div>
          )}

          {/* Filter Bar with Search and Status Pills */}
          <SystemFilter className="p-2 sm:p-2.5 flex-col sm:flex-row items-stretch sm:items-center">
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

          {/* Reconciliation Table */}
          <div className="bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs flex-1 flex flex-col">
            <SystemTableWrapper>
              <SystemThead>
                <SystemTr>
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
                  <SystemTableSkeleton rows={8} cols={8} />
                ) : reconItems.length === 0 ? (
                  <SystemTableEmpty
                    title="Chưa có dữ liệu đối soát"
                    description="Không tìm thấy đơn hàng đối soát nào phù hợp với bộ lọc."
                    colSpan={8}
                  />
                ) : (
                  reconItems.map((rec) => {
                    const est = Number(rec.estimatedPayout || 0);
                    const setl = Number(rec.settledPayout || 0);
                    const diff = setl > 0 ? setl - est : 0;
                    return (
                      <SystemTr key={rec.id}>
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

            <Button
              size="sm"
              onClick={() => handleOpenExpense('CHI_NHAP_HANG')}
              className="gap-1.5 bg-[#5865f2] hover:bg-[#4752c4] text-white shrink-0"
            >
              <Plus size={14} />
              <span>Tạo phiếu thanh toán NCC</span>
            </Button>
          </div>

          <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <span className="font-semibold">Quy tắc phân bổ & Chi hộ cá nhân:</span>
            <ul className="list-disc pl-5 mt-1.5 space-y-1">
              <li>Một lần chuyển tiền có thể phân bổ cho một hoặc nhiều phiếu nhập kho.</li>
              <li>Nếu trả dư tiền hàng, phần dư được tự động theo dõi là <b>tiền ứng trước cho nhà cung cấp</b>.</li>
              <li>Nếu chị Hồng hoặc nhân viên dùng tiền cá nhân trả hộ, chọn <i>"Tiền cá nhân chi hộ"</i>: hệ thống ghi nhận shop nợ chị Hồng, không trừ quỹ shop, và khi hoàn trả sẽ không tính lại chi phí lần hai.</li>
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
            <SystemTableWrapper>
              <SystemThead>
                <SystemTr>
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
                {categories.map((cat) => (
                  <SystemTr key={cat.id}>
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
                            if (window.confirm(`Xác nhận xóa khoản mục ${cat.name}?`)) {
                              try {
                                await cashflowApi.deleteCategory(cat.id);
                                toast.success('Đã xóa khoản mục');
                                loadBaseData();
                              } catch (e: any) {
                                toast.error(e?.response?.data?.message || 'Không thể xóa');
                              }
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
