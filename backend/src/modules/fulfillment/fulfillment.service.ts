import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';
import { ScanBarcodeDto, ReverseDispatchDto } from './dto/fulfillment.dto';
import {
  ScanResult,
  PackageStatus,
  PlatformOrderStatus,
  FulfillmentStatus,
  VerificationStatus,
  InventoryMovementType,
  WarehouseStatus,
} from '@prisma/client';

@Injectable()
export class FulfillmentService {
  private readonly logger = new Logger(FulfillmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
  ) {}

  normalizeCode(code: string): string {
    if (!code) return '';
    return code.trim().replace(/[\r\n\t]/g, '').trim();
  }

  async verifyDispatch(
    tenantId: string,
    userId: string,
    dto: ScanBarcodeDto,
    idempotencyKey?: string,
  ) {
    const rawCode = dto.code;
    const normalizedCode = this.normalizeCode(rawCode);

    if (!normalizedCode) {
      throw new BadRequestException('Mã quét không hợp lệ');
    }

    let targetPackage: any = null;

    if (dto.packageId) {
      targetPackage = await this.prisma.package.findFirst({
        where: { id: dto.packageId, tenantId },
        include: {
          order: {
            include: {
              shop: true,
              orderItems: { include: { variant: true } },
              packages: true,
            },
          },
          packageItems: {
            include: { orderItem: { include: { variant: true } } },
          },
        },
      });

      if (!targetPackage) {
        return {
          result: ScanResult.NOT_FOUND,
          message: 'Không tìm thấy kiện hàng được chỉ định trong Workspace',
        };
      }
    } else {
      // Step 1: Find candidate packages within tenant (case-insensitive + check order.trackingCode)
      let candidates = await this.prisma.package.findMany({
        where: {
          tenantId,
          OR: [
            { packageCode: { equals: normalizedCode, mode: 'insensitive' } },
            { trackingCode: { equals: normalizedCode, mode: 'insensitive' } },
            { order: { trackingCode: { equals: normalizedCode, mode: 'insensitive' } } },
            { order: { externalOrderId: { equals: normalizedCode, mode: 'insensitive' } } },
            { order: { internalOrderCode: { equals: normalizedCode, mode: 'insensitive' } } },
          ],
        },
        include: {
          order: {
            include: {
              shop: true,
              orderItems: { include: { variant: true } },
              packages: true,
            },
          },
          packageItems: {
            include: { orderItem: { include: { variant: true } } },
          },
        },
      });

      // Step 2: Fallback - if no package found, query Order table directly
      // This handles cases where an order exists in DB with trackingCode but no package row was created yet
      if (candidates.length === 0) {
        const matchingOrders = await this.prisma.order.findMany({
          where: {
            tenantId,
            OR: [
              { trackingCode: { equals: normalizedCode, mode: 'insensitive' } },
              { externalOrderId: { equals: normalizedCode, mode: 'insensitive' } },
              { internalOrderCode: { equals: normalizedCode, mode: 'insensitive' } },
            ],
          },
          include: {
            shop: true,
            orderItems: { include: { variant: true } },
            packages: {
              include: {
                packageItems: {
                  include: { orderItem: { include: { variant: true } } },
                },
              },
            },
          },
        });

        if (matchingOrders.length > 1) {
          await this.prisma.scanEvent.create({
            data: {
              tenantId,
              rawCode,
              normalizedCode,
              scanResult: ScanResult.AMBIGUOUS_CODE,
              deviceId: dto.deviceId,
              performedByUserId: userId,
              idempotencyKey,
            },
          });

          return {
            result: ScanResult.AMBIGUOUS_CODE,
            message: `Mã quét khớp với ${matchingOrders.length} đơn hàng trong Workspace. Vui lòng kiểm tra lại.`,
            candidates: matchingOrders.map((o) => ({
              orderId: o.id,
              externalOrderId: o.externalOrderId,
              trackingCode: o.trackingCode,
              shopName: o.shop?.name || '',
              status: o.platformStatus,
            })),
          };
        }

        if (matchingOrders.length === 1) {
          const matchedOrder = matchingOrders[0];
          if (matchedOrder.packages && matchedOrder.packages.length > 0) {
            candidates = matchedOrder.packages.map((pkg) => ({
              ...pkg,
              order: matchedOrder,
            })) as any;
          } else {
            // Auto-create package for this order on the fly
            const newPkgCode = matchedOrder.trackingCode || `PKG-${matchedOrder.externalOrderId}`;
            const createdPackage = await this.prisma.package.create({
              data: {
                tenantId,
                orderId: matchedOrder.id,
                packageCode: newPkgCode,
                trackingCode: matchedOrder.trackingCode || normalizedCode,
                carrierName: matchedOrder.shippingCarrier || 'SPX Express',
                status: PackageStatus.READY,
              },
            });

            if (matchedOrder.orderItems && matchedOrder.orderItems.length > 0) {
              for (const oi of matchedOrder.orderItems) {
                try {
                  await this.prisma.packageItem.create({
                    data: {
                      tenantId,
                      packageId: createdPackage.id,
                      orderItemId: oi.id,
                      quantity: oi.quantity,
                    },
                  });
                } catch {
                  // Ignore duplicate/unlinked errors
                }
              }
            }

            const freshPackage = await this.prisma.package.findUnique({
              where: { id: createdPackage.id },
              include: {
                order: {
                  include: {
                    shop: true,
                    orderItems: { include: { variant: true } },
                    packages: true,
                  },
                },
                packageItems: {
                  include: { orderItem: { include: { variant: true } } },
                },
              },
            });

            if (freshPackage) {
              candidates = [freshPackage];
            }
          }
        }
      }

      // Step 3: Fuzzy search if still not found and code length >= 6 (guards against untrimmed whitespace in DB)
      if (candidates.length === 0 && normalizedCode.length >= 6) {
        const fuzzyPackages = await this.prisma.package.findMany({
          where: {
            tenantId,
            OR: [
              { trackingCode: { contains: normalizedCode, mode: 'insensitive' } },
              { order: { trackingCode: { contains: normalizedCode, mode: 'insensitive' } } },
              { order: { externalOrderId: { contains: normalizedCode, mode: 'insensitive' } } },
            ],
          },
          include: {
            order: {
              include: {
                shop: true,
                orderItems: { include: { variant: true } },
                packages: true,
              },
            },
            packageItems: {
              include: { orderItem: { include: { variant: true } } },
            },
          },
          take: 5,
        });

        if (fuzzyPackages.length === 1) {
          candidates = fuzzyPackages;
        } else if (fuzzyPackages.length > 1) {
          await this.prisma.scanEvent.create({
            data: {
              tenantId,
              rawCode,
              normalizedCode,
              scanResult: ScanResult.AMBIGUOUS_CODE,
              deviceId: dto.deviceId,
              performedByUserId: userId,
              idempotencyKey,
            },
          });

          return {
            result: ScanResult.AMBIGUOUS_CODE,
            message: `Mã quét khớp với ${fuzzyPackages.length} kiện hàng theo tìm kiếm tương tự. Vui lòng chọn kiện hàng cần xác nhận.`,
            candidates: fuzzyPackages.map((c) => ({
              packageId: c.id,
              packageCode: c.packageCode,
              trackingCode: c.trackingCode || c.order?.trackingCode,
              externalOrderId: c.order?.externalOrderId,
              shopName: c.order?.shop?.name || '',
              carrierName: c.carrierName,
              status: c.status,
            })),
          };
        }
      }

      if (candidates.length === 0) {
        // Log failed scan
        await this.prisma.scanEvent.create({
          data: {
            tenantId,
            rawCode,
            normalizedCode,
            scanResult: ScanResult.NOT_FOUND,
            deviceId: dto.deviceId,
            performedByUserId: userId,
            idempotencyKey,
          },
        });

        return {
          result: ScanResult.NOT_FOUND,
          message: 'Không tìm thấy đơn hàng hoặc kiện hàng nào khớp với mã quét trong Workspace',
        };
      }

      // AMBIGUOUS CODE CHECK: multiple packages match
      if (candidates.length > 1) {
        await this.prisma.scanEvent.create({
          data: {
            tenantId,
            rawCode,
            normalizedCode,
            scanResult: ScanResult.AMBIGUOUS_CODE,
            deviceId: dto.deviceId,
            performedByUserId: userId,
            idempotencyKey,
          },
        });

        return {
          result: ScanResult.AMBIGUOUS_CODE,
          message: `Mã quét khớp với ${candidates.length} kiện hàng. Vui lòng chọn kiện hàng cần xác nhận.`,
          candidates: candidates.map((c) => ({
            packageId: c.id,
            packageCode: c.packageCode,
            trackingCode: c.trackingCode || c.order?.trackingCode,
            externalOrderId: c.order?.externalOrderId,
            shopName: c.order?.shop?.name || '',
            carrierName: c.carrierName,
            status: c.status,
          })),
        };
      }

      targetPackage = candidates[0];
    }

    const order = targetPackage.order;
    let warehouseId = dto.warehouseId || order?.shop?.defaultWarehouseId;

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
      return {
        result: ScanResult.INVALID_ORDER_STATUS,
        message: 'Hệ thống chưa có Kho hàng khả dụng. Vui lòng cấu hình Kho hàng trong Workspace.',
      };
    }

    // Check order conditions: ƯU TIÊN 1 - ĐƠN HÀNG ĐÃ BỊ HỦY TRÊN SÀN (Kể cả các đơn đã xuất trước)
    const isOrderCancelled =
      order.platformStatus === PlatformOrderStatus.CANCELLED ||
      order.platformStatus === PlatformOrderStatus.IN_CANCEL ||
      order.fulfillmentStatus === FulfillmentStatus.CANCELLED_RESTOCKED;

    if (isOrderCancelled) {
      const wasDispatched = targetPackage.status === PackageStatus.DISPATCHED;
      const cancelMessage = wasDispatched
        ? 'Đơn hàng ĐÃ XUẤT TRƯỚC NHƯNG ĐÃ BỊ HỦY trên sàn Shopee! Tuyệt đối giữ lại kiện hàng!'
        : 'Đơn hàng đã bị hủy trên sàn Shopee, không thể xuất kho';

      await this.prisma.scanEvent.create({
        data: {
          tenantId,
          shopId: order.shopId,
          warehouseId,
          orderId: order.id,
          packageId: targetPackage.id,
          rawCode,
          normalizedCode,
          scanResult: ScanResult.INVALID_ORDER_STATUS,
          deviceId: dto.deviceId,
          performedByUserId: userId,
          idempotencyKey,
          errorMessage: cancelMessage,
        },
      });

      return {
        result: ScanResult.INVALID_ORDER_STATUS,
        message: cancelMessage,
        isCancelled: true,
        wasDispatched,
        orderId: order.externalOrderId || order.id,
        internalOrderCode: order.internalOrderCode,
        shopName: order.shop?.name,
        carrierName: targetPackage.carrierName || order.shippingCarrier,
        packageCode: targetPackage.packageCode,
        packageId: targetPackage.id,
        order: {
          id: order.id,
          externalOrderId: order.externalOrderId,
          internalOrderCode: order.internalOrderCode,
          trackingCode: order.trackingCode || targetPackage.trackingCode,
          platformStatus: order.platformStatus,
          fulfillmentStatus: order.fulfillmentStatus,
          shop: order.shop,
          isVirtual: order.isVirtual,
          isRealGoods: order.isRealGoods,
        },
        package: {
          id: targetPackage.id,
          packageCode: targetPackage.packageCode,
          trackingCode: targetPackage.trackingCode || order.trackingCode,
          carrierName: targetPackage.carrierName || order.shippingCarrier,
          status: targetPackage.status,
          verifiedAt: targetPackage.verifiedAt,
        },
      };
    }

    // Check if already dispatched (Double-layer protection: layer 2 check - Cho các đơn chưa bị hủy)
    if (targetPackage.status === PackageStatus.DISPATCHED) {
      await this.prisma.scanEvent.create({
        data: {
          tenantId,
          shopId: order.shopId,
          warehouseId,
          orderId: order.id,
          packageId: targetPackage.id,
          rawCode,
          normalizedCode,
          scanResult: ScanResult.ALREADY_VERIFIED,
          deviceId: dto.deviceId,
          performedByUserId: userId,
          idempotencyKey,
        },
      });

      return {
        result: ScanResult.ALREADY_VERIFIED,
        message: 'Kiện hàng này đã được xác nhận xuất kho trước đó',
        isCancelled: false,
        wasDispatched: true,
        packageId: targetPackage.id,
        packageCode: targetPackage.packageCode,
        trackingCode: targetPackage.trackingCode || order.trackingCode,
        verifiedAt: targetPackage.verifiedAt,
        verifiedByUserId: targetPackage.verifiedByUserId,
        orderId: order.id,
        externalOrderId: order.externalOrderId,
        internalOrderCode: order.internalOrderCode,
        shopName: order.shop?.name,
        carrierName: targetPackage.carrierName || order.shippingCarrier,
        package: {
          id: targetPackage.id,
          packageCode: targetPackage.packageCode,
          trackingCode: targetPackage.trackingCode || order.trackingCode,
          carrierName: targetPackage.carrierName || order.shippingCarrier,
          status: targetPackage.status,
          verifiedAt: targetPackage.verifiedAt,
        },
        order: {
          id: order.id,
          externalOrderId: order.externalOrderId,
          internalOrderCode: order.internalOrderCode,
          trackingCode: order.trackingCode || targetPackage.trackingCode,
          totalPackages: order.packages?.length || 1,
          verifiedPackages: order.packages?.filter((p: any) => p.status === PackageStatus.DISPATCHED)?.length || 1,
          verificationStatus: order.verificationStatus,
          isVirtual: order.isVirtual,
          isRealGoods: order.isRealGoods,
        },
      };
    }

    if (order.fulfillmentStatus === FulfillmentStatus.UNMAPPED) {
      await this.prisma.scanEvent.create({
        data: {
          tenantId,
          shopId: order.shopId,
          warehouseId,
          orderId: order.id,
          packageId: targetPackage.id,
          rawCode,
          normalizedCode,
          scanResult: ScanResult.UNMAPPED_SKU,
          deviceId: dto.deviceId,
          performedByUserId: userId,
          idempotencyKey,
          errorMessage: 'Đơn hàng chứa SKU chưa mapping',
        },
      });

      return {
        result: ScanResult.UNMAPPED_SKU,
        message: 'Đơn hàng này có SKU chưa được mapping nội bộ. Vui lòng mapping trước khi xuất kho.',
      };
    }

    // Items to dispatch
    let itemsToDispatch = (targetPackage.packageItems || [])
      .filter((pi: any) => !!pi.orderItem?.variantId)
      .map((pi: any) => ({
        variantId: pi.orderItem.variantId,
        quantity: pi.quantity,
      }));

    if (itemsToDispatch.length === 0 && order.orderItems && order.orderItems.length > 0) {
      itemsToDispatch = order.orderItems
        .filter((oi: any) => !!oi.variantId)
        .map((oi: any) => ({
          variantId: oi.variantId,
          quantity: oi.quantity,
        }));
    }

    // EXECUTE DISPATCH TRANSACTION WITH ATOMIC ROW LOCKS
    return this.prisma.$transaction(async (tx) => {
      // Atomic state change: ensures only one worker/device can mark package as DISPATCHED
      const updateCount = await tx.package.updateMany({
        where: {
          id: targetPackage.id,
          status: { not: PackageStatus.DISPATCHED },
        },
        data: {
          status: PackageStatus.DISPATCHED,
          verifiedAt: new Date(),
          verifiedByUserId: userId,
          ...(targetPackage.trackingCode ? {} : { trackingCode: order.trackingCode || normalizedCode }),
        },
      });

      if (updateCount.count === 0) {
        // Concurrently verified by another worker
        return {
          result: ScanResult.ALREADY_VERIFIED,
          message: 'Kiện hàng vừa được xác nhận xuất kho bởi thiết bị khác',
        };
      }

      // Link package items if they were missing on the package
      if ((!targetPackage.packageItems || targetPackage.packageItems.length === 0) && order.orderItems?.length > 0) {
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
            // Ignore duplicate/unlinked errors
          }
        }
      }

      // Deduct stock and write immutable ledger
      const isVirtualNoStock = order.isVirtual && !order.isRealGoods;

      if (isVirtualNoStock) {
        // Đơn ảo không đi hàng thật: KHÔNG TRỪ TỒN KHO SẢN PHẨM (tránh trừ kho)
        // Nếu trước đó đơn có trạng thái RESERVED, giải phóng reservation để không giam tồn kho
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
        if (itemsToDispatch.length > 0) {
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

      // Check if all packages in the order are now DISPATCHED
      const remainingUnverified = await tx.package.count({
        where: {
          orderId: order.id,
          status: { not: PackageStatus.DISPATCHED },
        },
      });

      const totalPackages = order.packages?.length || 1;
      const verifiedPackages = Math.max(1, totalPackages - remainingUnverified);
      const allVerified = remainingUnverified === 0;

      await tx.order.update({
        where: { id: order.id },
        data: {
          verificationStatus: allVerified
            ? VerificationStatus.VERIFIED
            : VerificationStatus.PARTIALLY_VERIFIED,
          fulfillmentStatus: allVerified
            ? FulfillmentStatus.DISPATCHED
            : order.fulfillmentStatus,
          ...(order.trackingCode ? {} : { trackingCode: targetPackage.trackingCode || normalizedCode }),
        },
      });

      // Log successful scan event
      await tx.scanEvent.create({
        data: {
          tenantId,
          shopId: order.shopId,
          warehouseId,
          orderId: order.id,
          packageId: targetPackage.id,
          rawCode,
          normalizedCode,
          scanResult: ScanResult.VERIFIED,
          deviceId: dto.deviceId,
          performedByUserId: userId,
          idempotencyKey,
        },
      });

      await this.auditService.log({
        tenantId,
        userId,
        action: 'SCAN_VERIFY_DISPATCH',
        entityType: 'Package',
        entityId: targetPackage.id,
        newValues: {
          packageCode: targetPackage.packageCode,
          orderId: order.id,
          allVerified,
          verifiedPackages,
          totalPackages,
          isVirtual: order.isVirtual,
          isRealGoods: order.isRealGoods,
        },
      });

      let successMessage = allVerified
        ? 'Xác nhận xuất kho hoàn tất thành công cho toàn bộ đơn hàng!'
        : `Xác nhận kiện hàng thành công (${verifiedPackages}/${totalPackages} kiện đã quét)`;

      if (isVirtualNoStock) {
        successMessage = allVerified
          ? 'Xác nhận xuất kho thành công (Đơn ảo - Không trừ tồn kho)!'
          : `Xác nhận kiện hàng đơn ảo (không trừ kho) (${verifiedPackages}/${totalPackages})`;
      } else if (order.isVirtual && order.isRealGoods) {
        successMessage = allVerified
          ? 'Xác nhận xuất kho thành công (Đơn ảo - Có đi hàng thật)!'
          : `Xác nhận kiện hàng đơn ảo (có đi hàng thật) (${verifiedPackages}/${totalPackages})`;
      }

      return {
        result: ScanResult.VERIFIED,
        message: successMessage,
        package: {
          id: targetPackage.id,
          packageCode: targetPackage.packageCode,
          trackingCode: targetPackage.trackingCode || order.trackingCode || normalizedCode,
          carrierName: targetPackage.carrierName || order.shippingCarrier,
          status: PackageStatus.DISPATCHED,
          verifiedAt: new Date(),
        },
        order: {
          id: order.id,
          externalOrderId: order.externalOrderId,
          internalOrderCode: order.internalOrderCode,
          trackingCode: order.trackingCode || targetPackage.trackingCode || normalizedCode,
          totalPackages,
          verifiedPackages,
          verificationStatus: allVerified
            ? VerificationStatus.VERIFIED
            : VerificationStatus.PARTIALLY_VERIFIED,
          isVirtual: order.isVirtual,
          isRealGoods: order.isRealGoods,
        },
      };
    });
  }

  // REVERSAL USE CASE: In case of accidental scan
  async reverseDispatch(tenantId: string, userId: string, dto: ReverseDispatchDto) {
    const pkg = await this.prisma.package.findFirst({
      where: { id: dto.packageId, tenantId },
      include: {
        order: {
          include: {
            shop: true,
            packages: true,
          },
        },
        packageItems: {
          include: { orderItem: true },
        },
      },
    });

    if (!pkg) {
      throw new NotFoundException('Không tìm thấy kiện hàng');
    }

    if (pkg.status !== PackageStatus.DISPATCHED) {
      throw new BadRequestException('Kiện hàng chưa ở trạng thái xuất kho, không thể hoàn tác');
    }

    const order = pkg.order;
    const warehouseId = order.shop.defaultWarehouseId;
    if (!warehouseId) {
      throw new BadRequestException('Shop chưa được cấu hình Kho');
    }

    const itemsToRestore = pkg.packageItems
      .filter((pi: any) => !!pi.orderItem.variantId)
      .map((pi: any) => ({
        variantId: pi.orderItem.variantId,
        quantity: pi.quantity,
      }));

    return this.prisma.$transaction(async (tx) => {
      // Revert package status
      await tx.package.update({
        where: { id: pkg.id },
        data: {
          status: PackageStatus.READY,
          verifiedAt: null,
          verifiedByUserId: null,
        },
      });

      // Restore stock: increment onHand and reserved, write compensatory ledger (Chỉ hoàn tác kho nếu hàng thật đã xuất)
      const isVirtualNoStock = order.isVirtual && !order.isRealGoods;
      if (!isVirtualNoStock) {
        for (const item of itemsToRestore) {
          await tx.inventoryBalance.update({
            where: {
              tenantId_warehouseId_variantId: {
                tenantId,
                warehouseId,
                variantId: item.variantId,
              },
            },
            data: {
              onHand: { increment: item.quantity },
              reserved: { increment: item.quantity },
            },
          });

          const orderCode = order?.externalOrderId || order?.internalOrderCode;
          const packageCode = pkg.packageCode || pkg.trackingCode;

          await tx.inventoryLedger.create({
            data: {
              tenantId,
              warehouseId,
              variantId: item.variantId,
              movementType: InventoryMovementType.ADJUST,
              deltaOnHand: item.quantity,
              deltaReserved: item.quantity,
              referenceType: 'SCAN_REVERSAL',
              referenceId: pkg.id,
              voucherCode: orderCode || packageCode,
              performerName: 'HieuNT',
              performedByUserId: userId,
              note: `Hoàn tác quét xuất kiện ${packageCode}${orderCode ? ` cho đơn ${orderCode}` : ''}: ${dto.reason}`,
            },
          });
        }
      }

      // Re-evaluate order verification status
      const verifiedCount = await tx.package.count({
        where: {
          orderId: order.id,
          status: PackageStatus.DISPATCHED,
        },
      });

      const newVerificationStatus =
        verifiedCount === 0
          ? VerificationStatus.NOT_VERIFIED
          : VerificationStatus.PARTIALLY_VERIFIED;

      await tx.order.update({
        where: { id: order.id },
        data: {
          verificationStatus: newVerificationStatus,
          fulfillmentStatus: FulfillmentStatus.RESERVED,
          note: `${order.note || ''} [Hoàn tác quét kiện ${pkg.packageCode}: ${dto.reason}]`,
        },
      });

      await this.auditService.log({
        tenantId,
        userId,
        action: 'SCAN_REVERSAL',
        entityType: 'Package',
        entityId: pkg.id,
        newValues: { reason: dto.reason },
      });

      return {
        message: 'Đã hoàn tác xuất kho kiện hàng thành công',
        packageId: pkg.id,
        newVerificationStatus,
      };
    });
  }

  async getScanHistory(
    tenantId: string,
    filter: { limit?: number; warehouseId?: string; result?: string },
  ) {
    const limit = Math.min(filter.limit ? Number(filter.limit) : 50, 100);
    const where: any = { tenantId };
    if (filter.warehouseId) {
      where.warehouseId = filter.warehouseId;
    }
    if (filter.result && Object.values(ScanResult).includes(filter.result as any)) {
      where.scanResult = filter.result as ScanResult;
    }

    const events = await this.prisma.scanEvent.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            externalOrderId: true,
            internalOrderCode: true,
            trackingCode: true,
            buyerUsername: true,
            platformStatus: true,
            verificationStatus: true,
            totalAmount: true,
            shippingCarrier: true,
            shop: { select: { id: true, name: true, code: true } },
            orderItems: {
              select: {
                id: true,
                productName: true,
                variationName: true,
                quantity: true,
              },
              take: 3,
            },
          },
        },
        package: {
          select: {
            id: true,
            packageCode: true,
            trackingCode: true,
            carrierName: true,
            status: true,
            verifiedAt: true,
          },
        },
        warehouse: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const verifiedPackages = await this.prisma.package.findMany({
      where: {
        tenantId,
        status: PackageStatus.DISPATCHED,
        ...(filter.warehouseId ? { order: { shop: { defaultWarehouseId: filter.warehouseId } } } : {}),
      },
      include: {
        order: {
          select: {
            id: true,
            externalOrderId: true,
            internalOrderCode: true,
            trackingCode: true,
            buyerUsername: true,
            platformStatus: true,
            verificationStatus: true,
            totalAmount: true,
            shippingCarrier: true,
            shop: { select: { id: true, name: true, code: true } },
            orderItems: {
              select: {
                id: true,
                productName: true,
                variationName: true,
                quantity: true,
              },
              take: 3,
            },
          },
        },
      },
      orderBy: { verifiedAt: 'desc' },
      take: limit,
    });

    return {
      events,
      verifiedPackages,
      totalEvents: events.length,
      totalVerifiedPackages: verifiedPackages.length,
    };
  }

  async batchVerifyDispatch(
    tenantId: string,
    userId: string,
    dto: { codes: string[]; warehouseId?: string; deviceId?: string; sessionName?: string },
  ) {
    const rawCodes = dto.codes || [];
    const results: any[] = [];
    let verifiedCount = 0;
    let alreadyVerifiedCount = 0;
    let notFoundCount = 0;
    let cancelledCount = 0;
    let failedCount = 0;

    for (const code of rawCodes) {
      const cleanCode = this.normalizeCode(code);
      if (!cleanCode) continue;

      try {
        const res: any = await this.verifyDispatch(tenantId, userId, {
          code: cleanCode,
          warehouseId: dto.warehouseId,
          deviceId: dto.deviceId || 'BATCH_SESSION',
        });

        const isCancelled =
          !!res.isCancelled ||
          res.order?.platformStatus === PlatformOrderStatus.CANCELLED ||
          res.order?.platformStatus === PlatformOrderStatus.IN_CANCEL ||
          res.order?.fulfillmentStatus === FulfillmentStatus.CANCELLED_RESTOCKED;

        if (isCancelled) {
          cancelledCount++;
        } else if (res.result === ScanResult.VERIFIED) {
          verifiedCount++;
        } else if (res.result === ScanResult.ALREADY_VERIFIED) {
          alreadyVerifiedCount++;
        } else if (res.result === ScanResult.NOT_FOUND) {
          notFoundCount++;
        } else {
          failedCount++;
        }

        results.push({
          code: cleanCode,
          result: isCancelled ? ScanResult.INVALID_ORDER_STATUS : res.result,
          message: res.message,
          isCancelled,
          wasDispatched: !!res.wasDispatched,
          orderId: res.order?.externalOrderId || res.orderId || res.externalOrderId,
          internalOrderCode: res.order?.internalOrderCode || res.internalOrderCode,
          carrierName: res.package?.carrierName || res.carrierName,
          shopName: res.package?.order?.shop?.name || res.order?.shop?.name || res.shopName,
          packageCode: res.package?.packageCode || res.packageCode,
          packageId: res.package?.id || res.packageId,
          isVirtual: res.order?.isVirtual,
          isRealGoods: res.order?.isRealGoods,
        });
      } catch (err: any) {
        failedCount++;
        results.push({
          code: cleanCode,
          result: 'ERROR',
          message: err.message || 'Lỗi xử lý xác nhận đơn hàng',
        });
      }
    }

    return {
      total: rawCodes.length,
      verifiedCount,
      alreadyVerifiedCount,
      notFoundCount,
      cancelledCount,
      failedCount,
      items: results,
    };
  }
}


