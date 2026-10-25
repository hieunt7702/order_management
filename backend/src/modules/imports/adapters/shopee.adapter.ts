import { PlatformOrderStatus } from '@prisma/client';

export interface RawShopeeRow {
  orderCode: string;
  packageCode?: string;
  orderDate?: string;
  orderStatus?: string;
  trackingCode?: string;
  carrier?: string;
  productSku?: string;
  productName: string;
  variationSku?: string;
  variationName?: string;
  originalPrice?: number;
  discountedPrice?: number;
  rawQuantity: number;
  packMultiplier: number;
  quantity: number;
  canonicalSku: string;
  totalPaidByBuyer?: number;
  completedAt?: string;
  paidAt?: string;
  buyerUsername?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  fixedFee?: number;
  serviceFee?: number;
  transactionFee?: number;
  shippingFee?: number;
  raw: Record<string, any>;
  rowNumber: number;
}

export interface ParsedShopeeOrder {
  externalOrderId: string;
  platformStatus: PlatformOrderStatus;
  rawStatus: string;
  orderDate?: Date;
  paidAt?: Date;
  completedAt?: Date;
  trackingCode?: string;
  carrier?: string;
  buyerUsername?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  totalAmount: number;
  shippingFee: number;
  packageCode?: string;
  items: {
    externalSku: string;
    canonicalSku: string;
    productName: string;
    variationName?: string;
    rawQuantity: number;
    packMultiplier: number;
    quantity: number;
    originalPrice: number;
    discountedPrice: number;
    rowNumber: number;
  }[];
  fees: {
    fixedFee: number;
    serviceFee: number;
    transactionFee: number;
  };
}

export class ShopeeAdapter {
  static normalizePlatformStatus(
    rawStatus: string | undefined,
    row?: Record<string, any>,
  ): PlatformOrderStatus {
    if (!rawStatus && !row) return PlatformOrderStatus.READY_TO_SHIP;

    // 0. Helper to check if a signal represents negative / empty / non-actionable state
    const isNegativeOrEmpty = (val: string): boolean => {
      const c = val.trim().toLowerCase();
      if (!c || c === '-' || c === 'n/a' || c === 'none' || c === 'null' || c === 'undefined' || c === '0' || c === 'false') {
        return true;
      }
      if (
        c === 'không' ||
        c === 'khong' ||
        c === 'không có' ||
        c === 'khong co' ||
        c === 'chưa' ||
        c === 'chua' ||
        c === 'chưa có' ||
        c === 'chua co' ||
        c === 'bình thường' ||
        c === 'binh thuong'
      ) {
        return true;
      }
      if (
        c.startsWith('không có') ||
        c.startsWith('khong co') ||
        c.startsWith('chưa có') ||
        c.startsWith('chua co') ||
        c.startsWith('không ') ||
        c.startsWith('khong ') ||
        c.startsWith('chưa ') ||
        c.startsWith('chua ') ||
        c.includes('không có yêu cầu') ||
        c.includes('chưa có yêu cầu') ||
        c.includes('không có lý do') ||
        c.includes('chưa có lý do') ||
        c.includes('không có khiếu nại')
      ) {
        return true;
      }
      return false;
    };

    let hasReturnCode = false;
    let extraSignals = '';
    if (row && typeof row === 'object') {
      const returnCodeKeys = [
        'Return Code',
        'Mã Trả hàng',
        'Mã hoàn hàng',
        'Mã yêu cầu trả hàng',
        'return_code',
        'return_id',
      ];
      for (const k of returnCodeKeys) {
        const val = row[k];
        if (val !== undefined && val !== null) {
          const cleanVal = String(val).trim();
          if (!isNegativeOrEmpty(cleanVal)) {
            hasReturnCode = true;
            extraSignals += ' return ' + cleanVal.toLowerCase();
          }
        }
      }

      const candidateKeys = [
        'Trạng thái Trả hàng/Hoàn tiền',
        'Trạng thái trả hàng',
        'Trạng thái hoàn tiền',
        'Trạng thái yêu cầu trả hàng/hoàn tiền',
        'return_refund_status',
        'return_status',
        'Trạng thái giao hàng',
        'shipping_status',
        'logistics_status',
        'Lý do hủy',
        'Lý do trả hàng',
        'cancel_reason',
        'return_reason',
      ];
      for (const k of candidateKeys) {
        const val = row[k];
        if (val !== undefined && val !== null) {
          const cleanVal = String(val).trim();
          if (!isNegativeOrEmpty(cleanVal)) {
            extraSignals += ' ' + cleanVal.toLowerCase();
          }
        }
      }
    }

    const s = `${rawStatus || ''} ${extraSignals}`.trim().toLowerCase();
    if (!s) return PlatformOrderStatus.READY_TO_SHIP;

    // Special Shopee buyer confirmed receipt clause check:
    // Shopee string: "Người mua xác nhận đã nhận được hàng, tuy nhiên Người mua vẫn có thể gửi yêu cầu Trả hàng/Hoàn tiền tới ngày YYYY-MM-DD."
    const isBuyerConfirmedReceiptWithReturnDeadline =
      (s.includes('người mua xác nhận đã nhận được hàng') ||
        s.includes('xác nhận đã nhận được hàng') ||
        s.includes('đã nhận được hàng')) &&
      s.includes('tuy nhiên');

    // 1. Check Return / Refund FIRST (unless it's just the buyer confirmed receipt clause above)
    if (!isBuyerConfirmedReceiptWithReturnDeadline) {
      // 1a. Completed Refund / Completed Return
      if (
        s.includes('đã hoàn tiền') ||
        s.includes('hoàn tiền thành công') ||
        s.includes('đã trả hàng') ||
        s.includes('refunded') ||
        s.includes('trả hàng thành công') ||
        s.includes('hoàn tất trả hàng') ||
        s.includes('return_refund')
      ) {
        return PlatformOrderStatus.RETURN_REFUND;
      }

      // 1b. In-progress Return / Returning to seller / Return request
      if (
        hasReturnCode ||
        s.includes('sent back to seller') ||
        s.includes('order is being sent back to seller') ||
        s.includes('return code') ||
        s.includes('chuyển hoàn') ||
        s.includes('đang chuyển hoàn') ||
        s.includes('hàng chuyển hoàn') ||
        s.includes('trả hàng') ||
        s.includes('hoàn tiền') ||
        s.includes('yêu cầu trả hàng') ||
        s.includes('yêu cầu hoàn tiền') ||
        s.includes('trả hàng/hoàn tiền') ||
        s.includes('tra hang') ||
        s.includes('hoan tien') ||
        s.includes('to_return') ||
        s.includes('đang hoàn') ||
        s.includes('đang trả') ||
        s.includes('khiếu nại') ||
        s.includes('returning') ||
        s.includes('returned')
      ) {
        return PlatformOrderStatus.TO_RETURN;
      }
    }

    // 2. Completed
    if (s.includes('hoàn thành') || s === 'completed') {
      return PlatformOrderStatus.COMPLETED;
    }

    // 3. Buyer confirmed receipt or Delivered (Delivered to buyer)
    if (
      isBuyerConfirmedReceiptWithReturnDeadline ||
      s.includes('người mua xác nhận đã nhận được hàng') ||
      s.includes('xác nhận đã nhận được hàng') ||
      s.includes('đã nhận được hàng') ||
      s.includes('giao hàng thành công') ||
      s.includes('đã giao thành công') ||
      s.includes('đã giao hàng') ||
      (s.includes('đã giao') &&
        !s.includes('đã giao cho đvvc') &&
        !s.includes('đã giao cho đơn vị vận chuyển')) ||
      s === 'delivered'
    ) {
      return PlatformOrderStatus.TO_CONFIRM_RECEIVE;
    }

    // 4. Ready to ship / Preparing to ship / Chuẩn bị giao hàng
    // Check this before "Shipping" to avoid false matches on "chuẩn bị giao"
    if (
      s.includes('chờ giao hàng') ||
      s.includes('chờ lấy hàng') ||
      s.includes('đang chuẩn bị hàng') ||
      s.includes('đang chuẩn bị giao') ||
      s.includes('chuẩn bị giao') ||
      s.includes('chuẩn bị hàng') ||
      s.includes('chờ giao') ||
      s.includes('ready to ship') ||
      s.includes('ready_to_ship') ||
      s.includes('chờ xử lý')
    ) {
      return PlatformOrderStatus.READY_TO_SHIP;
    }

    // 5. Cancelled
    if (s.includes('đã hủy') || s.includes('cancelled') || s === 'canceled') {
      return PlatformOrderStatus.CANCELLED;
    }

    // 6. In cancellation process / Cancellation requested
    if (s.includes('chờ xác nhận hủy') || s.includes('yêu cầu hủy') || s.includes('in_cancel')) {
      return PlatformOrderStatus.IN_CANCEL;
    }

    // 7. Delivery retry / Failed delivery attempt
    if (s.includes('giao lại') || s.includes('giao không thành công') || s.includes('retry_ship')) {
      return PlatformOrderStatus.RETRY_SHIP;
    }

    // 8. Shipping / In transit (including standard "Đã giao cho ĐVVC" when not a return)
    if (
      s.includes('đang giao') ||
      s.includes('shipped') ||
      s.includes('in_transit') ||
      s.includes('đã giao cho đvvc') ||
      s.includes('đã giao cho đơn vị vận chuyển')
    ) {
      return PlatformOrderStatus.SHIPPED;
    }

    // 9. Unpaid
    if (s.includes('chưa thanh toán') || s.includes('unpaid')) {
      return PlatformOrderStatus.UNPAID;
    }

    return PlatformOrderStatus.READY_TO_SHIP;
  }

  static parseDate(dateStr: string | undefined): Date | undefined {
    if (!dateStr || typeof dateStr !== 'string') return undefined;
    const clean = dateStr.trim();
    if (!clean) return undefined;

    // Handle 'YYYY-MM-DD HH:mm' or 'YYYY-MM-DD HH:mm:ss'
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      return d;
    }
    return undefined;
  }

  static parseNumber(val: any): number {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    const clean = String(val).replace(/,/g, '').trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }

  static extractPackMultiplier(variationName?: string): number {
    if (!variationName || typeof variationName !== 'string') return 1;
    const clean = variationName.trim();
    if (!clean) return 1;

    // 1. Thùng/thung: 'Combo 2 thùng', '2 thùng', 'COMBO 3 THÙNG', 'combo 4 thùng', '1 thùng 200', '3 thùng'
    const thungMatch = clean.match(/(?:combo|set)?\s*(\d+)\s*(?:thùng|thung)/i);
    if (thungMatch) return parseInt(thungMatch[1], 10);

    // 2. Combo X gói/chai/can/hộp/bịch/cây/lốc/ly: '20 gói ( 40 chân )', '10 gói', '12 cây vani', 'Combo 20 t.bằm'
    const packMatch = clean.match(/^(?:combo\s*)?(\d+)\s*(?:chai|hộp|hop|can|lon|gói|goi|bịch|bich|cây|cay|lốc|loc|ly|túi|tui)\b/i);
    if (packMatch) return parseInt(packMatch[1], 10);

    // 3. '3 gói + 1bim', '10 gói +4bim'
    const plusMatch = clean.match(/^(\d+)\s*(?:gói|goi)/i);
    if (plusMatch) return parseInt(plusMatch[1], 10);

    // 4. 'Combo 20 ...'
    const comboMatch = clean.match(/^combo\s*(\d+)\b/i);
    if (comboMatch) return parseInt(comboMatch[1], 10);

    // 5. '3 thùng' or '4 thùng' anywhere
    const anyThung = clean.match(/(\d+)\s*(?:thùng|thung)/i);
    if (anyThung) return parseInt(anyThung[1], 10);

    return 1;
  }

  static generateCanonicalSku(productName: string, variationName?: string, sellerSku?: string): string {
    if (sellerSku && sellerSku.trim()) {
      return sellerSku.trim();
    }
    const cleanProd = (productName || 'UNKNOWN').trim().replace(/[:\s]+/g, ' ');
    const cleanVar = (variationName || 'DEFAULT').trim().replace(/[:\s]+/g, ' ');
    return `NAME::${cleanProd}::${cleanVar}`;
  }

  static mapRow(row: Record<string, any>, rowNumber: number): RawShopeeRow | null {
    // String preservation: Ensure Order ID and Tracking Code are never cast to float/number
    const rawOrderCode = row['Mã đơn hàng'] ?? row['order_sn'] ?? row['Mã đơn'];
    if (!rawOrderCode) return null;

    const orderCode = String(rawOrderCode).trim();
    if (!orderCode) return null;

    const packageCode = row['Mã Kiện Hàng'] || row['package_number'] ? String(row['Mã Kiện Hàng'] || row['package_number']).trim() : undefined;
    const trackingCode = row['Mã vận đơn'] || row['tracking_number'] ? String(row['Mã vận đơn'] || row['tracking_number']).trim() : undefined;
    const carrier = row['Đơn Vị Vận Chuyển'] || row['shipping_carrier'] ? String(row['Đơn Vị Vận Chuyển'] || row['shipping_carrier']).trim() : undefined;

    // Prefer variation SKU, then product SKU
    const variationSku = row['SKU phân loại hàng'] || row['variation_sku'] ? String(row['SKU phân loại hàng'] || row['variation_sku']).trim() : '';
    const productSku = row['SKU sản phẩm'] || row['product_sku'] ? String(row['SKU sản phẩm'] || row['product_sku']).trim() : '';
    const effectiveSku = variationSku || productSku;

    const productName = String(row['Tên sản phẩm'] || row['product_name'] || 'Sản phẩm không tên').trim();
    const variationName = row['Tên phân loại hàng'] || row['variation_name'] ? String(row['Tên phân loại hàng'] || row['variation_name']).trim() : '';

    const rawQuantity = Math.max(1, parseInt(String(row['Số lượng'] || row['quantity'] || 1), 10));
    const packMultiplier = this.extractPackMultiplier(variationName);
    const quantity = rawQuantity * packMultiplier;
    const canonicalSku = this.generateCanonicalSku(productName, variationName, effectiveSku);

    const originalPrice = this.parseNumber(row['Giá gốc'] || row['original_price']);
    const discountedPrice = this.parseNumber(row['Giá ưu đãi'] || row['Gia ưu đãi'] || row['discounted_price'] || originalPrice);
    const totalPaid = this.parseNumber(row['Tổng số tiền Người mua thanh toán'] || row['total_amount']);

    return {
      orderCode,
      packageCode,
      orderDate: row['Ngày đặt hàng'] || row['create_time'],
      orderStatus: row['Trạng Thái Đơn Hàng'] || row['order_status'],
      trackingCode,
      carrier,
      productSku,
      productName,
      variationSku,
      variationName,
      originalPrice,
      discountedPrice,
      rawQuantity,
      packMultiplier,
      quantity,
      canonicalSku,
      totalPaidByBuyer: totalPaid,
      completedAt: row['Thời gian hoàn thành đơn hàng'] || row['complete_time'],
      paidAt: row['Thời gian đơn hàng được thanh toán'] || row['pay_time'],
      buyerUsername: row['Người Mua'] || row['buyer_username'] ? String(row['Người Mua'] || row['buyer_username']).trim() : undefined,
      recipientName: row['Tên Người nhận'] || row['recipient_name'] ? String(row['Tên Người nhận'] || row['recipient_name']).trim() : undefined,
      recipientPhone: row['Số điện thoại'] || row['recipient_phone'] ? String(row['Số điện thoại'] || row['recipient_phone']).trim() : undefined,
      recipientAddress: row['Địa chỉ nhận hàng'] || row['recipient_address'] ? String(row['Địa chỉ nhận hàng'] || row['recipient_address']).trim() : undefined,
      fixedFee: this.parseNumber(row['Phí cố định']),
      serviceFee: this.parseNumber(row['Phí Dịch Vụ']),
      transactionFee: this.parseNumber(row['Phí xử lý giao dịch']),
      shippingFee: this.parseNumber(row['Phí vận chuyển (dự kiến)'] || row['Phí vận chuyển']),
      raw: row,
      rowNumber,
    };
  }

  static groupRowsIntoOrders(rows: RawShopeeRow[]): ParsedShopeeOrder[] {
    const ordersMap = new Map<string, ParsedShopeeOrder>();

    for (const r of rows) {
      let order = ordersMap.get(r.orderCode);
      const rowStatus = this.normalizePlatformStatus(r.orderStatus, r.raw);

      if (!order) {
        order = {
          externalOrderId: r.orderCode,
          platformStatus: rowStatus,
          rawStatus: r.orderStatus || '',
          orderDate: this.parseDate(r.orderDate),
          paidAt: this.parseDate(r.paidAt),
          completedAt: this.parseDate(r.completedAt),
          trackingCode: r.trackingCode,
          carrier: r.carrier,
          packageCode: r.packageCode,
          buyerUsername: r.buyerUsername,
          recipientName: r.recipientName,
          recipientPhone: r.recipientPhone,
          recipientAddress: r.recipientAddress,
          totalAmount: r.totalPaidByBuyer || 0,
          shippingFee: r.shippingFee || 0,
          items: [],
          fees: {
            fixedFee: r.fixedFee || 0,
            serviceFee: r.serviceFee || 0,
            transactionFee: r.transactionFee || 0,
          },
        };
        ordersMap.set(r.orderCode, order);
      } else {
        // If a subsequent row contains return or cancellation signals, overwrite status
        if (
          rowStatus === PlatformOrderStatus.TO_RETURN ||
          rowStatus === PlatformOrderStatus.RETURN_REFUND ||
          rowStatus === PlatformOrderStatus.CANCELLED
        ) {
          order.platformStatus = rowStatus;
          if (r.orderStatus) order.rawStatus = r.orderStatus;
        }
      }

      // Add item
      order.items.push({
        externalSku: r.variationSku || r.productSku || '',
        canonicalSku: r.canonicalSku,
        productName: r.productName,
        variationName: r.variationName,
        rawQuantity: r.rawQuantity,
        packMultiplier: r.packMultiplier,
        quantity: r.quantity,
        originalPrice: r.originalPrice || 0,
        discountedPrice: r.discountedPrice || 0,
        rowNumber: r.rowNumber,
      });

      // Update tracking / package if not previously set
      if (!order.trackingCode && r.trackingCode) order.trackingCode = r.trackingCode;
      if (!order.packageCode && r.packageCode) order.packageCode = r.packageCode;
    }

    return Array.from(ordersMap.values());
  }
}
