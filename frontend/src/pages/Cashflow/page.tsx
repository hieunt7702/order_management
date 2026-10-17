import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Landmark,
  Tag,
  Building2,
  Calendar,
  Eye,
  Info,
  DollarSign,
  TrendingUp,
  RefreshCw,
  ShieldCheck,
  Receipt,
  FileText,
  Trash2,
  Check,
  X,
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
} from '../../components/ui/SystemTable';
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

export const CashflowPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('OVERVIEW');
  const [overview, setOverview] = useState<CashflowOverviewModel | null>(null);
  const [accounts, setAccounts] = useState<CashAccountModel[]>([]);
  const [categories, setCategories] = useState<CashCategoryModel[]>([]);
  const [shops, setShops] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedShopId, setSelectedShopId] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Transactions State
  const [transactions, setTransactions] = useState<CashTransactionModel[]>([]);
  const [txTotal, setTxTotal] = useState<number>(0);
  const [txPage, setTxPage] = useState<number>(1);
  const [txFilterType, setTxFilterType] = useState<string>('ALL');
  const [txFilterCategoryId, setTxFilterCategoryId] = useState<string>('ALL');
  const [txFilterAccountId, setTxFilterAccountId] = useState<string>('ALL');
  const [txFilterStatus, setTxFilterStatus] = useState<string>('ALL');
  const [txSearch, setTxSearch] = useState<string>('');

  // Reconciliation State
  const [reconItems, setReconItems] = useState<OrderReconciliationRecordModel[]>([]);
  const [reconSummary, setReconSummary] = useState<any>(null);
  const [reconTotal, setReconTotal] = useState<number>(0);
  const [reconPage, setReconPage] = useState<number>(1);
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
        shopsApi.findAll(),
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

  // Load Transactions when tab changes or filter changes
  useEffect(() => {
    if (activeTab === 'TRANSACTIONS') {
      loadTransactions();
    }
  }, [
    activeTab,
    txPage,
    txFilterType,
    txFilterCategoryId,
    txFilterAccountId,
    txFilterStatus,
    txSearch,
    selectedShopId,
  ]);

  const loadTransactions = async () => {
    try {
      const res = await cashflowApi.getTransactions({
        page: txPage,
        limit: 30,
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
    }
  };

  // Load Reconciliation when tab changes
  useEffect(() => {
    if (activeTab === 'RECONCILIATION') {
      loadReconciliation();
    }
  }, [activeTab, reconPage, reconStatusFilter, reconSearch, selectedShopId]);

  const loadReconciliation = async () => {
    try {
      const res = await cashflowApi.getReconciliation({
        page: reconPage,
        limit: 30,
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
    }
  };

  // Quick Action Buttons
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

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* 1. Header & Quick Mobile Action Bar */}
      <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 p-3 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="p-1.5 sm:p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Wallet className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 flex-1 truncate">
              <h1 className="text-sm sm:text-xl font-bold text-slate-900 dark:text-white truncate">
                <span className="sm:hidden">Thu chi & Quỹ</span>
                <span className="hidden sm:inline">Thu chi & Đối soát tiền</span>
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:block">
                Quỹ tiền mặt, ngân hàng, đối soát tiền sàn Shopee & liên kết công nợ NCC
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Positioned horizontally with title on all screens */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Nút + Thu tiền */}
          <button
            type="button"
            onClick={handleOpenIncome}
            className="h-8 sm:h-9 flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm active:scale-95 transition-all"
            title="Thu tiền"
          >
            <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
            <span>Thu</span>
          </button>

          {/* Nút - Chi tiền */}
          <button
            type="button"
            onClick={() => handleOpenExpense()}
            className="h-8 sm:h-9 flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-sm active:scale-95 transition-all"
            title="Chi tiền"
          >
            <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
            <span>Chi</span>
          </button>

          {/* Nút Chuyển tiền nội bộ */}
          <button
            type="button"
            onClick={() => setIsTransferModalOpen(true)}
            className="h-8 sm:h-9 flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 active:scale-95 transition-all"
            title="Chuyển tiền giữa các tài khoản & rút tiền Shopee"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />
            <span className="hidden sm:inline">Chuyển</span>
          </button>

          {/* Nút Đối soát Shopee */}
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="h-8 sm:h-9 flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm text-indigo-700 dark:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 active:scale-95 transition-all"
            title="Import file quyết toán"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Import</span>
          </button>
        </div>
      </div>

      {/* 2. Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-slate-800 pb-2">
        {[
          { key: 'OVERVIEW', label: 'Tổng quan tiền', icon: TrendingUp },
          { key: 'TRANSACTIONS', label: 'Sổ thu chi', icon: Receipt },
          { key: 'RECONCILIATION', label: 'Đối soát tiền Shopee', icon: ShieldCheck },
          { key: 'SUPPLIERS', label: 'Thanh toán NCC & Công nợ', icon: Building2 },
          { key: 'ACCOUNTS', label: 'Tài khoản & Chuyển tiền', icon: Landmark },
          { key: 'CATEGORIES', label: 'Danh mục thu chi', icon: Tag },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as ActiveTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shrink-0 whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. TAB CONTENT */}

      {/* -------------------- TAB 1: TỔNG QUAN TIỀN -------------------- */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SystemMetricCard
              title="Tổng tiền thực có"
              value={`${(overview?.totals.totalNetBalance || 0).toLocaleString('vi-VN')}đ`}
              subtitle="Toàn bộ quỹ tiền mặt + ngân hàng + ví sàn"
              icon={Wallet}
              colorScheme="purple"
            />
            <SystemMetricCard
              title="Số dư sàn Shopee"
              value={`${(overview?.totals.totalPlatformWallet || 0).toLocaleString('vi-VN')}đ`}
              subtitle="Đã quyết toán, chờ rút về ngân hàng"
              icon={TrendingUp}
              colorScheme="blue"
            />
            <SystemMetricCard
              title="Dòng tiền ròng trong kỳ"
              value={`${(overview?.period.netOperatingCashflow || 0).toLocaleString('vi-VN')}đ`}
              subtitle={`Thu: ${(overview?.period.periodIncome || 0).toLocaleString('vi-VN')}đ | Chi: ${(overview?.period.periodExpense || 0).toLocaleString('vi-VN')}đ`}
              icon={DollarSign}
              colorScheme="green"
            />
            <SystemMetricCard
              title="Nợ nhà cung cấp phải trả"
              value={`${(overview?.outstanding.supplierDebt || 0).toLocaleString('vi-VN')}đ`}
              subtitle={`${overview?.outstanding.unpaidReceiptsCount || 0} phiếu nhập chưa thanh toán`}
              icon={Building2}
              colorScheme="orange"
            />
          </div>

          {/* Quick Expense Shortcut Buttons */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
              Ghi nhanh khoản chi thường dùng:
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleOpenExpense('CHI_VAT_TU_DONG_GOI')}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center gap-1.5 shadow-sm"
              >
                📦 Mua vật tư đóng gói (xốp, băng dính, thùng)
              </button>
              <button
                type="button"
                onClick={() => handleOpenExpense('CHI_GIAY_MUC_IN')}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center gap-1.5 shadow-sm"
              >
                🖨️ Giấy in vận đơn & Mực in
              </button>
              <button
                type="button"
                onClick={() => handleOpenExpense('CHI_NHAP_HANG')}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center gap-1.5 shadow-sm"
              >
                🚚 Thanh toán tiền nhập hàng NCC
              </button>
              <button
                type="button"
                onClick={() => handleOpenExpense('CHI_VAN_CHUYEN_NGOAI')}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center gap-1.5 shadow-sm"
              >
                🛵 Phí xe ba gác, vận chuyển ngoài sàn
              </button>
              <button
                type="button"
                onClick={() => handleOpenExpense('CHI_HOAN_TIEN_KHACH')}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center gap-1.5 shadow-sm"
              >
                🤝 Hoàn tiền trực tiếp cho khách
              </button>
            </div>
          </div>

          {/* Danh mục tài khoản thanh toán */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      {acc.type === 'CASH'
                        ? 'Quỹ tiền mặt'
                        : acc.type === 'PLATFORM_WALLET'
                        ? 'Ví sàn Shopee'
                        : 'Tài khoản ngân hàng'}
                    </span>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white mt-0.5">
                      {acc.name}
                    </h3>
                    {acc.accountNumber && (
                      <p className="text-xs font-mono text-slate-500">{acc.accountNumber}</p>
                    )}
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <Landmark className="w-5 h-5" />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-end justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400">Số dư hiện tại:</span>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">
                      {Number(acc.currentBalance).toLocaleString('vi-VN')}đ
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTransferModalOpen(true);
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
                  >
                    Chuyển tiền <ArrowLeftRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Giao dịch gần nhất */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-500" />
                Giao dịch thu chi gần đây
              </h3>
              <button
                type="button"
                onClick={() => setActiveTab('TRANSACTIONS')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
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
                {(overview?.recentTransactions || []).map((tx) => (
                  <SystemTr key={tx.id}>
                    <SystemTd>
                      <span className="font-mono font-semibold text-xs text-slate-700 dark:text-slate-300">
                        {tx.transactionCode}
                      </span>
                    </SystemTd>
                    <SystemTd className="text-xs text-slate-500">
                      {new Date(tx.transactionDate).toLocaleDateString('vi-VN')}
                    </SystemTd>
                    <SystemTd>
                      <span className="font-medium text-xs text-slate-900 dark:text-white">
                        {tx.category?.name || '---'}
                      </span>
                    </SystemTd>
                    <SystemTd>
                      <span
                        className={`font-bold text-xs ${
                          tx.type === 'INCOME'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : tx.type === 'EXPENSE'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-indigo-600 dark:text-indigo-400'
                        }`}
                      >
                        {tx.type === 'INCOME' ? '+' : tx.type === 'EXPENSE' ? '−' : ''}
                        {Number(tx.amount).toLocaleString('vi-VN')}đ
                      </span>
                    </SystemTd>
                    <SystemTd className="text-xs text-slate-600 dark:text-slate-300">
                      {tx.fromAccount?.name || tx.toAccount?.name || 'Tiền cá nhân ứng hộ'}
                    </SystemTd>
                    <SystemTd className="text-xs text-slate-600 dark:text-slate-300 max-w-xs truncate">
                      {tx.counterpartyName && <span className="font-semibold">{tx.counterpartyName}: </span>}
                      {tx.note || '---'}
                    </SystemTd>
                    <SystemTd>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                          tx.status === 'CONFIRMED'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : tx.status === 'DRAFT'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
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
                ))}
              </SystemTbody>
            </SystemTableWrapper>
          </div>
        </div>
      )}

      {/* -------------------- TAB 2: SỔ THU CHI -------------------- */}
      {activeTab === 'TRANSACTIONS' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div>
                <input
                  type="text"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder="Tìm mã phiếu, UNC, tên đối tượng..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <select
                  value={txFilterType}
                  onChange={(e) => setTxFilterType(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none"
                >
                  <option value="ALL">-- Tất cả loại --</option>
                  <option value="EXPENSE">Khoản chi</option>
                  <option value="INCOME">Khoản thu</option>
                  <option value="INTERNAL_TRANSFER">Chuyển nội bộ</option>
                  <option value="REIMBURSEMENT">Hoàn tiền ứng</option>
                  <option value="CAPITAL_IN">Góp vốn</option>
                </select>
              </div>

              <div>
                <select
                  value={txFilterCategoryId}
                  onChange={(e) => setTxFilterCategoryId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none"
                >
                  <option value="ALL">-- Tất cả khoản mục --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={txFilterAccountId}
                  onChange={(e) => setTxFilterAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none"
                >
                  <option value="ALL">-- Tất cả tài khoản --</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={txFilterStatus}
                  onChange={(e) => setTxFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none"
                >
                  <option value="ALL">-- Tất cả trạng thái --</option>
                  <option value="CONFIRMED">Đã xác nhận</option>
                  <option value="DRAFT">Lưu nháp</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
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
                {transactions.map((tx) => (
                  <SystemTr key={tx.id}>
                    <SystemTd>
                      <div className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                        {tx.transactionCode}
                      </div>
                      {tx.referenceCode && (
                        <div className="text-[10px] text-slate-400">UNC: {tx.referenceCode}</div>
                      )}
                    </SystemTd>
                    <SystemTd className="text-xs text-slate-500 whitespace-nowrap">
                      {new Date(tx.transactionDate).toLocaleDateString('vi-VN')}
                    </SystemTd>
                    <SystemTd>
                      <div className="font-medium text-xs text-slate-900 dark:text-white">
                        {tx.category?.name || '---'}
                      </div>
                      {tx.note && <div className="text-[11px] text-slate-400 max-w-xs truncate">{tx.note}</div>}
                    </SystemTd>
                    <SystemTd className="whitespace-nowrap">
                      <span
                        className={`font-bold text-sm ${
                          tx.type === 'INCOME'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : tx.type === 'EXPENSE'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-indigo-600 dark:text-indigo-400'
                        }`}
                      >
                        {tx.type === 'INCOME' ? '+' : tx.type === 'EXPENSE' ? '−' : ''}
                        {Number(tx.amount).toLocaleString('vi-VN')}đ
                      </span>
                    </SystemTd>
                    <SystemTd className="text-xs text-slate-600 dark:text-slate-300">
                      {tx.fromAccount?.name || tx.toAccount?.name || 'Tiền cá nhân chi hộ'}
                    </SystemTd>
                    <SystemTd className="text-xs text-slate-700 dark:text-slate-300">
                      {tx.counterpartyName || '---'}
                    </SystemTd>
                    <SystemTd className="text-xs text-slate-500">
                      {tx.performedByName || '---'}
                    </SystemTd>
                    <SystemTd className="text-xs text-slate-500">
                      {tx.isCommonExpense ? (
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-medium">
                          Chi chung
                        </span>
                      ) : (
                        tx.shop?.name || '---'
                      )}
                    </SystemTd>
                    <SystemTd>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                          tx.status === 'CONFIRMED'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : tx.status === 'DRAFT'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
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
                      <div className="flex items-center justify-end gap-1.5">
                        {tx.status === 'DRAFT' && (
                          <button
                            type="button"
                            onClick={() => handleConfirmTx(tx.id)}
                            className="p-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg"
                            title="Xác nhận phiếu nháp này"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        {tx.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            onClick={() => handleCancelTx(tx.id)}
                            className="p-1.5 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                            title="Hủy phiếu (hoàn trả số dư)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {tx.voucherImage && (
                          <a
                            href={tx.voucherImage}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            title="Xem ảnh chứng từ"
                          >
                            <Eye className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </SystemTd>
                  </SystemTr>
                ))}
              </SystemTbody>
            </SystemTableWrapper>
          </div>
        </div>
      )}

      {/* -------------------- TAB 3: ĐỐI SOÁT TIỀN SHOPEE -------------------- */}
      {activeTab === 'RECONCILIATION' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Important Rules Alert */}
          <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-indigo-950 dark:text-indigo-200">
                  Quy tắc đối soát tiền đơn hàng Shopee
                </h4>
                <p className="text-xs text-indigo-800 dark:text-indigo-300 mt-1 leading-relaxed">
                  Nhập file đơn hàng không đồng nghĩa đã thu được tiền. Tiền bán hàng chỉ được ghi nhận
                  khi khớp từ <b>File quyết toán / Thu nhập Shopee</b>. Khi rút tiền về tài khoản ngân
                  hàng (MB Bank), thực hiện <b>Chuyển tiền nội bộ</b> để tránh tính doanh thu 2 lần!
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto">
              <button
                type="button"
                onClick={handleSyncOrders}
                className="flex-1 md:flex-none px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Đồng bộ đơn mới</span>
                <span className="lg:hidden">Đồng bộ</span>
              </button>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="flex-1 md:flex-none px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-md transition-colors flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Import File Quyết Toán
              </button>
            </div>
          </div>

          {/* 4 Financial Columns Metric Overview */}
          {reconSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 uppercase">
                  1. Giá trị hàng hóa
                </span>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {(reconSummary.totalGoodsValue || 0).toLocaleString('vi-VN')}đ
                </div>
                <p className="text-[11px] text-slate-500">Tổng tiền sản phẩm theo đơn</p>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 uppercase">
                  2. Tiền dự kiến nhận
                </span>
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                  {(reconSummary.totalEstimatedPayout || 0).toLocaleString('vi-VN')}đ
                </div>
                <p className="text-[11px] text-slate-500">Tạm tính trừ các loại phí sàn</p>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 uppercase">
                  3. Tiền đã quyết toán
                </span>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {(reconSummary.totalSettledPayout || 0).toLocaleString('vi-VN')}đ
                </div>
                <p className="text-[11px] text-slate-500">Xác nhận từ file quyết toán</p>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 uppercase">
                  4. Điều chỉnh / Hoàn tiền
                </span>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                  {(reconSummary.totalAdjustment || 0).toLocaleString('vi-VN')}đ
                </div>
                <p className="text-[11px] text-slate-500">Phát sinh khiếu nại, bồi thường</p>
              </div>
            </div>
          )}

          {/* Filter Status & Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={reconSearch}
                onChange={(e) => setReconSearch(e.target.value)}
                placeholder="Tìm mã đơn Shopee (Order SN), mã vận đơn..."
                className="px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 w-72 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
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
                  onClick={() => setReconStatusFilter(s.key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    reconStatusFilter === s.key
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reconciliation Table with 4 Essential Financial Columns */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
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
                {reconItems.map((rec) => {
                  const est = Number(rec.estimatedPayout || 0);
                  const setl = Number(rec.settledPayout || 0);
                  const diff = setl > 0 ? setl - est : 0;
                  return (
                    <SystemTr key={rec.id}>
                      <SystemTd>
                        <div className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                          {rec.externalOrderId}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Mã nội bộ: {rec.order?.internalOrderCode}
                        </div>
                      </SystemTd>
                      <SystemTd className="text-xs text-slate-600 dark:text-slate-300">
                        {rec.shop?.name}
                      </SystemTd>
                      <SystemTd className="text-xs font-medium text-slate-700 dark:text-slate-300">
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
                          <span className={diff === 0 ? 'text-slate-400' : diff > 0 ? 'text-emerald-500' : 'text-rose-500'}>
                            {diff > 0 ? `+${diff.toLocaleString('vi-VN')}đ` : `${diff.toLocaleString('vi-VN')}đ`}
                          </span>
                        ) : (
                          '---'
                        )}
                      </SystemTd>
                      <SystemTd>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            rec.reconciliationStatus === 'MATCHED'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : rec.reconciliationStatus === 'NEEDS_CHECK'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                              : rec.reconciliationStatus === 'UNMATCHED'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
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
                })}
              </SystemTbody>
            </SystemTableWrapper>
          </div>
        </div>
      )}

      {/* -------------------- TAB 4: THANH TOÁN NCC & CÔNG NỢ -------------------- */}
      {activeTab === 'SUPPLIERS' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-500" />
                Thanh toán nhập kho & Công nợ Nhà cung cấp
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Phiếu nhập ghi nhận hàng & nghĩa vụ phải trả; phiếu chi ghi nhận tiền thực tế thanh toán.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleOpenExpense('CHI_NHAP_HANG')}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Tạo phiếu thanh toán NCC
            </button>
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
            <span className="font-bold">Quy tắc phân bổ & Chi hộ cá nhân:</span>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Một lần chuyển tiền có thể phân bổ cho một hoặc nhiều phiếu nhập kho.</li>
              <li>Nếu trả dư tiền hàng, phần dư được tự động theo dõi là <b>tiền ứng trước cho nhà cung cấp</b>.</li>
              <li>Nếu chị Hồng hoặc nhân viên dùng tiền cá nhân trả hộ, chọn <i>"Tiền cá nhân chi hộ"</i>: hệ thống ghi nhận shop nợ chị Hồng, không trừ quỹ shop, và khi hoàn trả sẽ không tính lại chi phí lần hai.</li>
            </ul>
          </div>
        </div>
      )}

      {/* -------------------- TAB 5: TÀI KHOẢN & CHUYỂN TIỀN -------------------- */}
      {activeTab === 'ACCOUNTS' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Landmark className="w-5 h-5 text-indigo-500" />
              Danh sách tài khoản tiền & số dư
            </h3>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(true)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-all flex items-center gap-1.5"
              >
                <ArrowLeftRight className="w-4 h-4 text-indigo-500" />
                Chuyển tiền nội bộ
              </button>
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(true)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Thêm tài khoản mới
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      {acc.type}
                    </span>
                    <h4 className="font-bold text-base text-slate-900 dark:text-white mt-0.5">
                      {acc.name}
                    </h4>
                    {acc.accountNumber && (
                      <p className="text-xs font-mono text-slate-500">{acc.accountNumber} ({acc.bankName})</p>
                    )}
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600">
                    <Landmark className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <span className="text-[11px] text-slate-400">Số dư hiện tại:</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {Number(acc.currentBalance).toLocaleString('vi-VN')}đ
                  </div>
                </div>

                {acc.note && <p className="text-xs text-slate-500 italic">{acc.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------- TAB 6: DANH MỤC THU CHI -------------------- */}
      {activeTab === 'CATEGORIES' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-indigo-500" />
                Quản lý danh mục khoản mục thu / chi
              </h3>
              <p className="text-xs text-slate-500">
                Cho phép thêm, đổi tên hoặc ngừng sử dụng. Khoản mục đã có giao dịch sẽ được bảo toàn lịch sử.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Thêm khoản mục
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
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
                      <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                        {cat.code}
                      </span>
                    </SystemTd>
                    <SystemTd>
                      <span className="font-semibold text-xs text-slate-900 dark:text-white">
                        {cat.name}
                      </span>
                    </SystemTd>
                    <SystemTd>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
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
                    <SystemTd className="text-xs text-slate-500 max-w-sm">
                      {cat.description || '---'}
                    </SystemTd>
                    <SystemTd className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {cat._count?.transactions || 0}
                    </SystemTd>
                    <SystemTd>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                          cat.isActive
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-400'
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
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Cố định</span>
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
