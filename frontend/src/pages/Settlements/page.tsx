import React, { useState, useEffect } from 'react';
import {
  Receipt,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Search,
  RefreshCw,
  CreditCard,
  Store,
  Percent,
  Clock,
  ShieldCheck,
  Calendar,
  SlidersHorizontal,
  X,
  MoreHorizontal,
  Eye,
} from 'lucide-react';
import { settlementsApi } from '../../services/settlementsApi';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { formatCurrency } from '../../utils';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import { Select } from '../../components/ui/Select';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../../components/ui/DropdownMenu';
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
import { toast } from '../../components/ui/Toast';

export const SettlementsPage: React.FC = () => {
  const { selectedShopId } = useWorkspaceStore();

  const [settlements, setSettlements] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  // Modal
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);
  const [selectedSettlement, setSelectedSettlement] = useState<any>(null);

  const [recordForm, setRecordForm] = useState({
    orderId: '',
    actualAmount: 0,
    payoutDate: new Date().toISOString().split('T')[0],
    referenceCode: '',
    note: '',
  });

  useEffect(() => {
    loadSettlements();
  }, [selectedShopId, statusFilter, page, limit]);

  const loadSettlements = async () => {
    setIsLoading(true);
    try {
      const res: any = await settlementsApi.findAll({
        page,
        limit,
        shopId: selectedShopId !== 'ALL' ? selectedShopId : undefined,
      });
      const items = res?.items || res?.data || (Array.isArray(res) ? res : []);
      const total = res?.total ?? items.length;
      setSettlements(items);
      setTotalCount(total);
    } catch (err) {
      console.error('Error loading settlements:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenRecordModal = (item: any) => {
    setSelectedSettlement(item);
    setRecordForm({
      orderId: item.orderId || item.id,
      actualAmount: item.expectedAmount || item.netAmount || 0,
      payoutDate: new Date().toISOString().split('T')[0],
      referenceCode: '',
      note: '',
    });
    setIsRecordModalOpen(true);
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordForm.orderId || recordForm.actualAmount <= 0) {
      toast.warning('Vui lòng nhập mã đơn và số tiền thực nhận lớn hơn 0');
      return;
    }
    try {
      await settlementsApi.recordSettlement({
        orderId: recordForm.orderId,
        actualAmount: Number(recordForm.actualAmount),
        payoutDate: new Date(recordForm.payoutDate).toISOString(),
        referenceCode: recordForm.referenceCode || undefined,
        note: recordForm.note || undefined,
      });
      setIsRecordModalOpen(false);
      loadSettlements();
      toast.success('Ghi nhận đối soát tiền về thành công!');
    } catch (err: any) {
      toast.error('Lỗi ghi nhận đối soát', err.message);
    }
  };

  // Aggregated metrics from list
  const totalGmv = settlements.reduce(
    (acc, s) => acc + (s.grossAmount || s.order?.totalAmount || 0),
    0,
  );
  const totalFees = settlements.reduce((acc, s) => acc + (s.platformFees || 0), 0);
  const totalExpected = settlements.reduce(
    (acc, s) => acc + (s.expectedAmount || s.netAmount || 0),
    0,
  );
  const totalActual = settlements.reduce((acc, s) => acc + (s.actualAmount || 0), 0);

  const filteredSettlements = settlements.filter((s) => {
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const orderSn = (s.order?.externalOrderId || s.order?.internalOrderCode || s.orderId || '').toLowerCase();
      const refCode = (s.referenceCode || '').toLowerCase();
      return orderSn.includes(term) || refCode.includes(term);
    }
    return true;
  });

  // Data is already paginated by backend per (page, limit)
  const paginatedSettlements = filteredSettlements;

  return (
    <div className="flex-1 flex flex-col min-h-fit md:min-h-0 space-y-3.5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-xl font-medium text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2 truncate">
            <Receipt size={18} className="text-[#5865f2] shrink-0 sm:w-5 sm:h-5" />
            <span className="truncate">Đối soát tài chính</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate hidden sm:block">
            Tách biệt xác minh hàng thực tế và đối soát tiền thực nhận từ sàn Shopee
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadSettlements}
          className="h-8 w-8 sm:w-auto p-0 sm:px-2.5 sm:py-1 gap-1 text-xs shrink-0"
          title="Làm mới dữ liệu"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span className="hidden lg:inline text-xs">Làm mới</span>
        </Button>
      </div>

      {/* Summary KPI Cards matching Orders page */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 shrink-0">
        <SystemMetricPairCard
          leftItem={{
            title: 'Doanh thu Shopee (GMV)',
            value: formatCurrency(totalGmv),
            subtitle: 'Tổng tiền đơn hàng',
            icon: Receipt,
            colorScheme: 'blue',
          }}
          rightItem={{
            title: 'Phí sàn khấu trừ',
            value: formatCurrency(totalFees),
            subtitle: 'Phí dịch vụ & thanh toán',
            icon: AlertCircle,
            colorScheme: 'red',
          }}
        />
        <SystemMetricPairCard
          leftItem={{
            title: 'Dự kiến nhận (Shopee)',
            value: formatCurrency(totalExpected),
            subtitle: 'Doanh thu ước tính',
            icon: DollarSign,
            colorScheme: 'purple',
          }}
          rightItem={{
            title: 'Thực nhận ngân hàng',
            value: formatCurrency(totalActual),
            subtitle: 'Đã về tài khoản',
            icon: CheckCircle,
            colorScheme: 'green',
          }}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded shrink-0">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo mã đơn hàng Shopee, mã tham chiếu ngân hàng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-4 py-1.5 h-8 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
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
              { value: 'ALL', label: 'Tất cả trạng thái', icon: ShieldCheck },
              { value: 'PENDING', label: 'Chờ tiền về (Pending)', icon: Clock },
              { value: 'COMPLETED', label: 'Đã khớp tiền (Completed)', icon: CheckCircle },
              { value: 'DISCREPANCY', label: 'Lệch đối soát (Discrepancy)', icon: AlertCircle },
            ]}
            icon={ShieldCheck}
            size="sm"
            className="w-full sm:w-56"
            menuWidth="w-60"
          />
        </div>
      </div>

      {/* Settlements Desktop Table */}
      <div className="hidden md:flex flex-1 flex-col min-h-fit md:min-h-0">
        <SystemTableWrapper
          tableClassName="min-w-[1050px]"
          pagination={
            <SystemPagination
              currentPage={page}
              totalPages={Math.ceil(totalCount / limit) || 1}
              totalItems={totalCount}
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
            <SystemTh className="w-52" align="left">
              <div className="flex items-center gap-1.5">
                <Receipt size={12} className="text-gray-400 shrink-0" />
                <span>Mã đơn Shopee</span>
              </div>
            </SystemTh>
            <SystemTh className="w-36" align="left">
              <div className="flex items-center gap-1.5">
                <Store size={12} className="text-gray-400 shrink-0" />
                <span>Shop</span>
              </div>
            </SystemTh>
            <SystemTh className="w-36 text-right" align="right">
              <div className="flex items-center justify-end gap-1.5">
                <DollarSign size={12} className="text-gray-400 shrink-0" />
                <span>Doanh thu sàn</span>
              </div>
            </SystemTh>
            <SystemTh className="w-32 text-right" align="right">
              <div className="flex items-center justify-end gap-1.5">
                <Percent size={12} className="text-red-500 shrink-0" />
                <span>Phí sàn</span>
              </div>
            </SystemTh>
            <SystemTh className="w-36 text-right" align="right">
              <div className="flex items-center justify-end gap-1.5">
                <Clock size={12} className="text-[#5865f2] shrink-0" />
                <span>Dự kiến nhận</span>
              </div>
            </SystemTh>
            <SystemTh className="w-36 text-right" align="right">
              <div className="flex items-center justify-end gap-1.5">
                <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                <span>Thực nhận NH</span>
              </div>
            </SystemTh>
            <SystemTh className="w-32 text-right" align="right">
              <div className="flex items-center justify-end gap-1.5">
                <AlertCircle size={12} className="text-amber-500 shrink-0" />
                <span>Chênh lệch</span>
              </div>
            </SystemTh>
            <SystemTh className="w-44" align="left">
              <div className="flex items-center gap-1.5">
                <Calendar size={12} className="text-gray-400 shrink-0" />
                <span>Tham chiếu / Ngày tiền về</span>
              </div>
            </SystemTh>
            <SystemTh className="w-32 text-center" align="center">
              <div className="flex items-center justify-center gap-1.5">
                <ShieldCheck size={12} className="text-gray-400 shrink-0" />
                <span>Trạng thái</span>
              </div>
            </SystemTh>
            <SystemTh className="w-16 text-center" align="center">
              <div className="flex items-center justify-center gap-1.5">
                <SlidersHorizontal size={12} className="text-gray-400 shrink-0" />
                <span>Thao tác</span>
              </div>
            </SystemTh>
          </SystemThead>
          <SystemTbody>
            {isLoading ? (
              <SystemTableSkeleton cols={11} rows={7} />
            ) : paginatedSettlements.length === 0 ? (
              <SystemTableEmpty
                colSpan={11}
                title="Không có bản ghi đối soát nào"
                description="Thử tìm kiếm với từ khóa khác hoặc thay đổi bộ lọc trạng thái."
              />
            ) : (
              paginatedSettlements.map((s, index) => {
                const gross = s.grossAmount || s.order?.totalAmount || 0;
                const fees = s.platformFees || 0;
                const expected = s.expectedAmount || s.netAmount || 0;
                const actual = s.actualAmount;
                const hasActual = actual !== null && actual !== undefined;
                const discrepancy = hasActual ? actual - expected : 0;
                const isMatched = hasActual && Math.abs(discrepancy) < 1;
                const stt = (page - 1) * limit + index + 1;

                return (
                  <SystemTr key={s.id}>
                    <SystemTd align="center" className="text-center font-medium text-gray-500 dark:text-gray-400 text-xs">
                      {stt}
                    </SystemTd>
                    <SystemTd className="font-mono font-medium text-gray-900 dark:text-white">
                      {s.order?.externalOrderId || s.order?.internalOrderCode || s.order?.orderSn || s.orderId}
                    </SystemTd>
                    <SystemTd className="text-gray-600 dark:text-gray-400">
                      {s.order?.shop?.name || s.shop?.name || '--'}
                    </SystemTd>
                    <SystemTd align="right" className="font-medium text-gray-900 dark:text-gray-200">
                      {formatCurrency(gross)}
                    </SystemTd>
                    <SystemTd align="right" className="font-medium text-red-600 dark:text-red-400">
                      {formatCurrency(fees)}
                    </SystemTd>
                    <SystemTd align="right" className="font-medium text-[#5865f2]">
                      {formatCurrency(expected)}
                    </SystemTd>
                    <SystemTd align="right" className="font-medium">
                      {hasActual ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(actual)}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Chưa đối soát</span>
                      )}
                    </SystemTd>
                    <SystemTd align="right" className="font-medium">
                      {hasActual ? (
                        <span
                          className={
                            isMatched
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : discrepancy < 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-blue-600 dark:text-blue-400'
                          }
                        >
                          {discrepancy > 0
                            ? `+${formatCurrency(discrepancy)}`
                            : formatCurrency(discrepancy)}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">--</span>
                      )}
                    </SystemTd>
                    {/* Tham chiếu / Ngày tiền về */}
                    <SystemTd className="text-gray-500 dark:text-gray-400 font-mono text-[11px]">
                      {s.payoutDate && (
                        <div>{new Date(s.payoutDate).toLocaleDateString('vi-VN')}</div>
                      )}
                      {s.referenceCode && (
                        <div className="text-gray-400 dark:text-gray-500 truncate max-w-[140px]">
                          {s.referenceCode}
                        </div>
                      )}
                    </SystemTd>

                    {/* Trạng thái (Chip status đặt ở cuối ngay trước Thao tác) */}
                    <SystemTd align="center">
                      {isMatched ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle size={12} /> Khớp 100%
                        </span>
                      ) : hasActual ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                          <AlertCircle size={12} /> Lệch tiền
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          Chờ tiền về
                        </span>
                      )}
                    </SystemTd>

                    {/* Thao tác: Đồng bộ DropdownMenu */}
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
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenRecordModal(s)}>
                              <CreditCard size={13} className="text-emerald-500" />
                              <span>{hasActual ? 'Chỉnh sửa đối soát' : 'Ghi nhận tiền về'}</span>
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

      {/* Settlements Mobile Card View */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-2 pb-16">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-gray-400">Đang tải đối soát...</div>
        ) : paginatedSettlements.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">Không có bản ghi đối soát nào</div>
        ) : (
          paginatedSettlements.map((s, index) => {
            const gross = s.grossAmount || s.order?.totalAmount || 0;
            const fees = s.platformFees || 0;
            const expected = s.expectedAmount || s.netAmount || 0;
            const actual = s.actualAmount;
            const hasActual = actual !== null && actual !== undefined;
            const discrepancy = hasActual ? actual - expected : 0;
            const isMatched = hasActual && Math.abs(discrepancy) < 1;
            const stt = (page - 1) * limit + index + 1;
            const orderCode = s.order?.externalOrderId || s.order?.internalOrderCode || s.order?.orderSn || s.orderId;

            return (
              <div
                key={s.id}
                className="p-3 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-5 h-5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-semibold text-gray-500 flex items-center justify-center shrink-0">
                      {stt}
                    </span>
                    <span className="font-mono font-bold text-xs text-gray-900 dark:text-white truncate">
                      {orderCode}
                    </span>
                  </div>
                  {isMatched ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                      <CheckCircle size={10} /> Khớp 100%
                    </span>
                  ) : hasActual ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 shrink-0">
                      <AlertCircle size={10} /> Lệch {discrepancy > 0 ? `+${formatCurrency(discrepancy)}` : formatCurrency(discrepancy)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                      Chờ tiền về
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-300 font-medium">Shop: {s.order?.shop?.name || s.shop?.name || '--'}</span>
                  {s.payoutDate && (
                    <span className="font-mono text-gray-400">
                      {new Date(s.payoutDate).toLocaleDateString('vi-VN')}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1.5 p-2 bg-gray-50 dark:bg-[#14151a] rounded text-center border border-gray-100 dark:border-gray-800">
                  <div>
                    <div className="text-[10px] text-gray-400">Doanh thu sàn</div>
                    <div className="text-xs font-semibold text-gray-900 dark:text-white">{formatCurrency(gross)}đ</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400">Phí sàn</div>
                    <div className="text-xs font-semibold text-rose-500">-{formatCurrency(fees)}đ</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400">Dự kiến nhận</div>
                    <div className="text-xs font-semibold text-[#5865f2]">{formatCurrency(expected)}đ</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800 text-[11px]">
                  <div>
                    <span className="text-gray-400">Thực nhận NH: </span>
                    {hasActual ? (
                      <strong className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(actual)}đ
                      </strong>
                    ) : (
                      <span className="text-gray-400 italic">Chưa khớp</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenRecordModal(s)}
                    className="px-2.5 py-1 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white font-medium text-xs transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <CreditCard size={12} />
                    <span>{hasActual ? 'Sửa' : 'Ghi nhận'}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}

        {totalCount > limit && (
          <div className="pt-2">
            <SystemPagination
              currentPage={page}
              totalPages={Math.ceil(totalCount / limit) || 1}
              totalItems={totalCount}
              itemsPerPage={limit}
              onPageChange={(p) => setPage(p)}
              onLimitChange={(l) => {
                setLimit(l);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* RECORD PAYOUT MODAL */}
      {isRecordModalOpen && (
        <Modal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          title={
            <div className="flex items-center gap-2 min-w-0">
              <span className="sm:hidden font-semibold truncate">Ghi nhận tiền về</span>
              <span className="hidden sm:inline font-semibold truncate">Ghi nhận tiền thực nhận Shopee</span>
            </div>
          }
          subtitle={
            <div className="min-w-0 truncate">
              <span className="sm:hidden truncate">Cập nhật số tiền chuyển khoản thực tế</span>
              <span className="hidden sm:inline truncate">Cập nhật số tiền chuyển khoản thực tế từ sàn và mã giao dịch ngân hàng đối soát</span>
            </div>
          }
          icon={CreditCard}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleRecordSubmit} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 sm:space-y-3.5 p-3 sm:p-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                  <Receipt size={13} className="text-[#5865f2]" />
                  <span>Mã đơn hàng Shopee</span>
                </label>
                <input
                  type="text"
                  disabled
                  value={selectedSettlement?.order?.externalOrderId || selectedSettlement?.order?.internalOrderCode || selectedSettlement?.order?.orderSn || recordForm.orderId}
                  className="w-full px-3 py-2 text-xs font-mono bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                  <DollarSign size={13} className="text-emerald-500" />
                  <span>Số tiền thực nhận vào tài khoản (VND) *</span>
                </label>
                <CurrencyInput
                  required
                  value={recordForm.actualAmount}
                  onChange={(val) =>
                    setRecordForm({
                      ...recordForm,
                      actualAmount: val,
                    })
                  }
                  placeholder="0"
                  suffix="đ"
                  inputClassName="px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white font-bold focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                  <Calendar size={13} className="text-gray-400" />
                  <span>Ngày nhận tiền thực tế *</span>
                </label>
                <input
                  type="date"
                  required
                  value={recordForm.payoutDate}
                  onChange={(e) =>
                    setRecordForm({ ...recordForm, payoutDate: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                  <CreditCard size={13} className="text-gray-400" />
                  <span>Mã tham chiếu ngân hàng (Bank Transaction ID / UNC)</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: FT2610134892..."
                  value={recordForm.referenceCode}
                  onChange={(e) =>
                    setRecordForm({ ...recordForm, referenceCode: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                  <Receipt size={13} className="text-gray-400" />
                  <span>Ghi chú đối soát</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú thêm nếu có chênh lệch..."
                  value={recordForm.note}
                  onChange={(e) => setRecordForm({ ...recordForm, note: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => setIsRecordModalOpen(false)}
                className="gap-1.5 flex-none px-4 py-2.5 sm:py-1.5 text-xs font-semibold shrink-0"
              >
                <X size={14} />
                <span>Hủy</span>
              </ModalButton>
              <ModalButton
                variant="primary"
                type="submit"
                className="gap-1.5 flex-1 sm:flex-none py-2.5 sm:py-1.5 px-4 font-semibold text-xs active:scale-95 justify-center"
              >
                <CheckCircle size={14} />
                <span>Lưu đối soát</span>
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </div>
  );
};
