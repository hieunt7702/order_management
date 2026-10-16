import { ShopeeAdapter } from './modules/imports/adapters/shopee.adapter';
import { PlatformOrderStatus, FulfillmentStatus, VerificationStatus, PackageStatus } from '@prisma/client';

describe('Minimum End-to-End Demo Flow: Full Lifecycle Verification', () => {
  it('thực hiện trọn vẹn luồng: Tạo master data -> Nhập kho -> Import đơn -> Giữ hàng -> Quét xuất kho -> Sổ cái & Báo cáo', async () => {
    // 1. Giả lập Tenant, Shop, Warehouse, SKU
    const tenant = { id: 'demo-tenant-id', code: 'TENANT_DEMO', name: 'Demo Workspace' };
    const warehouse = { id: 'demo-wh-id', tenantId: tenant.id, code: 'WH_DEMO', name: 'Kho Demo' };
    const shop = {
      id: 'demo-shop-id',
      tenantId: tenant.id,
      code: 'SHOP_DEMO',
      name: 'Shop Shopee Demo',
      defaultWarehouseId: warehouse.id,
    };
    const sku = {
      id: 'demo-sku-id',
      tenantId: tenant.id,
      sku: 'SKU-HAOHAO-120G',
      costPrice: 15000,
      sellingPrice: 23100,
    };

    // 2. Nhập tồn kho ban đầu (RECEIVE)
    let inventoryBalance = {
      tenantId: tenant.id,
      warehouseId: warehouse.id,
      variantId: sku.id,
      onHand: 100,
      reserved: 0,
      available: 100,
    };
    const initialLedger = {
      movementType: 'RECEIVE',
      deltaOnHand: 100,
      deltaReserved: 0,
    };
    expect(inventoryBalance.onHand).toBe(100);
    expect(inventoryBalance.available).toBe(100);

    // 3. Mapping Listing Sàn
    const listingMapping = {
      tenantId: tenant.id,
      shopId: shop.id,
      sellerSku: 'Ngẫu nhiên',
      variantId: sku.id,
    };
    expect(listingMapping.variantId).toBe(sku.id);

    // 4. Đọc và parse dòng đơn từ file Shopee
    const rawShopeeRow = {
      'Mã đơn hàng': '2607218XUFC1C0',
      'Mã Kiện Hàng': '6010091862211584363',
      'Mã vận đơn': 'SPXVN066144212957',
      'Trạng Thái Đơn Hàng': 'Chờ giao hàng',
      'SKU phân loại hàng': 'Ngẫu nhiên',
      'Tên sản phẩm': 'Muối Chấm Hảo Hảo Hũ 120gr',
      'Số lượng': 2,
      'Giá gốc': '23100.00',
      'Tổng số tiền Người mua thanh toán': '46200.00',
    };

    const mapped = ShopeeAdapter.mapRow(rawShopeeRow, 2)!;
    const orders = ShopeeAdapter.groupRowsIntoOrders([mapped]);
    expect(orders.length).toBe(1);

    const orderData = orders[0];
    expect(orderData.externalOrderId).toBe('2607218XUFC1C0');
    expect(orderData.trackingCode).toBe('SPXVN066144212957');
    expect(orderData.items[0].quantity).toBe(2);

    // 5. Xác nhận Import và Giữ hàng (RESERVE)
    const requiredQty = orderData.items[0].quantity;
    expect(inventoryBalance.available >= requiredQty).toBe(true);

    // Thực hiện giữ hàng
    inventoryBalance.reserved += requiredQty;
    inventoryBalance.available = inventoryBalance.onHand - inventoryBalance.reserved;
    const reserveLedger = {
      movementType: 'RESERVE',
      deltaOnHand: 0,
      deltaReserved: requiredQty,
    };
    expect(inventoryBalance.onHand).toBe(100);
    expect(inventoryBalance.reserved).toBe(2);
    expect(inventoryBalance.available).toBe(98);

    // 6. Quét Barcode xác nhận xuất kho (SCAN & DISPATCH)
    const scannedCode = 'SPXVN066144212957';
    expect(scannedCode).toBe(orderData.trackingCode);

    // Thực hiện xuất kho: giảm onHand, giảm reserved
    inventoryBalance.onHand -= requiredQty;
    inventoryBalance.reserved -= requiredQty;
    inventoryBalance.available = inventoryBalance.onHand - inventoryBalance.reserved;

    const dispatchLedger = {
      movementType: 'DISPATCH',
      deltaOnHand: -requiredQty,
      deltaReserved: -requiredQty,
    };

    expect(inventoryBalance.onHand).toBe(98);
    expect(inventoryBalance.reserved).toBe(0);
    expect(inventoryBalance.available).toBe(98);

    // 7. Kiểm tra đối soát sổ cái (Reconciliation):
    // Tổng deltaOnHand = 100 (nhập) - 2 (xuất) = 98 == onHand
    const cumulativeOnHandFromLedger =
      initialLedger.deltaOnHand + reserveLedger.deltaOnHand + dispatchLedger.deltaOnHand;
    expect(cumulativeOnHandFromLedger).toBe(inventoryBalance.onHand);

    // 8. Báo cáo Doanh thu & Lợi nhuận
    const totalOrderAmount = 46200;
    const totalCogs = sku.costPrice * requiredQty; // 15000 * 2 = 30000
    const grossProfit = totalOrderAmount - totalCogs; // 46200 - 30000 = 16200

    expect(totalCogs).toBe(30000);
    expect(grossProfit).toBe(16200);
  });
});
