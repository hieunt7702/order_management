import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
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

  @ApiProperty({ type: [StockItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockItemDto)
  items!: StockItemDto[];

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

  @ApiProperty({
    example: -2,
    description: 'Số lượng thay đổi (âm hoặc dương). Hoặc số chênh lệch kiểm kê.',
  })
  @IsInt()
  deltaOnHand!: number;

  @ApiProperty({ example: 'Hao hụt rách bao bì khi bốc dỡ' })
  @IsNotEmpty()
  @IsString()
  reason!: string;
}
