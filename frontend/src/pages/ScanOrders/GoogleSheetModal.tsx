import React, { useState, useEffect } from 'react';
import {
  X,
  CloudUpload,
  Copy,
  Check,
  ExternalLink,
  HelpCircle,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import {
  pushOrdersToGoogleSheet,
  copyOrdersToClipboard,
  APPS_SCRIPT_TEMPLATE,
} from '../../utils/googleSheetSync';

interface GoogleSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  scannedOrders: any[];
  onSuccess?: (orders: any[]) => void;
}

export const GoogleSheetModal: React.FC<GoogleSheetModalProps> = ({
  isOpen,
  onClose,
  scannedOrders,
  onSuccess,
}) => {
  const DEFAULT_WEBHOOK_URL =
    (import.meta as any).env.VITE_SCAN_GOOGLE_SHEET_WEBHOOK ||
    'https://script.google.com/macros/s/AKfycbxDECmjyS8qsJDZy6NWoM7pi1Nl7eB3FtBDKZKEd26bF-ZznMu4Wwp0PdLbbTu8WDc6/exec';

  const [webhookUrl, setWebhookUrl] = useState<string>(() => {
    return localStorage.getItem('shopee_google_sheet_webhook') || DEFAULT_WEBHOOK_URL;
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [copiedTable, setCopiedTable] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  const TARGET_SHEET_URL =
    'https://docs.google.com/spreadsheets/d/1oEZWAOdYu4x2s5sCJUlxIJrRu3femE9a2wsN0UcG3rQ/edit?gid=863388700#gid=863388700';

  useEffect(() => {
    if (webhookUrl) {
      localStorage.setItem('shopee_google_sheet_webhook', webhookUrl);
    }
  }, [webhookUrl]);

  if (!isOpen) return null;

  const handlePushToSheet = async () => {
    if (!webhookUrl.trim()) {
      setStatusMsg({
        type: 'warning',
        text: 'Vui lòng dán URL Webhook (Apps Script) vào ô bên dưới, hoặc dùng nút "Sao chép bảng để dán"!',
      });
      setShowGuide(true);
      return;
    }

    if (scannedOrders.length === 0) {
      setStatusMsg({ type: 'warning', text: 'Chưa có đơn hàng nào để đẩy lên Google Sheet.' });
      return;
    }

    setIsSyncing(true);
    setStatusMsg(null);

    try {
      await pushOrdersToGoogleSheet(scannedOrders, webhookUrl.trim());
      setStatusMsg({
        type: 'success',
        text: `Đã gửi thành công ${scannedOrders.length} đơn lên Google Sheet!`,
      });
      if (onSuccess) onSuccess(scannedOrders);
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: `Lỗi kết nối: ${err.message}`,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyTable = () => {
    const success = copyOrdersToClipboard(scannedOrders);
    if (success) {
      setCopiedTable(true);
      setTimeout(() => setCopiedTable(false), 2500);
      setStatusMsg({
        type: 'success',
        text: 'Đã sao chép bảng đơn hàng! Mở Google Sheet và bấm Dán (Ctrl+V / Paste).',
      });
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-[#fbfbfa] dark:bg-[#131720] rounded shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden z-10 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0 bg-[#fbfbfa] dark:bg-[#131720]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded bg-emerald-50/80 dark:bg-emerald-500/10 text-[#10b981] border border-emerald-100/50 dark:border-emerald-500/20 flex items-center justify-center font-bold">
              <FileSpreadsheet size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                Đẩy lên Google Sheet
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Lưu STT, Mã vận đơn, Mã đơn hàng, Thời gian & Ngày quét
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 custom-scrollbar text-xs">
          {/* Status Message */}
          {statusMsg && (
            <div
              className={`p-3 rounded border flex items-start gap-2.5 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : statusMsg.type === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
              )}
              <span className="font-medium text-xs leading-relaxed">{statusMsg.text}</span>
            </div>
          )}

          {/* Target Sheet Info */}
          <div className="p-3 bg-gray-50 dark:bg-[#1a1b23] border border-gray-100 dark:border-gray-800 rounded flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
                Trang tính đích
              </span>
              <span className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200 truncate block mt-0.5">
                Tab gid: 863388700
              </span>
            </div>
            <a
              href={TARGET_SHEET_URL}
              target="_blank"
              rel="noreferrer"
              className="h-[32px] px-3 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 text-[#5865f2] border border-indigo-200/50 dark:border-indigo-500/30 rounded font-medium text-xs flex items-center gap-1 transition-colors shrink-0"
            >
              <span>Mở Sheet</span>
              <ExternalLink size={12} />
            </a>
          </div>

          {/* Primary Action 1: One-Click Copy Table to Clipboard */}
          <div className="p-3.5 bg-gray-50 dark:bg-[#1a1b23] border border-gray-100 dark:border-gray-800 rounded space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-gray-900 dark:text-white text-xs block">
                  Cách 1: Sao chép bảng & Dán trực tiếp vào Sheet
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 block">
                  Dán vào ô A1. Chỉ lưu 5 cột chuẩn (STT, Mã vận đơn, Mã đơn, Giờ, Ngày).
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopyTable}
                className="flex-1 h-[36px] bg-[#10b981] hover:bg-[#059669] text-white rounded font-medium text-xs flex items-center justify-center gap-1.5 shadow-none transition-colors cursor-pointer active:scale-95"
              >
                {copiedTable ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedTable ? 'Đã sao chép!' : `Sao chép ${scannedOrders.length} đơn`}</span>
              </button>
              {scannedOrders.length > 0 && (
                <button
                  onClick={() => {
                    if (onSuccess) onSuccess(scannedOrders);
                  }}
                  className="h-[36px] px-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded font-medium text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Đã dán xong -> Lưu vào lịch sử và làm mới danh sách để quét đợt tiếp theo"
                >
                  <RotateCcw size={13} />
                  <span>Lưu & Làm mới</span>
                </button>
              )}
            </div>
          </div>

          {/* Primary Action 2: Direct Push via Apps Script Webhook */}
          <div className="space-y-2.5 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900 dark:text-white text-xs">
                Cách 2: Đẩy tự động qua Webhook Apps Script
              </span>
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="text-[11px] text-[#5865f2] hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <HelpCircle size={12} />
                <span>{showGuide ? 'Ẩn hướng dẫn' : 'Xem cách lấy Webhook'}</span>
              </button>
            </div>

            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full h-[36px] px-3 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-[2px] focus:ring-[#5865f2]/30 font-mono transition-all"
            />

            <button
              onClick={handlePushToSheet}
              disabled={isSyncing || scannedOrders.length === 0}
              className={`w-full h-[36px] rounded font-medium text-xs flex items-center justify-center gap-1.5 shadow-none transition-all cursor-pointer ${
                isSyncing || scannedOrders.length === 0
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed border border-gray-200 dark:border-gray-800'
                  : 'bg-[#5865f2] hover:bg-[#4752c4] text-white active:scale-95'
              }`}
            >
              <CloudUpload size={14} />
              <span>
                {isSyncing
                  ? 'Đang gửi lên Sheet...'
                  : `Đẩy ${scannedOrders.length} đơn lên Google Sheet`}
              </span>
            </button>
          </div>

          {/* Guide Dropdown */}
          {showGuide && (
            <div className="p-3.5 bg-gray-50 dark:bg-[#1a1b23] border border-gray-100 dark:border-gray-800 rounded space-y-2.5 animate-slide-down">
              <span className="font-bold text-xs text-[#5865f2] block">
                📋 Hướng dẫn tạo Webhook 30 giây trong Google Sheet:
              </span>
              <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <li>Mở file Google Sheet của bạn.</li>
                <li>
                  Vào menu: <strong>Tiện ích mở rộng (Extensions)</strong> →{' '}
                  <strong>Apps Script</strong>.
                </li>
                <li>Xóa hết mã cũ và dán đoạn mã bên dưới vào.</li>
                <li>
                  Bấm <strong>Triển khai (Deploy)</strong> →{' '}
                  <strong>Tùy chọn triển khai mới (New deployment)</strong>.
                </li>
                <li>
                  Chọn loại: <strong>Ứng dụng web (Web app)</strong>.
                </li>
                <li>
                  Mục <em>Ai có quyền truy cập (Who has access)</em>: Chọn{' '}
                  <strong>Bất kỳ ai (Anyone)</strong>.
                </li>
                <li>Bấm <strong>Triển khai</strong> và sao chép đường link URL dán vào ô Webhook ở trên!</li>
              </ol>

              <button
                onClick={handleCopyScript}
                className="w-full h-[34px] bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded font-medium text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedScript ? (
                  <Check size={13} className="text-emerald-500" />
                ) : (
                  <Copy size={13} />
                )}
                <span>
                  {copiedScript ? 'Đã sao chép mã Apps Script!' : 'Sao chép đoạn mã Apps Script'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
