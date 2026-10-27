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
  MarkVirtualOrderDto,
  BulkMarkVirtualOrdersDto,
  MarkDispatchedDto,
  BulkMarkDispatchedDto,
  ReverseDispatchedDto,
  ProcurementDemandQueryDto,
} from './dto/order.dto';
import {
  PlatformOrderStatus,
  FulfillmentStatus,
  VerificationStatus,
  Platform,
  Prisma,
  PackageStatus,
  WarehouseStatus,
  ScanResult,
  InventoryMovementType,
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
      ...(filter.shopId && filter.shopId !== 'ALL' ? { shopId: filter.shopId } : {}),
      ...(filter.fulfillmentStatus ? { fulfillmentStatus: filter.fulfillmentStatus } : {}),
      ...(filter.verificationStatus ? { verificationStatus: filter.verificationStatus } : {}),
      ...(filter.financialStatus ? { financialStatus: filter.financialStatus } : {}),
    };

    const andConditions: any[] = [];

    if (
      filter.platformStatus === 'CANCELLED_AND_RETURNED' ||
      filter.platformStatus === 'CANCELLED_OR_RETURNED'
    ) {
      andConditions.push({
        OR: [
          { platformStatus: { in: ['CANCELLED', 'IN_CANCEL', 'TO_RETURN', 'RETURN_REFUND'] } },
          { fulfillmentStatus: { in: ['RETURN_RECEIVED', 'PARTIALLY_RETURN_RECEIVED'] } },
        ],
      });
    } else if (
      filter.platformStatus === 'COMPLETED' ||
      filter.platformStatus === 'DELIVERED_SUCCESS'
    ) {
      andConditions.push({
        platformStatus: { in: ['COMPLETED', 'TO_CONFIRM_RECEIVE'] },
      });
    } else if (filter.platformStatus === 'TO_RETURN') {
      andConditions.push({
        OR: [
          { platformStatus: { in: ['TO_RETURN', 'RETURN_REFUND'] } },
          { fulfillmentStatus: { in: ['RETURN_RECEIVED', 'PARTIALLY_RETURN_RECEIVED'] } },
        ],
      });
    } else if (filter.platformStatus === 'CANCELLED') {
      andConditions.push({
        platformStatus: { in: ['CANCELLED', 'IN_CANCEL'] },
      });
    } else if (filter.platformStatus === 'SHIPPED') {
      andConditions.push({
        platformStatus: { in: ['SHIPPED', 'RETRY_SHIP'] },
      });
    } else if (filter.platformStatus) {
      if (filter.platformStatus.includes(',')) {
        const statuses = filter.platformStatus
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        where.platformStatus = { in: statuses };
      } else {
        where.platformStatus = filter.platformStatus;
      }
    }

    // Enforce allowed shop memberships
    if (allowedShopIds) {
      if (filter.shopId && !allowedShopIds.includes(filter.shopId)) {
        return { items: [], total: 0, page, limit };
      }
      if (!filter.shopId || filter.shopId === 'ALL') {
        where.shopId = { in: allowedShopIds };
      }
    }

    if (filter.isVirtual !== undefined && filter.isVirtual !== '' && filter.isVirtual !== 'ALL') {
      where.isVirtual = filter.isVirtual === true || filter.isVirtual === 'true';
    }

    if (filter.isRealGoods !== undefined && filter.isRealGoods !== '' && filter.isRealGoods !== 'ALL') {
      where.isRealGoods = filter.isRealGoods === true || filter.isRealGoods === 'true';
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
                select: { id: true, sku: true, barcode: true, name: true, unit: true, costPrice: true },
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
      if (filter.shopId && filter.shopId !== 'ALL') {
        where.shopId = allowedShopIds.includes(filter.shopId)
          ? filter.shopId
          : '__FORBIDDEN__';
      } else {
        where.shopId = { in: allowedShopIds };
      }
    } else if (filter.shopId && filter.shopId !== 'ALL') {
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

    const [
      total,
      readyToShip,
      shipped,
      verified,
      completed,
      returned,
      unmapped,
      cancelledOnly,
      returnedOnly,
      virtualOrders,
    ] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.count({
        where: { ...where, platformStatus: 'READY_TO_SHIP' },
      }),
      this.prisma.order.count({
        where: {
          ...where,
          platformStatus: { in: ['SHIPPED', 'RETRY_SHIP'] },
        },
      }),
      this.prisma.order.count({
        where: { ...where, verificationStatus: 'VERIFIED' },
      }),
      this.prisma.order.count({
        where: {
          ...where,
          platformStatus: { in: ['COMPLETED', 'TO_CONFIRM_RECEIVE'] },
        },
      }),
      this.prisma.order.count({
        where: {
          ...where,
          OR: [
            { platformStatus: { in: ['CANCELLED', 'IN_CANCEL', 'TO_RETURN', 'RETURN_REFUND'] } },
            { fulfillmentStatus: { in: ['RETURN_RECEIVED', 'PARTIALLY_RETURN_RECEIVED'] } },
          ],
        },
      }),
      this.prisma.order.count({
        where: { ...where, fulfillmentStatus: 'UNMAPPED' },
      }),
      this.prisma.order.count({
        where: {
          ...where,
          platformStatus: { in: ['CANCELLED', 'IN_CANCEL'] },
        },
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
        where: { ...where, isVirtual: true },
      }),
    ]);

    return {
      total,
      readyToShip,
      shipped,
      verified,
      completed,
      returned,
      cancelledAndReturned: returned,
      cancelledOnly,
      returnedOnly,
      unmapped,
      virtualOrders,
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

    // Đơn ảo không đi hàng thật: trực tiếp chuyển sang RESERVED mà không giam giữ tồn kho thực tế
    if (order.isVirtual && !order.isRealGoods) {
      const updated = await this.prisma.order.update({
        where: { id: order.id },
        data: { fulfillmentStatus: FulfillmentStatus.RESERVED },
      });

      await this.auditService.log({
        tenantId,
        userId,
        action: 'ORDER_RESERVED_VIRTUAL',
        entityType: 'Order',
        entityId: order.id,
        newValues: { fulfillmentStatus: FulfillmentStatus.RESERVED, isVirtual: true, isRealGoods: false },
      });

      return updated;
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
        order.externalOrderId || order.internalOrderCode,
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
            order.externalOrderId || order.internalOrderCode,
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

        // Xóa bản ghi đối soát nếu đơn bị hủy và chưa từng nhận tiền
        if ((tx as any).orderReconciliationRecord?.deleteMany) {
          await (tx as any).orderReconciliationRecord.deleteMany({
            where: {
              orderId: order.id,
              settledPayout: 0,
              adjustmentAmount: 0,
            },
          });
        }

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

      // Xóa bản ghi đối soát nếu đơn bị hủy và chưa từng nhận tiền
      if ((tx as any).orderReconciliationRecord?.deleteMany) {
        await (tx as any).orderReconciliationRecord.deleteMany({
          where: {
            orderId: order.id,
            settledPayout: 0,
            adjustmentAmount: 0,
          },
        });
      }

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

    // Đơn ảo không đi hàng thật: không cộng hàng vào kho
    if (order.isVirtual && !order.isRealGoods) {
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.order.update({
          where: { id: order.id },
          data: {
            platformStatus: PlatformOrderStatus.RETURN_REFUND,
            fulfillmentStatus: FulfillmentStatus.RETURN_RECEIVED,
            note: dto.note ? `${order.note || ''} [Nhập hoàn đơn ảo: ${dto.note}]` : order.note,
          },
        });

        await this.auditService.log({
          tenantId,
          userId,
          action: 'ORDER_RETURN_RECEIVED_VIRTUAL',
          entityType: 'Order',
          entityId: order.id,
          newValues: { fulfillmentStatus: FulfillmentStatus.RETURN_RECEIVED, isVirtual: true },
        });

        return updated;
      });
    }

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
          isVirtual: dto.isVirtual ?? false,
          isRealGoods: dto.isVirtual ? (dto.isRealGoods ?? false) : false,
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
        newValues: { externalOrderId, totalAmount, isVirtual: dto.isVirtual },
      });

      return order;
    });
  }

  async updateOrder(tenantId: string, id: string, userId: string, dto: UpdateOrderDto) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: { packages: true, orderItems: true, shop: true },
    });
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    const isMarkingVirtualNoStock =
      dto.isVirtual === true && (dto.isRealGoods === false || (!dto.isRealGoods && !order.isRealGoods));
    const wasReserved = order.fulfillmentStatus === FulfillmentStatus.RESERVED;

    return this.prisma.$transaction(async (tx) => {
      // Nếu đang RESERVED mà chuyển sang đơn ảo không đi hàng thật -> giải phóng tồn giữ
      if (wasReserved && isMarkingVirtualNoStock) {
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
              id,
              userId,
              order.externalOrderId || order.internalOrderCode,
            );
          }
        }
      }

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
          ...(dto.isVirtual !== undefined ? { isVirtual: dto.isVirtual } : {}),
          ...(dto.isRealGoods !== undefined ? { isRealGoods: dto.isRealGoods } : {}),
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
            order.externalOrderId || order.internalOrderCode,
          );
        }
      }

      // Clean up child tables to prevent foreign key constraint failures
      await tx.scanEvent.deleteMany({
        where: {
          tenantId,
          OR: [{ orderId: id }, { package: { orderId: id } }],
        },
      });

      await tx.orderReconciliationRecord.deleteMany({
        where: { orderId: id, tenantId },
      });

      const orderReturns = await tx.orderReturn.findMany({
        where: { orderId: id, tenantId },
        select: { id: true },
      });
      if (orderReturns.length > 0) {
        const returnIds = orderReturns.map((r) => r.id);
        await tx.orderReturnItem.deleteMany({
          where: { returnId: { in: returnIds }, tenantId },
        });
        await tx.orderReturn.deleteMany({
          where: { id: { in: returnIds }, tenantId },
        });
      }

      const packages = await tx.package.findMany({
        where: { orderId: id, tenantId },
        select: { id: true },
      });
      if (packages.length > 0) {
        const pkgIds = packages.map((p) => p.id);
        await tx.packageItem.deleteMany({
          where: { packageId: { in: pkgIds }, tenantId },
        });
        await tx.package.deleteMany({
          where: { id: { in: pkgIds }, tenantId },
        });
      }

      await tx.settlement.deleteMany({
        where: { orderId: id, tenantId },
      });

      await tx.orderItem.deleteMany({
        where: { orderId: id, tenantId },
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
    }, { timeout: 30000 });
  }

  async bulkDeleteOrders(
    tenantId: string,
    userId: string,
    dto: BulkDeleteOrdersDto,
  ) {
    const whereClause: Prisma.OrderWhereInput = {
      tenantId,
    };

    if (dto.shopId && dto.shopId !== 'ALL' && dto.shopId.trim() !== '') {
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
                order.externalOrderId || order.internalOrderCode,
              );
            }
          }
        }
      }

      // 2. Xóa các scan events liên kết (cả theo orderId và theo packages của đơn)
      await tx.scanEvent.deleteMany({
        where: {
          tenantId,
          OR: [
            { orderId: { in: idsToDelete } },
            { package: { orderId: { in: idsToDelete } } },
          ],
        },
      });

      // 3. Xóa các bản ghi đối soát
      await tx.orderReconciliationRecord.deleteMany({
        where: { orderId: { in: idsToDelete }, tenantId },
      });

      // 4. Xóa các bản ghi hoàn hàng
      const orderReturns = await tx.orderReturn.findMany({
        where: { orderId: { in: idsToDelete }, tenantId },
        select: { id: true },
      });
      if (orderReturns.length > 0) {
        const returnIds = orderReturns.map((r) => r.id);
        await tx.orderReturnItem.deleteMany({
          where: { returnId: { in: returnIds }, tenantId },
        });
        await tx.orderReturn.deleteMany({
          where: { id: { in: returnIds }, tenantId },
        });
      }

      // 5. Xóa các kiện hàng và package items
      const packages = await tx.package.findMany({
        where: { orderId: { in: idsToDelete }, tenantId },
        select: { id: true },
      });
      if (packages.length > 0) {
        const pkgIds = packages.map((p) => p.id);
        await tx.packageItem.deleteMany({
          where: { packageId: { in: pkgIds }, tenantId },
        });
        await tx.package.deleteMany({
          where: { id: { in: pkgIds }, tenantId },
        });
      }

      // 6. Xóa các settlements
      await tx.settlement.deleteMany({
        where: { orderId: { in: idsToDelete }, tenantId },
      });

      // 7. Xóa các order items
      await tx.orderItem.deleteMany({
        where: { orderId: { in: idsToDelete }, tenantId },
      });

      // 8. Xóa các đơn hàng
      await tx.order.deleteMany({
        where: { id: { in: idsToDelete }, tenantId },
      });

      // 9. Ghi audit log
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
    }, { timeout: 60000 });

    return {
      success: true,
      count: idsToDelete.length,
      skippedCount,
      message: `Đã xóa thành công ${idsToDelete.length} đơn hàng${
        skippedCount > 0 ? ` (bỏ qua ${skippedCount} đơn đã xuất kho)` : ''
      }`,
    };
  }

  async markVirtualOrder(
    tenantId: string,
    id: string,
    userId: string,
    dto: MarkVirtualOrderDto,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: { orderItems: true, shop: true, packages: true },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng trong Workspace');
    }

    const isVirtual = !!dto.isVirtual;
    const isRealGoods = isVirtual ? !!dto.isRealGoods : false;

    return this.prisma.$transaction(async (tx) => {
      // Nếu đang giữ hàng (RESERVED) mà chuyển sang đơn ảo không đi hàng thật -> giải phóng giữ hàng để khôi phục tồn
      if (order.fulfillmentStatus === FulfillmentStatus.RESERVED && isVirtual && !isRealGoods) {
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
              order.externalOrderId || order.internalOrderCode,
            );
          }
        }
      }

      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          isVirtual,
          isRealGoods,
        },
        include: {
          shop: { select: { id: true, code: true, name: true } },
          orderItems: true,
          packages: true,
        },
      });

      await this.auditService.log({
        tenantId,
        userId,
        action: 'ORDER_MARK_VIRTUAL',
        entityType: 'Order',
        entityId: order.id,
        newValues: { isVirtual, isRealGoods },
      });

      return updated;
    });
  }

  async bulkMarkVirtualOrders(
    tenantId: string,
    userId: string,
    dto: BulkMarkVirtualOrdersDto,
  ) {
    if (!dto.orderIds || dto.orderIds.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất một đơn hàng');
    }

    const isVirtual = !!dto.isVirtual;
    const isRealGoods = isVirtual ? !!dto.isRealGoods : false;

    const orders = await this.prisma.order.findMany({
      where: {
        id: { in: dto.orderIds },
        tenantId,
      },
      include: {
        orderItems: true,
        shop: true,
      },
    });

    if (orders.length === 0) {
      throw new NotFoundException('Không tìm thấy đơn hàng nào phù hợp trong Workspace');
    }

    return this.prisma.$transaction(async (tx) => {
      // Nếu chuyển sang đơn ảo không đi hàng thật, giải phóng tồn giữ hàng cho các đơn đang RESERVED
      if (isVirtual && !isRealGoods) {
        for (const order of orders) {
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
                  order.externalOrderId || order.internalOrderCode,
                );
              }
            }
          }
        }
      }

      await tx.order.updateMany({
        where: {
          id: { in: dto.orderIds },
          tenantId,
        },
        data: {
          isVirtual,
          isRealGoods,
        },
      });

      await this.auditService.log({
        tenantId,
        userId,
        action: 'ORDER_BULK_MARK_VIRTUAL',
        entityType: 'Order',
        entityId: 'bulk',
        newValues: {
          orderIdsCount: dto.orderIds.length,
          isVirtual,
          isRealGoods,
        },
      });

      return {
        success: true,
        count: orders.length,
        message: `Đã cập nhật ${orders.length} đơn hàng thành ${isVirtual ? 'đơn ảo' : 'đơn thường'}${
          isVirtual ? (isRealGoods ? ' (có đi hàng thật)' : ' (không trừ kho)') : ''
        }`,
      };
    });
  }

  async markDispatched(
    tenantId: string,
    orderId: string,
    userId: string,
    dto?: MarkDispatchedDto,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        shop: true,
        orderItems: { include: { variant: true } },
        packages: {
          include: {
            packageItems: { include: { orderItem: true } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    if (order.platformStatus === PlatformOrderStatus.CANCELLED) {
      throw new BadRequestException('Đơn hàng đã bị hủy trên sàn, không thể xuất kho');
    }

    if (
      order.verificationStatus === VerificationStatus.VERIFIED &&
      order.fulfillmentStatus === FulfillmentStatus.DISPATCHED
    ) {
      return {
        success: true,
        alreadyDispatched: true,
        message: 'Đơn hàng này đã được xác nhận xuất kho / đã quét trước đó',
        order,
      };
    }

    let warehouseId = dto?.warehouseId || order.shop?.defaultWarehouseId;
    if (!warehouseId) {
      const activeWarehouse = await this.prisma.warehouse.findFirst({
        where: { tenantId, status: WarehouseStatus.ACTIVE },
        orderBy: { createdAt: 'asc' },
      });
      if (activeWarehouse) {
        warehouseId = activeWarehouse.id;
      }
    }

    if (!warehouseId) {
      throw new BadRequestException(
        'Hệ thống chưa có Kho hàng khả dụng. Vui lòng cấu hình Kho hàng trong Shop hoặc Workspace.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      let targetPackage: any = order.packages?.[0];

      if (!targetPackage) {
        const newPkgCode = order.trackingCode || `PKG-${order.externalOrderId}`;
        targetPackage = await tx.package.create({
          data: {
            tenantId,
            orderId: order.id,
            packageCode: newPkgCode,
            trackingCode: order.trackingCode || order.externalOrderId,
            carrierName: order.shippingCarrier || 'SPX Express',
            status: PackageStatus.READY,
          },
          include: {
            packageItems: true,
          },
        });

        if (order.orderItems && order.orderItems.length > 0) {
          for (const oi of order.orderItems) {
            try {
              await tx.packageItem.create({
                data: {
                  tenantId,
                  packageId: targetPackage.id,
                  orderItemId: oi.id,
                  quantity: oi.quantity,
                },
              });
            } catch {
              // Ignore duplicate
            }
          }
        }
      }

      // Items to dispatch
      const itemsToDispatch = (order.orderItems || [])
        .filter((oi) => !!oi.variantId)
        .map((oi) => ({
          variantId: oi.variantId!,
          quantity: oi.quantity,
        }));

      const isVirtualNoStock = order.isVirtual && !order.isRealGoods;

      if (isVirtualNoStock) {
        // Đơn ảo không đi hàng thật: KHÔNG trừ kho
        // Nếu trước đó RESERVED, giải phóng giữ kho
        if (order.fulfillmentStatus === FulfillmentStatus.RESERVED && itemsToDispatch.length > 0) {
          await this.inventoryService.releaseStockForOrder(
            tx,
            tenantId,
            warehouseId,
            itemsToDispatch,
            order.id,
            userId,
            order.externalOrderId || order.internalOrderCode,
          );
        }
      } else {
        // Đơn thường hoặc đơn ảo có đi hàng thật: Trừ tồn kho và ghi sổ cái DISPATCH
        if (itemsToDispatch.length > 0 && order.fulfillmentStatus !== FulfillmentStatus.DISPATCHED) {
          await this.inventoryService.dispatchStockForPackage(
            tx,
            tenantId,
            warehouseId,
            itemsToDispatch,
            order.id,
            targetPackage.id,
            userId,
          );
        }
      }

      // Cập nhật tất cả packages sang DISPATCHED
      await tx.package.updateMany({
        where: { orderId: order.id },
        data: {
          status: PackageStatus.DISPATCHED,
          verifiedAt: new Date(),
          verifiedByUserId: userId,
        },
      });

      // Cập nhật Order
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          verificationStatus: VerificationStatus.VERIFIED,
          fulfillmentStatus: FulfillmentStatus.DISPATCHED,
          shippedAt: order.shippedAt || new Date(),
        },
        include: {
          shop: true,
          orderItems: { include: { variant: true } },
          packages: true,
        },
      });

      // Tạo ScanEvent
      const scanCode = order.trackingCode || order.externalOrderId;
      await tx.scanEvent.create({
        data: {
          tenantId,
          shopId: order.shopId,
          warehouseId,
          orderId: order.id,
          packageId: targetPackage.id,
          rawCode: scanCode,
          normalizedCode: scanCode,
          scanResult: ScanResult.VERIFIED,
          deviceId: 'WEB_MANUAL_DISPATCH',
          performedByUserId: userId,
          errorMessage: dto?.note || 'Đánh dấu xuất kho thủ công từ Quản lý đơn hàng',
        },
      });

      await this.auditService.log({
        tenantId,
        userId,
        action: 'ORDER_MANUAL_DISPATCH',
        entityType: 'Order',
        entityId: order.id,
        newValues: {
          externalOrderId: order.externalOrderId,
          warehouseId,
          isVirtual: order.isVirtual,
          isRealGoods: order.isRealGoods,
          deductedStock: !isVirtualNoStock,
        },
      });

      return {
        success: true,
        message: isVirtualNoStock
          ? 'Đã đánh dấu xuất kho / đã quét (Đơn ảo - Không trừ tồn kho)'
          : 'Đã đánh dấu xuất kho / đã quét và cập nhật tồn kho thành công',
        order: updatedOrder,
      };
    });
  }

  async bulkMarkDispatched(
    tenantId: string,
    userId: string,
    dto: BulkMarkDispatchedDto,
  ) {
    if (!dto.orderIds || dto.orderIds.length === 0) {
      throw new BadRequestException('Danh sách ID đơn hàng không được để trống');
    }

    const results = {
      total: dto.orderIds.length,
      successCount: 0,
      failedCount: 0,
      errors: [] as Array<{ orderId: string; externalOrderId?: string; error: string }>,
    };

    for (const orderId of dto.orderIds) {
      try {
        await this.markDispatched(tenantId, orderId, userId, {
          warehouseId: dto.warehouseId,
          note: dto.note || 'Đánh dấu xuất kho hàng loạt từ Quản lý đơn hàng',
        });
        results.successCount++;
      } catch (err: any) {
        results.failedCount++;
        results.errors.push({
          orderId,
          error: err.message || 'Lỗi không xác định khi xuất kho',
        });
      }
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: 'ORDER_BULK_MANUAL_DISPATCH',
      entityType: 'Order',
      entityId: 'bulk',
      newValues: {
        total: results.total,
        successCount: results.successCount,
        failedCount: results.failedCount,
      },
    });

    return {
      success: results.successCount > 0,
      ...results,
      message: `Đã xử lý ${results.successCount}/${results.total} đơn hàng xuất kho thành công${
        results.failedCount > 0 ? ` (${results.failedCount} đơn thất bại)` : ''
      }`,
    };
  }

  async reverseDispatched(
    tenantId: string,
    orderId: string,
    userId: string,
    dto?: ReverseDispatchedDto,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        shop: true,
        packages: {
          include: {
            packageItems: { include: { orderItem: true } },
          },
        },
        orderItems: { include: { variant: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    if (
      order.fulfillmentStatus !== FulfillmentStatus.DISPATCHED &&
      order.verificationStatus !== VerificationStatus.VERIFIED
    ) {
      throw new BadRequestException('Đơn hàng chưa ở trạng thái xuất kho / đã quét');
    }

    const isVirtualNoStock = order.isVirtual && !order.isRealGoods;
    const isPlatformCancelled =
      order.platformStatus === PlatformOrderStatus.CANCELLED ||
      order.platformStatus === PlatformOrderStatus.IN_CANCEL;

    return this.prisma.$transaction(async (tx) => {
      // Revert package status (chỉ các kiện đang DISPATCHED)
      await tx.package.updateMany({
        where: { orderId: order.id, status: PackageStatus.DISPATCHED },
        data: {
          status: PackageStatus.READY,
          verifiedAt: null,
          verifiedByUserId: null,
        },
      });

      // Restore stock if real goods were dispatched.
      // Hoàn đúng số lượng & đúng KHO đã bị trừ theo sổ cái (kho lúc quét có thể khác kho mặc định của Shop),
      // chỉ cộng onHand, không tăng reserved.
      let restoredQuantity = 0;
      if (!isVirtualNoStock) {
        const orderCode = order.externalOrderId || order.internalOrderCode;
        const restored = await this.inventoryService.restoreDispatchedStock(tx, tenantId, {
          orderId: order.id,
          packageIds: (order.packages || []).map((p) => p.id),
          userId,
          referenceType: 'MANUAL_DISPATCH_REVERSAL',
          referenceId: order.id,
          voucherCode: orderCode,
          performerName: 'Staff',
          note: `Hoàn tác xuất kho đơn ${orderCode}${dto?.reason ? `: ${dto.reason}` : ''}`,
        });
        restoredQuantity = restored.restoredQuantity;
      }

      // Revert Order status
      // Đơn đã hủy trên sàn: không đưa về RESERVED (không còn giữ hàng) mà đánh dấu CANCELLED_RESTOCKED
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          verificationStatus: VerificationStatus.NOT_VERIFIED,
          fulfillmentStatus: isPlatformCancelled
            ? FulfillmentStatus.CANCELLED_RESTOCKED
            : FulfillmentStatus.RESERVED,
        },
        include: {
          shop: true,
          orderItems: { include: { variant: true } },
          packages: true,
        },
      });

      await this.auditService.log({
        tenantId,
        userId,
        action: 'ORDER_REVERSE_DISPATCH',
        entityType: 'Order',
        entityId: order.id,
        newValues: {
          externalOrderId: order.externalOrderId,
          reason: dto?.reason,
          restoredStock: !isVirtualNoStock,
          restoredQuantity,
        },
      });

      return {
        success: true,
        message: 'Đã hoàn tác xuất kho đơn hàng thành công',
        order: updatedOrder,
      };
    });
  }

  async getProcurementDemand(
    tenantId: string,
    allowedShopIds: string[] | null,
    query: ProcurementDemandQueryDto,
  ) {
    const orderWhere: Prisma.OrderWhereInput = {
      tenantId,
      platformStatus: PlatformOrderStatus.READY_TO_SHIP,
      fulfillmentStatus: { not: FulfillmentStatus.DISPATCHED },
      // Đơn ảo không đi hàng thật không cần nhập kho thật để xuất
      NOT: {
        AND: [{ isVirtual: true }, { isRealGoods: false }],
      },
    };

    if (allowedShopIds && allowedShopIds.length > 0) {
      if (query.shopId && query.shopId !== 'ALL') {
        orderWhere.shopId = allowedShopIds.includes(query.shopId)
          ? query.shopId
          : '__FORBIDDEN__';
      } else {
        orderWhere.shopId = { in: allowedShopIds };
      }
    } else if (query.shopId && query.shopId !== 'ALL') {
      orderWhere.shopId = query.shopId;
    }

    const orders = await this.prisma.order.findMany({
      where: orderWhere,
      select: {
        id: true,
        externalOrderId: true,
        internalOrderCode: true,
        trackingCode: true,
        orderDate: true,
        recipientName: true,
        shopId: true,
        orderItems: {
          select: {
            id: true,
            variantId: true,
            productName: true,
            variationName: true,
            externalSku: true,
            quantity: true,
            variant: {
              select: {
                id: true,
                sku: true,
                barcode: true,
                name: true,
                unit: true,
                costPrice: true,
                sellingPrice: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
                inventoryBalances: {
                  where: {
                    tenantId,
                    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
                  },
                  select: {
                    warehouseId: true,
                    onHand: true,
                    reserved: true,
                    warehouse: {
                      select: {
                        id: true,
                        name: true,
                        code: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const itemMap = new Map<string, any>();

    for (const order of orders) {
      for (const oi of order.orderItems) {
        // Group key: variantId if mapped, or externalSku/productName if unmapped
        const groupKey = oi.variantId
          ? `variant-${oi.variantId}`
          : `unmapped-${oi.externalSku || oi.productName}-${oi.variationName || ''}`;

        if (!itemMap.has(groupKey)) {
          const variant = oi.variant;
          let onHand = 0;
          let reserved = 0;
          const warehouseBreakdown: any[] = [];

          if (variant && variant.inventoryBalances) {
            for (const bal of variant.inventoryBalances) {
              onHand += bal.onHand;
              reserved += bal.reserved;
              warehouseBreakdown.push({
                warehouseId: bal.warehouseId,
                warehouseName: bal.warehouse?.name || '',
                warehouseCode: bal.warehouse?.code || '',
                onHand: bal.onHand,
                reserved: bal.reserved,
                available: bal.onHand - bal.reserved,
              });
            }
          }

          itemMap.set(groupKey, {
            groupKey,
            variantId: oi.variantId || null,
            isMapped: !!oi.variantId,
            sku: variant?.sku || oi.externalSku || 'Chưa mapping SKU',
            barcode: variant?.barcode || null,
            productName: variant?.product?.name || oi.productName,
            variationName: variant?.name || oi.variationName || '',
            productCode: variant?.product?.code || null,
            unit: variant?.unit || 'cái',
            costPrice: parseFloat(String(variant?.costPrice || 0)),
            sellingPrice: parseFloat(String(variant?.sellingPrice || 0)),
            onHand,
            reserved,
            available: onHand - reserved,
            warehouseBreakdown,
            requiredQuantity: 0,
            ordersCount: 0,
            relatedOrders: [],
          });
        }

        const entry = itemMap.get(groupKey);
        entry.requiredQuantity += oi.quantity;
        entry.ordersCount += 1;
        if (entry.relatedOrders.length < 20) {
          entry.relatedOrders.push({
            orderId: order.id,
            externalOrderId: order.externalOrderId,
            trackingCode: order.trackingCode,
            quantity: oi.quantity,
          });
        }
      }
    }

    const items = Array.from(itemMap.values()).map((item) => {
      // difference = onHand - requiredQuantity
      // If difference < 0 => thiếu hàng cần nhập thêm
      // If difference >= 0 => đủ hàng, thừa/dư tồn
      const difference = item.onHand - item.requiredQuantity;
      const isShortage = difference < 0;
      const shortageQuantity = isShortage ? Math.abs(difference) : 0;
      const surplusQuantity = !isShortage ? difference : 0;
      const estimatedShortageCost = shortageQuantity * item.costPrice;

      return {
        ...item,
        difference,
        status: isShortage ? 'SHORTAGE' : 'SUFFICIENT',
        shortageQuantity,
        surplusQuantity,
        estimatedShortageCost,
      };
    });

    // Sắp xếp: Thiếu hàng lên trước (độ thiếu giảm dần), sau đó đến chưa mapping, rồi đến đủ hàng
    items.sort((a, b) => {
      if (a.status === 'SHORTAGE' && b.status !== 'SHORTAGE') return -1;
      if (a.status !== 'SHORTAGE' && b.status === 'SHORTAGE') return 1;
      if (a.status === 'SHORTAGE' && b.status === 'SHORTAGE') {
        return b.shortageQuantity - a.shortageQuantity;
      }
      if (!a.isMapped && b.isMapped) return -1;
      if (a.isMapped && !b.isMapped) return 1;
      return a.surplusQuantity - b.surplusQuantity;
    });

    const summary = {
      totalOrders: orders.length,
      totalItems: items.length,
      shortageItemsCount: items.filter((it) => it.status === 'SHORTAGE').length,
      sufficientItemsCount: items.filter((it) => it.status === 'SUFFICIENT').length,
      unmappedItemsCount: items.filter((it) => !it.isMapped).length,
      totalRequiredQuantity: items.reduce((sum, it) => sum + it.requiredQuantity, 0),
      totalOnHand: items.reduce((sum, it) => sum + it.onHand, 0),
      totalShortageQuantity: items.reduce((sum, it) => sum + it.shortageQuantity, 0),
      totalEstimatedCost: items.reduce((sum, it) => sum + it.estimatedShortageCost, 0),
    };

    const filteredItems = query.onlyShortage
      ? items.filter((it) => it.status === 'SHORTAGE')
      : items;

    return {
      summary,
      items: filteredItems,
    };
  }
}



