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

export class InspectReturnItemDto {
  @ApiProperty({ example: 'variant-uuid' })
  @IsNotEmpty()
  @IsString()
  variantId!: string;

  @ApiProperty({ example: 'SKU-SUA-BOT-900G' })
  @IsNotEmpty()
  @IsString()
  sku!: string;

  @ApiProperty({ example: 2, description: 'Số lượng còn nguyên, bán lại được (Cộng vào tồn có thể bán onHand)' })
  @IsInt()
  @Min(0)
  sellableQuantity!: number;

  @ApiProperty({ example: 1, description: 'Số lượng bị hỏng, móp, cận date (Cộng vào tồn hàng lỗi damaged)' })
  @IsInt()
  @Min(0)
  damagedQuantity!: number;

  @ApiProperty({ example: 0, description: 'Số lượng khách giữ lại / thiếu (Không nhập lại kho)' })
  @IsInt()
  @Min(0)
  missingQuantity!: number;

  @ApiPropertyOptional({ example: 'LOT-20261015-A', description: 'Số lô sản xuất (áp dụng cho sữa, thực phẩm)' })
  @IsOptional()
  @IsString()
  batchCode?: string;

  @ApiPropertyOptional({ example: '2027-10-15T00:00:00.000Z', description: 'Hạn sử dụng' })
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @ApiPropertyOptional({ example: 'Hộp nguyên seal, tem chống hàng giả đầy đủ' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateOrderReturnDto {
  @ApiProperty({ example: 'order-uuid' })
  @IsNotEmpty()
  @IsString()
  orderId!: string;

  @ApiProperty({ example: 'warehouse-uuid', description: 'Kho thực tế nhận hàng hoàn' })
  @IsNotEmpty()
  @IsString()
  warehouseId!: string;

  @ApiPropertyOptional({ example: 'PH-20261015-001' })
  @IsOptional()
  @IsString()
  returnCode?: string;

  @ApiPropertyOptional({ example: 'SPXVN039281729' })
  @IsOptional()
  @IsString()
  trackingCode?: string;

  @ApiPropertyOptional({ example: '2026-10-15T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  receivedDate?: string;

  @ApiProperty({ example: 'Nhân viên B', description: 'Người thực hiện kiểm tra và xác nhận nhận hoàn' })
  @IsNotEmpty()
  @IsString()
  inspectorName!: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/damaged-photo.jpg', description: 'Ảnh chụp tình trạng hàng hoàn' })
  @IsOptional()
  @IsString()
  conditionPhoto?: string;

  @ApiPropertyOptional({ example: 'Khách không ưng màu, yêu cầu đổi trả' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [InspectReturnItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InspectReturnItemDto)
  items!: InspectReturnItemDto[];
}

export class OrderReturnFilterDto {
  @ApiPropertyOptional({ example: 'order-uuid' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ example: 'shop-uuid' })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiPropertyOptional({ example: 'warehouse-uuid' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ example: 'PH-2026' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  limit?: number;
}
