import React, { useState, useEffect, useCallback } from 'react';
import {
  Landmark,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  RefreshCw,
  Search,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  Ban,
  Tag,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building2,
  FileText,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
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
  cashflowApi,
  CashAccountModel,
  CashTransactionModel,
} from '../../services/cashflowApi';
import { toast } from '../../components/ui/Toast';

interface AccountTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string | null;
  onOpenDepositModal: (accountId?: string) => void;
  onOpenTransferModal?: (accountId?: string) => void;
  accounts: CashAccountModel[];
}

export const AccountTransactionsModal: React.FC<AccountTransactionsModalProps> = ({
  isOpen,
  onClose,
  accountId,
  onOpenDepositModal,
  onOpenTransferModal,
  accounts,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [transactions, setTransactions] = useState<CashTransactionModel[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);

  // Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [accountSummary, setAccountSummary] = useState<any>(null);

  // Sync selected account
  useEffect(() => {
    if (isOpen) {
      if (accountId) {
        setSelectedAccountId(accountId);
      } else if (accounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accounts[0].id);
      }
      setPage(1);
    }
  }, [isOpen, accountId, accounts]);

  const activeAccount = accounts.find((a) => a.id === selectedAccountId);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    try {
      const params: any = {
        page,
        limit,
      };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (search.trim()) params.search = search.trim();
      if (typeFilter !== 'ALL') {
        params.type = typeFilter;
      }

      const res = await cashflowApi.getAccountTransactions(selectedAccountId, params);
      setTransactions(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
      if (res.accountSummary) {
        setAccountSummary(res.accountSummary);
      }
    } catch (err: any) {
      console.error('Lỗi tải lịch sử giao dịch tài khoản:', err);
      toast.error('Không thể tải lịch sử giao dịch');
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, page, limit, startDate, endDate, typeFilter, search]);

  useEffect(() => {
    if (isOpen && selectedAccountId) {
      fetchTransactions();
    }
  }, [isOpen, selectedAccountId, fetchTransactions]);

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setTypeFilter('ALL');
    setSearch('');
    setPage(1);
  };

  const currentBal = Number(activeAccount?.currentBalance ?? accountSummary?.account?.currentBalance ?? 0);
  const totalIn = Number(accountSummary?.totalInflow || 0);
  const totalOut = Number(accountSummary?.totalOutflow || 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      maxWidth="w-[96vw] max-w-[1400px] xl:max-w-[1440px]"
      icon={activeAccount?.type === 'BANK' ? Landmark : Wallet}
      title={
        <div className="flex items-center gap-2">
          <span className="font-semibold text-base sm:text-lg text-gray-900 dark:text-white">
            Lịch sử giao dịch & nạp rút tiền
          </span>
          {activeAccount && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              {activeAccount.type === 'CASH'
                ? 'Tiền mặt'
                : activeAccount.type === 'PLATFORM_WALLET'
                ? 'Ví Shopee'
                : activeAccount.bankName || 'Ngân hàng'}
            </span>
          )}
        </div>
      }
      subtitle="Xem toàn bộ các lần nạp tiền, rút tiền, thanh toán và biến động số dư luỹ kế"
      headerRight={
        <div className="flex items-center gap-2">
          {/* Quick Deposit button */}
          <Button
            size="sm"
            onClick={() => {
              onOpenDepositModal(selectedAccountId);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-medium shadow-xs text-xs h-8"
          >
            <ArrowDownLeft size={14} />
            <span className="hidden sm:inline">Nạp tiền vào quỹ</span>
            <span className="sm:hidden">Nạp quỹ</span>
          </Button>

          {/* Quick Transfer button */}
          {onOpenTransferModal && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenTransferModal(selectedAccountId);
              }}
              className="gap-1.5 text-xs h-8"
            >
              <ArrowLeftRight size={13} className="text-[#5865f2]" />
              <span className="hidden sm:inline">Chuyển tiền</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={fetchTransactions}
            disabled={loading}
            className="p-1.5 h-8 w-8"
            title="Làm mới"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      }
    >

      <ModalBody className="p-4 sm:p-5 space-y-4">
        {/* Account Metrics Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card 1: Số dư hiện tại */}
          <div
            className={`p-3.5 rounded-lg border flex items-center justify-between transition-colors ${
              currentBal < 0
                ? 'bg-rose-500/10 border-rose-500/25 dark:bg-rose-950/20 dark:border-rose-800/40'
                : 'bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-950/20 dark:border-emerald-800/30'
            }`}
          >
            <div>
              <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                Số dư tài khoản hiện tại
              </div>
              <div
                className={`text-lg sm:text-xl font-bold mt-0.5 ${
                  currentBal < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {currentBal.toLocaleString('vi-VN')} đ
              </div>
              {currentBal < 0 && (
                <div className="text-[10px] text-rose-500 dark:text-rose-400 mt-0.5 font-medium flex items-center gap-1">
                  <AlertCircle size={11} />
                  <span>Quỹ âm (Cần nạp bù)</span>
                </div>
              )}
            </div>
            <div
              className={`p-2 rounded-full shrink-0 ${
                currentBal < 0
                  ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                  : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              <Wallet size={18} />
            </div>
          </div>

          {/* Card 2: Tổng nạp / Thu */}
          <div className="p-3.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-[#1a1b23] flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                Tổng tiền nạp vào / Thu (+)
              </div>
              <div className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                +{totalIn.toLocaleString('vi-VN')} đ
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                Số dư tăng qua các giao dịch
              </div>
            </div>
            <div className="p-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <TrendingUp size={18} />
            </div>
          </div>

          {/* Card 3: Tổng rút / Chi */}
          <div className="p-3.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-[#1a1b23] flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                Tổng tiền rút ra / Chi (-)
              </div>
              <div className="text-lg sm:text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                -{totalOut.toLocaleString('vi-VN')} đ
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                Số dư giảm qua các giao dịch
              </div>
            </div>
            <div className="p-2 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
              <TrendingDown size={18} />
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-3 bg-gray-50 dark:bg-[#1a1b23] rounded-lg border border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
            {/* Search */}
            <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Tìm mã GD, người nộp/nhận..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded focus:outline-none focus:border-[#5865f2] text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>

            {/* Type Filter */}
            <div className="w-[180px]">
              <Select
                value={typeFilter}
                onChange={(val) => {
                  setTypeFilter(String(val || 'ALL'));
                  setPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'Tất cả nghiệp vụ' },
                  { value: 'INCOME', label: 'Tiền nạp & Thu (+)' },
                  { value: 'CAPITAL_IN', label: 'Góp vốn kinh doanh (+)' },
                  { value: 'EXPENSE', label: 'Tiền rút & Chi (-)' },
                  { value: 'CAPITAL_OUT', label: 'Rút vốn (-)' },
                  { value: 'INTERNAL_TRANSFER', label: 'Chuyển tiền nội bộ' },
                ]}
                placeholder="Tất cả nghiệp vụ"
                size="sm"
              />
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="px-2 py-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded text-xs text-gray-900 dark:text-white"
                title="Từ ngày"
              />
              <span>-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="px-2 py-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded text-xs text-gray-900 dark:text-white"
                title="Đến ngày"
              />
            </div>
          </div>

          {(startDate || endDate || search || typeFilter !== 'ALL') && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer underline"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        {/* Transactions Table */}
        <SystemTableWrapper tableClassName="w-full min-w-[1100px] text-xs">
          <SystemThead>
            <SystemTh className="w-44">Mã GD / Thời gian</SystemTh>
            <SystemTh className="w-40">Loại nghiệp vụ</SystemTh>
            <SystemTh className="min-w-[200px]">Khoản mục / Ghi chú</SystemTh>
            <SystemTh className="w-36 text-right" align="right">Số dư trước</SystemTh>
            <SystemTh className="w-36 text-right" align="right">Số tiền biến động</SystemTh>
            <SystemTh className="w-36 text-right" align="right">Số dư sau</SystemTh>
            <SystemTh className="w-44">Người nộp / nhận</SystemTh>
            <SystemTh className="w-28 text-center" align="center">Trạng thái</SystemTh>
          </SystemThead>
          <SystemTbody>
            {loading ? (
              <SystemTableSkeleton cols={8} rows={5} />
            ) : transactions.length === 0 ? (
              <SystemTableEmpty
                colSpan={8}
                title="Chưa có giao dịch"
                description="Chưa có giao dịch nạp rút nào được ghi nhận cho tài khoản này"
              />
            ) : (
              transactions.map((tx) => {
                const isInflow =
                  tx.toAccountId === selectedAccountId ||
                  tx.type === 'INCOME' ||
                  tx.type === 'CAPITAL_IN';
                const isOutflow =
                  tx.fromAccountId === selectedAccountId ||
                  tx.type === 'EXPENSE' ||
                  tx.type === 'CAPITAL_OUT';
                const isTransfer = tx.type === 'INTERNAL_TRANSFER';

                const balBefore = Number(tx.balanceBefore || 0);
                const balAfter = Number(tx.balanceAfter || 0);

                return (
                  <SystemTr key={tx.id}>
                    {/* 1. Mã GD & Thời gian */}
                    <SystemTd className="w-44">
                      <div className="font-mono font-medium text-gray-900 dark:text-white">
                        {tx.transactionCode}
                      </div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                        <Clock size={11} />
                        <span>
                          {new Date(tx.transactionDate).toLocaleDateString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </SystemTd>

                    {/* 2. Loại nghiệp vụ */}
                    <SystemTd className="w-40">
                      {tx.type === 'CAPITAL_IN' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <ArrowDownLeft size={11} />
                          Góp vốn / Nạp quỹ
                        </span>
                      ) : tx.type === 'CAPITAL_OUT' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400">
                          <ArrowUpRight size={11} />
                          Rút vốn
                        </span>
                      ) : tx.type === 'INCOME' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <ArrowDownLeft size={11} />
                          Nạp tiền / Thu
                        </span>
                      ) : tx.type === 'EXPENSE' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400">
                          <ArrowUpRight size={11} />
                          Chi tiền / Rút
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                          <ArrowLeftRight size={11} />
                          Chuyển nội bộ
                        </span>
                      )}
                    </SystemTd>

                    {/* 3. Khoản mục & Ghi chú */}
                    <SystemTd className="min-w-[200px]">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {tx.category?.name || 'Khoản mục thu chi'}
                      </div>
                      {tx.note && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5 italic">
                          {tx.note}
                        </div>
                      )}
                      {tx.referenceCode && (
                        <div className="text-[10px] font-mono text-gray-400 mt-0.5">
                          Mã UNC: {tx.referenceCode}
                        </div>
                      )}
                    </SystemTd>

                    {/* 4. Số dư trước GD */}
                    <SystemTd className="w-36 text-right font-mono text-gray-500">
                      {balBefore.toLocaleString('vi-VN')} đ
                    </SystemTd>

                    {/* 5. Biến động */}
                    <SystemTd className="w-36 text-right">
                      <span
                        className={`font-mono font-bold text-sm ${
                          isInflow
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isInflow ? '+' : '-'}
                        {Number(tx.amount).toLocaleString('vi-VN')} đ
                      </span>
                    </SystemTd>

                    {/* 6. Số dư sau GD */}
                    <SystemTd className="w-36 text-right">
                      <span
                        className={`font-mono font-bold ${
                          balAfter < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {balAfter.toLocaleString('vi-VN')} đ
                      </span>
                    </SystemTd>

                    {/* 7. Người nộp / nhận */}
                    <SystemTd className="w-44 text-gray-600 dark:text-gray-300">
                      <div className="truncate" title={tx.counterpartyName || tx.performedByName || '---'}>
                        {tx.counterpartyName || tx.performedByName || '---'}
                      </div>
                    </SystemTd>

                    {/* 8. Trạng thái */}
                    <SystemTd className="w-28 text-center">
                      {tx.status === 'CONFIRMED' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={10} />
                          Đã xác nhận
                        </span>
                      ) : tx.status === 'DRAFT' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          <Clock size={10} />
                          Nháp
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-500/10 text-gray-500">
                          <Ban size={10} />
                          Đã hủy
                        </span>
                      )}
                    </SystemTd>
                  </SystemTr>
                );
              })
            )}
          </SystemTbody>
        </SystemTableWrapper>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pt-2">
            <SystemPagination
              page={page}
              totalPages={totalPages}
              totalItems={total}
              itemsPerPage={limit}
              onLimitChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
              onPageChange={setPage}
            />
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <ModalButton variant="secondary" onClick={onClose}>
          Đóng
        </ModalButton>
      </ModalFooter>
    </Modal>
  );
};
