import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCcw,
  Search,
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Boxes,
  Truck,
  Eye,
  Camera,
  Calendar,
  Layers,
  ArrowDownLeft,
  XCircle,
  FileText,
  ShieldCheck,
  Building2,
  Store,
  Info,
  Check,
  ClipboardList,
  RefreshCw,
  MoreHorizontal,
} from 'lucide-react';
import {
  orderReturnsApi,
  ReturnQueueItem,
  OrderReturnModel,
  CreateOrderReturnPayload,
} from '../../services/orderReturnsApi';
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
import { SystemMetricCard } from '../../components/ui/SystemMetricCard';
import { toast } from '../../components/ui/Toast';

export const OrderReturnsPage: React.FC = () => {
  const { warehouses, selectedWarehouseId } = useWorkspaceStore();

  const [activeTab, setActiveTab] = useState<'QUEUE' | 'HISTORY'>('QUEUE');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Return Queue State
  const [returnQueue, setReturnQueue] = useState<ReturnQueueItem[]>([]);
  const [selectedQueueOrder, setSelectedQueueOrder] = useState<ReturnQueueItem | null>(null);

  // Return History State
  const [historyList, setHistoryList] = useState<OrderReturnModel[]>([]);
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyLimit, setHistoryLimit] = useState<number>(25);
  const [historyTotal, setHistoryTotal] = useState<number>(0);
  const [historyTotalPages, setHistoryTotalPages] = useState<number>(1);

  // Modals
  const [isInspectModalOpen, setIsInspectModalOpen] = useState<boolean>(false);
  const [selectedHistoryDetail, setSelectedHistoryDetail] = useState<OrderReturnModel | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  // Inspection Form State
  const [inspectForm, setInspectForm] = useState<CreateOrderReturnPayload>({
    orderId: '',
    warehouseId: selectedWarehouseId || (warehouses[0]?.id || ''),
    trackingCode: '',
    receivedDate: new Date().toISOString().split('T')[0],
    inspectorName: 'Nhân viên kho',
    conditionPhoto: '',
    reason: 'Khách yêu cầu trả hàng / Giao không thành công',
    note: '',
    items: [],
  });

  const scanInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (activeTab === 'QUEUE') {
      loadReturnQueue();
    } else {
      loadHistory();
    }
  }, [activeTab]);

  const loadReturnQueue = async (query = searchTerm) => {
    try {
      setIsLoading(true);
      const res = await orderReturnsApi.getReturnQueue(query.trim() || undefined);
      const data = (res as any)?.data || res;
      setReturnQueue(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Lỗi tải danh sách chờ nhận hoàn:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const res = await orderReturnsApi.findAll({
        page: historyPage,
        limit: historyLimit,
        search: searchTerm.trim() || undefined,
      });
      const data = (res as any)?.data || res;
      if (data && data.data) {
        setHistoryList(data.data);
        setHistoryTotal(data.meta?.total || 0);
        setHistoryTotalPages(data.meta?.totalPages || 1);
      } else {
        setHistoryList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Lỗi tải lịch sử hoàn:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Open Inspection Modal for an Order
  const handleOpenInspect = (order: ReturnQueueItem) => {
    setSelectedQueueOrder(order);

    const defaultWarehouse =
      order.shop?.defaultWarehouseId || selectedWarehouseId || (warehouses[0]?.id || '');

    setInspectForm({
      orderId: order.id,
      warehouseId: defaultWarehouse,
      trackingCode: order.trackingCode || '',
      receivedDate: new Date().toISOString().split('T')[0],
      inspectorName: 'Nhân viên kiểm hàng',
      conditionPhoto: '',
      reason: 'Khách không nhận / Giao thất bại / Đổi trả sàn',
      note: '',
      items: order.itemsProgress.map((ip) => ({
        variantId: ip.variantId,
        sku: ip.sku,
        sellableQuantity: ip.remainingToReturn, // Mặc định điền số lượng còn lại
        damagedQuantity: 0,
        missingQuantity: 0,
        batchCode: '',
        expiryDate: '',
        note: '',
      })),
    });

    setIsInspectModalOpen(true);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...inspectForm.items];
    updated[index] = { ...updated[index], [field]: value };
    setInspectForm({ ...inspectForm, items: updated });
  };

  const handleSubmitInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQueueOrder) return;

    if (!inspectForm.warehouseId) {
      alert('Vui lòng chọn kho tiếp nhận hàng hoàn');
      return;
    }

    if (!inspectForm.inspectorName.trim()) {
      alert('Vui lòng nhập tên người thực hiện kiểm tra');
      return;
    }

    // Kiểm tra ràng buộc bất biến: Tổng lượng hoàn không được vượt số lượng còn chờ
    for (let i = 0; i < inspectForm.items.length; i++) {
      const it = inspectForm.items[i];
      const prog = selectedQueueOrder.itemsProgress.find((p) => p.variantId === it.variantId);
      const remaining = prog ? prog.remainingToReturn : 0;
      const totalThisTime = (it.sellableQuantity || 0) + (it.damagedQuantity || 0) + (it.missingQuantity || 0);

      if (totalThisTime > remaining) {
        toast.error(
          `Lỗi SKU ${it.sku}`,
          `Tổng số lượng hoàn đợt này (${totalThisTime}) vượt quá số lượng chưa nhận (${remaining}).`,
        );
        return;
      }
    }

    const totalRestocked = inspectForm.items.reduce(
      (sum, it) => sum + (it.sellableQuantity || 0) + (it.damagedQuantity || 0) + (it.missingQuantity || 0),
      0,
    );

    if (totalRestocked === 0) {
      toast.warning('Vui lòng nhập ít nhất 1 sản phẩm có số lượng nhận lại hoặc khách giữ lại');
      return;
    }

    try {
      await orderReturnsApi.inspectAndReceive(inspectForm);
      setIsInspectModalOpen(false);
      setSelectedQueueOrder(null);
      loadReturnQueue();
      toast.success(
        'Nhận hàng hoàn thành công!',
        'Đã cập nhật hàng vào kho và ghi nhận sổ cái tồn kho.',
      );
    } catch (err: any) {
      toast.error('Lỗi khi nhập hoàn kho', err?.response?.data?.message || err?.message);
    }
  };

  // Top KPIs
  const totalWaitingCount = returnQueue.filter((q) => q.queueStatus === 'WAITING_INSPECTION').length;
  const totalPartiallyCount = returnQueue.filter((q) => q.queueStatus === 'PARTIALLY_INSPECTED').length;
  const totalItemsWaiting = returnQueue.reduce((sum, q) => sum + q.remainingTotal, 0);

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-3.5 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <RotateCcw size={20} className="text-[#5865f2]" />
            Xử lý đơn hoàn & Nhập lại kho
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Chỉ cộng kho khi kho thực tế nhận và kiểm tra: Hàng đạt chuẩn → Tồn bán được • Hàng hỏng/móp → Tồn hàng lỗi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => (activeTab === 'QUEUE' ? loadReturnQueue() : loadHistory())}
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
          title="Chờ nhận hoàn"
          value={totalWaitingCount.toString()}
          subtitle="Chưa kiểm tra"
          icon={Clock}
          colorScheme="orange"
        />
        <SystemMetricCard
          title="Sản phẩm đang về"
          value={totalItemsWaiting.toString()}
          subtitle="Chưa tính vào tồn bán"
          icon={Boxes}
          colorScheme="blue"
        />
        <SystemMetricCard
          title="Hoàn một phần"
          value={totalPartiallyCount.toString()}
          subtitle="Đang theo dõi nhiều đợt"
          icon={AlertTriangle}
          colorScheme="purple"
        />
        <SystemMetricCard
          title="Đã nhập hoàn kho"
          value={historyTotal.toString()}
          subtitle="Đã ghi sổ cái kho"
          icon={CheckCircle2}
          colorScheme="green"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-gray-100/80 dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded w-full sm:w-fit shrink-0 max-w-full overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('QUEUE')}
          className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-2 cursor-pointer border-0 shrink-0 ${
            activeTab === 'QUEUE'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <ScanLine size={14} />
          <span>Chờ Nhận & Kiểm Tra Hàng Hoàn ({returnQueue.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-2 cursor-pointer border-0 shrink-0 ${
            activeTab === 'HISTORY'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <ClipboardList size={14} />
          <span>Lịch Sử Phiếu Nhận Hoàn ({historyTotal})</span>
        </button>
      </div>

      {/* TAB 1: DANH SÁCH CHỜ NHẬN HOÀN */}
      {activeTab === 'QUEUE' && (
        <div className="flex-1 flex flex-col min-h-0 space-y-3">
          {/* Quick Scanner Bar */}
          <div className="p-3 bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="relative w-full sm:max-w-md">
              <ScanLine className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#5865f2]" />
              <input
                ref={scanInputRef}
                type="text"
                placeholder="Quét mã vận đơn / mã đơn Shopee (Enter để tìm)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    loadReturnQueue(searchTerm);
                  }
                }}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white font-mono focus:outline-none focus:border-[#5865f2]"
              />
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              * Quét mã kiện để mở ngay bảng kiểm tra từng sản phẩm và cộng tồn tương ứng
            </div>
          </div>

          <div className="hidden md:flex flex-1 flex-col min-h-0">
            <SystemTableWrapper tableClassName="min-w-[1100px]">
              <SystemThead>
                <SystemTh className="w-48">Mã Đơn & Vận Đơn</SystemTh>
                <SystemTh className="w-48">Shop & Khách Hàng</SystemTh>
                <SystemTh className="w-64">Sản Phẩm & Tiến Độ Hoàn</SystemTh>
                <SystemTh className="w-24 text-center">SL Xuất</SystemTh>
                <SystemTh className="w-28 text-center text-emerald-600">Đã Hoàn Bán</SystemTh>
                <SystemTh className="w-28 text-center text-rose-500">Đã Hoàn Lỗi</SystemTh>
                <SystemTh className="w-28 text-center font-bold text-[#5865f2]">Còn Chờ Hoàn</SystemTh>
                <SystemTh className="w-32 text-center">Trạng Thái</SystemTh>
                <SystemTh className="w-36 text-center">Thao Tác</SystemTh>
              </SystemThead>
              <SystemTbody>
                {isLoading ? (
                  <SystemTableSkeleton cols={9} rows={7} />
                ) : returnQueue.length === 0 ? (
                  <SystemTableEmpty
                    title="Không có đơn hàng nào chờ hoàn"
                    description="Hiện không có đơn hàng nào đang chờ nhận hoàn hoặc kiểm tra tại kho."
                    colSpan={9}
                  />
                ) : (
                  returnQueue.map((item) => (
                    <SystemTr key={item.id}>
                      <SystemTd>
                        <div className="font-semibold text-[#5865f2] font-mono">
                          {item.internalOrderCode}
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                          Mã Shopee: {item.externalOrderId}
                        </div>
                        {item.trackingCode && (
                          <div className="text-[11px] text-gray-500 dark:text-gray-300 font-mono mt-0.5">
                            VĐ: {item.trackingCode}
                          </div>
                        )}
                      </SystemTd>

                      <SystemTd>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {item.shop?.name || 'N/A'}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {item.recipientName || item.buyerUsername} ({item.recipientPhone || ''})
                        </div>
                      </SystemTd>

                      <SystemTd>
                        <div className="space-y-1">
                          {item.itemsProgress.map((ip) => (
                            <div key={ip.orderItemId} className="text-[11px]">
                              <span className="font-mono font-medium text-[#5865f2]">{ip.sku}:</span>{' '}
                              <span className="text-gray-800 dark:text-gray-200">{ip.productName}</span>{' '}
                              <span className="text-gray-400">
                                (Xuất: {ip.dispatchedQuantity} | Đã hoàn: {ip.totalAccounted} | Còn: {ip.remainingToReturn})
                              </span>
                            </div>
                          ))}
                        </div>
                      </SystemTd>

                      <SystemTd className="text-center font-mono font-medium">
                        {item.totalDispatched}
                      </SystemTd>

                      <SystemTd className="text-center font-mono text-emerald-600 font-semibold">
                        {item.itemsProgress.reduce((s, it) => s + it.returnedSellable, 0)}
                      </SystemTd>

                      <SystemTd className="text-center font-mono text-rose-500 font-semibold">
                        {item.itemsProgress.reduce((s, it) => s + it.returnedDamaged, 0)}
                      </SystemTd>

                      <SystemTd className="text-center font-mono font-bold text-[#5865f2] text-xs sm:text-sm">
                        {item.remainingTotal}
                      </SystemTd>

                      <SystemTd className="text-center">
                        {item.queueStatus === 'FULLY_INSPECTED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Hoàn tất
                          </span>
                        ) : item.queueStatus === 'PARTIALLY_INSPECTED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            Hoàn 1 phần
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                            Chờ kiểm tra
                          </span>
                        )}
                      </SystemTd>

                      <SystemTd className="text-center">
                        {item.remainingTotal > 0 ? (
                          <button
                            onClick={() => handleOpenInspect(item)}
                            className="px-2.5 py-1 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white font-medium text-xs transition-colors cursor-pointer"
                          >
                            Kiểm & Nhập kho
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Đã nhận đủ</span>
                        )}
                      </SystemTd>
                    </SystemTr>
                  ))
                )}
              </SystemTbody>
            </SystemTableWrapper>
          </div>
        </div>
      )}

      {/* TAB 2: LỊCH SỬ PHIẾU NHẬN HOÀN */}
      {activeTab === 'HISTORY' && (
        <div className="flex-1 flex flex-col min-h-0 space-y-3">
          <div className="hidden md:flex flex-1 flex-col min-h-0">
            <SystemTableWrapper
              tableClassName="min-w-[1100px]"
              pagination={
                <SystemPagination
                  currentPage={historyPage}
                  totalPages={historyTotalPages}
                  totalItems={historyTotal}
                  itemsPerPage={historyLimit}
                  onPageChange={(p) => setHistoryPage(p)}
                  onLimitChange={(l) => {
                    setHistoryLimit(l);
                    setHistoryPage(1);
                  }}
                />
              }
            >
              <SystemThead>
                <SystemTh className="w-40">Mã Phiếu Hoàn</SystemTh>
                <SystemTh className="w-32">Ngày Nhận & Kiểm</SystemTh>
                <SystemTh className="w-44">Mã Đơn & Vận Đơn</SystemTh>
                <SystemTh className="w-40">Kho Tiếp Nhận</SystemTh>
                <SystemTh className="w-60">Chi Tiết Hàng Hoàn</SystemTh>
                <SystemTh className="w-36">Người Kiểm Tra</SystemTh>
                <SystemTh className="w-48">Lý Do & Ghi Chú</SystemTh>
                <SystemTh className="w-20 text-center">Thao Tác</SystemTh>
              </SystemThead>
              <SystemTbody>
                {isLoading ? (
                  <SystemTableSkeleton cols={8} rows={7} />
                ) : historyList.length === 0 ? (
                  <SystemTableEmpty
                    title="Chưa có phiếu nhận hoàn nào"
                    description="Các phiếu kiểm nhận hàng hoàn đã xử lý sẽ được lưu trữ tại đây."
                    colSpan={8}
                  />
                ) : (
                  historyList.map((item) => {
                    const totalSellable = item.items.reduce((s, i) => s + i.sellableQuantity, 0);
                    const totalDamaged = item.items.reduce((s, i) => s + i.damagedQuantity, 0);
                    const totalMissing = item.items.reduce((s, i) => s + i.missingQuantity, 0);

                    return (
                      <SystemTr
                        key={item.id}
                        onClick={() => {
                          setSelectedHistoryDetail(item);
                          setIsDetailModalOpen(true);
                        }}
                        className="cursor-pointer"
                      >
                        <SystemTd className="font-semibold font-mono text-[#5865f2]">
                          {item.returnCode}
                        </SystemTd>
                        <SystemTd className="text-gray-500">
                          {new Date(item.receivedDate).toLocaleDateString('vi-VN')}
                        </SystemTd>
                        <SystemTd>
                          <div className="font-mono font-medium text-gray-900 dark:text-white">
                            {item.order?.internalOrderCode}
                          </div>
                          {item.trackingCode && (
                            <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                              VĐ: {item.trackingCode}
                            </div>
                          )}
                        </SystemTd>
                        <SystemTd>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {item.warehouse?.name}
                          </span>
                        </SystemTd>
                        <SystemTd>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-mono font-semibold">
                              +Bán: {totalSellable}
                            </span>
                            {totalDamaged > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-mono font-semibold">
                                +Lỗi: {totalDamaged}
                              </span>
                            )}
                            {totalMissing > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 font-mono">
                                Thiếu: {totalMissing}
                              </span>
                            )}
                          </div>
                        </SystemTd>
                        <SystemTd className="text-gray-700 dark:text-gray-300">
                          {item.inspectorName}
                        </SystemTd>
                        <SystemTd className="text-gray-500 max-w-xs truncate">
                          {item.reason || item.note || '-'}
                        </SystemTd>
                        <SystemTd className="text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            title="Xem chi tiết phiếu hoàn"
                            onClick={() => {
                              setSelectedHistoryDetail(item);
                              setIsDetailModalOpen(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </SystemTd>
                      </SystemTr>
                    );
                  })
                )}
              </SystemTbody>
            </SystemTableWrapper>
          </div>
        </div>
      )}

      {/* MODAL: KIỂM TRA TỪNG SẢN PHẨM & NHẬP HOÀN KHO */}
      <Modal isOpen={isInspectModalOpen} onClose={() => setIsInspectModalOpen(false)} title={`Kiểm Tra Hàng Hoàn Thực Tế: ${selectedQueueOrder?.internalOrderCode || ''}`} size="xl">
        {selectedQueueOrder && (
          <form onSubmit={handleSubmitInspection} className="space-y-4">
            <ModalBody className="max-h-[75vh] overflow-y-auto space-y-4 text-xs sm:text-sm">
              {/* Header Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                <div>
                  <label className="block text-xs font-semibold mb-1">Kho tiếp nhận nhập lại *</label>
                  <select
                    required
                    value={inspectForm.warehouseId}
                    onChange={(e) => setInspectForm({ ...inspectForm, warehouseId: e.target.value })}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1.5"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} - {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Người thực hiện kiểm tra *</label>
                  <input
                    type="text"
                    required
                    value={inspectForm.inspectorName}
                    onChange={(e) => setInspectForm({ ...inspectForm, inspectorName: e.target.value })}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1.5"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Ngày tiếp nhận</label>
                  <input
                    type="date"
                    value={inspectForm.receivedDate}
                    onChange={(e) => setInspectForm({ ...inspectForm, receivedDate: e.target.value })}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1.5"
                  />
                </div>
              </div>

              {/* Items Verification Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-800 dark:text-gray-200">
                    Phân loại kiểm tra từng sản phẩm
                  </span>
                  <span className="text-xs text-gray-500">
                    Đơn hàng đã xuất {selectedQueueOrder.totalDispatched} sản phẩm
                  </span>
                </div>

                <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                      <tr>
                        <th className="p-2.5 w-[28%]">Sản Phẩm & SKU</th>
                        <th className="p-2.5 text-center w-[12%]">SL Xuất Ban Đầu</th>
                        <th className="p-2.5 text-center w-[15%] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40">
                          Còn Nguyên (Bán lại được)
                        </th>
                        <th className="p-2.5 text-center w-[15%] text-rose-600 bg-rose-50 dark:bg-rose-950/40">
                          Bị Hỏng / Móp (Hàng lỗi)
                        </th>
                        <th className="p-2.5 text-center w-[12%] text-gray-500">
                          Khách Giữ / Thiếu
                        </th>
                        <th className="p-2.5 w-[18%]">Lô & Hạn Dùng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {inspectForm.items.map((row, idx) => {
                        const prog = selectedQueueOrder.itemsProgress.find((p) => p.variantId === row.variantId);
                        const maxAllowed = prog ? prog.remainingToReturn : 0;

                        return (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                            <td className="p-2.5">
                              <div className="font-bold text-indigo-600 font-mono">{row.sku}</div>
                              <div className="text-[11px] text-gray-700 dark:text-gray-300">
                                {prog?.productName} {prog?.variationName ? `(${prog.variationName})` : ''}
                              </div>
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                Còn chờ hoàn: {maxAllowed} cái
                              </div>
                            </td>

                            <td className="p-2.5 text-center font-mono font-semibold">
                              {prog?.dispatchedQuantity}
                            </td>

                            {/* Còn nguyên bán lại được */}
                            <td className="p-2.5 text-center bg-emerald-50/30 dark:bg-emerald-950/20">
                              <input
                                type="number"
                                min="0"
                                max={maxAllowed}
                                value={row.sellableQuantity}
                                onChange={(e) => handleItemChange(idx, 'sellableQuantity', Number(e.target.value))}
                                className="w-16 text-center bg-white dark:bg-gray-800 border border-emerald-400 rounded p-1 font-bold font-mono text-emerald-600 text-xs"
                              />
                              <div className="text-[10px] text-emerald-600 mt-0.5">Tồn bán +{row.sellableQuantity}</div>
                            </td>

                            {/* Bị hỏng, móp, cận date */}
                            <td className="p-2.5 text-center bg-rose-50/30 dark:bg-rose-950/20">
                              <input
                                type="number"
                                min="0"
                                max={maxAllowed}
                                value={row.damagedQuantity}
                                onChange={(e) => handleItemChange(idx, 'damagedQuantity', Number(e.target.value))}
                                className="w-16 text-center bg-white dark:bg-gray-800 border border-rose-400 rounded p-1 font-bold font-mono text-rose-600 text-xs"
                              />
                              <div className="text-[10px] text-rose-600 mt-0.5">Hàng lỗi +{row.damagedQuantity}</div>
                            </td>

                            {/* Khách giữ lại / thiếu */}
                            <td className="p-2.5 text-center">
                              <input
                                type="number"
                                min="0"
                                max={maxAllowed}
                                value={row.missingQuantity}
                                onChange={(e) => handleItemChange(idx, 'missingQuantity', Number(e.target.value))}
                                className="w-16 text-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1 font-mono text-xs text-gray-500"
                              />
                              <div className="text-[10px] text-gray-400 mt-0.5">Ko cộng tồn</div>
                            </td>

                            {/* Lô & HSD */}
                            <td className="p-2.5 space-y-1">
                              <input
                                type="text"
                                placeholder="Lô sản xuất"
                                value={row.batchCode || ''}
                                onChange={(e) => handleItemChange(idx, 'batchCode', e.target.value)}
                                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1 text-[11px] font-mono"
                              />
                              <input
                                type="date"
                                value={row.expiryDate || ''}
                                onChange={(e) => handleItemChange(idx, 'expiryDate', e.target.value)}
                                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1 text-[10px]"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Photos & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">Lý do hoàn hàng</label>
                  <input
                    type="text"
                    value={inspectForm.reason || ''}
                    onChange={(e) => setInspectForm({ ...inspectForm, reason: e.target.value })}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1.5 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Ghi chú tình trạng</label>
                  <input
                    type="text"
                    placeholder="Mô tả vỏ hộp, rách niêm phong, trầy xước..."
                    value={inspectForm.note || ''}
                    onChange={(e) => setInspectForm({ ...inspectForm, note: e.target.value })}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1.5 text-xs"
                  />
                </div>
              </div>
            </ModalBody>

            <ModalFooter>
              <ModalButton type="button" variant="outline" onClick={() => setIsInspectModalOpen(false)}>
                Hủy bỏ
              </ModalButton>
              <ModalButton type="submit" variant="primary">
                Xác nhận Nhập Kho & Ghi Sổ Cái
              </ModalButton>
            </ModalFooter>
          </form>
        )}
      </Modal>

      {/* MODAL: CHI TIẾT PHIẾU NHẬN HOÀN */}
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={`Phiếu Nhận Hoàn: ${selectedHistoryDetail?.returnCode || ''}`} size="lg">
        {selectedHistoryDetail && (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div>
                <span className="text-gray-400 block">Mã đơn hàng:</span>
                <span className="font-bold text-gray-900 dark:text-white font-mono text-sm">
                  {selectedHistoryDetail.order?.internalOrderCode}
                </span>
                <span className="text-gray-400 block mt-1">Mã Shopee: {selectedHistoryDetail.order?.externalOrderId}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-400 block">Người kiểm tra:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {selectedHistoryDetail.inspectorName}
                </span>
                <span className="text-gray-400 block mt-1">
                  Kho: {selectedHistoryDetail.warehouse?.name}
                </span>
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              <div className="bg-gray-100 dark:bg-gray-800 p-2.5 font-bold text-gray-700 dark:text-gray-300">
                Sản phẩm trong phiếu nhập hoàn
              </div>
              <div className="p-3 divide-y divide-gray-100 dark:divide-gray-800">
                {selectedHistoryDetail.items.map((it) => (
                  <div key={it.id} className="py-2 flex justify-between items-center">
                    <div>
                      <div className="font-mono font-bold text-indigo-600">{it.sku}</div>
                      <div className="text-gray-800 dark:text-gray-200">{it.variant?.product?.name || it.sku}</div>
                      {it.batchCode && (
                        <div className="text-[10px] text-gray-400 font-mono">
                          Lô: {it.batchCode} {it.expiryDate ? `• HSD: ${new Date(it.expiryDate).toLocaleDateString('vi-VN')}` : ''}
                        </div>
                      )}
                    </div>
                    <div className="text-right space-y-0.5">
                      <div className="font-bold text-emerald-600 font-mono">+ Bán lại được: {it.sellableQuantity}</div>
                      {it.damagedQuantity > 0 && (
                        <div className="font-bold text-rose-600 font-mono">+ Hàng lỗi: {it.damagedQuantity}</div>
                      )}
                      {it.missingQuantity > 0 && (
                        <div className="text-gray-400 font-mono">Thiếu / ko hoàn: {it.missingQuantity}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
