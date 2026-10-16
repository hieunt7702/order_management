import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Platform, ProductStatus } from '@prisma/client';

export class CreateVariantDto {
  @ApiProperty({ example: 'SKU-HAO-HAO-120G' })
  @IsNotEmpty({ message: 'SKU nội bộ không được để trống' })
  @IsString()
  sku!: string;

  @ApiProperty({ example: 'Hũ 120gr Tôm Chua Cay' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: '8934567890123' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ example: 'Hũ' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({ example: 23100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPrice?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;
}

export class CreateProductDto {
  @ApiProperty({ example: 'PROD_HAOHAO_TOM' })
  @IsNotEmpty()
  @IsString()
  code!: string;

  @ApiProperty({ example: 'Muối Chấm Hảo Hảo Hũ 120gr' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Muối Hảo Hảo chính hãng Acecook' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [CreateVariantDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants!: CreateVariantDto[];
}

export class CreateListingMappingDto {
  @ApiProperty({ example: 'shop-uuid' })
  @IsNotEmpty()
  @IsString()
  shopId!: string;

  @ApiPropertyOptional({ enum: Platform, default: Platform.SHOPEE })
  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @ApiPropertyOptional({ example: '2607218XUFC1C0' })
  @IsOptional()
  @IsString()
  externalProductId?: string;

  @ApiPropertyOptional({ example: 'VAR_RANDOM' })
  @IsOptional()
  @IsString()
  externalVariationId?: string;

  @ApiPropertyOptional({ example: 'SELLER-SKU-SHOPEE-01', description: 'SKU hoặc mã phân loại hàng trên sàn Shopee' })
  @IsOptional()
  @IsString()
  sellerSku?: string;

  @ApiPropertyOptional({ example: '(Bán sỉ )Thùng Chân Gà Bà Tuyết' })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiPropertyOptional({ example: 'Combo 2 thùng' })
  @IsOptional()
  @IsString()
  variationName?: string;

  @ApiPropertyOptional({ example: 2, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  multiplier?: number;

  @ApiProperty({ example: 'variant-uuid', description: 'ID của SKU nội bộ cần liên kết' })
  @IsNotEmpty()
  @IsString()
  variantId!: string;
}

export class BulkListingItemDto {
  @ApiProperty({ example: 'shop-uuid' })
  @IsNotEmpty()
  @IsString()
  shopId!: string;

  @ApiPropertyOptional({ example: 'SELLER-SKU-01' })
  @IsOptional()
  @IsString()
  sellerSku?: string;

  @ApiPropertyOptional({ example: 'Tên sản phẩm' })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiPropertyOptional({ example: 'Combo 2 thùng' })
  @IsOptional()
  @IsString()
  variationName?: string;

  @ApiPropertyOptional({ example: 2, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  multiplier?: number;
}

export class BulkListingMappingDto {
  @ApiProperty({ example: 'variant-uuid', description: 'SKU kho nội bộ dùng chung cho các sản phẩm' })
  @IsNotEmpty()
  @IsString()
  variantId!: string;

  @ApiProperty({ type: [BulkListingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkListingItemDto)
  items!: BulkListingItemDto[];
}

export class UpdateVariantDto {
  @ApiPropertyOptional({ example: 'Hũ 120gr (Cập nhật)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '8934567890123' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ example: 16000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({ example: 25000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPrice?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'PROD_HAOHAO_TOM' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: 'Muối Chấm Hảo Hảo Hũ 120gr' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Mô tả mới' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}

