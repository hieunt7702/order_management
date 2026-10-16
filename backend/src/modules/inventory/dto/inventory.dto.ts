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

export class StockItemDto {
  @ApiProperty({ example: 'variant-uuid' })
  @IsNotEmpty()
  @IsString()
  variantId!: string;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ReceiveStockDto {
  @ApiProperty({ example: 'warehouse-uuid' })
  @IsNotEmpty()
  @IsString()
  warehouseId!: string;

  @ApiPropertyOptional({ type: [StockItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockItemDto)
  items?: StockItemDto[];

  @ApiPropertyOptional({ example: 'variant-uuid' })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsNumber()
  unitCost?: number;

  @ApiPropertyOptional({ example: 'PNK-20261016-RZEH' })
  @IsOptional()
  @IsString()
  referenceCode?: string;

  @ApiPropertyOptional({ example: 'Nhập lô hàng đầu kỳ từ nhà cung cấp' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class AdjustStockDto {
  @ApiProperty({ example: 'warehouse-uuid' })
  @IsNotEmpty()
  @IsString()
  warehouseId!: string;

  @ApiProperty({ example: 'variant-uuid' })
  @IsNotEmpty()
  @IsString()
  variantId!: string;

  @ApiPropertyOptional({
    example: -2,
    description: 'Số lượng thay đổi (âm hoặc dương). Hoặc số chênh lệch kiểm kê.',
  })
  @IsOptional()
  @IsInt()
  deltaOnHand?: number;

  @ApiPropertyOptional({
    example: -2,
    description: 'Số lượng thay đổi gửi từ frontend',
  })
  @IsOptional()
  @IsInt()
  quantityChange?: number;

  @ApiProperty({ example: 'Hao hụt rách bao bì khi bốc dỡ' })
  @IsNotEmpty()
  @IsString()
  reason!: string;

  @ApiPropertyOptional({ example: 'Ghi chú thêm' })
  @IsOptional()
  @IsString()
  note?: string;
}

