import { ShopeeAdapter } from './adapters/shopee.adapter';
import { PlatformOrderStatus } from '@prisma/client';

describe('Scenarios 3, 4, 6, 7, 8, 20: Shopee Import Engine & Integrity Tests', () => {
  describe('Scenario 7 & 20: Multi-line grouping & String preservation (số 0 đầu, mã đơn)', () => {
    it('phải bảo toàn số 0 ở đầu của mã vận đơn, mã đơn và số điện thoại mà không bị ép kiểu thành số', () => {
      const rawRow = {
        'Mã đơn hàng': '02607218XUFC1C0',
        'Mã Kiện Hàng': '006010091862211584363',
        'Mã vận đơn': '0987654321',
        'SKU phân loại hàng': '00123-SKU',
        'Tên sản phẩm': 'Sản phẩm thử nghiệm',
        'Số lượng': 2,
        'Số điện thoại': '0901234567',
        'Tổng số tiền Người mua thanh toán': '150,000.00',
        'Trạng Thái Đơn Hàng': 'Chờ giao hàng',
      };

      const mapped = ShopeeAdapter.mapRow(rawRow, 2);
      expect(mapped).not.toBeNull();
      expect(mapped!.orderCode).toBe('02607218XUFC1C0');
      expect(mapped!.packageCode).toBe('006010091862211584363');
      expect(mapped!.trackingCode).toBe('0987654321');
      expect(mapped!.variationSku).toBe('00123-SKU');
      expect(mapped!.recipientPhone).toBe('0901234567');
      expect(mapped!.totalPaidByBuyer).toBe(150000);
    });

    it('Scenario 7: Đơn nhiều dòng (multi-line) phải được gộp đúng về 1 đơn với nhiều items', () => {
      const row1 = ShopeeAdapter.mapRow(
        {
          'Mã đơn hàng': 'ORDER_MULTI_LINE_999',
          'Mã vận đơn': 'SPXVN_001',
          'Tên sản phẩm': 'Áo Thun Nam Cotton',
          'SKU phân loại hàng': 'SKU-AO-M',
          'Số lượng': 2,
          'Giá gốc': '120000',
          'Trạng Thái Đơn Hàng': 'Chờ giao hàng',
        },
        2,
      )!;

      const row2 = ShopeeAdapter.mapRow(
        {
          'Mã đơn hàng': 'ORDER_MULTI_LINE_999',
          'Mã vận đơn': 'SPXVN_001',
          'Tên sản phẩm': 'Quần Short Kaki',
          'SKU phân loại hàng': 'SKU-QUAN-L',
          'Số lượng': 1,
          'Giá gốc': '180000',
          'Trạng Thái Đơn Hàng': 'Chờ giao hàng',
        },
        3,
      )!;

      const grouped = ShopeeAdapter.groupRowsIntoOrders([row1, row2]);
      expect(grouped.length).toBe(1);
      expect(grouped[0].externalOrderId).toBe('ORDER_MULTI_LINE_999');
      expect(grouped[0].items.length).toBe(2);
      expect(grouped[0].items[0].externalSku).toBe('SKU-AO-M');
      expect(grouped[0].items[0].quantity).toBe(2);
      expect(grouped[0].items[1].externalSku).toBe('SKU-QUAN-L');
      expect(grouped[0].items[1].quantity).toBe(1);
    });
  });

  describe('Scenario 6: File cũ không ghi đè trạng thái nội bộ mới', () => {
    it('ShopeeAdapter chuẩn hóa trạng thái hợp lệ từ tiếng Việt', () => {
      expect(ShopeeAdapter.normalizePlatformStatus('Hoàn thành')).toBe(PlatformOrderStatus.COMPLETED);
      expect(ShopeeAdapter.normalizePlatformStatus('Chờ giao hàng')).toBe(PlatformOrderStatus.READY_TO_SHIP);
      expect(ShopeeAdapter.normalizePlatformStatus('Đang giao')).toBe(PlatformOrderStatus.SHIPPED);
      expect(ShopeeAdapter.normalizePlatformStatus('Đã hủy')).toBe(PlatformOrderStatus.CANCELLED);
      // Buyer confirmed receipt with Shopee return deadline clause
      expect(ShopeeAdapter.normalizePlatformStatus(
        'Người mua xác nhận đã nhận được hàng, tuy nhiên Người mua vẫn có thể gửi yêu cầu Trả hàng/Hoàn tiền tới ngày 2026-08-29.'
      )).toBe(PlatformOrderStatus.TO_CONFIRM_RECEIVE);
      expect(ShopeeAdapter.normalizePlatformStatus('Đã giao')).toBe(PlatformOrderStatus.TO_CONFIRM_RECEIVE);
      // Real return/refund request
      expect(ShopeeAdapter.normalizePlatformStatus('Yêu cầu Trả hàng/Hoàn tiền')).toBe(PlatformOrderStatus.TO_RETURN);
      expect(ShopeeAdapter.normalizePlatformStatus('Đã hoàn tiền')).toBe(PlatformOrderStatus.RETURN_REFUND);
      expect(ShopeeAdapter.normalizePlatformStatus('Chưa thanh toán')).toBe(PlatformOrderStatus.UNPAID);
    });
  });

  describe('Scenario 8: SKU chưa mapping được ghi nhận', () => {
    it('phát hiện SKU trống hoặc chưa map trong danh sách items', () => {
      const row = ShopeeAdapter.mapRow(
        {
          'Mã đơn hàng': 'ORDER_UNMAPPED_123',
          'Tên sản phẩm': 'Sản phẩm mới chưa tạo SKU',
          'SKU phân loại hàng': '',
          'SKU sản phẩm': '',
          'Số lượng': 1,
          'Trạng Thái Đơn Hàng': 'Chờ giao hàng',
        },
        2,
      )!;

      const grouped = ShopeeAdapter.groupRowsIntoOrders([row]);
      expect(grouped[0].items[0].externalSku).toBe('');
      expect(grouped[0].items[0].canonicalSku).toContain('NAME::Sản phẩm mới chưa tạo SKU');
    });
  });

  describe('Trích xuất hệ số Combo/Thùng từ Cột U và nhân với Cột AA (Số lượng)', () => {
    it('Phân loại "3 thùng" với số lượng 1 -> tổng số lượng = 3; số lượng 2 -> tổng số lượng = 6', () => {
      expect(ShopeeAdapter.extractPackMultiplier('3 thùng')).toBe(3);

      const row1 = ShopeeAdapter.mapRow(
        {
          'Mã đơn hàng': 'ORD_THUNG_1',
          'Tên sản phẩm': 'Mì Hảo Hảo',
          'Tên phân loại hàng': '3 thùng',
          'Số lượng': 1,
        },
        2,
      )!;
      expect(row1.rawQuantity).toBe(1);
      expect(row1.packMultiplier).toBe(3);
      expect(row1.quantity).toBe(3); // 3 x 1 = 3

      const row2 = ShopeeAdapter.mapRow(
        {
          'Mã đơn hàng': 'ORD_THUNG_2',
          'Tên sản phẩm': 'Mì Hảo Hảo',
          'Tên phân loại hàng': '3 thùng',
          'Số lượng': 2,
        },
        3,
      )!;
      expect(row2.rawQuantity).toBe(2);
      expect(row2.packMultiplier).toBe(3);
      expect(row2.quantity).toBe(6); // 3 x 2 = 6
    });

    it('Trích xuất chính xác các định dạng quy cách: Combo 2 thùng, Combo 4 thùng, COMBO 3 THÙNG, 10 gói, 20 gói, 12 cây', () => {
      expect(ShopeeAdapter.extractPackMultiplier('Combo 2 thùng')).toBe(2);
      expect(ShopeeAdapter.extractPackMultiplier('Combo 4 thùng')).toBe(4);
      expect(ShopeeAdapter.extractPackMultiplier('combo 4 thùng')).toBe(4);
      expect(ShopeeAdapter.extractPackMultiplier('COMBO 3 THÙNG')).toBe(3);
      expect(ShopeeAdapter.extractPackMultiplier('1 thùng')).toBe(1);
      expect(ShopeeAdapter.extractPackMultiplier('1 thùng 200')).toBe(1);
      expect(ShopeeAdapter.extractPackMultiplier('10 gói ( 20 chân )')).toBe(10);
      expect(ShopeeAdapter.extractPackMultiplier('20 gói ( 40 chân )')).toBe(20);
      expect(ShopeeAdapter.extractPackMultiplier('12 cây vani')).toBe(12);
      expect(ShopeeAdapter.extractPackMultiplier('Combo 3 Chai')).toBe(3);
    });

    it('Không nhầm lẫn đơn vị thể tích/khối lượng/màu sắc (500ml, 350ml, Thiên Nhiên Lô Hội)', () => {
      expect(ShopeeAdapter.extractPackMultiplier('500ml')).toBe(1);
      expect(ShopeeAdapter.extractPackMultiplier('350ml')).toBe(1);
      expect(ShopeeAdapter.extractPackMultiplier('Thiên Nhiên Lô Hội')).toBe(1);
      expect(ShopeeAdapter.extractPackMultiplier('huyền diệu')).toBe(1);
    });

    it('Tạo canonicalSku nhất quán khi file Shopee không có mã SKU người bán', () => {
      const canonical = ShopeeAdapter.generateCanonicalSku(
        '(Bán sỉ )Thùng Chân Gà Bà Tuyết',
        'Combo 2 thùng',
      );
      expect(canonical).toBe('NAME::(Bán sỉ )Thùng Chân Gà Bà Tuyết::Combo 2 thùng');
    });
  });
});
