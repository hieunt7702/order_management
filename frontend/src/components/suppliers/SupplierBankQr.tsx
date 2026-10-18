import React, { useState } from 'react';
import {
  QrCode,
  Copy,
  Check,
  Download,
  AlertCircle,
  Eye,
  X,
  CreditCard,
  FileText,
} from 'lucide-react';
import { buildVietQrUrl, resolveVietQrBankCode, POPULAR_BANKS } from '../../utils/vietqr';
import { toast } from '../ui/Toast';

export interface SupplierBankQrProps {
  supplier?: {
    id?: string;
    code?: string;
    name?: string;
    bankName?: string | null;
    bankAccount?: string | null;
    bankBeneficiary?: string | null;
  } | null;
  amount?: number;
  description?: string;
  className?: string;
  compact?: boolean;
}

export const SupplierBankQr: React.FC<SupplierBankQrProps> = ({
  supplier,
  amount = 0,
  description = '',
  className = '',
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  if (!supplier) return null;

  const hasBank = !!supplier.bankAccount?.trim();
  const bankCode = resolveVietQrBankCode(supplier.bankName);
  const bankInfo = POPULAR_BANKS.find((b) => b.code === bankCode);

  const qrUrl = hasBank
    ? buildVietQrUrl({
        bankName: supplier.bankName,
        bankAccount: supplier.bankAccount,
        bankBeneficiary: supplier.bankBeneficiary,
        amount: amount > 0 ? amount : undefined,
        description: description || `Thanh toan NCC ${supplier.code || supplier.name}`,
        template: 'compact2',
      })
    : null;

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Đã sao chép ${fieldName}`);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const handleDownload = () => {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `VietQR_${supplier.code || 'NCC'}_${amount || 0}.png`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!hasBank) {
    return (
      <div
        className={`p-3 rounded bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300 ${className}`}
      >
        <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Chưa có thông tin tài khoản:</span>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
            Nhà cung cấp chưa cấu hình Ngân hàng & STK. Vui lòng cập nhật thông tin trong mục Quản lý NCC.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center w-full space-y-3 ${className}`}>
      {/* Thông tin ngân hàng & thao tác nhanh */}
      <div className="w-full flex items-center justify-between px-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#5865f2]/10 text-[#5865f2] dark:bg-[#5865f2]/20 dark:text-[#8ea1e1] shrink-0">
            {bankInfo?.shortName || supplier.bankName || 'VietQR'}
          </div>
          {supplier.bankBeneficiary && (
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[180px]">
              {supplier.bankBeneficiary}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsZoomOpen(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-[#5865f2] hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-colors cursor-pointer"
            title="Phóng to mã QR"
          >
            <Eye size={15} />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-colors cursor-pointer"
            title="Tải ảnh mã QR"
          >
            <Download size={15} />
          </button>
        </div>
      </div>

      {/* QR Code Container - Seamless elevated presentation */}
      <div className="flex flex-col items-center justify-center w-full">
        {qrUrl && !imgError ? (
          <div
            className="relative group cursor-pointer overflow-hidden rounded-2xl bg-white p-3 shadow-md hover:shadow-lg transition-all duration-200"
            onClick={() => setIsZoomOpen(true)}
            title="Bấm để phóng to mã QR"
          >
            <img
              src={qrUrl}
              alt="VietQR Chuyển khoản"
              className="w-48 sm:w-52 h-auto max-w-full object-contain rounded-lg transition-transform duration-200 group-hover:scale-[1.02]"
              onError={() => setImgError(true)}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-1.5 rounded-2xl backdrop-blur-[1px]">
              <Eye size={16} />
              <span>Phóng to mã QR</span>
            </div>
          </div>
        ) : (
          <div className="w-48 h-48 flex flex-col items-center justify-center text-gray-400 text-xs rounded-2xl bg-gray-50 dark:bg-gray-800/40">
            <QrCode size={32} className="mb-2 opacity-50 text-gray-400" />
            <span>Không tải được mã QR</span>
          </div>
        )}
        <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 text-center select-none">
          Chạm vào mã để phóng to toàn màn hình
        </span>
      </div>

      {/* Quick Copy Action Chips */}
      <div className="w-full flex flex-wrap items-center justify-center gap-2 pt-1">
        {supplier.bankAccount && (
          <button
            type="button"
            onClick={() => handleCopy(supplier.bankAccount || '', 'Số tài khoản')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all cursor-pointer text-xs font-mono font-semibold shadow-xs"
            title="Sao chép số tài khoản"
          >
            {copiedField === 'Số tài khoản' ? (
              <Check size={13} className="text-emerald-500 shrink-0" />
            ) : (
              <CreditCard size={13} className="text-[#5865f2] shrink-0" />
            )}
            <span className="truncate max-w-[140px]">{supplier.bankAccount}</span>
            <Copy size={12} className="text-gray-400 shrink-0 opacity-70" />
          </button>
        )}
        {description && (
          <button
            type="button"
            onClick={() => handleCopy(description, 'Nội dung')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5865f2]/10 dark:bg-[#5865f2]/20 text-[#5865f2] dark:text-[#8ea1e1] hover:bg-[#5865f2]/20 dark:hover:bg-[#5865f2]/30 active:scale-95 transition-all cursor-pointer text-xs font-medium shadow-xs"
            title="Sao chép nội dung chuyển khoản"
          >
            {copiedField === 'Nội dung' ? (
              <Check size={13} className="text-emerald-500 shrink-0" />
            ) : (
              <FileText size={13} className="text-[#5865f2] shrink-0" />
            )}
            <span>Nội dung CK</span>
            <Copy size={12} className="opacity-70 shrink-0" />
          </button>
        )}
      </div>

      {/* Modal Zoom QR */}
      {isZoomOpen && qrUrl && (
        <div
          className="fixed inset-0 z-[120] bg-black/75 dark:bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsZoomOpen(false)}
        >
          <div
            className="relative bg-white dark:bg-[#181b22] rounded-xl p-4 max-w-xs sm:max-w-sm w-full space-y-3.5 shadow-2xl border border-gray-200 dark:border-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h4 className="font-semibold text-xs text-gray-900 dark:text-white">
                  Mã QR Chuyển khoản VietQR
                </h4>
                <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[220px]">
                  {supplier.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsZoomOpen(false)}
                className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-white shadow-xs">
              <img
                src={qrUrl}
                alt="VietQR Phóng to"
                className="w-full h-auto object-contain rounded"
              />
            </div>

            <button
              type="button"
              onClick={handleDownload}
              className="w-full py-2 px-3 rounded-lg bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
            >
              <Download size={13} />
              <span>Tải ảnh mã QR về máy</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
