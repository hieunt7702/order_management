import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductBorrowType, ProductBorrowStatus } from '@prisma/client';

export class BorrowItemDto {
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsString()
  @IsNotEmpty()
  productName!: string;

  @IsString()
  @IsOptional()
  variationName?: string;

  @IsNumber()
  @Min(1)
  borrowQuantity!: number;

  @IsNumber()
  @IsOptional()
  unitPrice?: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class CreateSupplierProductBorrowDto {
  @IsString()
  @IsNotEmpty()
  supplierId!: string;

  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @IsString()
  @IsOptional()
  borrowCode?: string;

  @IsEnum(ProductBorrowType)
  @IsOptional()
  type?: ProductBorrowType;

  @IsString()
  @IsOptional()
  borrowDate?: string;

  @IsString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BorrowItemDto)
  items!: BorrowItemDto[];
}

export class ReturnBorrowItemDto {
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsNumber()
  @Min(1)
  returnQuantity!: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class ReturnSupplierProductBorrowDto {
  @IsString()
  @IsNotEmpty()
  borrowId!: string;

  @IsString()
  @IsOptional()
  returnDate?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnBorrowItemDto)
  items!: ReturnBorrowItemDto[];
}

export class ConvertBorrowItemDto {
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsNumber()
  @Min(1)
  purchaseQuantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class ConvertBorrowToPurchaseDto {
  @IsString()
  @IsNotEmpty()
  borrowId!: string;

  @IsString()
  @IsOptional()
  shopId?: string;

  @IsString()
  @IsOptional()
  receiptCode?: string;

  @IsString()
  @IsOptional()
  paymentDueDate?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConvertBorrowItemDto)
  items!: ConvertBorrowItemDto[];
}

export class SupplierProductBorrowFilterDto {
  @IsString()
  @IsOptional()
  supplierId?: string;

  @IsString()
  @IsOptional()
  warehouseId?: string;

  @IsEnum(ProductBorrowType)
  @IsOptional()
  type?: ProductBorrowType;

  @IsEnum(ProductBorrowStatus)
  @IsOptional()
  status?: ProductBorrowStatus;

  @IsString()
  @IsOptional()
  search?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
