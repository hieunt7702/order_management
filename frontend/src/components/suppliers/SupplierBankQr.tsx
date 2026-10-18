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
    <div
      className={`bg-white dark:bg-[#161a22] rounded border border-gray-200 dark:border-gray-800 p-3 sm:p-3.5 flex flex-col items-center justify-between shadow-xs transition-colors duration-200 ${className}`}
    >
      {/* Header bar */}
      <div className="w-full flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded bg-[#5865f2]/10 dark:bg-[#5865f2]/20 flex items-center justify-center text-[#5865f2] shrink-0">
            <QrCode size={13} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-xs text-gray-900 dark:text-white flex items-center gap-1.5 leading-tight">
              <span>VietQR 24/7</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                Napas
              </span>
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
              {bankInfo?.shortName || supplier.bankName || 'Quét bằng app ngân hàng'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsZoomOpen(true)}
            className="p-1 rounded text-gray-400 hover:text-[#5865f2] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="Phóng to mã QR"
          >
            <Eye size={13} />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="p-1 rounded text-gray-400 hover:text-emerald-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="Tải ảnh mã QR"
          >
            <Download size={13} />
          </button>
        </div>
      </div>

      {/* QR Code Container */}
      <div className="my-2.5 p-2 rounded bg-gray-50/80 dark:bg-[#12141a] border border-gray-200/60 dark:border-gray-800/80 flex flex-col items-center justify-center w-full">
        {qrUrl && !imgError ? (
          <div
            className="relative group cursor-pointer overflow-hidden rounded bg-white p-1.5 shadow-2xs border border-gray-200/60 dark:border-gray-700/80"
            onClick={() => setIsZoomOpen(true)}
            title="Bấm để phóng to"
          >
            <img
              src={qrUrl}
              alt="VietQR Chuyển khoản"
              className="w-40 sm:w-44 h-auto max-w-full object-contain rounded transition-transform duration-200 group-hover:scale-[1.03]"
              onError={() => setImgError(true)}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-medium gap-1 rounded backdrop-blur-[1px]">
              <Eye size={13} />
              <span>Phóng to</span>
            </div>
          </div>
        ) : (
          <div className="w-36 h-36 flex flex-col items-center justify-center text-gray-400 text-xs">
            <QrCode size={28} className="mb-1 opacity-50" />
            <span>Không tải được QR</span>
          </div>
        )}
        <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 text-center select-none">
          Chạm để xem mã lớn
        </span>
      </div>

      {/* Quick Copy Action Chips */}
      <div className="w-full flex flex-wrap items-center justify-center gap-1.5 pt-0.5 shrink-0">
        {supplier.bankAccount && (
          <button
            type="button"
            onClick={() => handleCopy(supplier.bankAccount || '', 'Số tài khoản')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer text-[10px] font-mono font-medium border border-gray-200/60 dark:border-gray-700/60"
            title="Sao chép số tài khoản"
          >
            {copiedField === 'Số tài khoản' ? (
              <Check size={11} className="text-emerald-500 shrink-0" />
            ) : (
              <CreditCard size={11} className="text-[#5865f2] shrink-0" />
            )}
            <span className="truncate max-w-[130px]">{supplier.bankAccount}</span>
            <Copy size={10} className="text-gray-400 shrink-0 opacity-70" />
          </button>
        )}
        {description && (
          <button
            type="button"
            onClick={() => handleCopy(description, 'Nội dung')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-50/80 dark:bg-indigo-950/40 text-[#5865f2] dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer text-[10px] font-medium border border-indigo-200/50 dark:border-indigo-800/50"
            title="Sao chép nội dung chuyển khoản"
          >
            {copiedField === 'Nội dung' ? (
              <Check size={11} className="text-emerald-500 shrink-0" />
            ) : (
              <FileText size={11} className="text-[#5865f2] shrink-0" />
            )}
            <span>Nội dung CK</span>
            <Copy size={10} className="opacity-70 shrink-0" />
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
            className="relative bg-white dark:bg-[#181b22] rounded p-4 max-w-xs sm:max-w-sm w-full space-y-3.5 shadow-2xl border border-gray-200 dark:border-gray-800"
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

            <div className="flex flex-col items-center justify-center p-2 rounded bg-gray-50 dark:bg-[#12141a] border border-gray-200/60 dark:border-gray-800">
              <img
                src={qrUrl}
                alt="VietQR Phóng to"
                className="w-full h-auto object-contain rounded bg-white p-2 shadow-xs"
              />
            </div>

            <button
              type="button"
              onClick={handleDownload}
              className="w-full py-2 px-3 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
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
