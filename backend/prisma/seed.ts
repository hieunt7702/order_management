import { PrismaClient, MembershipRole, Platform, PlatformOrderStatus, FulfillmentStatus, VerificationStatus, PackageStatus, InventoryMovementType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('--- BẮT ĐẦU SEED DỮ LIỆU CHO 3 TENANT ĐỘC LẬP ---');

  const salt = await bcrypt.genSalt(10);
  const commonPasswordHash = await bcrypt.hash('Password123@Pass', salt);

  // =========================================================================
  // TENANT 1: HÀ NỘI (TẬP ĐOÀN BÁN LẺ MIỀN BẮC)
  // =========================================================================
  console.log('Seeding Tenant 1: TENANT_HN...');
  const tenant1 = await prisma.tenant.upsert({
    where: { code: 'TENANT_HN' },
    update: {},
    create: {
      code: 'TENANT_HN',
      name: 'Tập Đoàn Bán Lẻ Miền Bắc (Hà Nội)',
    },
  });

  const owner1 = await prisma.user.upsert({
    where: { email: 'admin_hn@shopee1.com' },
    update: {},
    create: {
      email: 'admin_hn@shopee1.com',
      name: 'Trần Văn Giám Đốc (HN)',
      passwordHash: commonPasswordHash,
    },
  });

  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant1.id, userId: owner1.id } },
    update: {},
    create: {
      tenantId: tenant1.id,
      userId: owner1.id,
      role: MembershipRole.OWNER,
    },
  });

  const staffKho1 = await prisma.user.upsert({
    where: { email: 'kho_hn@shopee1.com' },
    update: {},
    create: {
      email: 'kho_hn@shopee1.com',
      name: 'Lê Văn Thủ Kho (HN)',
      passwordHash: commonPasswordHash,
    },
  });

  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant1.id, userId: staffKho1.id } },
    update: {},
    create: {
      tenantId: tenant1.id,
      userId: staffKho1.id,
      role: MembershipRole.WAREHOUSE,
    },
  });

  const whHn1 = await prisma.warehouse.upsert({
    where: { tenantId_code: { tenantId: tenant1.id, code: 'WH_HN_01' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      code: 'WH_HN_01',
      name: 'Kho Tổng Long Biên (Hà Nội)',
      address: 'Số 102 Cổ Linh, Long Biên, Hà Nội',
    },
  });

  const whHn2 = await prisma.warehouse.upsert({
    where: { tenantId_code: { tenantId: tenant1.id, code: 'WH_HN_02' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      code: 'WH_HN_02',
      name: 'Kho Phụ Cầu Giấy (Hà Nội)',
      address: 'Số 45 Duy Tân, Cầu Giấy, Hà Nội',
    },
  });

  const shopHn1 = await prisma.shop.upsert({
    where: { tenantId_code: { tenantId: tenant1.id, code: 'SHOP_HN_GROCERY' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      code: 'SHOP_HN_GROCERY',
      name: 'Shop Bách Hóa Tiêu Dùng HN',
      platform: Platform.SHOPEE,
      externalShopId: 'shopee_hn_grocery_8901',
      defaultWarehouseId: whHn1.id,
    },
  });

  const shopHn2 = await prisma.shop.upsert({
    where: { tenantId_code: { tenantId: tenant1.id, code: 'SHOP_HN_HOME' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      code: 'SHOP_HN_HOME',
      name: 'Shop Gia Dụng Nhà Cửa HN',
      platform: Platform.SHOPEE,
      externalShopId: 'shopee_hn_home_8902',
      defaultWarehouseId: whHn1.id,
    },
  });

  // Products Tenant 1
  const prodHn1 = await prisma.product.upsert({
    where: { tenantId_code: { tenantId: tenant1.id, code: 'PROD_HAOHAO_TOM' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      code: 'PROD_HAOHAO_TOM',
      name: 'Muối Chấm Hảo Hảo Hũ 120gr Hương Vị Tôm Chua Cay',
    },
  });

  const varHn1 = await prisma.productVariant.upsert({
    where: { tenantId_sku: { tenantId: tenant1.id, sku: 'SKU-HAOHAO-120G' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      productId: prodHn1.id,
      sku: 'SKU-HAOHAO-120G',
      barcode: '8934567890123',
      name: 'Hũ 120gr Tôm Chua Cay',
      unit: 'hũ',
      costPrice: 15000,
      sellingPrice: 23100,
      lowStockThreshold: 10,
    },
  });

  const varHn2 = await prisma.productVariant.upsert({
    where: { tenantId_sku: { tenantId: tenant1.id, sku: 'SKU-HAOHAO-THUNG' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      productId: prodHn1.id,
      sku: 'SKU-HAOHAO-THUNG',
      barcode: '8934567890456',
      name: 'Thùng 30 Hũ 120gr',
      unit: 'thùng',
      costPrice: 420000,
      sellingPrice: 650000,
      lowStockThreshold: 5,
    },
  });

  // Listing Mapping for Tenant 1
  await prisma.listingMapping.upsert({
    where: {
      tenantId_shopId_platform_sellerSku: {
        tenantId: tenant1.id,
        shopId: shopHn1.id,
        platform: Platform.SHOPEE,
        sellerSku: 'Ngẫu nhiên',
      },
    },
    update: {},
    create: {
      tenantId: tenant1.id,
      shopId: shopHn1.id,
      platform: Platform.SHOPEE,
      sellerSku: 'Ngẫu nhiên',
      variantId: varHn1.id,
    },
  });

  // Initial stock Tenant 1
  await prisma.inventoryBalance.upsert({
    where: {
      tenantId_warehouseId_variantId: {
        tenantId: tenant1.id,
        warehouseId: whHn1.id,
        variantId: varHn1.id,
      },
    },
    update: {},
    create: {
      tenantId: tenant1.id,
      warehouseId: whHn1.id,
      variantId: varHn1.id,
      onHand: 150,
      reserved: 0,
    },
  });

  await prisma.inventoryLedger.create({
    data: {
      tenantId: tenant1.id,
      warehouseId: whHn1.id,
      variantId: varHn1.id,
      movementType: InventoryMovementType.RECEIVE,
      deltaOnHand: 150,
      deltaReserved: 0,
      referenceType: 'INITIAL_STOCK',
      performedByUserId: owner1.id,
      note: 'Nhập số dư đầu kỳ kiểm kho',
    },
  });

  // Seed sample order in Tenant 1 (from real Shopee sample)
  const sampleOrder1 = await prisma.order.upsert({
    where: {
      tenantId_shopId_platform_externalOrderId: {
        tenantId: tenant1.id,
        shopId: shopHn1.id,
        platform: Platform.SHOPEE,
        externalOrderId: '2607218XUFC1C0',
      },
    },
    update: {},
    create: {
      tenantId: tenant1.id,
      shopId: shopHn1.id,
      internalOrderCode: 'ORD-HN-SAMPLE-01',
      platform: Platform.SHOPEE,
      externalOrderId: '2607218XUFC1C0',
      platformStatus: PlatformOrderStatus.READY_TO_SHIP,
      fulfillmentStatus: FulfillmentStatus.RESERVED,
      verificationStatus: VerificationStatus.NOT_VERIFIED,
      orderDate: new Date('2026-07-21T11:40:00Z'),
      trackingCode: 'SPXVN066144212957',
      shippingCarrier: 'Nhanh-SPX Express',
      buyerUsername: 'minhhong_99',
      recipientName: 'Trần Văn Khách',
      recipientPhone: '******82',
      recipientAddress: 'Thôn Nội Xá, Xã Hòa Xá, Hà Nội',
      totalAmount: 23100,
      shippingFee: 16500,
      cogsTotal: 15000,
      orderItems: {
        create: [
          {
            tenantId: tenant1.id,
            variantId: varHn1.id,
            externalSku: 'Ngẫu nhiên',
            productName: '[ chính hãng ] Muối Chấm Hảo Hảo Hũ 120gr Hương Vị Tôm Chua Cay',
            variationName: 'Ngẫu nhiên',
            quantity: 1,
            originalPrice: 23100,
            discountedPrice: 23100,
            itemCogs: 15000,
          },
        ],
      },
    },
  });

  const samplePkg1 = await prisma.package.upsert({
    where: {
      tenantId_packageCode: {
        tenantId: tenant1.id,
        packageCode: '6010091862211584363',
      },
    },
    update: {},
    create: {
      tenantId: tenant1.id,
      orderId: sampleOrder1.id,
      packageCode: '6010091862211584363',
      trackingCode: 'SPXVN066144212957',
      carrierName: 'SPX Express',
      status: PackageStatus.READY,
    },
  });

  // Reserved 1 unit for sample order
  await prisma.inventoryBalance.update({
    where: {
      tenantId_warehouseId_variantId: {
        tenantId: tenant1.id,
        warehouseId: whHn1.id,
        variantId: varHn1.id,
      },
    },
    data: { reserved: 1 },
  });

  // =========================================================================
  // TENANT 2: HỒ CHÍ MINH (CHUỖI MỸ PHẨM SÀI GÒN)
  // =========================================================================
  console.log('Seeding Tenant 2: TENANT_HCM...');
  const tenant2 = await prisma.tenant.upsert({
    where: { code: 'TENANT_HCM' },
    update: {},
    create: {
      code: 'TENANT_HCM',
      name: 'Chuỗi Mỹ Phẩm Sài Gòn (TP.HCM)',
    },
  });

  const owner2 = await prisma.user.upsert({
    where: { email: 'admin_hcm@shopee2.com' },
    update: {},
    create: {
      email: 'admin_hcm@shopee2.com',
      name: 'Nguyễn Thị Hương (HCM)',
      passwordHash: commonPasswordHash,
    },
  });

  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant2.id, userId: owner2.id } },
    update: {},
    create: {
      tenantId: tenant2.id,
      userId: owner2.id,
      role: MembershipRole.OWNER,
    },
  });

  const whHcm1 = await prisma.warehouse.upsert({
    where: { tenantId_code: { tenantId: tenant2.id, code: 'WH_HCM_01' } },
    update: {},
    create: {
      tenantId: tenant2.id,
      code: 'WH_HCM_01',
      name: 'Kho Tân Bình (TP.HCM)',
      address: 'Số 15 Phổ Quang, Tân Bình, TP.HCM',
    },
  });

  const shopHcm1 = await prisma.shop.upsert({
    where: { tenantId_code: { tenantId: tenant2.id, code: 'SHOP_HCM_BEAUTY' } },
    update: {},
    create: {
      tenantId: tenant2.id,
      code: 'SHOP_HCM_BEAUTY',
      name: 'Shop Mỹ Phẩm Chính Hãng SG',
      platform: Platform.SHOPEE,
      externalShopId: 'shopee_hcm_beauty_9901',
      defaultWarehouseId: whHcm1.id,
    },
  });

  const prodHcm1 = await prisma.product.upsert({
    where: { tenantId_code: { tenantId: tenant2.id, code: 'PROD_CERAVE_CLEANSER' } },
    update: {},
    create: {
      tenantId: tenant2.id,
      code: 'PROD_CERAVE_CLEANSER',
      name: 'Sữa Rửa Mặt CeraVe Foaming Facial Cleanser',
    },
  });

  const varHcm1 = await prisma.productVariant.upsert({
    where: { tenantId_sku: { tenantId: tenant2.id, sku: 'SKU-CERAVE-473ML' } },
    update: {},
    create: {
      tenantId: tenant2.id,
      productId: prodHcm1.id,
      sku: 'SKU-CERAVE-473ML',
      barcode: '3337875597357',
      name: 'Chai 473ml Da Dầu Mụn',
      unit: 'chai',
      costPrice: 280000,
      sellingPrice: 395000,
      lowStockThreshold: 15,
    },
  });

  await prisma.inventoryBalance.upsert({
    where: {
      tenantId_warehouseId_variantId: {
        tenantId: tenant2.id,
        warehouseId: whHcm1.id,
        variantId: varHcm1.id,
      },
    },
    update: {},
    create: {
      tenantId: tenant2.id,
      warehouseId: whHcm1.id,
      variantId: varHcm1.id,
      onHand: 80,
      reserved: 0,
    },
  });

  // =========================================================================
  // TENANT 3: ĐÀ NẴNG (THẾ GIỚI PHỤ KIỆN MIỀN TRUNG)
  // =========================================================================
  console.log('Seeding Tenant 3: TENANT_DN...');
  const tenant3 = await prisma.tenant.upsert({
    where: { code: 'TENANT_DN' },
    update: {},
    create: {
      code: 'TENANT_DN',
      name: 'Thế Giới Phụ Kiện Miền Trung (Đà Nẵng)',
    },
  });

  const owner3 = await prisma.user.upsert({
    where: { email: 'admin_dn@shopee3.com' },
    update: {},
    create: {
      email: 'admin_dn@shopee3.com',
      name: 'Phạm Minh Tuấn (ĐN)',
      passwordHash: commonPasswordHash,
    },
  });

  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant3.id, userId: owner3.id } },
    update: {},
    create: {
      tenantId: tenant3.id,
      userId: owner3.id,
      role: MembershipRole.OWNER,
    },
  });

  const whDn1 = await prisma.warehouse.upsert({
    where: { tenantId_code: { tenantId: tenant3.id, code: 'WH_DN_01' } },
    update: {},
    create: {
      tenantId: tenant3.id,
      code: 'WH_DN_01',
      name: 'Kho Hải Châu (Đà Nẵng)',
      address: 'Số 88 Nguyễn Văn Linh, Hải Châu, Đà Nẵng',
    },
  });

  const shopDn1 = await prisma.shop.upsert({
    where: { tenantId_code: { tenantId: tenant3.id, code: 'SHOP_DN_TECH' } },
    update: {},
    create: {
      tenantId: tenant3.id,
      code: 'SHOP_DN_TECH',
      name: 'Shop Cáp Sạc Phụ Kiện ĐN',
      platform: Platform.SHOPEE,
      externalShopId: 'shopee_dn_tech_7701',
      defaultWarehouseId: whDn1.id,
    },
  });

  const prodDn1 = await prisma.product.upsert({
    where: { tenantId_code: { tenantId: tenant3.id, code: 'PROD_ANKER_CHARGER' } },
    update: {},
    create: {
      tenantId: tenant3.id,
      code: 'PROD_ANKER_CHARGER',
      name: 'Củ Sạc Nhanh Anker 20W PowerPort III Nano',
    },
  });

  const varDn1 = await prisma.productVariant.upsert({
    where: { tenantId_sku: { tenantId: tenant3.id, sku: 'SKU-ANKER-20W' } },
    update: {},
    create: {
      tenantId: tenant3.id,
      productId: prodDn1.id,
      sku: 'SKU-ANKER-20W',
      barcode: '848061038590',
      name: 'Màu Trắng Chân Tròn',
      unit: 'cái',
      costPrice: 140000,
      sellingPrice: 220000,
      lowStockThreshold: 10,
    },
  });

  await prisma.inventoryBalance.upsert({
    where: {
      tenantId_warehouseId_variantId: {
        tenantId: tenant3.id,
        warehouseId: whDn1.id,
        variantId: varDn1.id,
      },
    },
    update: {},
    create: {
      tenantId: tenant3.id,
      warehouseId: whDn1.id,
      variantId: varDn1.id,
      onHand: 200,
      reserved: 0,
    },
  });

  console.log('--- SEED DỮ LIỆU THÀNH CÔNG CHO CẢ 3 TENANT ---');
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed dữ liệu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
