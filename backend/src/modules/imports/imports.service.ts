import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { parse as parseCsv } from 'csv-parse/sync';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';
import { UploadImportDto, ConfirmImportDto } from './dto/import.dto';
import { ShopeeAdapter, ParsedShopeeOrder } from './adapters/shopee.adapter';
import {
  ImportJobStatus,
  Platform,
  PlatformOrderStatus,
  FulfillmentStatus,
  VerificationStatus,
  PackageStatus,
} from '@prisma/client';

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  // In-memory cache for parsed payload before confirmation
  private readonly parsedJobCache = new Map<string, ParsedShopeeOrder[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
  ) {}

  async uploadFile(
    tenantId: string,
    userId: string,
    file: Express.Multer.File,
    dto: UploadImportDto,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng tải lên file dữ liệu (.xlsx hoặc .csv)');
    }

    // Verify shop belongs to tenant
    const shop = await this.prisma.shop.findFirst({
      where: { id: dto.shopId, tenantId },
    });
    if (!shop) {
      throw new BadRequestException('Shop không thuộc Workspace hiện tại');
    }

    // Determine warehouse
    const warehouseId = dto.warehouseId || shop.defaultWarehouseId;

    // Checksum for deduplication
    const fileChecksum = createHash('md5').update(file.buffer).digest('hex');

    // Parse raw records
    let rawRows: Record<string, any>[] = [];
    const fileName = file.originalname.toLowerCase();

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = XLSX.read(file.buffer, { type: 'buffer', raw: false });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } else if (fileName.endsWith('.csv')) {
      rawRows = parseCsv(file.buffer.toString('utf-8'), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } else {
      throw new BadRequestException('Định dạng file không được hỗ trợ. Chỉ chấp nhận .xlsx hoặc .csv');
    }

    if (rawRows.length === 0) {
      throw new BadRequestException('File không chứa dữ liệu hoặc không có dòng nào hợp lệ');
    }

    // Adapt rows using ShopeeAdapter
    const mappedRows = [];
    for (let i = 0; i < rawRows.length; i++) {
      const mapped = ShopeeAdapter.mapRow(rawRows[i], i + 2); // 1-indexed header is row 1
      if (mapped) mappedRows.push(mapped);
    }

    // Group rows into Orders
    const parsedOrders = ShopeeAdapter.groupRowsIntoOrders(mappedRows);

    // Fetch existing mappings in this tenant & shop
    const mappings = await this.prisma.listingMapping.findMany({
      where: { tenantId, shopId: dto.shopId, platform: Platform.SHOPEE },
    });

    const isItemMapped = (item: any) => {
      if (
        item.externalSku &&
        mappings.some((m) => m.sellerSku.toLowerCase() === item.externalSku.toLowerCase())
      ) {
        return true;
      }
      if (
        item.canonicalSku &&
        mappings.some((m) => m.sellerSku.toLowerCase() === item.canonicalSku.toLowerCase())
      ) {
        return true;
      }
      const cleanProd = (item.productName || '').trim().toLowerCase();
      const cleanVar = (item.variationName || '').trim().toLowerCase();
      return mappings.some((m) => {
        const mProd = (m.productName || '').trim().toLowerCase();
        const mVar = (m.variationName || '').trim().toLowerCase();
        return mProd && mProd === cleanProd && (!mVar || mVar === cleanVar);
      });
    };

    // Track unmapped SKUs
    const unmappedSkuSet = new Set<string>();
    for (const order of parsedOrders) {
      for (const item of order.items) {
        if (!isItemMapped(item)) {
          const displayLabel = item.externalSku
            ? item.externalSku
            : `${item.productName}${item.variationName ? ` [${item.variationName}]` : ''}`;
          unmappedSkuSet.add(displayLabel);
        }
      }
    }

    // Check existing duplicate orders in this shop to calculate new vs duplicate orders
    const externalOrderIds = parsedOrders.map((o) => o.externalOrderId);
    const existingOrders = await this.prisma.order.findMany({
      where: {
        tenantId,
        shopId: dto.shopId,
        platform: Platform.SHOPEE,
        externalOrderId: { in: externalOrderIds },
      },
      select: {
        id: true,
        externalOrderId: true,
      },
    });

    const duplicateOrderCount = existingOrders.length;
    const newOrderCount = parsedOrders.length - duplicateOrderCount;

    // Create ImportJob record
    const importJob = await this.prisma.importJob.create({
      data: {
        tenantId,
        shopId: dto.shopId,
        warehouseId,
        fileName: file.originalname,
        fileChecksum,
        status: ImportJobStatus.READY,
        totalRows: rawRows.length,
        totalOrders: parsedOrders.length,
        unmappedSkuCount: unmappedSkuSet.size,
      },
    });

    // Store in-memory cache for confirm step
    this.parsedJobCache.set(importJob.id, parsedOrders);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'IMPORT_UPLOAD',
      entityType: 'ImportJob',
      entityId: importJob.id,
      newValues: {
        fileName: file.originalname,
        totalOrders: parsedOrders.length,
        newOrderCount,
        duplicateOrderCount,
        unmappedSkus: unmappedSkuSet.size,
      },
    });

    return {
      importJobId: importJob.id,
      fileName: file.originalname,
      status: importJob.status,
      totalRows: rawRows.length,
      totalOrders: parsedOrders.length,
      newOrderCount,
      duplicateOrderCount,
      unmappedSkuCount: unmappedSkuSet.size,
      unmappedSkus: Array.from(unmappedSkuSet),
      message:
        duplicateOrderCount > 0
          ? `Nhận diện ${newOrderCount} đơn mới và ${duplicateOrderCount} đơn đã có (sẽ tự động cập nhật trạng thái theo file mới nhất này).`
          : `Nhận diện ${newOrderCount} đơn mới, sẵn sàng import.`,
    };
  }

  async getPreview(tenantId: string, jobId: string) {
    const job = await this.prisma.importJob.findFirst({
      where: { id: jobId, tenantId },
      include: {
        shop: { select: { id: true, code: true, name: true } },
      },
    });

    if (!job) {
      throw new NotFoundException('Không tìm thấy Import Job');
    }

    const cachedOrders = this.parsedJobCache.get(job.id);
    const sampleOrders = cachedOrders ? cachedOrders.slice(0, 10) : [];

    return {
      job,
      sampleOrders,
      cachedOrdersCount: cachedOrders ? cachedOrders.length : 0,
    };
  }

  async confirmImport(
    tenantId: string,
    jobId: string,
    userId: string,
    dto: ConfirmImportDto,
  ) {
    const job = await this.prisma.importJob.findFirst({
      where: { id: jobId, tenantId },
      include: { shop: true },
    });

    if (!job) {
      throw new NotFoundException('Không tìm thấy Import Job');
    }

    if (
      job.status === ImportJobStatus.COMPLETED ||
      job.status === ImportJobStatus.PROCESSING
    ) {
      return { message: 'Import Job đã được xử lý hoặc đang xử lý', job };
    }

    const ordersToProcess = this.parsedJobCache.get(job.id);
    if (!ordersToProcess || ordersToProcess.length === 0) {
      throw new BadRequestException('Dữ liệu bộ nhớ tạm của Job đã hết hạn. Vui lòng upload lại file.');
    }

    await this.prisma.importJob.update({
      where: { id: job.id },
      data: { status: ImportJobStatus.PROCESSING },
    });

    // Fetch mappings
    const mappings = await this.prisma.listingMapping.findMany({
      where: { tenantId, shopId: job.shopId, platform: Platform.SHOPEE },
      include: { variant: true },
    });

    const findMatchedMapping = (item: any) => {
      if (item.externalSku) {
        const bySku = mappings.find(
          (m) => m.sellerSku.toLowerCase() === item.externalSku.toLowerCase(),
        );
        if (bySku) return bySku;
      }
      if (item.canonicalSku) {
        const byCanonical = mappings.find(
          (m) => m.sellerSku.toLowerCase() === item.canonicalSku.toLowerCase(),
        );
        if (byCanonical) return byCanonical;
      }
      const cleanProd = (item.productName || '').trim().toLowerCase();
      const cleanVar = (item.variationName || '').trim().toLowerCase();
      return (
        mappings.find((m) => {
          const mProd = (m.productName || '').trim().toLowerCase();
          const mVar = (m.variationName || '').trim().toLowerCase();
          return mProd && mProd === cleanProd && (!mVar || mVar === cleanVar);
        }) || null
      );
    };

    const warehouseId = job.warehouseId || job.shop.defaultWarehouseId;

    let newOrdersCount = 0;
    let updatedOrdersCount = 0;
    let errorCount = 0;

    // Process in batches
    for (const parsed of ordersToProcess) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Check if order already exists in tenant
          const existingOrder = await tx.order.findUnique({
            where: {
              tenantId_shopId_platform_externalOrderId: {
                tenantId,
                shopId: job.shopId,
                platform: Platform.SHOPEE,
                externalOrderId: parsed.externalOrderId,
              },
            },
            include: {
              packages: true,
              orderItems: true,
            },
          });

          if (existingOrder) {
            // LATEST FILE STATUS UPDATE: Update order state according to the latest file!
            // Invariant: Do not reverse local warehouse DISPATCHED status, but update platform status and release/reserve inventory correctly
            const isDispatched =
              existingOrder.fulfillmentStatus === FulfillmentStatus.DISPATCHED;

            const newPlatformStatus = parsed.platformStatus;
            let newFulfillmentStatus = existingOrder.fulfillmentStatus;

            // Update unmapped orderItems if new mapping is available now
            for (const oi of existingOrder.orderItems) {
              if (!oi.variantId) {
                const matched = findMatchedMapping(oi);
                if (matched?.variant) {
                  const multiplier = matched.multiplier || oi.packMultiplier || 1;
                  const rawQty = oi.rawQuantity || 1;
                  const finalQty = Math.max(1, rawQty * multiplier);

                  await tx.orderItem.update({
                    where: { id: oi.id },
                    data: {
                      variantId: matched.variant.id,
                      packMultiplier: multiplier,
                      quantity: finalQty,
                      itemCogs: Number(matched.variant.costPrice) * finalQty,
                    },
                  });
                  oi.variantId = matched.variant.id;
                  oi.quantity = finalQty;
                }
              }
            }

            // Fulfillment State Machine updates based on latest file
            if (isDispatched) {
              // Physical handover already verified at local warehouse
              newFulfillmentStatus = FulfillmentStatus.DISPATCHED;
            } else {
              if (newPlatformStatus === PlatformOrderStatus.CANCELLED) {
                // If order was reserved, release stock back to available
                if (existingOrder.fulfillmentStatus === FulfillmentStatus.RESERVED) {
                  const itemsToRelease = existingOrder.orderItems
                    .filter((oi) => oi.variantId)
                    .map((oi) => ({
                      variantId: oi.variantId!,
                      quantity: oi.quantity,
                    }));
                  if (itemsToRelease.length > 0 && warehouseId) {
                    await this.inventoryService.releaseStockForOrder(
                      tx,
                      tenantId,
                      warehouseId,
                      itemsToRelease,
                      existingOrder.id,
                      userId,
                    );
                  }
                }
                newFulfillmentStatus = FulfillmentStatus.CANCELLED_RESTOCKED;
              } else if (newPlatformStatus === PlatformOrderStatus.COMPLETED) {
                // Historical order marked completed
                if (existingOrder.fulfillmentStatus === FulfillmentStatus.RESERVED) {
                  const itemsToRelease = existingOrder.orderItems
                    .filter((oi) => oi.variantId)
                    .map((oi) => ({
                      variantId: oi.variantId!,
                      quantity: oi.quantity,
                    }));
                  if (itemsToRelease.length > 0 && warehouseId) {
                    await this.inventoryService.releaseStockForOrder(
                      tx,
                      tenantId,
                      warehouseId,
                      itemsToRelease,
                      existingOrder.id,
                      userId,
                    );
                  }
                }
                newFulfillmentStatus = FulfillmentStatus.PENDING_PROCESSING;
              } else if (
                newPlatformStatus === PlatformOrderStatus.READY_TO_SHIP &&
                (existingOrder.fulfillmentStatus === FulfillmentStatus.PENDING_PROCESSING ||
                  existingOrder.fulfillmentStatus === FulfillmentStatus.OUT_OF_STOCK ||
                  existingOrder.fulfillmentStatus === FulfillmentStatus.CANCELLED_RESTOCKED ||
                  existingOrder.fulfillmentStatus === FulfillmentStatus.UNMAPPED)
              ) {
                // If autoReserve enabled and all items mapped, attempt reservation
                const allItemsMapped = existingOrder.orderItems.every((oi) => oi.variantId);
                if (allItemsMapped) {
                  if (dto.autoReserve !== false && warehouseId) {
                    const itemsToReserve = existingOrder.orderItems.map((oi) => ({
                      variantId: oi.variantId!,
                      quantity: oi.quantity,
                    }));
                    const reserveResult = await this.inventoryService.reserveStockForOrder(
                      tx,
                      tenantId,
                      warehouseId,
                      itemsToReserve,
                      existingOrder.id,
                      userId,
                    );
                    newFulfillmentStatus = reserveResult.success
                      ? FulfillmentStatus.RESERVED
                      : FulfillmentStatus.OUT_OF_STOCK;
                  } else {
                    newFulfillmentStatus = FulfillmentStatus.PENDING_PROCESSING;
                  }
                } else {
                  newFulfillmentStatus = FulfillmentStatus.UNMAPPED;
                }
              }
            }

            // Warning note if platform cancelled after physical dispatch
            let updatedNote = existingOrder.note;
            if (isDispatched && newPlatformStatus === PlatformOrderStatus.CANCELLED) {
              const warning = `[CẢNH BÁO: Sàn báo hủy theo file import mới nhất sau khi kho đã quét xuất!]`;
              if (!updatedNote?.includes('CẢNH BÁO: Sàn báo hủy')) {
                updatedNote = updatedNote ? `${updatedNote} | ${warning}` : warning;
              }
            }

            // Update order record with latest file information
            await tx.order.update({
              where: { id: existingOrder.id },
              data: {
                platformStatus: newPlatformStatus,
                fulfillmentStatus: newFulfillmentStatus,
                paidAt: parsed.paidAt ?? existingOrder.paidAt,
                completedAt: parsed.completedAt ?? existingOrder.completedAt,
                trackingCode: parsed.trackingCode ?? existingOrder.trackingCode,
                shippingCarrier: parsed.carrier ?? existingOrder.shippingCarrier,
                recipientName: parsed.recipientName ?? existingOrder.recipientName,
                recipientPhone: parsed.recipientPhone ?? existingOrder.recipientPhone,
                recipientAddress: parsed.recipientAddress ?? existingOrder.recipientAddress,
                totalAmount: parsed.totalAmount || existingOrder.totalAmount,
                shippingFee: parsed.shippingFee || existingOrder.shippingFee,
                note: updatedNote,
              },
            });

            // Nếu đơn cập nhật sang trạng thái hủy và chưa nhận tiền quyết toán, xóa bản ghi đối soát
            if (
              newPlatformStatus === PlatformOrderStatus.CANCELLED ||
              newPlatformStatus === PlatformOrderStatus.IN_CANCEL
            ) {
              await tx.orderReconciliationRecord.deleteMany({
                where: {
                  orderId: existingOrder.id,
                  settledPayout: 0,
                  adjustmentAmount: 0,
                },
              });
            }

            // Update packages with latest tracking code and carrier name
            if (parsed.trackingCode || parsed.carrier) {
              await tx.package.updateMany({
                where: { orderId: existingOrder.id, tenantId },
                data: {
                  ...(parsed.trackingCode ? { trackingCode: parsed.trackingCode } : {}),
                  ...(parsed.carrier ? { carrierName: parsed.carrier } : {}),
                },
              });
            }

            updatedOrdersCount++;
          } else {
            // NEW ORDER CREATION
            const internalOrderCode = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

            // Check if all items are mapped
            let allMapped = true;
            let totalCogs = 0;

            const orderItemsData = parsed.items.map((item) => {
              const matchedMapping = findMatchedMapping(item);
              const matchedVariant = matchedMapping ? matchedMapping.variant : null;

              if (!matchedVariant) {
                allMapped = false;
              }

              const multiplier = matchedMapping?.multiplier || item.packMultiplier || 1;
              const rawQuantity = item.rawQuantity || 1;
              const finalQuantity = Math.max(1, rawQuantity * multiplier);

              const itemCogs = matchedVariant
                ? Number(matchedVariant.costPrice) * finalQuantity
                : 0;
              totalCogs += itemCogs;

              return {
                tenantId,
                variantId: matchedVariant ? matchedVariant.id : null,
                externalSku: item.externalSku || item.canonicalSku,
                productName: item.productName,
                variationName: item.variationName,
                rawQuantity,
                packMultiplier: multiplier,
                quantity: finalQuantity,
                originalPrice: item.originalPrice,
                discountedPrice: item.discountedPrice,
                itemCogs,
              };
            });

            // Initial fulfillment status
            let fulfillmentStatus: FulfillmentStatus = FulfillmentStatus.PENDING_PROCESSING;
            if (!allMapped) {
              fulfillmentStatus = FulfillmentStatus.UNMAPPED;
            } else if (parsed.platformStatus === PlatformOrderStatus.COMPLETED) {
              // Past historical order: do not deduct stock!
              fulfillmentStatus = FulfillmentStatus.PENDING_PROCESSING;
            }

            const createdOrder = await tx.order.create({
              data: {
                tenantId,
                shopId: job.shopId,
                internalOrderCode,
                platform: Platform.SHOPEE,
                externalOrderId: parsed.externalOrderId,
                platformStatus: parsed.platformStatus,
                fulfillmentStatus,
                verificationStatus: VerificationStatus.NOT_VERIFIED,
                orderDate: parsed.orderDate,
                paidAt: parsed.paidAt,
                completedAt: parsed.completedAt,
                buyerUsername: parsed.buyerUsername,
                recipientName: parsed.recipientName,
                recipientPhone: parsed.recipientPhone,
                recipientAddress: parsed.recipientAddress,
                shippingCarrier: parsed.carrier,
                trackingCode: parsed.trackingCode,
                totalAmount: parsed.totalAmount,
                shippingFee: parsed.shippingFee,
                cogsTotal: totalCogs,
                orderItems: {
                  create: orderItemsData,
                },
              },
              include: { orderItems: true },
            });

            // Create default package for the order
            const packageCode = parsed.packageCode || `PKG-${parsed.externalOrderId}`;
            const pkg = await tx.package.create({
              data: {
                tenantId,
                orderId: createdOrder.id,
                packageCode,
                trackingCode: parsed.trackingCode,
                carrierName: parsed.carrier,
                status: PackageStatus.READY,
              },
            });

            // Link package items
            for (const oi of createdOrder.orderItems) {
              await tx.packageItem.create({
                data: {
                  tenantId,
                  packageId: pkg.id,
                  orderItemId: oi.id,
                  quantity: oi.quantity,
                },
              });
            }

            // AUTO-RESERVE IF ELIGIBLE (all mapped + READY_TO_SHIP + warehouse configured)
            if (
              dto.autoReserve !== false &&
              allMapped &&
              warehouseId &&
              parsed.platformStatus === PlatformOrderStatus.READY_TO_SHIP
            ) {
              const itemsToReserve = createdOrder.orderItems.map((oi) => ({
                variantId: oi.variantId!,
                quantity: oi.quantity,
              }));

              const reserveResult = await this.inventoryService.reserveStockForOrder(
                tx,
                tenantId,
                warehouseId,
                itemsToReserve,
                createdOrder.id,
                userId,
              );

              if (reserveResult.success) {
                await tx.order.update({
                  where: { id: createdOrder.id },
                  data: { fulfillmentStatus: FulfillmentStatus.RESERVED },
                });
              } else {
                await tx.order.update({
                  where: { id: createdOrder.id },
                  data: { fulfillmentStatus: FulfillmentStatus.OUT_OF_STOCK },
                });
              }
            }

            newOrdersCount++;
          }
        });
      } catch (err) {
        this.logger.error(`Error processing order ${parsed.externalOrderId}: ${(err as Error).message}`);
        errorCount++;
        await this.prisma.importRowError.create({
          data: {
            tenantId,
            importJobId: job.id,
            rowNumber: parsed.items[0]?.rowNumber || 0,
            externalOrderId: parsed.externalOrderId,
            errorCode: 'IMPORT_ORDER_ERROR',
            errorMessage: (err as Error).message,
          },
        });
      }
    }

    const finalStatus =
      errorCount > 0 ? ImportJobStatus.COMPLETED_WITH_ERRORS : ImportJobStatus.COMPLETED;

    const updatedJob = await this.prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: finalStatus,
        processedOrders: newOrdersCount + updatedOrdersCount,
        newOrdersCount,
        updatedOrdersCount,
        errorCount,
      },
    });

    // Clear cache
    this.parsedJobCache.delete(job.id);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'IMPORT_CONFIRM',
      entityType: 'ImportJob',
      entityId: job.id,
      newValues: { newOrdersCount, updatedOrdersCount, errorCount, status: finalStatus },
    });

    return {
      message: 'Đã hoàn tất xử lý import đơn hàng Shopee',
      job: updatedJob,
    };
  }
}
