import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateProductDto,
  CreateVariantDto,
  UpdateProductDto,
  CreateListingMappingDto,
  BulkListingMappingDto,
  UpdateVariantDto,
} from './dto/product.dto';
import { Platform, FulfillmentStatus, ProductStatus } from '@prisma/client';
import { ShopeeAdapter } from '../imports/adapters/shopee.adapter';


@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, page = 1, limit = 50, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = { tenantId };

    if (search && search !== 'undefined' && search !== 'null' && search.trim() !== '') {
      const searchClean = search.trim();
      where.OR = [
        { name: { contains: searchClean, mode: 'insensitive' } },
        { code: { contains: searchClean, mode: 'insensitive' } },
        {
          variants: {
            some: {
              OR: [
                { sku: { contains: searchClean, mode: 'insensitive' } },
                { barcode: { contains: searchClean, mode: 'insensitive' } },
                { name: { contains: searchClean, mode: 'insensitive' } },
                {
                  listingMappings: {
                    some: {
                      OR: [
                        { sellerSku: { contains: searchClean, mode: 'insensitive' } },
                        { productName: { contains: searchClean, mode: 'insensitive' } },
                        { variationName: { contains: searchClean, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          variants: {
            include: {
              inventoryBalances: {
                include: { warehouse: true },
              },
              listingMappings: {
                include: { shop: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findAllVariants(tenantId: string, page = 1, limit = 1000, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = { tenantId, status: ProductStatus.ACTIVE };

    if (search && search !== 'undefined' && search !== 'null' && search.trim() !== '') {
      const searchClean = search.trim();
      where.OR = [
        { sku: { contains: searchClean, mode: 'insensitive' } },
        { barcode: { contains: searchClean, mode: 'insensitive' } },
        { name: { contains: searchClean, mode: 'insensitive' } },
        { product: { name: { contains: searchClean, mode: 'insensitive' } } },
        {
          listingMappings: {
            some: {
              OR: [
                { sellerSku: { contains: searchClean, mode: 'insensitive' } },
                { productName: { contains: searchClean, mode: 'insensitive' } },
                { variationName: { contains: searchClean, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.productVariant.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          inventoryBalances: {
            include: { warehouse: true },
          },
          listingMappings: {
            include: { shop: true },
          },
        },
        orderBy: [{ product: { name: 'asc' } }, { sku: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.productVariant.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        variants: {
          include: {
            inventoryBalances: {
              include: { warehouse: true },
            },
            listingMappings: {
              include: { shop: true },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    return product;
  }

  async generateNextProductCode(tenantId: string): Promise<string> {
    const products = await this.prisma.product.findMany({
      where: { tenantId },
      select: { code: true },
    });

    let maxNum = 0;
    for (const p of products) {
      const match = p.code?.match(/^SP-?(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    let nextNum = maxNum + 1;
    let candidate = `SP${String(nextNum).padStart(3, '0')}`;
    while (
      await this.prisma.product.findUnique({
        where: { tenantId_code: { tenantId, code: candidate } },
      })
    ) {
      nextNum++;
      candidate = `SP${String(nextNum).padStart(3, '0')}`;
    }
    return candidate;
  }

  async create(tenantId: string, dto: CreateProductDto) {
    let productCode = dto.code?.trim().toUpperCase();
    if (!productCode) {
      productCode = await this.generateNextProductCode(tenantId);
    } else {
      const existingCode = await this.prisma.product.findUnique({
        where: {
          tenantId_code: {
            tenantId,
            code: productCode,
          },
        },
      });
      if (existingCode) {
        productCode = await this.generateNextProductCode(tenantId);
      }
    }

    // Process variants and ensure unique SKUs
    const variantsToCreate: any[] = [];
    const baseVariants = dto.variants && dto.variants.length > 0 ? dto.variants : [{ name: 'Mặc định' }];

    for (let i = 0; i < baseVariants.length; i++) {
      const v = baseVariants[i];
      let sku = (v as any).sku?.trim().toUpperCase();
      if (!sku || sku === 'SKU' || sku === 'SP' || sku.startsWith('SP-') || sku.startsWith('SP')) {
        sku = `${productCode}-${i + 1}`;
      }
      let candidateSku = sku;
      let counter = i + 1;
      while (
        await this.prisma.productVariant.findUnique({
          where: {
            tenantId_sku: {
              tenantId,
              sku: candidateSku,
            },
          },
        })
      ) {
        counter++;
        candidateSku = `${productCode}-${counter}`;
      }
      variantsToCreate.push({
        ...v,
        sku: candidateSku,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          tenantId,
          code: productCode,
          name: dto.name,
          description: dto.description,
        },
      });

      const variants = [];
      for (const v of variantsToCreate) {
        const variant = await tx.productVariant.create({
          data: {
            tenantId,
            productId: product.id,
            sku: v.sku,
            name: v.name || 'Mặc định',
            barcode: v.barcode,
            unit: v.unit || 'cái',
            costPrice: v.costPrice ?? 0,
            sellingPrice: v.sellingPrice ?? 0,
            lowStockThreshold: v.lowStockThreshold ?? 5,
          },
        });
        variants.push(variant);
      }

      return {
        ...product,
        variants,
      };
    });
  }

  async updateVariant(tenantId: string, variantId: string, dto: UpdateVariantDto) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, tenantId },
    });
    if (!variant) {
      throw new NotFoundException('Không tìm thấy biến thể SKU này');
    }

    if (dto.sku && dto.sku.trim().toUpperCase() !== variant.sku) {
      const newSku = dto.sku.trim().toUpperCase();
      const existing = await this.prisma.productVariant.findUnique({
        where: { tenantId_sku: { tenantId, sku: newSku } },
      });
      if (existing && existing.id !== variantId) {
        throw new ConflictException(`Mã SKU "${newSku}" đã tồn tại trong hệ thống`);
      }
    }

    const sellingPrice = dto.sellingPrice ?? dto.sellPrice;
    const lowStockThreshold = dto.lowStockThreshold ?? dto.minStockAlert;

    return this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...(dto.sku ? { sku: dto.sku.trim().toUpperCase() } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.barcode !== undefined ? { barcode: dto.barcode } : {}),
        ...(dto.costPrice !== undefined ? { costPrice: dto.costPrice } : {}),
        ...(sellingPrice !== undefined ? { sellingPrice } : {}),
        ...(lowStockThreshold !== undefined ? { lowStockThreshold } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
  }

  async addVariant(tenantId: string, productId: string, dto: CreateVariantDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: { variants: true },
    });
    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    const productCode = product.code.trim().toUpperCase();
    let sku = dto.sku?.trim().toUpperCase();
    let counter = product.variants.length + 1;
    if (!sku || sku === 'SKU' || sku === 'SP' || sku.startsWith('SP-') || sku.startsWith('SP')) {
      sku = `${productCode}-${counter}`;
    }

    let candidateSku = sku;
    while (
      await this.prisma.productVariant.findUnique({
        where: {
          tenantId_sku: {
            tenantId,
            sku: candidateSku,
          },
        },
      })
    ) {
      counter++;
      candidateSku = `${productCode}-${counter}`;
    }

    const sellingPrice = dto.sellingPrice ?? dto.sellPrice;
    const lowStockThreshold = dto.lowStockThreshold ?? dto.minStockAlert;

    return this.prisma.productVariant.create({
      data: {
        tenantId,
        productId,
        sku: candidateSku,
        name: dto.name || 'Mặc định',
        barcode: dto.barcode || null,
        unit: dto.unit || 'cái',
        costPrice: dto.costPrice ?? 0,
        sellingPrice: sellingPrice ?? 0,
        lowStockThreshold: lowStockThreshold ?? 5,
      },
    });
  }

  async updateProduct(tenantId: string, id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        variants: true,
      },
    });
    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    if (dto.code && dto.code !== product.code) {
      const existing = await this.prisma.product.findUnique({
        where: { tenantId_code: { tenantId, code: dto.code } },
      });
      if (existing) {
        throw new ConflictException(`Mã sản phẩm "${dto.code}" đã tồn tại`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...(dto.code ? { code: dto.code } : {}),
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.status ? { status: dto.status } : {}),
        },
      });

      if (dto.variants && Array.isArray(dto.variants)) {
        const productCode = (dto.code || product.code).trim().toUpperCase();
        let counter = product.variants.length + 1;

        for (const v of dto.variants) {
          const sellingPrice = v.sellingPrice ?? v.sellPrice;
          const lowStockThreshold = v.lowStockThreshold ?? v.minStockAlert;

          if (v.id) {
            const existingVariant = product.variants.find((pv) => pv.id === v.id);
            if (!existingVariant) continue;

            if (v.isDeleted) {
              const historyCount =
                (await tx.orderItem.count({ where: { variantId: v.id } })) +
                (await tx.inventoryLedger.count({ where: { variantId: v.id } }));

              if (historyCount > 0) {
                await tx.productVariant.update({
                  where: { id: v.id },
                  data: { status: ProductStatus.ARCHIVED },
                });
              } else {
                await tx.inventoryBalance.deleteMany({ where: { variantId: v.id } });
                await tx.listingMapping.deleteMany({ where: { variantId: v.id } });
                await tx.productVariant.delete({ where: { id: v.id } });
              }
            } else {
              let nextSku = existingVariant.sku;
              if (v.sku && v.sku.trim().toUpperCase() !== existingVariant.sku) {
                const candidate = v.sku.trim().toUpperCase();
                const conflict = await tx.productVariant.findUnique({
                  where: { tenantId_sku: { tenantId, sku: candidate } },
                });
                if (!conflict || conflict.id === existingVariant.id) {
                  nextSku = candidate;
                }
              }

              await tx.productVariant.update({
                where: { id: v.id },
                data: {
                  sku: nextSku,
                  ...(v.name !== undefined ? { name: v.name } : {}),
                  ...(v.barcode !== undefined ? { barcode: v.barcode || null } : {}),
                  ...(v.costPrice !== undefined ? { costPrice: v.costPrice } : {}),
                  ...(sellingPrice !== undefined ? { sellingPrice } : {}),
                  ...(lowStockThreshold !== undefined ? { lowStockThreshold } : {}),
                  ...(v.status !== undefined ? { status: v.status } : {}),
                },
              });
            }
          } else if (!v.isDeleted) {
            // New variant
            let candidateSku = v.sku?.trim().toUpperCase();
            if (
              !candidateSku ||
              candidateSku === 'SKU' ||
              candidateSku === 'SP' ||
              candidateSku.startsWith('SP-') ||
              candidateSku.startsWith('SP')
            ) {
              candidateSku = `${productCode}-${counter}`;
            }

            while (
              await tx.productVariant.findUnique({
                where: { tenantId_sku: { tenantId, sku: candidateSku } },
              })
            ) {
              counter++;
              candidateSku = `${productCode}-${counter}`;
            }
            counter++;

            await tx.productVariant.create({
              data: {
                tenantId,
                productId: product.id,
                sku: candidateSku,
                name: v.name || 'Mặc định',
                barcode: v.barcode || null,
                unit: 'cái',
                costPrice: v.costPrice ?? 0,
                sellingPrice: sellingPrice ?? 0,
                lowStockThreshold: lowStockThreshold ?? 5,
                status: v.status || ProductStatus.ACTIVE,
              },
            });
          }
        }
      }

      return tx.product.findUnique({
        where: { id },
        include: {
          variants: {
            include: {
              inventoryBalances: { include: { warehouse: true } },
              listingMappings: { include: { shop: true } },
            },
          },
        },
      });
    });
  }

  async deleteProduct(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        variants: {
          select: {
            id: true,
            _count: {
              select: {
                orderItems: true,
                inventoryLedgers: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    const hasHistory = product.variants.some(
      (v) => v._count.orderItems > 0 || v._count.inventoryLedgers > 0,
    );

    if (hasHistory) {
      await this.prisma.$transaction([
        this.prisma.product.update({
          where: { id },
          data: { status: ProductStatus.ARCHIVED },
        }),
        this.prisma.productVariant.updateMany({
          where: { productId: id },
          data: { status: ProductStatus.ARCHIVED },
        }),
      ]);
      return { success: true, message: 'Sản phẩm có phát sinh đơn hàng/kho, đã chuyển trạng thái Lưu trữ (Archived)' };
    }

    await this.prisma.product.delete({
      where: { id },
    });

    return { success: true, message: 'Đã xóa sản phẩm thành công' };
  }

  async deleteVariant(tenantId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, tenantId },
      include: {
        _count: {
          select: {
            orderItems: true,
            inventoryLedgers: true,
          },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException('Không tìm thấy biến thể');
    }

    if (variant._count.orderItems > 0 || variant._count.inventoryLedgers > 0) {
      await this.prisma.productVariant.update({
        where: { id: variantId },
        data: { status: ProductStatus.ARCHIVED },
      });
      return { success: true, message: 'Biến thể đã có lịch sử đơn hàng/kho, đã chuyển sang Lưu trữ' };
    }

    await this.prisma.productVariant.delete({
      where: { id: variantId },
    });

    return { success: true, message: 'Đã xóa biến thể thành công' };
  }


  // Listing Mapping Logic
  async createListingMapping(tenantId: string, dto: CreateListingMappingDto) {
    // Verify shop belongs to tenant
    const shop = await this.prisma.shop.findFirst({
      where: { id: dto.shopId, tenantId },
    });
    if (!shop) {
      throw new BadRequestException('Shop không thuộc Workspace hiện tại');
    }

    // Verify variant belongs to tenant
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: dto.variantId, tenantId },
      include: { product: true },
    });
    if (!variant) {
      throw new BadRequestException('SKU nội bộ không thuộc Workspace hiện tại');
    }

    const platform = dto.platform || Platform.SHOPEE;
    const sellerSku = ShopeeAdapter.generateCanonicalSku(
      dto.productName || '',
      dto.variationName,
      dto.sellerSku,
    );

    const multiplier =
      dto.multiplier && dto.multiplier >= 1
        ? dto.multiplier
        : ShopeeAdapter.extractPackMultiplier(dto.variationName);

    // Check composite unique
    const existing = await this.prisma.listingMapping.findUnique({
      where: {
        tenantId_shopId_platform_sellerSku: {
          tenantId,
          shopId: dto.shopId,
          platform,
          sellerSku,
        },
      },
    });

    let mapping;
    if (existing) {
      mapping = await this.prisma.listingMapping.update({
        where: { id: existing.id },
        data: {
          variantId: dto.variantId,
          productName: dto.productName || existing.productName,
          variationName: dto.variationName || existing.variationName,
          multiplier,
          externalProductId: dto.externalProductId || existing.externalProductId,
          externalVariationId: dto.externalVariationId || existing.externalVariationId,
        },
        include: {
          shop: true,
          variant: { include: { product: true } },
        },
      });
    } else {
      mapping = await this.prisma.listingMapping.create({
        data: {
          tenantId,
          shopId: dto.shopId,
          platform,
          sellerSku,
          productName: dto.productName,
          variationName: dto.variationName,
          multiplier,
          variantId: dto.variantId,
          externalProductId: dto.externalProductId,
          externalVariationId: dto.externalVariationId,
        },
        include: {
          shop: true,
          variant: { include: { product: true } },
        },
      });
    }

    // Auto-sync unmapped OrderItems for this shop
    await this.syncUnmappedOrderItems(tenantId, dto.shopId, mapping, variant);

    return mapping;
  }

  async bulkListingMapping(tenantId: string, dto: BulkListingMappingDto) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: dto.variantId, tenantId },
      include: { product: true },
    });
    if (!variant) {
      throw new BadRequestException('SKU nội bộ không tồn tại trong Workspace');
    }

    const results = [];
    for (const item of dto.items) {
      const res = await this.createListingMapping(tenantId, {
        shopId: item.shopId,
        variantId: dto.variantId,
        sellerSku: item.sellerSku,
        productName: item.productName,
        variationName: item.variationName,
        multiplier: item.multiplier,
      });
      results.push(res);
    }
    return { count: results.length, items: results };
  }

  async deleteListingMapping(tenantId: string, id: string) {
    const mapping = await this.prisma.listingMapping.findFirst({
      where: { id, tenantId },
    });
    if (!mapping) {
      throw new NotFoundException('Không tìm thấy liên kết listing này');
    }
    return this.prisma.listingMapping.delete({
      where: { id },
    });
  }

  private async syncUnmappedOrderItems(
    tenantId: string,
    shopId: string,
    mapping: any,
    variant: any,
  ) {
    try {
      const unmappedItems = await this.prisma.orderItem.findMany({
        where: {
          tenantId,
          variantId: null,
          order: { shopId },
        },
        include: { order: true },
      });

      const affectedOrderIds = new Set<string>();

      for (const item of unmappedItems) {
        let isMatch = false;
        const itemCanonical = ShopeeAdapter.generateCanonicalSku(
          item.productName,
          item.variationName || undefined,
          item.externalSku || undefined,
        );

        if (
          (item.externalSku && item.externalSku.toLowerCase() === mapping.sellerSku.toLowerCase()) ||
          (itemCanonical && itemCanonical.toLowerCase() === mapping.sellerSku.toLowerCase())
        ) {
          isMatch = true;
        } else if (
          mapping.productName &&
          item.productName.trim().toLowerCase() === mapping.productName.trim().toLowerCase()
        ) {
          if (
            !mapping.variationName ||
            (item.variationName &&
              item.variationName.trim().toLowerCase() === mapping.variationName.trim().toLowerCase())
          ) {
            isMatch = true;
          }
        }

        if (isMatch) {
          const rawQty = item.rawQuantity || 1;
          const finalQty = Math.max(1, rawQty * mapping.multiplier);
          await this.prisma.orderItem.update({
            where: { id: item.id },
            data: {
              variantId: variant.id,
              packMultiplier: mapping.multiplier,
              quantity: finalQty,
              itemCogs: Number(variant.costPrice) * finalQty,
            },
          });
          affectedOrderIds.add(item.orderId);
        }
      }

      for (const orderId of affectedOrderIds) {
        const remainingUnmapped = await this.prisma.orderItem.count({
          where: { orderId, variantId: null },
        });
        if (remainingUnmapped === 0) {
          await this.prisma.order.update({
            where: { id: orderId },
            data: { fulfillmentStatus: FulfillmentStatus.PENDING_PROCESSING },
          });
        }
      }
    } catch (err) {
      console.error('Failed to sync unmapped order items:', err);
    }
  }

  async findListingMappings(tenantId: string, shopId?: string) {
    const mappings = await this.prisma.listingMapping.findMany({
      where: {
        tenantId,
        ...(shopId ? { shopId } : {}),
      },
      include: {
        shop: true,
        variant: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Also gather unmapped listings from OrderItems
    const unmappedOrderItems = await this.prisma.orderItem.findMany({
      where: {
        tenantId,
        variantId: null,
        ...(shopId ? { order: { shopId } } : {}),
      },
      select: {
        order: { select: { shopId: true, shop: { select: { id: true, name: true, code: true } } } },
        productName: true,
        variationName: true,
        externalSku: true,
        rawQuantity: true,
        packMultiplier: true,
      },
      distinct: ['productName', 'variationName', 'externalSku'],
    });

    const existingSkuKeys = new Set<string>();
    const existingNameKeys = new Set<string>();

    for (const m of mappings) {
      if (m.sellerSku) {
        existingSkuKeys.add(`${m.shopId}__${m.sellerSku.trim().toLowerCase()}`);
      }
      if (m.productName) {
        existingNameKeys.add(
          `${m.shopId}__${m.productName.trim().toLowerCase()}__${(m.variationName || '').trim().toLowerCase()}`,
        );
      }
    }

    const unmappedMap = new Map<string, any>();

    for (const oi of unmappedOrderItems) {
      const canonical = ShopeeAdapter.generateCanonicalSku(
        oi.productName,
        oi.variationName || undefined,
        oi.externalSku || undefined,
      );
      const effectiveSku = (oi.externalSku || canonical).trim();
      const skuKey = `${oi.order.shopId}__${effectiveSku.toLowerCase()}`;
      const canonicalKey = `${oi.order.shopId}__${canonical.trim().toLowerCase()}`;
      const nameKey = `${oi.order.shopId}__${(oi.productName || '').trim().toLowerCase()}__${(oi.variationName || '').trim().toLowerCase()}`;

      // If already mapped by SKU, canonical, or product+variation name, skip!
      if (
        existingSkuKeys.has(skuKey) ||
        existingSkuKeys.has(canonicalKey) ||
        existingNameKeys.has(nameKey)
      ) {
        continue;
      }

      // Group & deduplicate so identical listings don't produce duplicate items or keys
      const dedupeKey = `${oi.order.shopId}__${effectiveSku.toLowerCase()}__${(oi.variationName || '').trim().toLowerCase()}`;
      if (unmappedMap.has(dedupeKey)) {
        continue;
      }

      const multiplier =
        oi.packMultiplier || ShopeeAdapter.extractPackMultiplier(oi.variationName || undefined);

      unmappedMap.set(dedupeKey, {
        id: `unmapped-${oi.order.shopId}-${encodeURIComponent(effectiveSku)}-${encodeURIComponent(oi.variationName || 'default')}`,
        tenantId,
        shopId: oi.order.shopId,
        shop: oi.order.shop,
        platform: Platform.SHOPEE,
        sellerSku: effectiveSku,
        productName: oi.productName,
        variationName: oi.variationName,
        multiplier,
        variantId: null,
        variant: null,
        isMapped: false,
        createdAt: new Date(),
      });
    }

    const unmappedEntries = Array.from(unmappedMap.values());

    const mappedWithFlag = mappings.map((m) => ({
      ...m,
      isMapped: true,
    }));

    return [...unmappedEntries, ...mappedWithFlag];
  }
}
