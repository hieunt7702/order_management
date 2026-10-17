import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';
import {
  OrderFilterDto,
  CancelOrderDto,
  ReceiveReturnDto,
  CreateOrderDto,
  UpdateOrderDto,
  BulkDeleteOrdersDto,
} from './dto/order.dto';
import {
  PlatformOrderStatus,
  FulfillmentStatus,
  VerificationStatus,
  Platform,
  Prisma,
} from '@prisma/client';


@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(tenantId: string, allowedShopIds: string[] | null, filter: OrderFilterDto) {
    const page = filter.page || 1;
    const limit = Math.min(filter.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      ...(filter.shopId ? { shopId: filter.shopId } : {}),
      ...(filter.fulfillmentStatus ? { fulfillmentStatus: filter.fulfillmentStatus } : {}),
      ...(filter.verificationStatus ? { verificationStatus: filter.verificationStatus } : {}),
      ...(filter.financialStatus ? { financialStatus: filter.financialStatus } : {}),
    };

    const andConditions: any[] = [];

    if (filter.platformStatus === 'TO_RETURN') {
      andConditions.push({
        OR: [
          { platformStatus: { in: ['TO_RETURN', 'RETURN_REFUND'] } },
          { fulfillmentStatus: { in: ['RETURN_RECEIVED', 'PARTIALLY_RETURN_RECEIVED'] } },
        ],
      });
    } else if (filter.platformStatus) {
      where.platformStatus = filter.platformStatus;
    }

    // Enforce allowed shop memberships
    if (allowedShopIds) {
      if (filter.shopId && !allowedShopIds.includes(filter.shopId)) {
        return { items: [], total: 0, page, limit };
      }
      where.shopId = { in: allowedShopIds };
    }

    if (filter.search) {
      andConditions.push({
        OR: [
          { externalOrderId: { contains: filter.search, mode: 'insensitive' } },
          { internalOrderCode: { contains: filter.search, mode: 'insensitive' } },
          { trackingCode: { contains: filter.search, mode: 'insensitive' } },
          { buyerUsername: { contains: filter.search, mode: 'insensitive' } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    if (filter.fromDate || filter.toDate) {
      where.orderDate = {};
      if (filter.fromDate) {
        where.orderDate.gte = new Date(filter.fromDate);
      }
      if (filter.toDate) {
        where.orderDate.lt = new Date(filter.toDate);
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          shop: { select: { id: true, code: true, name: true } },
          orderItems: {
            include: {
              variant: {
                select: { id: true, sku: true, barcode: true, costPrice: true },
              },
            },
          },
          packages: {
            select: {
              id: true,
              packageCode: true,
              trackingCode: true,
              status: true,
              verifiedAt: true,
            },
          },
        },
        orderBy: { orderDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getSummary(
    tenantId: string,
    allowedShopIds: string[] | undefined,
    filter: { shopId?: string; fromDate?: string; toDate?: string },
  ) {
    const where: Prisma.OrderWhereInput = { tenantId };

    if (allowedShopIds && allowedShopIds.length > 0) {
      where.shopId = { in: allowedShopIds };
    }
    if (filter.shopId && filter.shopId !== 'ALL') {
      where.shopId = filter.shopId;
    }
    if (filter.fromDate || filter.toDate) {
      where.orderDate = {};
      if (filter.fromDate) {
        where.orderDate.gte = new Date(filter.fromDate);
      }
      if (filter.toDate) {
        where.orderDate.lt = new Date(filter.toDate);
      }
    }

    const [total, readyToShip, shipped, verified, completed, returned, unmapped] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.count({
        where: { ...where, platformStatus: 'READY_TO_SHIP' },
      }),
      this.prisma.order.count({
        where: { ...where, platformStatus: 'SHIPPED' },
      }),
      this.prisma.order.count({
        where: { ...where, verificationStatus: 'VERIFIED' },
      }),
      this.prisma.order.count({
        where: { ...where, platformStatus: 'COMPLETED' },
      }),
      this.prisma.order.count({
        where: {
          ...where,
          OR: [
            { platformStatus: { in: ['TO_RETURN', 'RETURN_REFUND'] } },
            { fulfillmentStatus: { in: ['RETURN_RECEIVED', 'PARTIALLY_RETURN_RECEIVED'] } },
          ],
        },
      }),
      this.prisma.order.count({
        where: { ...where, fulfillmentStatus: 'UNMAPPED' },
      }),
    ]);

    return {
      total,
      readyToShip,
      shipped,
      verified,
      completed,
      returned,
      unmapped,
    };
  }

  async findOne(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        shop: true,
        orderItems: {
          include: {
            variant: {
              include: {
                product: true,
                inventoryBalances: { include: { warehouse: true } },
              },
            },
          },
        },
        packages: {
          include: {
            packageItems: {
              include: { orderItem: true },
            },
          },
        },
        scanEvents: {
          orderBy: { createdAt: 'desc' },
        },
        settlements: true,
        orderReturns: {
          include: {
            items: { include: { variant: true } },
            warehouse: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng trong Workspace');
    }

    return order;
  }

  // RESERVE STOCK FOR AN ORDER
  async reserveOrder(tenantId: string, orderId: string, userId?: string) {
    const order = await this.findOne(tenantId, orderId);

    if (
      order.fulfillmentStatus !== FulfillmentStatus.PENDING_PROCESSING &&
      order.fulfillmentStatus !== FulfillmentStatus.OUT_OF_STOCK
    ) {
      throw new BadRequestException(
        `Không thể giữ hàng cho đơn ở trạng thái "${order.fulfillmentStatus}"`,
      );
    }

    // Check if any item is unmapped
    const unmappedItems = order.orderItems.filter((item) => !item.variantId);
    if (unmappedItems.length > 0) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { fulfillmentStatus: FulfillmentStatus.UNMAPPED },
      });
      throw new BadRequestException(
        `Đơn hàng có ${unmappedItems.length} sản phẩm chưa được mapping SKU nội bộ`,
      );
    }

    // Determine warehouse
    const warehouseId = order.shop.defaultWarehouseId;
    if (!warehouseId) {
      throw new BadRequestException('Shop chưa được cấu hình Kho xuất hàng mặc định');
    }

    const itemsToReserve = order.orderItems.map((item) => ({
      variantId: item.variantId!,
      quantity: item.quantity,
    }));

    return this.prisma.$transaction(async (tx) => {
      const reservation = await this.inventoryService.reserveStockForOrder(
        tx,
        tenantId,
        warehouseId,
        itemsToReserve,
        order.id,
        userId,
      );

      if (!reservation.success) {
        await tx.order.update({
          where: { id: order.id },
          data: { fulfillmentStatus: FulfillmentStatus.OUT_OF_STOCK },
        });
        throw new BadRequestException('Tồn kho khả dụng không đủ để giữ hàng cho toàn bộ đơn');
      }

      const updated = await tx.order.update({
        where: { id: order.id },
        data: { fulfillmentStatus: FulfillmentStatus.RESERVED },
      });

      await this.auditService.log({
        tenantId,
        userId,
        action: 'ORDER_RESERVED',
        entityType: 'Order',
        entityId: order.id,
        newValues: { fulfillmentStatus: FulfillmentStatus.RESERVED },
      });

      return updated;
    });
  }

  // CANCEL ORDER
  async cancelOrder(tenantId: string, orderId: string, userId: string, dto: CancelOrderDto) {
    const order = await this.findOne(tenantId, orderId);

    if (order.platformStatus === PlatformOrderStatus.CANCELLED) {
      return { message: 'Đơn hàng đã ở trạng thái đã hủy', order };
    }

    const warehouseId = order.shop.defaultWarehouseId;

    return this.prisma.$transaction(async (tx) => {
      // If cancelled before dispatch (was RESERVED or PACKED), release the reserved stock!
      if (
        order.fulfillmentStatus === FulfillmentStatus.RESERVED ||
        order.fulfillmentStatus === FulfillmentStatus.PACKED
      ) {
        if (warehouseId) {
          const itemsToRelease = order.orderItems
            .filter((item) => !!item.variantId)
            .map((item) => ({
              variantId: item.variantId!,
              quantity: item.quantity,
            }));

          await this.inventoryService.releaseStockForOrder(
            tx,
            tenantId,
            warehouseId,
            itemsToRelease,
            order.id,
            userId,
          );
        }

        const updated = await tx.order.update({
          where: { id: order.id },
          data: {
            platformStatus: PlatformOrderStatus.CANCELLED,
            fulfillmentStatus: FulfillmentStatus.CANCELLED_RESTOCKED,
            note: dto.reason ? `${order.note || ''} [Hủy: ${dto.reason}]` : order.note,
          },
        });

        await this.auditService.log({
          tenantId,
          userId,
          action: 'ORDER_CANCELLED_RELEASED',
          entityType: 'Order',
          entityId: order.id,
          newValues: { reason: dto.reason },
        });

        return updated;
      }

      // If cancelled AFTER dispatch, DO NOT automatically increment stock!
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          platformStatus: PlatformOrderStatus.CANCELLED,
          note: dto.reason ? `${order.note || ''} [Hủy sau xuất: ${dto.reason}]` : order.note,
        },
      });

      await this.auditService.log({
        tenantId,
        userId,
        action: 'ORDER_CANCELLED_POST_DISPATCH',
        entityType: 'Order',
        entityId: order.id,
        newValues: { reason: dto.reason },
      });

      return updated;
    });
  }

  // CONFIRM RETURN RECEIPT (PHYSICALLY RECEIVED AT WAREHOUSE)
  async receiveReturn(tenantId: string, orderId: string, userId: string, dto: ReceiveReturnDto) {
    const order = await this.findOne(tenantId, orderId);

    if (order.fulfillmentStatus === FulfillmentStatus.RETURN_RECEIVED) {
      throw new BadRequestException('Đơn hàng đã được xác nhận nhập kho trả hàng trước đó');
    }

    if (order.fulfillmentStatus !== FulfillmentStatus.DISPATCHED) {
      throw new BadRequestException('Chỉ có thể nhập hoàn cho đơn đã từng xuất kho thực tế (DISPATCHED)');
    }

    const warehouseId = dto.warehouseId || order.shop.defaultWarehouseId;
    if (!warehouseId) {
      throw new BadRequestException('Chưa chọn kho hàng để nhập lại hàng hoàn');
    }

    const itemsToRestock = order.orderItems
      .filter((item) => !!item.variantId)
      .map((item) => ({
        variantId: item.variantId!,
        quantity: item.quantity,
      }));

    return this.prisma.$transaction(async (tx) => {
      await this.inventoryService.receiveReturnedStock(
        tx,
        tenantId,
        warehouseId,
        itemsToRestock,
        order.id,
        userId,
        dto.note,
      );

      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          platformStatus: PlatformOrderStatus.RETURN_REFUND,
          fulfillmentStatus: FulfillmentStatus.RETURN_RECEIVED,
          note: dto.note ? `${order.note || ''} [Nhập hoàn: ${dto.note}]` : order.note,
        },
      });

      await this.auditService.log({
        tenantId,
        userId,
        action: 'ORDER_RETURN_RECEIVED',
        entityType: 'Order',
        entityId: order.id,
        newValues: { warehouseId, note: dto.note },
      });

      return updated;
    });
  }

  async createOrder(tenantId: string, userId: string, dto: CreateOrderDto) {
    const shop = await this.prisma.shop.findFirst({
      where: { id: dto.shopId, tenantId },
    });
    if (!shop) {
      throw new BadRequestException('Gian hàng không tồn tại trong Workspace');
    }

    const externalOrderId =
      dto.externalOrderId || `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const internalOrderCode = `INT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const trackingCode = dto.trackingCode || `TRK-${Date.now()}`;
    const carrier = dto.shippingCarrier || 'SPX Express';

    let totalAmount = dto.totalAmount ?? 0;
    if (!dto.totalAmount && dto.items && dto.items.length > 0) {
      totalAmount =
        dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) +
        (dto.shippingFee || 0);
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          tenantId,
          shopId: dto.shopId,
          platform: dto.platform || shop.platform || Platform.MANUAL,
          externalOrderId,
          internalOrderCode,
          recipientName: dto.recipientName,
          recipientPhone: dto.recipientPhone,
          recipientAddress: dto.recipientAddress,
          shippingCarrier: carrier,
          trackingCode,
          totalAmount,
          shippingFee: dto.shippingFee || 0,
          note: dto.note,
          orderDate: new Date(),
          platformStatus: PlatformOrderStatus.READY_TO_SHIP,
          fulfillmentStatus: FulfillmentStatus.PENDING_PROCESSING,
          orderItems: {
            create: (dto.items || []).map((item) => ({
              tenantId,
              variantId: item.variantId || null,
              productName: item.productName,
              variationName: item.variationName || '',
              externalSku: item.sellerSku || '',
              quantity: item.quantity,
              rawQuantity: item.quantity,
              originalPrice: item.unitPrice,
              discountedPrice: item.unitPrice,
            })),
          },
          packages: {
            create: {
              tenantId,
              packageCode: trackingCode,
              trackingCode,
              carrierName: carrier,
            },
          },
        },
        include: {
          shop: { select: { id: true, code: true, name: true } },
          orderItems: true,
          packages: true,
        },
      });

      const pkg = order.packages?.[0];
      if (pkg && order.orderItems && order.orderItems.length > 0) {
        for (const oi of order.orderItems) {
          await tx.packageItem.create({
            data: {
              tenantId,
              packageId: pkg.id,
              orderItemId: oi.id,
              quantity: oi.quantity,
            },
          }).catch(() => {});
        }
      }

      await this.auditService.log({
        tenantId,
        userId,
        action: 'ORDER_CREATED_MANUAL',
        entityType: 'Order',
        entityId: order.id,
        newValues: { externalOrderId, totalAmount },
      });

      return order;
    });
  }

  async updateOrder(tenantId: string, id: string, userId: string, dto: UpdateOrderDto) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: { packages: true },
    });
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          ...(dto.recipientName ? { recipientName: dto.recipientName } : {}),
          ...(dto.recipientPhone !== undefined ? { recipientPhone: dto.recipientPhone } : {}),
          ...(dto.recipientAddress !== undefined ? { recipientAddress: dto.recipientAddress } : {}),
          ...(dto.shippingCarrier !== undefined ? { shippingCarrier: dto.shippingCarrier } : {}),
          ...(dto.trackingCode ? { trackingCode: dto.trackingCode } : {}),
          ...(dto.platformStatus ? { platformStatus: dto.platformStatus } : {}),
          ...(dto.fulfillmentStatus ? { fulfillmentStatus: dto.fulfillmentStatus } : {}),
          ...(dto.totalAmount !== undefined ? { totalAmount: dto.totalAmount } : {}),
          ...(dto.shippingFee !== undefined ? { shippingFee: dto.shippingFee } : {}),
          ...(dto.note !== undefined ? { note: dto.note } : {}),
        },
        include: {
          shop: { select: { id: true, code: true, name: true } },
          orderItems: true,
          packages: true,
        },
      });

      if (dto.trackingCode) {
        if (order.packages && order.packages.length > 0) {
          await tx.package.updateMany({
            where: { orderId: id },
            data: {
              trackingCode: dto.trackingCode,
              ...(dto.shippingCarrier ? { carrierName: dto.shippingCarrier } : {}),
            },
          });
        } else {
          await tx.package.create({
            data: {
              tenantId,
              orderId: id,
              packageCode: dto.trackingCode,
              trackingCode: dto.trackingCode,
              carrierName: dto.shippingCarrier || order.shippingCarrier || 'SPX Express',
            },
          });
        }
      }

      await this.auditService.log({
        tenantId,
        userId,
        action: 'ORDER_UPDATED',
        entityType: 'Order',
        entityId: id,
        newValues: dto,
      });

      return updated;
    });
  }

  async deleteOrder(tenantId: string, id: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: { orderItems: true, shop: true },
    });
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    if (order.fulfillmentStatus === FulfillmentStatus.DISPATCHED) {
      throw new BadRequestException('Không thể xóa đơn hàng đã xuất kho bàn giao. Vui lòng tạo phiếu nhận hoàn hàng.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (order.fulfillmentStatus === FulfillmentStatus.RESERVED) {
        const warehouseId = order.shop?.defaultWarehouseId;
        if (warehouseId) {
          const itemsToRelease = order.orderItems
            .filter((item) => !!item.variantId)
            .map((item) => ({
              variantId: item.variantId!,
              quantity: item.quantity,
            }));
          await this.inventoryService.releaseStockForOrder(
            tx,
            tenantId,
            warehouseId,
            itemsToRelease,
            id,
            userId,
          );
        }
      }

      await tx.scanEvent.deleteMany({
        where: { orderId: id },
      });

      await tx.order.delete({
        where: { id },
      });

      await this.auditService.log({
        tenantId,
        userId,
        action: 'ORDER_DELETED',
        entityType: 'Order',
        entityId: id,
        newValues: { externalOrderId: order.externalOrderId },
      });

      return { success: true, message: 'Đã xóa đơn hàng thành công' };
    });
  }

  async bulkDeleteOrders(
    tenantId: string,
    userId: string,
    dto: BulkDeleteOrdersDto,
  ) {
    const whereClause: Prisma.OrderWhereInput = {
      tenantId,
    };

    if (dto.shopId) {
      whereClause.shopId = dto.shopId;
    }

    if (!dto.deleteAll) {
      if (!dto.orderIds || dto.orderIds.length === 0) {
        throw new BadRequestException('Vui lòng chọn ít nhất một đơn hàng để xóa');
      }
      whereClause.id = { in: dto.orderIds };
    }

    const orders = await this.prisma.order.findMany({
      where: whereClause,
      include: {
        orderItems: true,
        shop: true,
      },
    });

    if (orders.length === 0) {
      return {
        success: true,
        count: 0,
        skippedCount: 0,
        message: 'Không tìm thấy đơn hàng nào phù hợp để xóa',
      };
    }

    let ordersToDelete = orders;
    let skippedCount = 0;

    if (!dto.force) {
      ordersToDelete = orders.filter(
        (o) => o.fulfillmentStatus !== FulfillmentStatus.DISPATCHED,
      );
      skippedCount = orders.length - ordersToDelete.length;
      if (ordersToDelete.length === 0) {
        throw new BadRequestException(
          'Tất cả các đơn đã chọn đều đã xuất kho bàn giao. Vui lòng bật tùy chọn "Buộc xóa" nếu bạn chắc chắn muốn xóa toàn bộ.',
        );
      }
    }

    const idsToDelete = ordersToDelete.map((o) => o.id);

    await this.prisma.$transaction(async (tx) => {
      // 1. Giải phóng tồn kho giữ hàng (reserved) nếu đơn đang ở trạng thái RESERVED
      for (const order of ordersToDelete) {
        if (order.fulfillmentStatus === FulfillmentStatus.RESERVED) {
          const warehouseId = order.shop?.defaultWarehouseId;
          if (warehouseId) {
            const itemsToRelease = order.orderItems
              .filter((item) => !!item.variantId)
              .map((item) => ({
                variantId: item.variantId!,
                quantity: item.quantity,
              }));
            if (itemsToRelease.length > 0) {
              await this.inventoryService.releaseStockForOrder(
                tx,
                tenantId,
                warehouseId,
                itemsToRelease,
                order.id,
                userId,
              );
            }
          }
        }
      }

      // 2. Xóa các scan events liên kết
      await tx.scanEvent.deleteMany({
        where: { orderId: { in: idsToDelete } },
      });

      // 3. Xóa các đơn hàng (cascade xóa order items, packages, order returns, settlements)
      await tx.order.deleteMany({
        where: { id: { in: idsToDelete }, tenantId },
      });

      // 4. Ghi audit log
      await this.auditService.log({
        tenantId,
        userId,
        action: 'ORDER_BULK_DELETED',
        entityType: 'Order',
        entityId: 'bulk',
        newValues: {
          deletedCount: idsToDelete.length,
          skippedCount,
          deleteAll: !!dto.deleteAll,
          force: !!dto.force,
        },
      });
    });

    return {
      success: true,
      count: idsToDelete.length,
      skippedCount,
      message: `Đã xóa thành công ${idsToDelete.length} đơn hàng${
        skippedCount > 0 ? ` (bỏ qua ${skippedCount} đơn đã xuất kho)` : ''
      }`,
    };
  }
}


