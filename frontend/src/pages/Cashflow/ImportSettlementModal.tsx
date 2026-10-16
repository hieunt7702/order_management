import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import {
  cashflowApi,
  CashAccountModel,
  SettlementRowPayload,
} from '../../services/cashflowApi';
import { toast } from '../../components/ui/Toast';

interface ImportSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shops: Array<{ id: string; name: string }>;
  accounts: CashAccountModel[];
}

export const ImportSettlementModal: React.FC<ImportSettlementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  shops,
  accounts,
}) => {
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [creditToWallet, setCreditToWallet] = useState<boolean>(true);
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [rawText, setRawText] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<SettlementRowPayload[]>([]);
  const [parsingError, setParsingError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Filter platform wallet accounts
  const platformAccounts = accounts.filter((a) => a.type === 'PLATFORM_WALLET');

  React.useEffect(() => {
    if (isOpen) {
      setRawText('');
      setParsedRows([]);
      setParsingError('');
      setImportResult(null);

      if (shops.length > 0 && !selectedShopId) {
        setSelectedShopId(shops[0].id);
      }
      if (platformAccounts.length > 0 && !targetAccountId) {
        setTargetAccountId(platformAccounts[0].id);
      } else if (accounts.length > 0 && !targetAccountId) {
        setTargetAccountId(accounts[0].id);
      }
    }
  }, [isOpen, shops, accounts]);

  // Helper parsing CSV / TSV text
  const handleParseData = (text: string) => {
    setRawText(text);
    setParsingError('');
    setImportResult(null);

    if (!text.trim()) {
      setParsedRows([]);
      return;
    }

    try {
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) {
        setParsingError('Dữ liệu cần tối thiểu 1 dòng tiêu đề và 1 dòng dữ liệu.');
        return;
      }

      // Xác định delimiter (, hoặc \t hoặc ;)
      const firstLine = lines[0];
      let delimiter = '\t';
      if (firstLine.includes('\t')) delimiter = '\t';
      else if (firstLine.includes(';')) delimiter = ';';
      else if (firstLine.includes(',')) delimiter = ',';

      const headers = firstLine.split(delimiter).map((h) => h.trim().toLowerCase());

      // Tìm index của các cột quan trọng
      const orderIdIdx = headers.findIndex(
        (h) =>
          h.includes('mã đơn') ||
          h.includes('order id') ||
          h.includes('order sn') ||
          h.includes('mã đơn hàng'),
      );
      const payoutIdx = headers.findIndex(
        (h) =>
          h.includes('thực nhận') ||
          h.includes('payout') ||
          h.includes('quyết toán') ||
          h.includes('tiền chuyển') ||
          h.includes('tổng tiền thực nhận'),
      );
      const buyerPaidIdx = headers.findIndex(
        (h) =>
          h.includes('người mua trả') ||
          h.includes('buyer') ||
          h.includes('tổng giá trị đơn hàng') ||
          h.includes('tổng tiền thanh toán'),
      );
      const feeIdx = headers.findIndex(
        (h) => h.includes('phí cố định') || h.includes('commission') || h.includes('phí sàn'),
      );
      const serviceIdx = headers.findIndex(
        (h) => h.includes('phí dịch vụ') || h.includes('service fee'),
      );
      const transIdx = headers.findIndex(
        (h) => h.includes('phí thanh toán') || h.includes('transaction fee'),
      );
      const shippingIdx = headers.findIndex(
        (h) => h.includes('phí vận chuyển') || h.includes('shipping fee'),
      );
      const adjustIdx = headers.findIndex(
        (h) => h.includes('điều chỉnh') || h.includes('adjustment') || h.includes('bồi thường'),
      );

      if (orderIdIdx === -1) {
        setParsingError(
          'Không tìm thấy cột Mã đơn hàng (Order SN / Mã đơn hàng). Vui lòng kiểm tra file.',
        );
        return;
      }

      const rows: SettlementRowPayload[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(delimiter).map((c) => c.replace(/["']/g, '').trim());
        const extId = cols[orderIdIdx];
        if (!extId) continue;

        const parseNum = (idx: number) => {
          if (idx === -1 || !cols[idx]) return 0;
          // Loại bỏ dấu . hoặc , ngăn cách hàng nghìn
          const clean = cols[idx].replace(/[^0-9.-]/g, '');
          const val = parseFloat(clean);
          return isNaN(val) ? 0 : val;
        };

        const actualPayout = payoutIdx !== -1 ? parseNum(payoutIdx) : 0;
        const buyerPaid = buyerPaidIdx !== -1 ? parseNum(buyerPaidIdx) : 0;
        const commFee = feeIdx !== -1 ? parseNum(feeIdx) : 0;
        const servFee = serviceIdx !== -1 ? parseNum(serviceIdx) : 0;
        const txFee = transIdx !== -1 ? parseNum(transIdx) : 0;
        const shipFee = shippingIdx !== -1 ? parseNum(shippingIdx) : 0;
        const adj = adjustIdx !== -1 ? parseNum(adjustIdx) : 0;

        rows.push({
          externalOrderId: extId,
          actualPayout,
          buyerPaidAmount: buyerPaid,
          commissionFee: commFee,
          serviceFee: servFee,
          transactionFee: txFee,
          shippingFee: shipFee,
          adjustmentAmount: adj,
          settledAt: new Date().toISOString(),
        });
      }

      if (rows.length === 0) {
        setParsingError('Không trích xuất được dòng dữ liệu hợp lệ nào.');
      } else {
        setParsedRows(rows);
      }
    } catch (e: any) {
      setParsingError(`Lỗi xử lý dữ liệu: ${e.message}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleParseData(content);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!selectedShopId) {
      toast.warning('Vui lòng chọn Shop đối soát');
      return;
    }
    if (parsedRows.length === 0) {
      toast.warning('Vui lòng upload hoặc dán dữ liệu quyết toán');
      return;
    }

    setSubmitting(true);
    try {
      const res = await cashflowApi.importSettlement({
        shopId: selectedShopId,
        creditToAccountId: creditToWallet ? targetAccountId : undefined,
        rows: parsedRows,
      });

      setImportResult(res);
      toast.success(
        `Đối soát thành công! Khớp: ${res.matchedCount} đơn, Cần kiểm tra: ${res.needsCheckCount} đơn, Chưa khớp: ${res.unmatchedCount} đơn.`,
      );
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra khi đối soát');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPayout = parsedRows.reduce((acc, r) => acc + (r.actualPayout || 0), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      title="Đối soát File Quyết toán & Doanh thu Shopee"
      subtitle="Ghép tiền thực nhận và các khoản phí sàn với đơn hàng, cập nhật số dư ví sàn"
      icon={FileSpreadsheet}
    >
      <ModalBody className="space-y-4 p-6 max-h-[75vh] overflow-y-auto">
        {/* Hướng dẫn nguyên tắc quan trọng */}
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold mb-0.5">Quy tắc chuẩn hóa dòng tiền sàn Shopee:</div>
            File đơn hàng chỉ cập nhật sản phẩm & số lượng (chưa thu tiền). File quyết toán này xác
            nhận tiền đã về Ví Shopee. Khi bạn rút tiền từ Ví Shopee về MB Bank, dùng nút{' '}
            <b>"Chuyển tiền nội bộ"</b> để tránh tính trùng doanh thu lần thứ hai!
          </div>
        </div>

        {/* Chọn shop & Tài khoản nhận tiền */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Shop thực hiện đối soát <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold focus:outline-none"
            >
              <option value="">-- Chọn Shop --</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Ghi nhận vào Ví sàn Shopee
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={creditToWallet}
                  onChange={(e) => setCreditToWallet(e.target.checked)}
                  className="rounded text-emerald-600 w-3.5 h-3.5"
                />
                Tự động tăng số dư ví
              </label>
            </div>
            <select
              disabled={!creditToWallet}
              value={targetAccountId}
              onChange={(e) => setTargetAccountId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium focus:outline-none disabled:opacity-50"
            >
              {platformAccounts.length > 0 ? (
                platformAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (Số dư: {Number(acc.currentBalance).toLocaleString('vi-VN')}đ)
                  </option>
                ))
              ) : (
                accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Upload file hoặc dán nội dung */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Dữ liệu file quyết toán (CSV, TSV hoặc Excel copy)
            </label>
            <label className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer font-medium flex items-center gap-1">
              <Upload className="w-3.5 h-3.5" />
              Tải file .csv / .txt
              <input
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
          <textarea
            rows={5}
            value={rawText}
            onChange={(e) => handleParseData(e.target.value)}
            placeholder={`Dán nội dung từ file Shopee export (hoặc copy từ Excel)...
Ví dụ cột:
Mã đơn hàng	Tổng tiền người mua trả	Số tiền thực nhận	Phí cố định	Phí dịch vụ	Phí thanh toán
241015ABCDEF1	150000	135000	6000	4500	4500`}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {parsingError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            {parsingError}
          </div>
        )}

        {/* Preview kết quả trích xuất */}
        {parsedRows.length > 0 && (
          <div className="p-3.5 bg-slate-100 dark:bg-slate-800/60 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Đã nhận diện: {parsedRows.length} đơn hàng</span>
              <span className="text-emerald-600 dark:text-emerald-400">
                Tổng tiền thực nhận: {totalPayout.toLocaleString('vi-VN')}đ
              </span>
            </div>

            <div className="max-h-36 overflow-y-auto text-[11px] divide-y divide-slate-200 dark:divide-slate-700 font-mono bg-white dark:bg-slate-900 rounded-lg p-2">
              {parsedRows.slice(0, 10).map((r, i) => (
                <div key={i} className="py-1 flex justify-between items-center">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {r.externalOrderId}
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    Quyết toán: {r.actualPayout?.toLocaleString('vi-VN')}đ (Phí:{' '}
                    {(
                      (r.commissionFee || 0) +
                      (r.serviceFee || 0) +
                      (r.transactionFee || 0)
                    ).toLocaleString('vi-VN')}
                    đ)
                  </span>
                </div>
              ))}
              {parsedRows.length > 10 && (
                <div className="py-1 text-center text-slate-400 italic">
                  ...và còn {parsedRows.length - 10} đơn khác
                </div>
              )}
            </div>
          </div>
        )}

        {/* Kết quả đối soát sau khi bấm Submit */}
        {importResult && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl space-y-2">
            <div className="font-bold text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Kết quả đối soát thành công:
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg text-center">
                <div className="text-slate-400">Khớp hoàn toàn</div>
                <div className="text-emerald-600 font-bold text-base">
                  {importResult.matchedCount}
                </div>
              </div>
              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg text-center">
                <div className="text-slate-400">Cần kiểm tra</div>
                <div className="text-amber-600 font-bold text-base">
                  {importResult.needsCheckCount}
                </div>
              </div>
              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg text-center">
                <div className="text-slate-400">Chưa tìm thấy đơn</div>
                <div className="text-rose-600 font-bold text-base">
                  {importResult.unmatchedCount}
                </div>
              </div>
            </div>
          </div>
        )}
      </ModalBody>

      <ModalFooter className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
        <ModalButton variant="secondary" onClick={onClose} disabled={submitting}>
          Đóng
        </ModalButton>

        <button
          type="button"
          disabled={submitting || parsedRows.length === 0}
          onClick={handleSubmit}
          className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
        >
          <CheckCircle2 className="w-4 h-4" />
          {submitting
            ? 'Đang xử lý ghép đơn...'
            : `Tiến hành đối soát (${parsedRows.length} đơn)`}
        </button>
      </ModalFooter>
    </Modal>
  );
};
