import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Package,
  Truck,
  User,
  MapPin,
  AlertCircle,
  RotateCcw,
  Ban,
  Boxes,
  Lock,
  Edit2,
  Trash2,
  ArrowUpRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { formatCurrency } from '../../utils';
import { ordersApi } from '../../services/ordersApi';
import {
  getPlatformStatusConfig,
  getFulfillmentStatusConfig,
  getVerificationStatusConfig,
} from '../../utils/orderStatus';
import { VerificationStatusBadge } from '../../components/orders/VerificationStatusBadge';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import { getOrderProductSummary } from './orderUtils';

interface OrderDetailDrawerProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onEdit?: (order: any) => void;
  onDelete?: (order: any) => void;
}

export const OrderDetailDrawer: React.FC<OrderDetailDrawerProps> = ({
  order,
  isOpen,
  onClose,
  onRefresh,
  onEdit,
  onDelete,
}) => {
  const navigate = useNavigate();
  const prodSummary = getOrderProductSummary(order?.orderItems);
  const [isLoadingAction, setIsLoadingAction] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('Khách hàng hủy trên Shopee');

  const [isReturnModalOpen, setIsReturnModalOpen] = useState<boolean>(false);
  const [returnNote, setReturnNote] = useState<string>('Hàng hoàn nguyên vẹn, bao bì đầy đủ');

  const [isVirtualModalOpen, setIsVirtualModalOpen] = useState<boolean>(false);
  const [virtualIsVirtual, setVirtualIsVirtual] = useState<boolean>(false);
  const [virtualIsRealGoods, setVirtualIsRealGoods] = useState<boolean>(false);

  useEffect(() => {
    if (order) {
      setVirtualIsVirtual(!!order.isVirtual);
      setVirtualIsRealGoods(!!order.isRealGoods);
    }
  }, [order]);

  const handleSaveVirtual = async () => {
    setIsLoadingAction(true);
    setActionError(null);
    try {
      await ordersApi.markVirtual(order.id, {
        isVirtual: virtualIsVirtual,
        isRealGoods: virtualIsRealGoods,
      });
      setIsVirtualModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Cập nhật cấu hình đơn ảo thất bại');
    } finally {
      setIsLoadingAction(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  const platformCfg = getPlatformStatusConfig(order.platformStatus);
  const fulfillmentCfg = getFulfillmentStatusConfig(order.fulfillmentStatus);
  const verificationCfg = getVerificationStatusConfig(order.verificationStatus);

  const handleReserve = async () => {
    setIsLoadingAction(true);
    setActionError(null);
    try {
      await ordersApi.reserveOrder(order.id);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Không thể giữ hàng cho đơn');
    } finally {
      setIsLoadingAction(false);
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingAction(true);
    setActionError(null);
    try {
      await ordersApi.cancelOrder(order.id, cancelReason);
      setIsCancelModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Hủy đơn thất bại');
    } finally {
      setIsLoadingAction(false);
    }
  };

  const handleReceiveReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingAction(true);
    setActionError(null);
    try {
      await ordersApi.receiveReturn(order.id, { note: returnNote });
      setIsReturnModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Nhập hàng hoàn thất bại');
    } finally {
      setIsLoadingAction(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-hidden flex justify-end bg-black/50 backdrop-blur-xs">
      {/* Backdrop overlay click to close */}
      <div className="fixed inset-0 -z-10" onClick={onClose} aria-hidden="true" />

      <div className="w-full max-w-2xl bg-white dark:bg-[#181b22] h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-800 animate-slide-left">
        {/* Header with Safe Area spacing */}
        <div className="px-4 sm:px-6 pt-[max(1.1rem,env(safe-area-inset-top,0px))] pb-3.5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0 bg-white dark:bg-[#181b22]">
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#5865f2]/10 text-[#5865f2] dark:text-[#8a94fd]">
                {order.shop?.name || 'Shop Shopee'}
              </span>
              <span className="text-gray-300 dark:text-gray-700">•</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{order.internalOrderCode}</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
              Đơn hàng: {order.externalOrderId}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer shrink-0"
            title="Đóng chi tiết đơn hàng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
          {actionError && (
            <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="flex-shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* 3-Layer Status Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded bg-gray-50/50 dark:bg-[#14151a] border border-gray-200 dark:border-gray-800">
            <div>
              <span className="text-xs font-normal text-gray-500 uppercase tracking-wider block">
                Trạng thái sàn Shopee
              </span>
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded ${platformCfg.badgeClass}`}>
                  {platformCfg.label}
                </span>
              </div>
              <span className="text-[11px] text-gray-400 mt-1 flex items-center gap-1 font-normal" title="Trạng thái sàn được cập nhật từ file Excel import">
                <Lock size={10} className="shrink-0 text-gray-400" />
                Đồng bộ tự động từ file
              </span>
            </div>

            <div>
              <span className="text-xs font-normal text-gray-500 uppercase tracking-wider block">
                Xử lý kho nội bộ
              </span>
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded ${fulfillmentCfg.badgeClass}`}>
                  {fulfillmentCfg.label}
                </span>
              </div>
              <span className="text-[11px] text-gray-400 mt-1 block font-normal">
                Quy trình lưu kho
              </span>
            </div>

            <div>
              <span className="text-xs font-normal text-gray-500 uppercase tracking-wider block">
                Xác minh thực tế (Scan)
              </span>
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                <VerificationStatusBadge status={order.verificationStatus} showLabel />
              </div>
              <span className="text-[11px] text-gray-400 mt-1 block font-normal">
                Bàn giao vận chuyển
              </span>
            </div>
          </div>

          {/* Virtual Order Status Card */}
          <div className={`p-3.5 rounded border transition-colors ${
            order.isVirtual
              ? 'bg-purple-50/70 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/60'
              : 'bg-gray-50/50 dark:bg-[#14151a] border-gray-200 dark:border-gray-800'
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 mt-0.5 ${
                  order.isVirtual
                    ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                }`}>
                  <Sparkles size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      {order.isVirtual ? 'Đơn hàng ảo (Seeding / Buff đơn)' : 'Đơn hàng thông thường'}
                    </span>
                    {order.isVirtual && (
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        !order.isRealGoods
                          ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                          : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      }`}>
                        {!order.isRealGoods ? 'Không đi hàng thật (Không trừ kho)' : 'Có đi hàng thật (Trừ kho)'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                    {order.isVirtual
                      ? (!order.isRealGoods
                          ? 'Khi quét xuất kho hoặc lưu kho, hệ thống sẽ KHÔNG trừ số lượng sản phẩm trong kho.'
                          : 'Đơn ảo này được cấu hình đi hàng thật nên hệ thống VẪN trừ tồn kho khi xuất hàng.')
                      : 'Đơn mua thật từ khách hàng, xuất kho trừ tồn kho tiêu chuẩn.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsVirtualModalOpen(true)}
                className="px-2.5 py-1 text-xs font-semibold rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer shrink-0 transition-colors shadow-2xs"
              >
                {order.isVirtual ? 'Đổi cấu hình' : 'Đánh dấu đơn ảo'}
              </button>
            </div>
          </div>

          {/* Customer & Shipping Information */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              Thông tin giao hàng
            </h3>
            <div className="p-3.5 rounded bg-white dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700/60 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <User size={14} className="text-gray-400 flex-shrink-0" />
                <span className="font-medium">{order.recipientName || 'Người nhận'}</span>
                {order.recipientPhone && <span className="text-gray-400">({order.recipientPhone})</span>}
                {order.buyerUsername && (
                  <span className="ml-auto text-xs text-gray-400">@{order.buyerUsername}</span>
                )}
              </div>

              <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                <MapPin size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <span>{order.recipientAddress || 'Chưa có địa chỉ'}</span>
              </div>

              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700/50">
                <Truck size={14} className="text-[#5865f2] flex-shrink-0" />
                <span>Đơn vị: <span className="font-medium text-gray-800 dark:text-gray-200">{order.shippingCarrier || 'Chưa rõ'}</span></span>
                {order.trackingCode && (
                  <span className="ml-auto font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                    MVD: {order.trackingCode}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                Sản phẩm ({order.orderItems?.length || 0} loại)
              </h3>
              {prodSummary.mainText && prodSummary.totalQuantity > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40 flex items-center gap-1">
                  <Package size={12} className="text-indigo-500 shrink-0" />
                  Tổng SL: {prodSummary.mainText}
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700/60 rounded overflow-hidden">
              {order.orderItems?.map((item: any) => (
                <div key={item.id} className="p-3 bg-white dark:bg-gray-800/30 flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{item.productName}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      {item.variationName && <span>Phân loại: {item.variationName}</span>}
                      <span>•</span>
                      <span>SKU sàn: <code className="font-mono">{item.externalSku || 'Chưa có'}</code></span>
                    </div>
                    {item.variant ? (
                      <span className="inline-block mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded">
                        Đã map SKU nội bộ: {item.variant.sku}
                      </span>
                    ) : (
                      <span className="inline-block mt-1 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded">
                        Cảnh báo: SKU chưa mapping nội bộ
                      </span>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(item.discountedPrice || item.originalPrice)} đ
                    </p>
                    <span className="inline-block mt-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-200/50 dark:border-indigo-900/40">
                      SL: {item.quantity} {item.variant?.unit || item.unit || 'cái'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Packages */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              Kiện hàng ({order.packages?.length || 0})
            </h3>
            <div className="space-y-2">
              {order.packages?.map((pkg: any) => (
                <div key={pkg.id} className="p-3 rounded bg-gray-50 dark:bg-gray-800/40 border border-gray-200/60 dark:border-gray-700/50 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <Package size={16} className="text-[#5865f2]" />
                    <div>
                      <p className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                        {pkg.packageCode}
                      </p>
                      <p className="text-[11px] text-gray-400">MVD: {pkg.trackingCode || 'Chưa có'}</p>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      pkg.status === 'DISPATCHED'
                        ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {pkg.status === 'DISPATCHED' ? 'Đã xuất kho' : 'Chờ xuất'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Scan Events History */}
          {order.scanEvents && order.scanEvents.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Lịch sử quét Barcode
              </h3>
              <div className="space-y-1.5 text-xs">
                {order.scanEvents.map((evt: any) => (
                  <div key={evt.id} className="p-2.5 rounded bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                        {evt.normalizedCode}
                      </span>
                      <span className="text-[11px] text-gray-400 ml-2">
                        {new Date(evt.createdAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      {evt.scanResult}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Return Vouchers History */}
          {order.orderReturns && order.orderReturns.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <RotateCcw size={13} />
                Phiếu nhập hàng hoàn ({order.orderReturns.length})
              </h3>
              <div className="space-y-2 text-xs">
                {order.orderReturns.map((ret: any) => (
                  <div key={ret.id} className="p-3 rounded bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                        {ret.returnCode}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {new Date(ret.receivedAt || ret.createdAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-600 dark:text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
                      <span>Kho: <b className="text-gray-800 dark:text-gray-200">{ret.warehouse?.name || 'Kho mặc định'}</b></span>
                      <span>Người kiểm: <b className="text-gray-800 dark:text-gray-200">{ret.inspectedBy || 'Kho'}</b></span>
                    </div>
                    {ret.items && ret.items.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-amber-200/40 dark:border-amber-900/30">
                        {ret.items.map((it: any) => (
                          <div key={it.id} className="flex items-center justify-between text-[11px]">
                            <span className="font-mono text-gray-700 dark:text-gray-300">
                              {it.variant?.sku || 'SKU'}
                            </span>
                            <div className="flex items-center gap-2">
                              {it.sellableQuantity > 0 && (
                                <span className="text-emerald-600 font-medium">
                                  +{it.sellableQuantity} bán được
                                </span>
                              )}
                              {it.damagedQuantity > 0 && (
                                <span className="text-rose-600 font-medium">
                                  +{it.damagedQuantity} lỗi
                                </span>
                              )}
                              {it.missingQuantity > 0 && (
                                <span className="text-gray-400 font-medium">
                                  {it.missingQuantity} thiếu/giữ
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:px-6 sm:py-4 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-white dark:bg-[#181b22] shrink-0 pb-[max(1.25rem,env(safe-area-inset-bottom,12px))] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Edit Button */}
            {onEdit && (
              <button
                onClick={() => onEdit(order)}
                className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Sửa thông tin đơn hàng"
              >
                <Edit2 size={13} />
                Sửa
              </button>
            )}

            {/* Cancel Button */}
            {order.platformStatus !== 'CANCELLED' && (
              <button
                onClick={() => setIsCancelModalOpen(true)}
                disabled={isLoadingAction}
                className="px-3 py-1.5 rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
              >
                <Ban size={13} />
                Hủy đơn
              </button>
            )}

            {/* Delete Button */}
            {onDelete && (
              <button
                onClick={() => onDelete(order)}
                className="px-3 py-1.5 rounded bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Xóa đơn hàng"
              >
                <Trash2 size={13} />
                Xóa
              </button>
            )}

            {/* Inspect Return Button (Only if dispatched or marked TO_RETURN) */}
            {(order.fulfillmentStatus === 'DISPATCHED' || order.platformStatus === 'TO_RETURN' || order.fulfillmentStatus === 'PARTIALLY_RETURN_RECEIVED') && (
              <button
                onClick={() => {
                  onClose();
                  navigate(`/order-returns?search=${encodeURIComponent(order.orderSn || order.trackingCode || '')}`);
                }}
                disabled={isLoadingAction}
                className="px-3 py-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Kiểm tra phân loại và xác nhận nhập hàng hoàn vào kho"
              >
                <RotateCcw size={13} />
                Kiểm tra & Nhập hoàn
                <ArrowUpRight size={12} />
              </button>
            )}
          </div>

          {/* Reserve Button if pending */}
          {order.fulfillmentStatus === 'PENDING_PROCESSING' && (
            <button
              onClick={handleReserve}
              disabled={isLoadingAction}
              className="w-full sm:w-auto px-4 py-2 sm:py-1.5 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Boxes size={14} />
              Giữ hàng (Reserve)
            </button>
          )}
        </div>
      </div>

      {/* Cancel Modal */}
      {isCancelModalOpen && (
        <Modal
          isOpen={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
          title={<><span className="sm:hidden">Hủy đơn hàng</span><span className="hidden sm:inline">Xác nhận hủy đơn hàng</span></>}
          subtitle={<span className="line-clamp-1 sm:line-clamp-none">Giải phóng số lượng giữ hàng (reserved) và cập nhật trạng thái đơn</span>}
          icon={Ban}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleCancel} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 sm:space-y-3.5 p-3 sm:p-5">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Nếu đơn chưa xuất kho, số lượng đã giữ hàng (reserved) sẽ được giải phóng ngay lập tức về kho thực tế.
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Lý do hủy đơn *
                </label>
                <textarea
                  required
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Nhập lý do hủy..."
                  className="w-full p-2.5 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#131720] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#5865f2]"
                />
              </div>
            </ModalBody>
            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => setIsCancelModalOpen(false)}
                className="flex-1 sm:flex-initial"
              >
                Đóng
              </ModalButton>
              <ModalButton
                variant="danger"
                type="submit"
                disabled={isLoadingAction}
                className="flex-1 sm:flex-initial"
              >
                Xác nhận hủy
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Return Modal */}
      {isReturnModalOpen && (
        <Modal
          isOpen={isReturnModalOpen}
          onClose={() => setIsReturnModalOpen(false)}
          title={<><span className="sm:hidden">Nhập lại hàng hoàn</span><span className="hidden sm:inline">Xác nhận nhập lại hàng hoàn</span></>}
          subtitle={<span className="line-clamp-1 sm:line-clamp-none">Cộng lại tồn kho thực tế và hạch toán vào sổ cái kế toán</span>}
          icon={RotateCcw}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleReceiveReturn} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 sm:space-y-3.5 p-3 sm:p-5">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Số lượng sản phẩm sẽ được cộng lại vào tồn kho thực tế (onHand) và ghi nhận vào sổ cái bất biến.
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Ghi chú kiểm tra hàng hoàn *
                </label>
                <input
                  type="text"
                  required
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  placeholder="Ghi chú kiểm tra tình trạng hàng..."
                  className="w-full px-3 py-2 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#131720] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#5865f2]"
                />
              </div>
            </ModalBody>
            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => setIsReturnModalOpen(false)}
                className="flex-1 sm:flex-initial"
              >
                Đóng
              </ModalButton>
              <ModalButton
                variant="primary"
                type="submit"
                disabled={isLoadingAction}
                className="flex-1 sm:flex-initial"
              >
                Nhập kho hoàn
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Modal Cấu hình Đơn Ảo */}
      {isVirtualModalOpen && (
        <Modal
          isOpen={isVirtualModalOpen}
          onClose={() => setIsVirtualModalOpen(false)}
          title="Thiết lập Đơn hàng ảo (Seeding / Buff đơn)"
          size="md"
        >
          <form onSubmit={(e) => { e.preventDefault(); handleSaveVirtual(); }}>
            <ModalBody>
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40 rounded flex items-start gap-2.5">
                  <Sparkles size={16} className="text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
                  <div className="text-gray-700 dark:text-gray-300">
                    <p className="font-semibold text-purple-900 dark:text-purple-300 mb-0.5">Quy tắc đơn ảo trong hệ thống</p>
                    <p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-400">
                      Đơn ảo (seeding) là đơn shop tự đặt để buff số bán hoặc đánh giá. Nếu <strong>không đi hàng thật</strong>, hệ thống sẽ bỏ qua việc trừ tồn kho khi quét xuất hàng, giúp số lượng tồn kho sản phẩm luôn chính xác.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <label className="flex items-start gap-3 p-3 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={virtualIsVirtual}
                      onChange={(e) => {
                        setVirtualIsVirtual(e.target.checked);
                        if (!e.target.checked) {
                          setVirtualIsRealGoods(false);
                        }
                      }}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 mt-0.5 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-white block">
                        Đánh dấu là đơn hàng ảo (Seeding / Buff đơn)
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        Bật cơ chế xử lý riêng biệt cho đơn ảo
                      </span>
                    </div>
                  </label>

                  {virtualIsVirtual && (
                    <div className="ml-6 pl-3 border-l-2 border-purple-300 dark:border-purple-700/60 space-y-2 animate-fade-in">
                      <label className="flex items-start gap-3 p-3 rounded border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/20 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={virtualIsRealGoods}
                          onChange={(e) => setVirtualIsRealGoods(e.target.checked)}
                          className="w-4 h-4 rounded text-[#5865f2] focus:ring-[#5865f2] mt-0.5 cursor-pointer"
                        />
                        <div>
                          <span className="font-semibold text-gray-900 dark:text-white block">
                            Có đi hàng thật (Vẫn trừ tồn kho)
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal">
                            {virtualIsRealGoods
                              ? 'Đơn ảo này VẪN gửi sản phẩm thật đi -> Hệ thống SẼ trừ tồn kho khi xuất kho.'
                              : 'Đơn ảo này KHÔNG gửi sản phẩm thật (hộp rỗng/thư cảm ơn) -> Hệ thống KHÔNG trừ tồn kho.'}
                          </span>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </ModalBody>
            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => setIsVirtualModalOpen(false)}
                disabled={isLoadingAction}
                className="flex-1 sm:flex-initial"
              >
                Hủy
              </ModalButton>
              <ModalButton
                variant="primary"
                type="submit"
                disabled={isLoadingAction}
                className="flex-1 sm:flex-initial"
              >
                {isLoadingAction ? 'Đang lưu...' : 'Lưu thiết lập'}
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </div>,
    document.body
  );
};
