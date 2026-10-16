import React, { useState, useEffect } from 'react';
import { X, Check, Package } from 'lucide-react';
import { CurrencyInput } from '../../components/ui/CurrencyInput';

export interface OrderEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onSave: (order: any) => void;
}

export const OrderEditModal: React.FC<OrderEditModalProps> = ({ isOpen, onClose, order, onSave }) => {
  const [formData, setFormData] = useState({
    trackingCode: '',
    orderCode: '',
    productName: '',
    variation: '',
    quantity: 1,
    codAmount: 0,
    orderDate: '',
    weight: '',
    carrier: '',
    recipient: '',
    recipientAddress: '',
  });

  useEffect(() => {
    if (order) {
      setFormData({
        trackingCode: order.trackingCode || '',
        orderCode: order.orderCode || '',
        productName: order.productName || '',
        variation: order.variation || '',
        quantity: order.quantity || 1,
        codAmount: order.codAmount || 0,
        orderDate: order.orderDate || '',
        weight: order.weight || '',
        carrier: order.carrier || '',
        recipient: order.recipient || '',
        recipientAddress: order.recipientAddress || '',
      });
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...order,
      ...formData,
      quantity: parseInt(formData.quantity as any, 10) || 1,
      codAmount: parseInt(formData.codAmount as any, 10) || 0,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#fbfbfa] dark:bg-[#131720] rounded shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-[#fbfbfa] dark:bg-[#131720]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded bg-indigo-50/80 dark:bg-indigo-500/10 text-[#5865f2] border border-indigo-100/50 dark:border-indigo-500/20 flex items-center justify-center font-bold">
              <Package size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Chỉnh sửa thông tin đơn</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Cập nhật chi tiết đơn hàng đã quét</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto custom-scrollbar space-y-4 text-sm flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Mã vận đơn</label>
              <input
                type="text"
                value={formData.trackingCode}
                onChange={(e) => setFormData({ ...formData, trackingCode: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-[2px] focus:ring-[#5865f2]/30 transition-all"
                placeholder="GYM..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Mã đơn hàng</label>
              <input
                type="text"
                value={formData.orderCode}
                onChange={(e) => setFormData({ ...formData, orderCode: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-[2px] focus:ring-[#5865f2]/30 transition-all"
                placeholder="2610..."
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tên sản phẩm</label>
            <textarea
              rows={2}
              value={formData.productName}
              onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-[2px] focus:ring-[#5865f2]/30 transition-all"
              placeholder="Tên sản phẩm..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Phân loại hàng</label>
              <input
                type="text"
                value={formData.variation}
                onChange={(e) => setFormData({ ...formData, variation: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-[2px] focus:ring-[#5865f2]/30 transition-all"
                placeholder="Màu, size, vị..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Số lượng</label>
              <input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value, 10) || 1 })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-[2px] focus:ring-[#5865f2]/30 transition-all font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tiền thu COD (VNĐ)</label>
              <CurrencyInput
                value={formData.codAmount}
                onChange={(val) => setFormData({ ...formData, codAmount: val })}
                placeholder="0"
                suffix="đ"
                inputClassName="px-3 py-2 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-emerald-600 dark:text-emerald-400 font-bold focus:outline-none focus:ring-[2px] focus:ring-[#5865f2]/30 transition-all font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Khối lượng</label>
              <input
                type="text"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-[2px] focus:ring-[#5865f2]/30 transition-all"
                placeholder="27,000 g"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Ngày đặt hàng</label>
              <input
                type="text"
                value={formData.orderDate}
                onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-[2px] focus:ring-[#5865f2]/30 transition-all"
                placeholder="11-10-2026 22:02"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Đơn vị vận chuyển</label>
              <input
                type="text"
                value={formData.carrier}
                onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-[2px] focus:ring-[#5865f2]/30 transition-all"
                placeholder="GHN, SPX..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Người nhận</label>
              <input
                type="text"
                value={formData.recipient}
                onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-[2px] focus:ring-[#5865f2]/30 transition-all"
                placeholder="Tên khách hàng"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Địa chỉ giao</label>
              <input
                type="text"
                value={formData.recipientAddress}
                onChange={(e) => setFormData({ ...formData, recipientAddress: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-[2px] focus:ring-[#5865f2]/30 transition-all"
                placeholder="Địa chỉ giao hàng"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-[36px] px-4 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="h-[36px] px-4 text-xs font-medium bg-[#5865f2] hover:bg-[#4752c4] text-white rounded flex items-center gap-1.5 shadow-none transition-colors cursor-pointer"
            >
              <Check size={14} /> Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
