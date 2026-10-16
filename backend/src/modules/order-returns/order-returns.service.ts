import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateOrderReturnDto,
  OrderReturnFilterDto,
} from './dto/order-return.dto';
import {
  Prisma,
  InventoryMovementType,
  FulfillmentStatus,
  PlatformOrderStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OrderReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private generateReturnCode(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PH-${y}${m}${d}-${rand}`;
  }

  // DANH SÁCH CHỜ NHẬN HÀNG HOÀN (Return Processing Queue)
  async getReturnQueue(tenantId: string, search?: string) {
    const where: Prisma.OrderWhereInput = {
      tenantId,
      OR: [
        { platformStatus: { in: [PlatformOrderStatus.TO_RETURN, PlatformOrderStatus.RETURN_REFUND] } },
        { fulfillmentStatus: { in: [FulfillmentStatus.PARTIALLY_RETURN_RECEIVED, FulfillmentStatus.DISPATCHED] } },
      ],
    };

    if (search) {
      const q = search.trim();
      where.AND = {
        OR: [
          { internalOrderCode: { contains: q, mode: 'insensitive' } },
          { externalOrderId: { contains: q, mode: 'insensitive' } },
          { trackingCode: { contains: q, mode: 'insensitive' } },
          { recipientName: { contains: q, mode: 'insensitive' } },
          { recipientPhone: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        shop: { select: { id: true, name: true, code: true, defaultWarehouseId: true } },
        orderItems: {
          include: {
            variant: {
              select: {
                id: true,
                sku: true,
                name: true,
                product: { select: { id: true, name: true } },
              },
            },
          },
        },
        orderReturns: {
          include: {
            items: true,
          },
        },
      },
    });

    return orders.map((order) => {
      // Tính toán số lượng đã xuất và đã hoàn theo từng dòng sản phẩm
      const itemsProgress = order.orderItems.map((oi) => {
        let returnedSellable = 0;
        let returnedDamaged = 0;
        let returnedMissing = 0;

        order.orderReturns.forEach((ret) => {
          ret.items.forEach((item) => {
            if (item.variantId === oi.variantId) {
              returnedSellable += item.sellableQuantity || 0;
              returnedDamaged += item.damagedQuantity || 0;
              returnedMissing += item.missingQuantity || 0;
            }
          });
        });

        const totalAccounted = returnedSellable + returnedDamaged + returnedMissing;
        const remainingToReturn = Math.max(0, oi.quantity - totalAccounted);

        return {
          orderItemId: oi.id,
          variantId: oi.variantId,
          sku: oi.variant?.sku || oi.externalSku || 'N/A',
          productName: oi.productName,
          variationName: oi.variationName,
          dispatchedQuantity: oi.quantity,
          returnedSellable,
          returnedDamaged,
          returnedMissing,
          totalAccounted,
          remainingToReturn,
        };
      });

      const totalDispatched = itemsProgress.reduce((sum, it) => sum + it.dispatchedQuantity, 0);
      const totalAccounted = itemsProgress.reduce((sum, it) => sum + it.totalAccounted, 0);
      const remainingTotal = itemsProgress.reduce((sum, it) => sum + it.remainingToReturn, 0);

      let queueStatus = 'WAITING_INSPECTION';
      if (remainingTotal === 0 && totalAccounted > 0) {
        queueStatus = 'FULLY_INSPECTED';
      } else if (totalAccounted > 0) {
        queueStatus = 'PARTIALLY_INSPECTED';
      }

      return {
        id: order.id,
        internalOrderCode: order.internalOrderCode,
        externalOrderId: order.externalOrderId,
        trackingCode: order.trackingCode,
        shop: order.shop,
        platformStatus: order.platformStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        orderDate: order.orderDate,
        buyerUsername: order.buyerUsername,
        recipientName: order.recipientName,
        recipientPhone: order.recipientPhone,
        totalDispatched,
        totalAccounted,
        remainingTotal,
        queueStatus,
        itemsProgress,
        returnCount: order.orderReturns.length,
      };
    });
  }

  // TIẾP NHẬN & KIỂM TRA HÀNG HOÀN (INSPECT AND RECEIVE)
  async inspectAndReceive(tenantId: string, userId: string, dto: CreateOrderReturnDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Phiếu nhận hoàn phải có ít nhất 1 sản phẩm');
    }

    const [order, warehouse] = await Promise.all([
      this.prisma.order.findFirst({
        where: { id: dto.orderId, tenantId },
        include: {
          orderItems: true,
          orderReturns: {
            include: { items: true },
          },
        },
      }),
      this.prisma.warehouse.findFirst({
        where: { id: dto.warehouseId, tenantId },
      }),
    ]);

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng cần nhận hoàn');
    }
    if (!warehouse) {
      throw new NotFoundException('Không tìm thấy kho tiếp nhận');
    }

    // BẤT BIẾN CỐT LÕI 1: Chỉ tạo nhập hoàn cho hàng đã từng xuất kho thực tế (DISPATCHED)
    const allowedFulfillmentStatuses: FulfillmentStatus[] = [
      FulfillmentStatus.DISPATCHED,
      FulfillmentStatus.PARTIALLY_RETURN_RECEIVED,
      FulfillmentStatus.RETURN_RECEIVED,
    ];

    if (!allowedFulfillmentStatuses.includes(order.fulfillmentStatus)) {
      throw new BadRequestException(
        `Chỉ có thể tạo nhập hoàn cho đơn đã được ghi nhận xuất kho thực tế (DISPATCHED). Đơn hàng này đang ở trạng thái '${order.fulfillmentStatus}', chưa trừ kho hoặc đã bị hủy trước khi xuất kho.`,
      );
    }

    // BẤT BIẾN CỐT LÕI 2: Không cộng hoàn vượt quá số lượng đã xuất kho (Chống cộng hoàn lặp)
    for (const itemDto of dto.items) {
      const orderItem = order.orderItems.find((oi) => oi.variantId === itemDto.variantId);
      if (!orderItem) {
        throw new BadRequestException(`SKU '${itemDto.sku}' không thuộc danh sách sản phẩm của đơn hàng này`);
      }

      let previouslyAccounted = 0;
      order.orderReturns.forEach((ret) => {
        ret.items.forEach((it) => {
          if (it.variantId === itemDto.variantId) {
            previouslyAccounted += (it.sellableQuantity || 0) + (it.damagedQuantity || 0) + (it.missingQuantity || 0);
          }
        });
      });

      const currentTotal = (itemDto.sellableQuantity || 0) + (itemDto.damagedQuantity || 0) + (itemDto.missingQuantity || 0);
      if (previouslyAccounted + currentTotal > orderItem.quantity) {
        throw new BadRequestException(
          `Số lượng hoàn vượt quá số lượng đã xuất kho của SKU '${itemDto.sku}' (Đã xuất: ${orderItem.quantity}, Đã nhận các đợt trước: ${previouslyAccounted}, Nhận đợt này: ${currentTotal})`,
        );
      }
    }

    const returnCode = dto.returnCode?.trim().toUpperCase() || this.generateReturnCode();

    const existingCode = await this.prisma.orderReturn.findUnique({
      where: { tenantId_returnCode: { tenantId, returnCode } },
    });
    if (existingCode) {
      throw new ConflictException(`Mã phiếu hoàn '${returnCode}' đã tồn tại trong workspace`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Tạo phiếu nhận hoàn OrderReturn
      const orderReturn = await tx.orderReturn.create({
        data: {
          tenantId,
          orderId: order.id,
          shopId: order.shopId,
          warehouseId: dto.warehouseId,
          returnCode,
          trackingCode: dto.trackingCode?.trim() || order.trackingCode || null,
          receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : new Date(),
          inspectedDate: new Date(),
          inspectedByUserId: userId,
          inspectorName: dto.inspectorName.trim(),
          status: 'COMPLETED',
          reason: dto.reason?.trim() || null,
          conditionPhoto: dto.conditionPhoto?.trim() || null,
          note: dto.note?.trim() || null,
          items: {
            create: dto.items.map((it) => ({
              tenantId,
              variantId: it.variantId,
              sku: it.sku.trim(),
              dispatchedQuantity: order.orderItems.find((oi) => oi.variantId === it.variantId)?.quantity || 1,
              receivedQuantity: (it.sellableQuantity || 0) + (it.damagedQuantity || 0),
              sellableQuantity: it.sellableQuantity || 0,
              damagedQuantity: it.damagedQuantity || 0,
              missingQuantity: it.missingQuantity || 0,
              batchCode: it.batchCode?.trim() || null,
              expiryDate: it.expiryDate ? new Date(it.expiryDate) : null,
              note: it.note?.trim() || null,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // 2. Cập nhật tồn kho và ghi sổ cái bất biến theo phân loại kiểm tra
      for (const itemDto of dto.items) {
        // Lấy số dư hiện tại của SKU tại kho
        let balance = await tx.inventoryBalance.findUnique({
          where: {
            tenantId_warehouseId_variantId: {
              tenantId,
              warehouseId: dto.warehouseId,
              variantId: itemDto.variantId,
            },
          },
        });

        if (!balance) {
          balance = await tx.inventoryBalance.create({
            data: {
              tenantId,
              warehouseId: dto.warehouseId,
              variantId: itemDto.variantId,
              onHand: 0,
              reserved: 0,
              damaged: 0,
              pendingInspection: 0,
              inboundReturning: 0,
            },
          });
        }

        const sellableQty = itemDto.sellableQuantity || 0;
        const damagedQty = itemDto.damagedQuantity || 0;
        const missingQty = itemDto.missingQuantity || 0;
        const totalAccounted = sellableQty + damagedQty + missingQty;

        // A. Hàng còn nguyên, bán lại được -> Tăng onHand
        if (sellableQty > 0) {
          const currentOnHand = balance.onHand;
          const nextOnHand = currentOnHand + sellableQty;

          await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: {
              onHand: { increment: sellableQty },
            },
          });

          await tx.inventoryLedger.create({
            data: {
              tenantId,
              warehouseId: dto.warehouseId,
              variantId: itemDto.variantId,
              movementType: InventoryMovementType.RETURN_RECEIVE,
              stockState: 'SELLABLE',
              deltaOnHand: sellableQty,
              deltaReserved: 0,
              deltaDamaged: 0,
              beforeOnHand: currentOnHand,
              afterOnHand: nextOnHand,
              voucherCode: `${returnCode} / ${order.internalOrderCode}`,
              performerName: dto.inspectorName,
              batchCode: itemDto.batchCode?.trim() || null,
              expiryDate: itemDto.expiryDate ? new Date(itemDto.expiryDate) : null,
              referenceType: 'ORDER_RETURN',
              referenceId: orderReturn.id,
              performedByUserId: userId,
              note: itemDto.note || `Khách hoàn hàng đạt chuẩn từ đơn ${order.internalOrderCode}`,
            },
          });
        }

        // B. Hàng bị hỏng, móp, cận date -> Tăng damaged
        if (damagedQty > 0) {
          const currentDamaged = balance.damaged;
          const nextDamaged = currentDamaged + damagedQty;

          await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: {
              damaged: { increment: damagedQty },
            },
          });

          await tx.inventoryLedger.create({
            data: {
              tenantId,
              warehouseId: dto.warehouseId,
              variantId: itemDto.variantId,
              movementType: InventoryMovementType.RETURN_DAMAGE,
              stockState: 'DAMAGED',
              deltaOnHand: 0,
              deltaReserved: 0,
              deltaDamaged: damagedQty,
              beforeOnHand: currentDamaged,
              afterOnHand: nextDamaged,
              voucherCode: `${returnCode} / ${order.internalOrderCode}`,
              performerName: dto.inspectorName,
              batchCode: itemDto.batchCode?.trim() || null,
              expiryDate: itemDto.expiryDate ? new Date(itemDto.expiryDate) : null,
              referenceType: 'ORDER_RETURN',
              referenceId: orderReturn.id,
              performedByUserId: userId,
              note: itemDto.note || `Khách hoàn hàng lỗi/hỏng từ đơn ${order.internalOrderCode}`,
            },
          });
        }

        // C. Cập nhật lượng hàng đang hoàn về (inboundReturning)
        if (totalAccounted > 0 && balance.inboundReturning > 0) {
          const newInbound = Math.max(0, balance.inboundReturning - totalAccounted);
          await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: { inboundReturning: newInbound },
          });
        }
      }

      // 3. Tính toán lại tiến độ hoàn toàn bộ đơn hàng
      let allItemsFullyAccounted = true;
      for (const oi of order.orderItems) {
        let totalReceivedForSku = 0;

        // Lịch sử cũ
        order.orderReturns.forEach((ret) => {
          ret.items.forEach((it) => {
            if (it.variantId === oi.variantId) {
              totalReceivedForSku += (it.sellableQuantity || 0) + (it.damagedQuantity || 0) + (it.missingQuantity || 0);
            }
          });
        });

        // Đợt này
        const currentItem = dto.items.find((it) => it.variantId === oi.variantId);
        if (currentItem) {
          totalReceivedForSku +=
            (currentItem.sellableQuantity || 0) +
            (currentItem.damagedQuantity || 0) +
            (currentItem.missingQuantity || 0);
        }

        if (totalReceivedForSku < oi.quantity) {
          allItemsFullyAccounted = false;
        }
      }

      const nextFulfillmentStatus = allItemsFullyAccounted
        ? FulfillmentStatus.RETURN_RECEIVED
        : FulfillmentStatus.PARTIALLY_RETURN_RECEIVED;

      await tx.order.update({
        where: { id: order.id },
        data: {
          platformStatus: PlatformOrderStatus.RETURN_REFUND,
          fulfillmentStatus: nextFulfillmentStatus,
          note: order.note ? `${order.note} [Nhập hoàn: ${returnCode}]` : `[Nhập hoàn: ${returnCode}]`,
        },
      });

      // 4. Ghi Audit Log
      await this.auditService.log({
        tenantId,
        userId,
        action: 'ORDER_RETURN_INSPECTED',
        entityType: 'OrderReturn',
        entityId: orderReturn.id,
        newValues: {
          returnCode,
          orderId: order.id,
          warehouseId: dto.warehouseId,
          inspectorName: dto.inspectorName,
          itemsCount: dto.items.length,
        },
      });

      return orderReturn;
    });
  }

  // LẤY DANH SÁCH LỊCH SỬ CÁC PHIẾU NHẬP HOÀN
  async findAll(tenantId: string, filter: OrderReturnFilterDto = {}) {
    const where: Prisma.OrderReturnWhereInput = {
      tenantId,
      ...(filter.orderId ? { orderId: filter.orderId } : {}),
      ...(filter.shopId ? { shopId: filter.shopId } : {}),
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
    };

    if (filter.search) {
      const q = filter.search.trim();
      where.OR = [
        { returnCode: { contains: q, mode: 'insensitive' } },
        { trackingCode: { contains: q, mode: 'insensitive' } },
        { inspectorName: { contains: q, mode: 'insensitive' } },
        { reason: { contains: q, mode: 'insensitive' } },
        { order: { internalOrderCode: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 25));
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.orderReturn.count({ where }),
      this.prisma.orderReturn.findMany({
        where,
        skip,
        take: limit,
        orderBy: { receivedDate: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              internalOrderCode: true,
              externalOrderId: true,
              trackingCode: true,
              buyerUsername: true,
              recipientName: true,
            },
          },
          shop: { select: { id: true, name: true, code: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          items: {
            include: {
              variant: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  product: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const item = await this.prisma.orderReturn.findFirst({
      where: { id, tenantId },
      include: {
        order: {
          include: {
            orderItems: true,
          },
        },
        shop: true,
        warehouse: true,
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Không tìm thấy phiếu nhận hoàn đơn hàng');
    }

    return item;
  }
}
