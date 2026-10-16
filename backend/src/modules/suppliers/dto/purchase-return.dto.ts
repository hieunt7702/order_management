import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseReturnItemDto {
  @ApiProperty({ example: 'variant-uuid' })
  @IsNotEmpty()
  @IsString()
  variantId!: string;

  @ApiProperty({ example: 'SKU-BO-150G' })
  @IsNotEmpty()
  @IsString()
  sku!: string;

  @ApiProperty({ example: 10, description: 'Số lượng trả nhà cung cấp' })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ example: 25000, description: 'Đơn giá hoàn vốn' })
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreatePurchaseReturnDto {
  @ApiProperty({ example: 'supplier-uuid' })
  @IsNotEmpty()
  @IsString()
  supplierId!: string;

  @ApiPropertyOptional({ example: 'receipt-uuid', description: 'Phiếu nhập gốc cần trả hàng (nếu có)' })
  @IsOptional()
  @IsString()
  receiptId?: string;

  @ApiProperty({ example: 'warehouse-uuid', description: 'Kho xuất hàng trả lại' })
  @IsNotEmpty()
  @IsString()
  warehouseId!: string;

  @ApiPropertyOptional({ example: 'TH-20261015-001' })
  @IsOptional()
  @IsString()
  returnCode?: string;

  @ApiPropertyOptional({ example: '2026-10-15T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  returnDate?: string;

  @ApiProperty({ type: [PurchaseReturnItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseReturnItemDto)
  items!: PurchaseReturnItemDto[];

  @ApiPropertyOptional({ example: 250000, description: 'Khoản tiền NCC đã xác nhận giảm trừ nợ' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  debtOffsetAmount?: number;

  @ApiPropertyOptional({ example: 'Hàng rách bao bì và cận date' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class PurchaseReturnFilterDto {
  @ApiPropertyOptional({ example: 'supplier-uuid' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ example: 'receipt-uuid' })
  @IsOptional()
  @IsString()
  receiptId?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  limit?: number;
}
