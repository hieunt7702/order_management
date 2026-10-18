export interface VietQrBankInfo {
  code: string;
  shortName: string;
  name: string;
  bin: string;
}

export const POPULAR_BANKS: VietQrBankInfo[] = [
  { code: 'MB', shortName: 'MBBank', name: 'Ngân hàng Quân Đội', bin: '970422' },
  { code: 'VCB', shortName: 'Vietcombank', name: 'Ngoại Thương Việt Nam', bin: '970436' },
  { code: 'TCB', shortName: 'Techcombank', name: 'Kỹ Thương Việt Nam', bin: '970407' },
  { code: 'ACB', shortName: 'ACB', name: 'Á Châu', bin: '970416' },
  { code: 'VPB', shortName: 'VPBank', name: 'Việt Nam Thịnh Vượng', bin: '970432' },
  { code: 'BIDV', shortName: 'BIDV', name: 'Đầu tư và Phát triển', bin: '970418' },
  { code: 'ICB', shortName: 'VietinBank', name: 'Công Thương Việt Nam', bin: '970415' },
  { code: 'TPB', shortName: 'TPBank', name: 'Tiên Phong', bin: '970423' },
  { code: 'STB', shortName: 'Sacombank', name: 'Sài Gòn Thương Tín', bin: '970403' },
  { code: 'HDB', shortName: 'HDBank', name: 'Phát triển TP.HCM', bin: '970437' },
  { code: 'SHB', shortName: 'SHB', name: 'Sài Gòn - Hà Nội', bin: '970443' },
  { code: 'VIB', shortName: 'VIB', name: 'Quốc Tế Việt Nam', bin: '970441' },
  { code: 'MSB', shortName: 'MSB', name: 'Hàng Hải', bin: '970426' },
  { code: 'OCB', shortName: 'OCB', name: 'Phương Đông', bin: '970448' },
  { code: 'LPB', shortName: 'LPBank', name: 'Bưu điện Liên Việt', bin: '970449' },
  { code: 'SEAB', shortName: 'SeABank', name: 'Đông Nam Á', bin: '970440' },
  { code: 'TIMO', shortName: 'Timo', name: 'Timo by BanVietBank', bin: '963388' },
  { code: 'CAKE', shortName: 'CAKE', name: 'Cake by VPBank', bin: '546034' },
];

export function resolveVietQrBankCode(input?: string | null): string {
  if (!input) return 'MB';
  const raw = input.trim().toLowerCase();

  // Direct match code or shortName
  const exact = POPULAR_BANKS.find(
    (b) =>
      b.code.toLowerCase() === raw ||
      b.shortName.toLowerCase() === raw ||
      b.bin === raw,
  );
  if (exact) return exact.code;

  // Fuzzy match keywords
  if (raw.includes('mb') || raw.includes('quan doi')) return 'MB';
  if (raw.includes('vietcom') || raw.includes('vcb') || raw.includes('ngoai thuong')) return 'VCB';
  if (raw.includes('techcom') || raw.includes('tcb') || raw.includes('ky thuong')) return 'TCB';
  if (raw.includes('vietin') || raw.includes('icb') || raw.includes('ctg') || raw.includes('cong thuong')) return 'ICB';
  if (raw.includes('acb') || raw.includes('a chau')) return 'ACB';
  if (raw.includes('vp') || raw.includes('thinh vuong')) return 'VPB';
  if (raw.includes('bidv') || raw.includes('dau tu')) return 'BIDV';
  if (raw.includes('tp') || raw.includes('tien phong')) return 'TPB';
  if (raw.includes('saco') || raw.includes('stb')) return 'STB';
  if (raw.includes('hd') || raw.includes('hdbank')) return 'HDB';
  if (raw.includes('shb')) return 'SHB';
  if (raw.includes('vib')) return 'VIB';
  if (raw.includes('msb') || raw.includes('hang hai')) return 'MSB';
  if (raw.includes('ocb')) return 'OCB';
  if (raw.includes('lpb') || raw.includes('lien viet')) return 'LPB';
  if (raw.includes('sea')) return 'SEAB';

  // Fallback: strip spaces and punctuation, uppercase
  return input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'MB';
}

export function buildVietQrUrl(params: {
  bankName?: string | null;
  bankAccount?: string | null;
  bankBeneficiary?: string | null;
  amount?: number | null;
  description?: string | null;
  template?: 'compact' | 'compact2' | 'qr_only' | 'print';
}): string | null {
  if (!params.bankAccount) return null;
  const cleanAcc = params.bankAccount.replace(/\s+/g, '');
  if (!cleanAcc) return null;

  const bankCode = resolveVietQrBankCode(params.bankName);
  const template = params.template || 'compact2';

  let url = `https://img.vietqr.io/image/${bankCode}-${cleanAcc}-${template}.png`;
  const qp = new URLSearchParams();
  if (params.amount && params.amount > 0) {
    qp.set('amount', Math.round(params.amount).toString());
  }
  if (params.description?.trim()) {
    qp.set('addInfo', params.description.trim());
  }
  if (params.bankBeneficiary?.trim()) {
    qp.set('accountName', params.bankBeneficiary.trim());
  }
  const qs = qp.toString();
  return qs ? `${url}?${qs}` : url;
}
