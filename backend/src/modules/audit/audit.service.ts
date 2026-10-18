import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RequestContext } from '../../common/utils/request-context';

export interface CreateAuditLogParams {
  tenantId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: CreateAuditLogParams) {
    try {
      const ctx = RequestContext.current();
      const ipAddress = params.ipAddress || ctx?.ipAddress || '127.0.0.1';
      const userAgent = params.userAgent || ctx?.userAgent;
      const userId = params.userId || ctx?.userId;

      return await this.prisma.auditLog.create({
        data: {
          tenantId: params.tenantId,
          userId: userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          oldValues: params.oldValues ?? undefined,
          newValues: params.newValues ?? undefined,
          ipAddress: ipAddress,
          userAgent: userAgent,
        },
      });
    } catch {
      // Do not fail user requests if audit log fails
    }
  }

  async findByTenant(tenantId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { tenantId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({
        where: { tenantId },
      }),
    ]);

    // Group entity IDs by entityType to batch-resolve human readable names/codes
    const orderIds = new Set<string>();
    const warehouseIds = new Set<string>();
    const shopIds = new Set<string>();
    const supplierIds = new Set<string>();
    const packageIds = new Set<string>();
    const variantIds = new Set<string>();
    const userIds = new Set<string>();
    const receiptIds = new Set<string>();

    for (const item of items) {
      if (!item.entityId) continue;
      const type = (item.entityType || '').toLowerCase();
      if (type.includes('order')) orderIds.add(item.entityId);
      else if (type.includes('warehouse')) warehouseIds.add(item.entityId);
      else if (type.includes('shop')) shopIds.add(item.entityId);
      else if (type.includes('supplier')) supplierIds.add(item.entityId);
      else if (type.includes('package')) packageIds.add(item.entityId);
      else if (type.includes('variant')) variantIds.add(item.entityId);
      else if (type.includes('user') || type.includes('member')) userIds.add(item.entityId);
      else if (type.includes('receipt')) receiptIds.add(item.entityId);
    }

    const [orders, warehouses, shops, suppliers, packages, variants, users, receipts] = await Promise.all([
      orderIds.size > 0
        ? this.prisma.order.findMany({
            where: { id: { in: Array.from(orderIds) }, tenantId },
            select: { id: true, externalOrderId: true, internalOrderCode: true },
          })
        : [],
      warehouseIds.size > 0
        ? this.prisma.warehouse.findMany({
            where: { id: { in: Array.from(warehouseIds) }, tenantId },
            select: { id: true, code: true, name: true },
          })
        : [],
      shopIds.size > 0
        ? this.prisma.shop.findMany({
            where: { id: { in: Array.from(shopIds) }, tenantId },
            select: { id: true, code: true, name: true },
          })
        : [],
      supplierIds.size > 0
        ? this.prisma.supplier.findMany({
            where: { id: { in: Array.from(supplierIds) }, tenantId },
            select: { id: true, code: true, name: true },
          })
        : [],
      packageIds.size > 0
        ? this.prisma.package.findMany({
            where: { id: { in: Array.from(packageIds) } },
            select: { id: true, packageCode: true, trackingCode: true },
          })
        : [],
      variantIds.size > 0
        ? this.prisma.productVariant.findMany({
            where: { id: { in: Array.from(variantIds) } },
            select: { id: true, sku: true, name: true },
          })
        : [],
      userIds.size > 0
        ? this.prisma.user.findMany({
            where: { id: { in: Array.from(userIds) } },
            select: { id: true, name: true, email: true },
          })
        : [],
      receiptIds.size > 0
        ? this.prisma.purchaseReceipt.findMany({
            where: { id: { in: Array.from(receiptIds) }, tenantId },
            select: { id: true, receiptCode: true },
          })
        : [],
    ]);

    const orderMap = new Map(orders.map((o) => [o.id, o]));
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));
    const shopMap = new Map(shops.map((s) => [s.id, s]));
    const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
    const packageMap = new Map(packages.map((p) => [p.id, p]));
    const variantMap = new Map(variants.map((v) => [v.id, v]));
    const userMap = new Map(users.map((u) => [u.id, u]));
    const receiptMap = new Map(receipts.map((r) => [r.id, r]));

    const enrichedItems = items.map((item) => {
      let entityCode: string | undefined;
      let entityName: string | undefined;
      let entitySummary: string | undefined;

      // 1. Resolve from database lookup
      const order = orderMap.get(item.entityId);
      if (order) {
        entityCode = order.externalOrderId || order.internalOrderCode;
        entitySummary = entityCode ? `Đơn ${entityCode}` : undefined;
      }
      const warehouse = warehouseMap.get(item.entityId);
      if (warehouse) {
        entityCode = warehouse.code;
        entityName = warehouse.name;
        entitySummary = `${warehouse.name} (${warehouse.code})`;
      }
      const shop = shopMap.get(item.entityId);
      if (shop) {
        entityCode = shop.code;
        entityName = shop.name;
        entitySummary = `${shop.name} (${shop.code})`;
      }
      const supplier = supplierMap.get(item.entityId);
      if (supplier) {
        entityCode = supplier.code;
        entityName = supplier.name;
        entitySummary = `${supplier.name} (${supplier.code})`;
      }
      const pkg = packageMap.get(item.entityId);
      if (pkg) {
        entityCode = pkg.packageCode || pkg.trackingCode || undefined;
        entitySummary = entityCode ? `Kiện ${entityCode}` : undefined;
      }
      const variant = variantMap.get(item.entityId);
      if (variant) {
        entityCode = variant.sku;
        entityName = variant.name;
        entitySummary = `${variant.name} [${variant.sku}]`;
      }
      const user = userMap.get(item.entityId);
      if (user) {
        entityName = user.name;
        entityCode = user.email;
        entitySummary = user.name ? `${user.name} (${user.email})` : user.email;
      }
      const receipt = receiptMap.get(item.entityId);
      if (receipt) {
        entityCode = receipt.receiptCode;
        entitySummary = `Phiếu ${receipt.receiptCode}`;
      }

      // 2. Fallback to examine payload in newValues / oldValues
      if (!entitySummary) {
        const payload = (item.newValues || item.oldValues || {}) as Record<string, any>;
        const code =
          payload.orderSn ||
          payload.orderCode ||
          payload.externalOrderId ||
          payload.internalOrderCode ||
          payload.packageCode ||
          payload.trackingCode ||
          payload.receiptCode ||
          payload.voucherCode ||
          payload.referenceCode ||
          payload.sku ||
          payload.code;
        const name =
          payload.productName ||
          payload.supplierName ||
          payload.warehouseName ||
          payload.shopName ||
          payload.userName ||
          payload.fullName ||
          payload.name;

        if (code && name) {
          entityCode = code;
          entityName = name;
          entitySummary = `${name} (${code})`;
        } else if (code) {
          entityCode = code;
          entitySummary = code;
        } else if (name) {
          entityName = name;
          entitySummary = name;
        }
      }

      return {
        ...item,
        entityCode,
        entityName,
        entitySummary,
        ipAddress: item.ipAddress || '127.0.0.1',
      };
    });

    return { items: enrichedItems, total, page, limit };
  }
}
