import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ReceiveStockDto, AdjustStockDto } from './dto/inventory.dto';
import { InventoryMovementType, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

export interface StockReservationItem {
  variantId: string;
  quantity: number;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getBalances(tenantId: string, warehouseId?: string, search?: string) {
    const where: any = {
      tenantId,
      ...(warehouseId ? { warehouseId } : {}),
    };

    if (search) {
      where.variant = {
        OR: [
          { sku: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
          { product: { name: { contains: search, mode: 'insensitive' } } },
          {
            listingMappings: {
              some: {
                OR: [
                  { sellerSku: { contains: search, mode: 'insensitive' } },
                  { productName: { contains: search, mode: 'insensitive' } },
                  { variationName: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      };
    }

    const balances = await this.prisma.inventoryBalance.findMany({
      where,
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        variant: {
          select: {
            id: true,
            sku: true,
            name: true,
            barcode: true,
            unit: true,
            lowStockThreshold: true,
            product: { select: { id: true, name: true, code: true } },
            listingMappings: {
              include: {
                shop: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Tự động làm sạch các giá trị reserved cũ trong database nếu còn tồn đọng
    this.prisma.inventoryBalance
      .updateMany({
        where: { tenantId, reserved: { not: 0 } },
        data: { reserved: 0 },
      })
      .catch(() => {});

    return balances.map((b) => {
      const onHand = b.onHand || 0;
      const reserved = 0;
      const damaged = b.damaged || 0;
      const pendingInspection = b.pendingInspection || 0;
      const inboundReturning = b.inboundReturning || 0;
      const available = onHand;
      const actualWarehouseStock = onHand + damaged + pendingInspection;

      return {
        id: b.id,
        warehouseId: b.warehouseId,
        warehouseCode: b.warehouse?.code || '',
        warehouseName: b.warehouse?.name || '',
        warehouse: b.warehouse,
        variantId: b.variantId,
        sku: b.variant?.sku || '',
        productName: b.variant?.product?.name || '',
        variantName: b.variant?.name || '',
        barcode: b.variant?.barcode || '',
        unit: b.variant?.unit || 'cái',
        variant: b.variant,
        onHand,
        reserved: 0,
        available: onHand,
        damaged,
        pendingInspection,
        inboundReturning,
        actualWarehouseStock,
        lowStockThreshold: b.variant?.lowStockThreshold ?? 5,
        isLowStock: onHand <= (b.variant?.lowStockThreshold ?? 5),
        updatedAt: b.updatedAt,
      };
    });
  }

  async getVariantInventorySummary(tenantId: string, variantId: string, warehouseId?: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, tenantId },
      include: {
        product: { select: { id: true, name: true, code: true } },
      },
    });

    if (!variant) {
      throw new NotFoundException('Không tìm thấy biến thể sản phẩm');
    }

    // Tự động đối soát và sửa các bút toán xuất kho nếu hệ số SKU (multiplier) đã được cập nhật sau khi xuất
    await this.healVariantDispatchedLedgerEntries(tenantId, variantId, warehouseId);

    const where: any = {
      tenantId,
      variantId,
      ...(warehouseId ? { warehouseId } : {}),
    };

    const balances = await this.prisma.inventoryBalance.findMany({
      where,
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
      },
    });

    let totalOnHand = 0;
    let totalDamaged = 0;
    let totalPendingInspection = 0;
    let totalInboundReturning = 0;

    const byWarehouse = balances.map((b) => {
      const onHand = b.onHand || 0;
      const damaged = b.damaged || 0;
      const pendingInspection = b.pendingInspection || 0;
      const inboundReturning = b.inboundReturning || 0;
      const availableToSell = onHand;
      const actualWarehouseStock = onHand + damaged + pendingInspection;

      totalOnHand += onHand;
      totalDamaged += damaged;
      totalPendingInspection += pendingInspection;
      totalInboundReturning += inboundReturning;

      return {
        warehouseId: b.warehouseId,
        warehouseCode: b.warehouse.code,
        warehouseName: b.warehouse.name,
        actualWarehouseStock,
        sellableStock: onHand,
        reservedStock: 0,
        availableToSell: onHand,
        damagedStock: damaged,
        pendingInspectionStock: pendingInspection,
        inboundReturningStock: inboundReturning,
        updatedAt: b.updatedAt,
      };
    });

    return {
      variant: {
        id: variant.id,
        sku: variant.sku,
        name: variant.name,
        barcode: variant.barcode,
        unit: variant.unit,
        costPrice: Number(variant.costPrice || 0),
        sellingPrice: Number(variant.sellingPrice || 0),
        lowStockThreshold: variant.lowStockThreshold,
        product: variant.product,
      },
      summary: {
        actualWarehouseStock: totalOnHand + totalDamaged + totalPendingInspection,
        sellableStock: totalOnHand,
        reservedStock: 0,
        availableToSell: totalOnHand,
        inboundReturningStock: totalInboundReturning,
        damagedStock: totalDamaged,
        pendingInspectionStock: totalPendingInspection,
      },
      byWarehouse,
    };
  }

  async getLedger(
    tenantId: string,
    filter: {
      page?: number;
      limit?: number;
      warehouseId?: string;
      variantId?: string;
      sku?: string;
      movementType?: InventoryMovementType;
      stockState?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
    } = {},
  ) {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 50));
    const skip = (page - 1) * limit;

    // Tự động đối soát và sửa các bút toán xuất kho nếu hệ số SKU (multiplier) đã được cập nhật sau khi xuất
    if (filter.variantId) {
      await this.healVariantDispatchedLedgerEntries(tenantId, filter.variantId, filter.warehouseId);
    }

    const where: any = {
      tenantId,
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      ...(filter.variantId ? { variantId: filter.variantId } : {}),
      ...(filter.movementType ? { movementType: filter.movementType } : {}),
      ...(filter.stockState ? { stockState: filter.stockState } : {}),
    };

    if (filter.sku) {
      where.variant = { sku: filter.sku };
    }

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) where.createdAt.gte = new Date(filter.startDate);
      if (filter.endDate) where.createdAt.lte = new Date(filter.endDate);
    }

    if (filter.search) {
      where.OR = [
        { voucherCode: { contains: filter.search.trim(), mode: 'insensitive' } },
        { performerName: { contains: filter.search.trim(), mode: 'insensitive' } },
        { referenceId: { contains: filter.search.trim(), mode: 'insensitive' } },
        { note: { contains: filter.search.trim(), mode: 'insensitive' } },
        { variant: { sku: { contains: filter.search.trim(), mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.inventoryLedger.findMany({
        where,
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          variant: {
            select: {
              id: true,
              sku: true,
              name: true,
              unit: true,
              product: { select: { id: true, name: true, code: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.inventoryLedger.count({ where }),
    ]);

    // Resolve human-readable order code / package code for entries missing human-readable voucherCode
    const packageIds = items
      .filter((i) => (i.referenceType === 'PACKAGE' || i.referenceType === 'SCAN_REVERSAL') && i.referenceId)
      .map((i) => i.referenceId!);
    const orderIds = items
      .filter((i) => (i.referenceType === 'ORDER' || i.referenceType === 'ORDER_RETURN') && i.referenceId)
      .map((i) => i.referenceId!);

    const [packages, orders] = await Promise.all([
      packageIds.length > 0
        ? this.prisma.package.findMany({
            where: { id: { in: packageIds } },
            include: {
              order: {
                select: { id: true, externalOrderId: true, internalOrderCode: true, trackingCode: true },
              },
            },
          })
        : [],
      orderIds.length > 0
        ? this.prisma.order.findMany({
            where: { id: { in: orderIds } },
            select: { id: true, externalOrderId: true, internalOrderCode: true, trackingCode: true },
          })
        : [],
    ]);

    const packageMap = new Map(packages.map((p) => [p.id, p]));
    const orderMap = new Map(orders.map((o) => [o.id, o]));

    return {
      items: items.map((i) => {
        let resolvedVoucher = i.voucherCode;
        let resolvedNote = i.note || '';

        if (i.referenceType === 'PACKAGE' || i.referenceType === 'SCAN_REVERSAL') {
          const pkg = i.referenceId ? packageMap.get(i.referenceId) : null;
          const ord = pkg?.order;
          const orderCode = ord?.externalOrderId || ord?.internalOrderCode || ord?.trackingCode;
          const pkgCode = pkg?.packageCode || pkg?.trackingCode;

          if (!resolvedVoucher || /^[0-9a-f-]{36}$/i.test(resolvedVoucher)) {
            resolvedVoucher = orderCode || pkgCode || (i.referenceId ? `Kiện ${i.referenceId.substring(0, 8)}` : '');
          }

          if (resolvedNote && i.referenceId) {
            if (pkgCode) {
              resolvedNote = resolvedNote.split(i.referenceId).join(pkgCode);
            }
            if (ord?.id && orderCode) {
              resolvedNote = resolvedNote.split(ord.id).join(orderCode);
            }
          }
        } else if (i.referenceType === 'ORDER' || i.referenceType === 'ORDER_RETURN') {
          const ord = i.referenceId ? orderMap.get(i.referenceId) : null;
          const orderCode = ord?.externalOrderId || ord?.internalOrderCode || ord?.trackingCode;

          if (!resolvedVoucher || /^[0-9a-f-]{36}$/i.test(resolvedVoucher)) {
            resolvedVoucher = orderCode || (i.referenceId ? `Đơn ${i.referenceId.substring(0, 8)}` : '');
          }

          if (resolvedNote && i.referenceId && orderCode) {
            resolvedNote = resolvedNote.split(i.referenceId).join(orderCode);
          }
        }

        // Format clean note (shorten any remaining UUIDs so no raw 36-char string is ever shown)
        resolvedNote = resolvedNote.replace(
          /([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
          (match, prefix) => prefix,
        );

        const REASON_LABELS: Record<string, string> = {
          INVENTORY_CHECK_DISCREPANCY: 'Kiểm kê định kỳ phát hiện chênh lệch',
          DAMAGE: 'Hàng hỏng vỡ, lỗi trong quá trình bảo quản',
          LOSS: 'Mất mát, thất thoát không rõ nguyên nhân',
          CORRECTION: 'Bút toán điều chỉnh sai sót nhập liệu',
          MANUAL_ADJUST: 'Điều chỉnh tồn kho thủ công',
          INITIAL_STOCK: 'Tồn kho ban đầu',
          OPENING_BALANCE: 'Số dư đầu kỳ',
        };

        if (resolvedNote) {
          for (const [key, label] of Object.entries(REASON_LABELS)) {
            if (resolvedNote === key) {
              resolvedNote = label;
              break;
            } else if (resolvedNote.startsWith(`${key}:`)) {
              const rest = resolvedNote.slice(key.length + 1).trim();
              resolvedNote = rest ? `${label}: ${rest}` : label;
              break;
            } else if (resolvedNote.startsWith(`${key} -`)) {
              const rest = resolvedNote.slice(key.length + 2).trim();
              resolvedNote = rest ? `${label} - ${rest}` : label;
              break;
            }
          }
        }

        return {
          id: i.id,
          createdAt: i.createdAt,
          warehouseId: i.warehouseId,
          warehouseCode: i.warehouse?.code || '',
          warehouseName: i.warehouse?.name || '',
          warehouse: i.warehouse,
          variantId: i.variantId,
          sku: i.variant?.sku || '',
          productName: i.variant?.product?.name || '',
          variantName: i.variant?.name || '',
          variant: i.variant,
          movementType: i.movementType,
          stockState: i.stockState || 'SELLABLE',
          deltaOnHand: i.deltaOnHand,
          deltaReserved: i.deltaReserved,
          deltaDamaged: i.deltaDamaged,
          deltaInspection: i.deltaInspection,
          beforeOnHand: i.beforeOnHand,
          afterOnHand: i.afterOnHand,
          voucherCode: resolvedVoucher || (i.referenceId ? i.referenceId.substring(0, 8) : ''),
          performerName: i.performerName || 'HieuNT',
          batchCode: i.batchCode,
          expiryDate: i.expiryDate,
          referenceType: i.referenceType,
          referenceId: i.referenceId,
          performedByUserId: i.performedByUserId,
          note: resolvedNote || i.note,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async receiveStock(tenantId: string, userId: string, dto: ReceiveStockDto) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, tenantId },
    });
    if (!warehouse) {
      throw new BadRequestException('Kho hàng không thuộc Workspace hiện tại');
    }

    // Resolve items from either items array or single variant shorthand
    let items = dto.items;
    if (!items || items.length === 0) {
      if (dto.variantId && dto.quantity) {
        items = [{ variantId: dto.variantId, quantity: dto.quantity }];
      } else {
        throw new BadRequestException('Danh sách mặt hàng nhập kho không được để trống');
      }
    }

    // Verify all variants belong to tenant
    const variantIds = items.map((i) => i.variantId);
    const validCount = await this.prisma.productVariant.count({
      where: { id: { in: variantIds }, tenantId },
    });
    if (validCount !== variantIds.length) {
      throw new BadRequestException('Một hoặc nhiều SKU không thuộc Workspace hiện tại');
    }

    const noteText = dto.referenceCode
      ? `[PNK: ${dto.referenceCode}] ${dto.note || 'Nhập kho hàng'}`
      : (dto.note || 'Nhập kho hàng');

    return this.prisma.$transaction(async (tx) => {
      const results = [];

      for (const item of items) {
        // Upsert balance
        const balance = await tx.inventoryBalance.upsert({
          where: {
            tenantId_warehouseId_variantId: {
              tenantId,
              warehouseId: dto.warehouseId,
              variantId: item.variantId,
            },
          },
          update: {
            onHand: { increment: item.quantity },
          },
          create: {
            tenantId,
            warehouseId: dto.warehouseId,
            variantId: item.variantId,
            onHand: item.quantity,
            reserved: 0,
          },
        });

        // Immutable ledger record
        await tx.inventoryLedger.create({
          data: {
            tenantId,
            warehouseId: dto.warehouseId,
            variantId: item.variantId,
            movementType: InventoryMovementType.RECEIVE,
            deltaOnHand: item.quantity,
            deltaReserved: 0,
            referenceType: 'MANUAL_RECEIVE',
            performedByUserId: userId,
            note: noteText,
          },
        });

        results.push(balance);
      }

      await this.auditService.log({
        tenantId,
        userId,
        action: 'INVENTORY_RECEIVE',
        entityType: 'Warehouse',
        entityId: dto.warehouseId,
        newValues: { items, note: noteText, referenceCode: dto.referenceCode },
      });

      return {
        message: `Đã nhập kho thành công ${items.length} mặt hàng`,
        balances: results,
      };
    });
  }

  async adjustStock(tenantId: string, userId: string, dto: AdjustStockDto) {
    const delta = dto.deltaOnHand !== undefined ? dto.deltaOnHand : dto.quantityChange;
    if (delta === undefined || delta === 0) {
      throw new BadRequestException('Số lượng thay đổi tồn kho (deltaOnHand) phải khác 0');
    }

    const balance = await this.prisma.inventoryBalance.findUnique({
      where: {
        tenantId_warehouseId_variantId: {
          tenantId,
          warehouseId: dto.warehouseId,
          variantId: dto.variantId,
        },
      },
    });

    if (!balance) {
      throw new NotFoundException('Không tìm thấy bản ghi tồn kho để điều chỉnh');
    }

    const newOnHand = balance.onHand + delta;

    const reasonLabels: Record<string, string> = {
      INVENTORY_CHECK_DISCREPANCY: 'Kiểm kê định kỳ phát hiện chênh lệch',
      DAMAGE: 'Hàng hỏng vỡ, lỗi trong quá trình bảo quản',
      LOSS: 'Mất mát, thất thoát không rõ nguyên nhân',
      CORRECTION: 'Bút toán điều chỉnh sai sót nhập liệu',
      MANUAL_ADJUST: 'Điều chỉnh tồn kho thủ công',
    };
    const reasonLabel = (dto.reason && reasonLabels[dto.reason]) || dto.reason || 'Điều chỉnh kiểm kê';
    const noteText = dto.note ? `${reasonLabel}: ${dto.note}` : reasonLabel;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: { onHand: newOnHand },
      });

      await tx.inventoryLedger.create({
        data: {
          tenantId,
          warehouseId: dto.warehouseId,
          variantId: dto.variantId,
          movementType: InventoryMovementType.ADJUST,
          deltaOnHand: delta,
          deltaReserved: 0,
          referenceType: 'MANUAL_ADJUST',
          performedByUserId: userId,
          note: noteText,
        },
      });

      await this.auditService.log({
        tenantId,
        userId,
        action: 'INVENTORY_ADJUST',
        entityType: 'InventoryBalance',
        entityId: balance.id,
        newValues: { deltaOnHand: delta, newOnHand, reason: noteText },
      });

      return {
        message: `Đã điều chỉnh tồn kho thành công (Delta: ${delta > 0 ? '+' : ''}${delta})`,
        balance: updated,
      };
    });
  }

  // ATOMIC RESERVATION WITH DETERMINISTIC SKU ORDERING
  async reserveStockForOrder(
    tx: Prisma.TransactionClient,
    tenantId: string,
    warehouseId: string,
    items: StockReservationItem[],
    orderId: string,
    userId?: string,
    orderCode?: string,
  ): Promise<{ success: boolean; errorSku?: string }> {
    // Sort items by variantId deterministically to avoid database deadlocks
    const sortedItems = [...items].sort((a, b) => a.variantId.localeCompare(b.variantId));

    let resolvedOrderCode = orderCode;
    if (!resolvedOrderCode && (tx as any).order?.findUnique) {
      const ord = await (tx as any).order
        .findUnique({
          where: { id: orderId },
          select: { externalOrderId: true, internalOrderCode: true },
        })
        .catch(() => null);
      resolvedOrderCode = ord?.externalOrderId || ord?.internalOrderCode || orderId;
    }
    resolvedOrderCode = resolvedOrderCode || orderId;

    let performerName = 'HieuNT';
    if (userId && (tx as any).user?.findUnique) {
      const user = await (tx as any).user
        .findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        })
        .catch(() => null);
      performerName = user?.name || user?.email || 'HieuNT';
    }

    for (const item of sortedItems) {
      // Find and verify current available stock
      const balance = await tx.inventoryBalance.findUnique({
        where: {
          tenantId_warehouseId_variantId: {
            tenantId,
            warehouseId,
            variantId: item.variantId,
          },
        },
      });

      if (!balance) {
        return { success: false, errorSku: item.variantId };
      }

      const available = balance.onHand - balance.reserved;
      if (available < item.quantity) {
        return { success: false, errorSku: item.variantId };
      }

      // Atomic conditional update
      await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: {
          reserved: { increment: item.quantity },
        },
      });

      // Immutable ledger entry
      await tx.inventoryLedger.create({
        data: {
          tenantId,
          warehouseId,
          variantId: item.variantId,
          movementType: InventoryMovementType.RESERVE,
          deltaOnHand: 0,
          deltaReserved: item.quantity,
          referenceType: 'ORDER',
          referenceId: orderId,
          voucherCode: resolvedOrderCode,
          performerName,
          beforeOnHand: balance.onHand,
          afterOnHand: balance.onHand,
          performedByUserId: userId,
          note: `Giữ hàng cho đơn ${resolvedOrderCode}`,
        },
      });
    }

    return { success: true };
  }

  // ATOMIC RELEASE OF RESERVATION
  async releaseStockForOrder(
    tx: Prisma.TransactionClient,
    tenantId: string,
    warehouseId: string,
    items: StockReservationItem[],
    orderId: string,
    userId?: string,
    orderCode?: string,
  ) {
    const sortedItems = [...items].sort((a, b) => a.variantId.localeCompare(b.variantId));

    let resolvedOrderCode = orderCode;
    if (!resolvedOrderCode && (tx as any).order?.findUnique) {
      const ord = await (tx as any).order
        .findUnique({
          where: { id: orderId },
          select: { externalOrderId: true, internalOrderCode: true },
        })
        .catch(() => null);
      resolvedOrderCode = ord?.externalOrderId || ord?.internalOrderCode || orderId;
    }
    resolvedOrderCode = resolvedOrderCode || orderId;

    let performerName = 'HieuNT';
    if (userId && (tx as any).user?.findUnique) {
      const user = await (tx as any).user
        .findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        })
        .catch(() => null);
      performerName = user?.name || user?.email || 'HieuNT';
    }

    for (const item of sortedItems) {
      const balance = await tx.inventoryBalance.findUnique({
        where: {
          tenantId_warehouseId_variantId: {
            tenantId,
            warehouseId,
            variantId: item.variantId,
          },
        },
      });

      if (balance) {
        const newReserved = Math.max(0, balance.reserved - item.quantity);
        await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: { reserved: newReserved },
        });

        await tx.inventoryLedger.create({
          data: {
            tenantId,
            warehouseId,
            variantId: item.variantId,
            movementType: InventoryMovementType.RELEASE,
            deltaOnHand: 0,
            deltaReserved: -item.quantity,
            referenceType: 'ORDER',
            referenceId: orderId,
            voucherCode: resolvedOrderCode,
            performerName,
            beforeOnHand: balance.onHand,
            afterOnHand: balance.onHand,
            performedByUserId: userId,
            note: `Giải phóng giữ hàng cho đơn ${resolvedOrderCode}`,
          },
        });
      }
    }
  }

  // ATOMIC DISPATCH (PHYSICAL HANDOVER SCAN CONFIRMATION)
  async dispatchStockForPackage(
    tx: Prisma.TransactionClient,
    tenantId: string,
    warehouseId: string,
    items: StockReservationItem[],
    orderId: string,
    packageId: string,
    userId?: string,
    meta?: {
      orderCode?: string;
      externalOrderId?: string;
      packageCode?: string;
      trackingCode?: string;
      performerName?: string;
      note?: string;
    },
  ) {
    const sortedItems = [...items].sort((a, b) => a.variantId.localeCompare(b.variantId));

    let orderCode = meta?.orderCode || meta?.externalOrderId;
    let packageCode = meta?.packageCode || meta?.trackingCode;
    let performerName = meta?.performerName;

    if (!orderCode && (tx as any).order?.findUnique) {
      const ord = await (tx as any).order
        .findUnique({
          where: { id: orderId },
          select: { externalOrderId: true, internalOrderCode: true, trackingCode: true },
        })
        .catch(() => null);
      orderCode = ord?.externalOrderId || ord?.internalOrderCode || ord?.trackingCode || orderId;
    }
    orderCode = orderCode || orderId;

    if (!packageCode && (tx as any).package?.findUnique) {
      const pkg = await (tx as any).package
        .findUnique({
          where: { id: packageId },
          select: { packageCode: true, trackingCode: true },
        })
        .catch(() => null);
      packageCode = pkg?.packageCode || pkg?.trackingCode || packageId;
    }
    packageCode = packageCode || packageId;

    if (!performerName && userId && (tx as any).user?.findUnique) {
      const user = await (tx as any).user
        .findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        })
        .catch(() => null);
      performerName = user?.name || user?.email;
    }
    performerName = performerName || 'HieuNT';

    for (const item of sortedItems) {
      let balance = await tx.inventoryBalance.findUnique({
        where: {
          tenantId_warehouseId_variantId: {
            tenantId,
            warehouseId,
            variantId: item.variantId,
          },
        },
      });

      if (!balance) {
        balance = await tx.inventoryBalance.create({
          data: {
            tenantId,
            warehouseId,
            variantId: item.variantId,
            onHand: 0,
            reserved: 0,
          },
        });
      }

      // Allow onHand to go negative if physical stock is insufficient (tracks negative stock/shortage deficit)
      const newOnHand = balance.onHand - item.quantity;
      const newReserved = Math.max(0, balance.reserved - item.quantity);

      await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: {
          onHand: newOnHand,
          reserved: newReserved,
        },
      });

      await tx.inventoryLedger.create({
        data: {
          tenantId,
          warehouseId,
          variantId: item.variantId,
          movementType: InventoryMovementType.DISPATCH,
          deltaOnHand: -item.quantity,
          deltaReserved: -item.quantity,
          referenceType: 'PACKAGE',
          referenceId: packageId,
          voucherCode: orderCode || packageCode,
          performerName,
          beforeOnHand: balance.onHand,
          afterOnHand: newOnHand,
          performedByUserId: userId,
          note: meta?.note || `Xuất kho thực tế khi quét kiện ${packageCode} cho đơn ${orderCode}`,
        },
      });
    }
  }

  // CANCEL DISPATCH AND RESTOCK (AUTO REVERT WHEN CANCELLED ORDER IS INTERCEPTED AT DISPATCH RECONCILIATION)
  async revertDispatchStockForPackage(
    tx: Prisma.TransactionClient,
    tenantId: string,
    warehouseId: string,
    items: StockReservationItem[],
    orderId: string,
    packageId: string,
    userId?: string,
    meta?: {
      orderCode?: string;
      externalOrderId?: string;
      packageCode?: string;
      trackingCode?: string;
      performerName?: string;
      note?: string;
    },
  ) {
    const sortedItems = [...items].sort((a, b) => a.variantId.localeCompare(b.variantId));

    let orderCode = meta?.orderCode || meta?.externalOrderId;
    let packageCode = meta?.packageCode || meta?.trackingCode;
    let performerName = meta?.performerName;

    if (!orderCode && (tx as any).order?.findUnique) {
      const ord = await (tx as any).order
        .findUnique({
          where: { id: orderId },
          select: { externalOrderId: true, internalOrderCode: true, trackingCode: true },
        })
        .catch(() => null);
      orderCode = ord?.externalOrderId || ord?.internalOrderCode || ord?.trackingCode || orderId;
    }
    orderCode = orderCode || orderId;

    if (!packageCode && (tx as any).package?.findUnique) {
      const pkg = await (tx as any).package
        .findUnique({
          where: { id: packageId },
          select: { packageCode: true, trackingCode: true },
        })
        .catch(() => null);
      packageCode = pkg?.packageCode || pkg?.trackingCode || packageId;
    }
    packageCode = packageCode || packageId;

    if (!performerName && userId && (tx as any).user?.findUnique) {
      const user = await (tx as any).user
        .findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        })
        .catch(() => null);
      performerName = user?.name || user?.email;
    }
    performerName = performerName || 'HieuNT';

    for (const item of sortedItems) {
      let balance = await tx.inventoryBalance.findUnique({
        where: {
          tenantId_warehouseId_variantId: {
            tenantId,
            warehouseId,
            variantId: item.variantId,
          },
        },
      });

      if (!balance) {
        balance = await tx.inventoryBalance.create({
          data: {
            tenantId,
            warehouseId,
            variantId: item.variantId,
            onHand: 0,
            reserved: 0,
          },
        });
      }

      const newOnHand = balance.onHand + item.quantity;

      await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: {
          onHand: newOnHand,
        },
      });

      await tx.inventoryLedger.create({
        data: {
          tenantId,
          warehouseId,
          variantId: item.variantId,
          movementType: InventoryMovementType.RETURN_RECEIVE,
          deltaOnHand: item.quantity,
          deltaReserved: 0,
          referenceType: 'SCAN_CANCELLED_RESTOCK',
          referenceId: packageId,
          voucherCode: orderCode || packageCode,
          performerName,
          beforeOnHand: balance.onHand,
          afterOnHand: newOnHand,
          performedByUserId: userId,
          note:
            meta?.note ||
            `Tự động hủy xác nhận đi đơn và hoàn tồn kho thực tế do đơn hàng ${orderCode} bị hủy trên sàn khi đối soát`,
        },
      });
    }
  }

  /**
   * HOÀN TÁC XUẤT KHO (bù trừ chính xác theo sổ cái):
   * - Tính số lượng đã thực sự bị trừ khỏi onHand cho các kiện của đơn (DISPATCH trừ đi các lần hoàn/hoàn tác trước đó),
   *   theo ĐÚNG kho đã xuất (không phụ thuộc kho mặc định của Shop) và ĐÚNG biến thể đã xuất.
   * - Chỉ cộng lại onHand. KHÔNG tăng `reserved` (dispatch chỉ giảm reserved có kẹp về 0 nên không thể "trả" lại reserved;
   *   tăng reserved khiến tồn khả dụng = onHand - reserved không đổi => tồn kho vẫn âm sau khi hoàn tác).
   * - Ghi bút toán ADJUST bù trừ vào InventoryLedger trong cùng transaction.
   */
  async restoreDispatchedStock(
    tx: Prisma.TransactionClient,
    tenantId: string,
    params: {
      orderId: string;
      packageIds: string[];
      userId?: string;
      referenceType: string;
      referenceId: string;
      voucherCode?: string;
      performerName?: string;
      note: string;
    },
  ): Promise<{ restoredLines: number; restoredQuantity: number }> {
    const { orderId, packageIds } = params;

    const ledgerWhereOr: Prisma.InventoryLedgerWhereInput[] = [
      { referenceType: 'MANUAL_DISPATCH_REVERSAL', referenceId: orderId },
    ];
    if (packageIds.length > 0) {
      ledgerWhereOr.push({
        movementType: InventoryMovementType.DISPATCH,
        referenceType: 'PACKAGE',
        referenceId: { in: packageIds },
      });
      ledgerWhereOr.push({
        referenceType: { in: ['SCAN_REVERSAL', 'SCAN_CANCELLED_RESTOCK'] },
        referenceId: { in: packageIds },
      });
    }

    const entries = await tx.inventoryLedger.findMany({
      where: { tenantId, OR: ledgerWhereOr },
      select: { warehouseId: true, variantId: true, deltaOnHand: true },
    });

    // Net onHand đã bị trừ theo từng (kho, biến thể)
    const netDeducted = new Map<string, { warehouseId: string; variantId: string; quantity: number }>();
    for (const e of entries) {
      const key = `${e.warehouseId}|${e.variantId}`;
      const cur = netDeducted.get(key) || { warehouseId: e.warehouseId, variantId: e.variantId, quantity: 0 };
      cur.quantity += -e.deltaOnHand;
      netDeducted.set(key, cur);
    }

    // Khóa theo thứ tự xác định để tránh deadlock
    const lines = [...netDeducted.values()]
      .filter((l) => l.quantity > 0)
      .sort((a, b) => `${a.warehouseId}|${a.variantId}`.localeCompare(`${b.warehouseId}|${b.variantId}`));

    let performerName = params.performerName;
    if (!performerName && params.userId && (tx as any).user?.findUnique) {
      const user = await (tx as any).user
        .findUnique({ where: { id: params.userId }, select: { name: true, email: true } })
        .catch(() => null);
      performerName = user?.name || user?.email;
    }
    performerName = performerName || 'HieuNT';

    let restoredQuantity = 0;
    for (const line of lines) {
      const balance = await tx.inventoryBalance.findUnique({
        where: {
          tenantId_warehouseId_variantId: {
            tenantId,
            warehouseId: line.warehouseId,
            variantId: line.variantId,
          },
        },
      });

      const beforeOnHand = balance?.onHand ?? 0;
      const afterOnHand = beforeOnHand + line.quantity;

      if (balance) {
        await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: { onHand: { increment: line.quantity } },
        });
      } else {
        await tx.inventoryBalance.create({
          data: {
            tenantId,
            warehouseId: line.warehouseId,
            variantId: line.variantId,
            onHand: line.quantity,
            reserved: 0,
          },
        });
      }

      await tx.inventoryLedger.create({
        data: {
          tenantId,
          warehouseId: line.warehouseId,
          variantId: line.variantId,
          movementType: InventoryMovementType.ADJUST,
          deltaOnHand: line.quantity,
          deltaReserved: 0,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          voucherCode: params.voucherCode,
          performerName,
          beforeOnHand,
          afterOnHand,
          performedByUserId: params.userId,
          note: params.note,
        },
      });

      restoredQuantity += line.quantity;
    }

    return { restoredLines: lines.length, restoredQuantity };
  }


  // RETURN RECEIPT (ONLY RESTOCKS WHEN PHYSICALLY RECEIVED AT WAREHOUSE)
  async receiveReturnedStock(
    tx: Prisma.TransactionClient,
    tenantId: string,
    warehouseId: string,
    items: StockReservationItem[],
    orderId: string,
    userId?: string,
    note?: string,
  ) {
    const sortedItems = [...items].sort((a, b) => a.variantId.localeCompare(b.variantId));

    let resolvedOrderCode = orderId;
    if ((tx as any).order?.findUnique) {
      const ord = await (tx as any).order
        .findUnique({
          where: { id: orderId },
          select: { externalOrderId: true, internalOrderCode: true },
        })
        .catch(() => null);
      if (ord) {
        resolvedOrderCode = ord.externalOrderId || ord.internalOrderCode || orderId;
      }
    }

    let performerName = 'HieuNT';
    if (userId && (tx as any).user?.findUnique) {
      const user = await (tx as any).user
        .findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        })
        .catch(() => null);
      performerName = user?.name || user?.email || 'HieuNT';
    }

    for (const item of sortedItems) {
      const currentBalance = await tx.inventoryBalance.findUnique({
        where: {
          tenantId_warehouseId_variantId: {
            tenantId,
            warehouseId,
            variantId: item.variantId,
          },
        },
      });
      const currentOnHand = currentBalance?.onHand || 0;

      await tx.inventoryBalance.upsert({
        where: {
          tenantId_warehouseId_variantId: {
            tenantId,
            warehouseId,
            variantId: item.variantId,
          },
        },
        update: {
          onHand: { increment: item.quantity },
        },
        create: {
          tenantId,
          warehouseId,
          variantId: item.variantId,
          onHand: item.quantity,
          reserved: 0,
        },
      });

      await tx.inventoryLedger.create({
        data: {
          tenantId,
          warehouseId,
          variantId: item.variantId,
          movementType: InventoryMovementType.RETURN_RECEIVE,
          deltaOnHand: item.quantity,
          deltaReserved: 0,
          referenceType: 'ORDER_RETURN',
          referenceId: orderId,
          voucherCode: resolvedOrderCode,
          performerName,
          beforeOnHand: currentOnHand,
          afterOnHand: currentOnHand + item.quantity,
          performedByUserId: userId,
          note: note || `Nhập lại hàng hoàn thực tế từ đơn ${resolvedOrderCode}`,
        },
      });
    }
  }

  // RECONCILIATION: Check discrepancy between InventoryBalance and InventoryLedger sum
  async reconcileBalances(tenantId: string, warehouseId?: string) {
    const balances = await this.prisma.inventoryBalance.findMany({
      where: {
        tenantId,
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: {
        variant: { select: { sku: true, name: true } },
        warehouse: { select: { code: true, name: true } },
      },
    });

    const report = [];

    for (const b of balances) {
      const ledgerSum = await this.prisma.inventoryLedger.aggregate({
        where: {
          tenantId,
          warehouseId: b.warehouseId,
          variantId: b.variantId,
        },
        _sum: {
          deltaOnHand: true,
        },
      });

      const calculatedOnHand = ledgerSum._sum.deltaOnHand || 0;
      const difference = b.onHand - calculatedOnHand;

      report.push({
        warehouseCode: b.warehouse.code,
        sku: b.variant.sku,
        variantName: b.variant.name,
        currentOnHand: b.onHand,
        calculatedFromLedger: calculatedOnHand,
        difference,
        isConsistent: difference === 0,
      });
    }

    const discrepancies = report.filter((r) => !r.isConsistent);

    return {
      totalAudited: report.length,
      discrepancyCount: discrepancies.length,
      items: report,
    };
  }

  /**
   * Tính toán lại chuỗi tồn kho lũy kế (beforeOnHand -> afterOnHand)
   * cho một biến thể tại kho, và đồng bộ số tồn cuối cùng vào InventoryBalance.
   */
  async recalculateLedgerRunningBalances(
    tenantId: string,
    warehouseId: string,
    variantId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || this.prisma;
    const entries = await db.inventoryLedger.findMany({
      where: { tenantId, warehouseId, variantId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    let runningOnHand = 0;
    for (const entry of entries) {
      const beforeOnHand = runningOnHand;
      runningOnHand += (entry.deltaOnHand || 0);
      const afterOnHand = runningOnHand;

      if (entry.beforeOnHand !== beforeOnHand || entry.afterOnHand !== afterOnHand) {
        await db.inventoryLedger.update({
          where: { id: entry.id },
          data: { beforeOnHand, afterOnHand },
        });
      }
    }

    // Đồng bộ số tồn thực tế cuối cùng vào InventoryBalance
    await db.inventoryBalance.upsert({
      where: {
        tenantId_warehouseId_variantId: {
          tenantId,
          warehouseId,
          variantId,
        },
      },
      update: {
        onHand: runningOnHand,
      },
      create: {
        tenantId,
        warehouseId,
        variantId,
        onHand: runningOnHand,
        reserved: 0,
      },
    });

    return { runningOnHand, entriesCount: entries.length };
  }

  /**
   * Đồng bộ lại số lượng xuất kho trong Sổ cái khi người dùng sửa hệ số multiplier của SKU
   */
  async syncDispatchedOrderLedger(
    tenantId: string,
    orderId: string,
    warehouseId: string,
    variantId: string,
    newQuantity: number,
    multiplier: number,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || this.prisma;
    const packages = await db.package.findMany({
      where: { orderId },
      select: { id: true, packageCode: true, trackingCode: true },
    });
    const pkgIds = packages.map((p) => p.id);

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { externalOrderId: true, internalOrderCode: true, trackingCode: true },
    });

    const vouchers = [
      order?.externalOrderId,
      order?.internalOrderCode,
      order?.trackingCode,
      ...packages.map((p) => p.packageCode),
      ...packages.map((p) => p.trackingCode),
    ].filter(Boolean) as string[];

    const dispatchEntries = await db.inventoryLedger.findMany({
      where: {
        tenantId,
        variantId,
        movementType: InventoryMovementType.DISPATCH,
        OR: [
          ...(pkgIds.length > 0 ? [{ referenceId: { in: pkgIds } }] : []),
          { referenceId: orderId },
          ...(vouchers.length > 0 ? [{ voucherCode: { in: vouchers } }] : []),
          ...(order?.externalOrderId ? [{ note: { contains: order.externalOrderId } }] : []),
        ],
      },
    });

    if (dispatchEntries.length > 0) {
      for (const entry of dispatchEntries) {
        if (Math.abs(entry.deltaOnHand) !== newQuantity) {
          await db.inventoryLedger.update({
            where: { id: entry.id },
            data: {
              deltaOnHand: -newQuantity,
              deltaReserved: -newQuantity,
              note: entry.note ? `${entry.note} (Cập nhật hệ số x${multiplier})` : `Xuất kho thực tế x${multiplier}`,
            },
          });
        }
      }
      await this.recalculateLedgerRunningBalances(tenantId, warehouseId, variantId, tx);
    }
  }

  /**
   * Tự động quét và chữa các bút toán xuất kho DISPATCH của biến thể bị ghi nhận thiếu do hệ số mapping ban đầu sai (VD: x1 thay vì x10)
   */
  async healVariantDispatchedLedgerEntries(
    tenantId: string,
    variantId: string,
    warehouseId?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || this.prisma;
    try {
      // 1. Lấy danh sách mapping của biến thể này
      const mappings = await db.listingMapping.findMany({
        where: { tenantId, variantId },
      });

      if (!mappings || mappings.length === 0) return;

      const maxMultiplier = Math.max(...mappings.map((m) => m.multiplier || 1), 1);
      if (maxMultiplier <= 1) return;

      // 2. Tìm tất cả các bút toán DISPATCH của biến thể
      const dispatchEntries = await db.inventoryLedger.findMany({
        where: {
          tenantId,
          variantId,
          movementType: InventoryMovementType.DISPATCH,
          ...(warehouseId ? { warehouseId } : {}),
          deltaOnHand: { lt: 0 },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (dispatchEntries.length === 0) return;

      const affectedWarehouses = new Set<string>();

      for (const entry of dispatchEntries) {
        let order: any = null;

        // 2a. Tìm qua referenceId (PACKAGE)
        if (entry.referenceType === 'PACKAGE' && entry.referenceId) {
          const pkg = await db.package.findUnique({
            where: { id: entry.referenceId },
            include: {
              order: { include: { orderItems: true } },
              packageItems: { include: { orderItem: true } },
            },
          });
          order = pkg?.order;
        }

        // 2b. Tìm qua referenceId (ORDER)
        if (!order && (entry.referenceType === 'ORDER' || !entry.referenceType) && entry.referenceId) {
          order = await db.order.findUnique({
            where: { id: entry.referenceId },
            include: { orderItems: true },
          }).catch(() => null);
        }

        // 2c. Tìm qua voucherCode
        if (!order && entry.voucherCode) {
          order = await db.order.findFirst({
            where: {
              tenantId,
              OR: [
                { externalOrderId: entry.voucherCode },
                { internalOrderCode: entry.voucherCode },
                { trackingCode: entry.voucherCode },
              ],
            },
            include: { orderItems: true },
          });

          if (!order) {
            const pkg = await db.package.findFirst({
              where: {
                tenantId,
                OR: [
                  { packageCode: entry.voucherCode },
                  { trackingCode: entry.voucherCode },
                ],
              },
              include: { order: { include: { orderItems: true } } },
            });
            order = pkg?.order;
          }
        }

        // 2d. Tìm qua trích xuất mã đơn từ note nếu voucherCode không khớp
        if (!order && entry.note) {
          const matchedOrderCode = entry.note.match(/26\d{10,}[A-Za-z0-9]*/);
          if (matchedOrderCode && matchedOrderCode[0]) {
            order = await db.order.findFirst({
              where: {
                tenantId,
                OR: [
                  { externalOrderId: matchedOrderCode[0] },
                  { internalOrderCode: matchedOrderCode[0] },
                ],
              },
              include: { orderItems: true },
            });
          }
        }

        if (!order || !order.orderItems) continue;

        // Tìm item trong đơn khớp với variant này
        const matchingItem =
          order.orderItems.find((oi: any) => oi.variantId === variantId) ||
          order.orderItems.find((oi: any) => {
            const oiSku = (oi.externalSku || '').trim().toLowerCase();
            return mappings.some((m) => {
              const mSku = (m.sellerSku || '').trim().toLowerCase();
              return mSku && oiSku && (mSku === oiSku || mSku.includes(oiSku) || oiSku.includes(mSku));
            });
          });

        if (!matchingItem) continue;

        const matchedMapping =
          mappings.find((m) => m.shopId === order.shopId) ||
          mappings.find(
            (m) =>
              m.sellerSku &&
              matchingItem.externalSku &&
              (m.sellerSku.toLowerCase() === matchingItem.externalSku.toLowerCase() ||
                m.sellerSku.toLowerCase().endsWith('_' + matchingItem.externalSku.toLowerCase()) ||
                matchingItem.externalSku.toLowerCase().endsWith('_' + m.sellerSku.toLowerCase())),
          ) ||
          mappings[0];

        const multiplier = Math.max(1, matchedMapping?.multiplier || matchingItem.packMultiplier || maxMultiplier);
        if (multiplier <= 1) continue;

        const rawQty = Math.max(
          1,
          matchingItem.rawQuantity ||
            (matchingItem.quantity && matchingItem.packMultiplier && matchingItem.packMultiplier > 1
              ? Math.round(matchingItem.quantity / matchingItem.packMultiplier)
              : 1),
        );
        const correctQty = rawQty * multiplier;

        if (correctQty > 1 && Math.abs(entry.deltaOnHand) !== correctQty) {
          await db.inventoryLedger.update({
            where: { id: entry.id },
            data: {
              deltaOnHand: -correctQty,
              deltaReserved: -correctQty,
              note: entry.note ? `${entry.note} (Khớp hệ số x${multiplier})` : `Xuất kho thực tế x${multiplier}`,
            },
          });

          if (matchingItem.quantity !== correctQty || matchingItem.packMultiplier !== multiplier) {
            await db.orderItem.update({
              where: { id: matchingItem.id },
              data: {
                variantId,
                quantity: correctQty,
                packMultiplier: multiplier,
                rawQuantity: rawQty,
              },
            });

            await db.packageItem.updateMany({
              where: { orderItemId: matchingItem.id, tenantId },
              data: { quantity: correctQty },
            });
          }

          affectedWarehouses.add(entry.warehouseId);
        }
      }

      for (const whId of affectedWarehouses) {
        await this.recalculateLedgerRunningBalances(tenantId, whId, variantId, tx);
      }
    } catch (err) {
      this.logger.error('Error in healVariantDispatchedLedgerEntries:', err);
    }
  }

  /**
   * Chữa tất cả các biến thể có mapping multiplier > 1 trên toàn workspace
   */
  async healAllDispatchedLedgerEntries(tenantId?: string) {
    try {
      const mappingsWithMultiplier = await this.prisma.listingMapping.findMany({
        where: {
          ...(tenantId ? { tenantId } : {}),
          multiplier: { gt: 1 },
        },
        select: { tenantId: true, variantId: true },
        distinct: ['tenantId', 'variantId'],
      });

      for (const m of mappingsWithMultiplier) {
        await this.healVariantDispatchedLedgerEntries(m.tenantId, m.variantId);
      }
    } catch (err) {
      this.logger.error('Error in healAllDispatchedLedgerEntries:', err);
    }
  }
}
