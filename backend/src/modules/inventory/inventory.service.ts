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

    return balances.map((b) => {
      const onHand = b.onHand || 0;
      const reserved = b.reserved || 0;
      const damaged = b.damaged || 0;
      const pendingInspection = b.pendingInspection || 0;
      const inboundReturning = b.inboundReturning || 0;
      const available = Math.max(0, onHand - reserved);
      const actualWarehouseStock = onHand + damaged + pendingInspection;

      return {
        id: b.id,
        warehouseId: b.warehouseId,
        warehouseCode: b.warehouse.code,
        warehouseName: b.warehouse.name,
        variantId: b.variantId,
        sku: b.variant.sku,
        productName: b.variant.product.name,
        variantName: b.variant.name,
        barcode: b.variant.barcode,
        unit: b.variant.unit,
        onHand,
        reserved,
        available,
        damaged,
        pendingInspection,
        inboundReturning,
        actualWarehouseStock,
        lowStockThreshold: b.variant.lowStockThreshold,
        isLowStock: available <= b.variant.lowStockThreshold,
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
    let totalReserved = 0;
    let totalDamaged = 0;
    let totalPendingInspection = 0;
    let totalInboundReturning = 0;

    const byWarehouse = balances.map((b) => {
      const onHand = b.onHand || 0;
      const reserved = b.reserved || 0;
      const damaged = b.damaged || 0;
      const pendingInspection = b.pendingInspection || 0;
      const inboundReturning = b.inboundReturning || 0;
      const availableToSell = Math.max(0, onHand - reserved);
      const actualWarehouseStock = onHand + damaged + pendingInspection;

      totalOnHand += onHand;
      totalReserved += reserved;
      totalDamaged += damaged;
      totalPendingInspection += pendingInspection;
      totalInboundReturning += inboundReturning;

      return {
        warehouseId: b.warehouseId,
        warehouseCode: b.warehouse.code,
        warehouseName: b.warehouse.name,
        actualWarehouseStock,
        sellableStock: onHand,
        reservedStock: reserved,
        availableToSell,
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
        reservedStock: totalReserved,
        availableToSell: Math.max(0, totalOnHand - totalReserved),
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

    return {
      items: items.map((i) => ({
        id: i.id,
        createdAt: i.createdAt,
        warehouseId: i.warehouseId,
        warehouseCode: i.warehouse.code,
        warehouseName: i.warehouse.name,
        variantId: i.variantId,
        sku: i.variant.sku,
        productName: i.variant.product.name,
        variantName: i.variant.name,
        movementType: i.movementType,
        stockState: i.stockState || 'SELLABLE',
        deltaOnHand: i.deltaOnHand,
        deltaReserved: i.deltaReserved,
        deltaDamaged: i.deltaDamaged,
        deltaInspection: i.deltaInspection,
        beforeOnHand: i.beforeOnHand,
        afterOnHand: i.afterOnHand,
        voucherCode: i.voucherCode,
        performerName: i.performerName,
        batchCode: i.batchCode,
        expiryDate: i.expiryDate,
        referenceType: i.referenceType,
        referenceId: i.referenceId,
        performedByUserId: i.performedByUserId,
        note: i.note,
      })),
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
    if (newOnHand < 0) {
      throw new BadRequestException('Số lượng tồn thực tế (onHand) không được phép âm');
    }

    const newAvailable = newOnHand - balance.reserved;
    if (newAvailable < 0) {
      throw new BadRequestException(
        `Không thể giảm tồn xuống dưới số lượng đã giữ hàng cho đơn (Reserved: ${balance.reserved})`,
      );
    }

    const noteText = dto.note ? `${dto.reason}: ${dto.note}` : dto.reason;

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
  ): Promise<{ success: boolean; errorSku?: string }> {
    // Sort items by variantId deterministically to avoid database deadlocks
    const sortedItems = [...items].sort((a, b) => a.variantId.localeCompare(b.variantId));

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
          performedByUserId: userId,
          note: `Giữ hàng cho đơn ${orderId}`,
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
  ) {
    const sortedItems = [...items].sort((a, b) => a.variantId.localeCompare(b.variantId));

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
            performedByUserId: userId,
            note: `Giải phóng giữ hàng cho đơn ${orderId}`,
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
  ) {
    const sortedItems = [...items].sort((a, b) => a.variantId.localeCompare(b.variantId));

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

      if (!balance) {
        throw new Error(`Không tìm thấy số dư tồn kho cho SKU ${item.variantId}`);
      }

      const newOnHand = Math.max(0, balance.onHand - item.quantity);
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
          performedByUserId: userId,
          note: `Xuất kho thực tế khi quét kiện ${packageId} cho đơn ${orderId}`,
        },
      });
    }
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

    for (const item of sortedItems) {
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
          performedByUserId: userId,
          note: note || `Nhập lại hàng hoàn thực tế từ đơn ${orderId}`,
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
}
