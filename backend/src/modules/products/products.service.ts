import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateProductDto,
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

  async create(tenantId: string, dto: CreateProductDto) {
    // Check product code
    const existingCode = await this.prisma.product.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: dto.code,
        },
      },
    });
    if (existingCode) {
      throw new ConflictException(`Mã sản phẩm "${dto.code}" đã tồn tại trong Workspace`);
    }

    // Check unique SKUs
    for (const v of dto.variants) {
      const existingSku = await this.prisma.productVariant.findUnique({
        where: {
          tenantId_sku: {
            tenantId,
            sku: v.sku,
          },
        },
      });
      if (existingSku) {
        throw new ConflictException(`SKU nội bộ "${v.sku}" đã tồn tại trong Workspace`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          tenantId,
          code: dto.code,
          name: dto.name,
          description: dto.description,
        },
      });

      const variants = [];
      for (const v of dto.variants) {
        const variant = await tx.productVariant.create({
          data: {
            tenantId,
            productId: product.id,
            sku: v.sku,
            name: v.name,
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

    return this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        name: dto.name,
        barcode: dto.barcode,
        costPrice: dto.costPrice,
        sellingPrice: dto.sellingPrice,
        lowStockThreshold: dto.lowStockThreshold,
        status: dto.status,
      },
    });
  }

  async updateProduct(tenantId: string, id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
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

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.code ? { code: dto.code } : {}),
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      include: {
        variants: true,
      },
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
