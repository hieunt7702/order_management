import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  PlatformOrderStatus,
  FulfillmentStatus,
  VerificationStatus,
  FinancialStatus,
  Platform,
} from '@prisma/client';
import { Type } from 'class-transformer';


export class OrderFilterDto {
  @ApiPropertyOptional({ example: 'shop-uuid' })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiPropertyOptional({ description: 'PlatformOrderStatus or composite aliases like CANCELLED_AND_RETURNED' })
  @IsOptional()
  @IsString()
  platformStatus?: string;

  @ApiPropertyOptional({ enum: FulfillmentStatus })
  @IsOptional()
  @IsEnum(FulfillmentStatus)
  fulfillmentStatus?: FulfillmentStatus;

  @ApiPropertyOptional({ enum: VerificationStatus })
  @IsOptional()
  @IsEnum(VerificationStatus)
  verificationStatus?: VerificationStatus;

  @ApiPropertyOptional({ enum: FinancialStatus })
  @IsOptional()
  @IsEnum(FinancialStatus)
  financialStatus?: FinancialStatus;

  @ApiPropertyOptional({ example: '2607218XUFC1C0' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: '2026-07-01T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Lọc theo đơn ảo: "true", "false", hoặc "ALL"' })
  @IsOptional()
  isVirtual?: boolean | string;

  @ApiPropertyOptional({ description: 'Lọc theo đi hàng thật: "true", "false", hoặc "ALL"' })
  @IsOptional()
  isRealGoods?: boolean | string;
}

export class CancelOrderDto {
  @ApiPropertyOptional({ example: 'Khách hàng hủy trên Shopee trước khi giao' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReceiveReturnDto {
  @ApiPropertyOptional({ example: 'warehouse-uuid' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ example: 'Hàng hoàn nguyên vẹn, bao bì đầy đủ' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateOrderItemDto {
  @ApiPropertyOptional({ example: 'variant-uuid' })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({ example: 'Bánh gạo One One Vị Bò Nướng 150g' })
  @IsNotEmpty()
  @IsString()
  productName!: string;

  @ApiPropertyOptional({ example: 'Gói 150g' })
  @IsOptional()
  @IsString()
  variationName?: string;

  @ApiPropertyOptional({ example: 'SKU-BO-150G' })
  @IsOptional()
  @IsString()
  sellerSku?: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty({ example: 28000 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'shop-uuid' })
  @IsNotEmpty()
  @IsString()
  shopId!: string;

  @ApiPropertyOptional({ example: '261015MANUAL001' })
  @IsOptional()
  @IsString()
  externalOrderId?: string;

  @ApiPropertyOptional({ enum: Platform, default: Platform.MANUAL })
  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsNotEmpty()
  @IsString()
  recipientName!: string;

  @ApiPropertyOptional({ example: '0987654321' })
  @IsOptional()
  @IsString()
  recipientPhone?: string;

  @ApiPropertyOptional({ example: '123 Đường Cầu Giấy, Hà Nội' })
  @IsOptional()
  @IsString()
  recipientAddress?: string;

  @ApiPropertyOptional({ example: 'SPX Express' })
  @IsOptional()
  @IsString()
  shippingCarrier?: string;

  @ApiPropertyOptional({ example: 'SPXVN0123456789' })
  @IsOptional()
  @IsString()
  trackingCode?: string;

  @ApiPropertyOptional({ example: 350000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @ApiPropertyOptional({ example: 25000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingFee?: number;

  @ApiPropertyOptional({ example: 'Giao giờ hành chính' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Đánh dấu đơn ảo (seeding/buff đơn)', default: false })
  @IsOptional()
  @IsBoolean()
  isVirtual?: boolean;

  @ApiPropertyOptional({ description: 'Có đi hàng thật hay không (mặc định false với đơn ảo)', default: false })
  @IsOptional()
  @IsBoolean()
  isRealGoods?: boolean;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}

export class UpdateOrderDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn B' })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiPropertyOptional({ example: '0912345678' })
  @IsOptional()
  @IsString()
  recipientPhone?: string;

  @ApiPropertyOptional({ example: '456 Hoàng Hoa Thám, Hà Nội' })
  @IsOptional()
  @IsString()
  recipientAddress?: string;

  @ApiPropertyOptional({ example: 'Giao Hàng Nhanh' })
  @IsOptional()
  @IsString()
  shippingCarrier?: string;

  @ApiPropertyOptional({ example: 'GHNVN987654321' })
  @IsOptional()
  @IsString()
  trackingCode?: string;

  @ApiPropertyOptional({ enum: PlatformOrderStatus })
  @IsOptional()
  @IsEnum(PlatformOrderStatus)
  platformStatus?: PlatformOrderStatus;

  @ApiPropertyOptional({ enum: FulfillmentStatus })
  @IsOptional()
  @IsEnum(FulfillmentStatus)
  fulfillmentStatus?: FulfillmentStatus;

  @ApiPropertyOptional({ example: 400000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @ApiPropertyOptional({ example: 30000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingFee?: number;

  @ApiPropertyOptional({ example: 'Đã gọi xác nhận với khách' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Đánh dấu đơn ảo (seeding/buff đơn)' })
  @IsOptional()
  @IsBoolean()
  isVirtual?: boolean;

  @ApiPropertyOptional({ description: 'Có đi hàng thật hay không' })
  @IsOptional()
  @IsBoolean()
  isRealGoods?: boolean;
}

export class MarkVirtualOrderDto {
  @ApiProperty({ description: 'Đánh dấu là đơn ảo (true) hoặc đơn thường (false)', example: true })
  @IsBoolean()
  isVirtual!: boolean;

  @ApiPropertyOptional({ description: 'Có đi hàng thật hay không (nếu false thì không trừ kho khi xuất)', example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isRealGoods?: boolean;
}

export class BulkMarkVirtualOrdersDto {
  @ApiProperty({ description: 'Danh sách ID đơn hàng cần đánh dấu', type: [String] })
  @IsArray()
  @IsString({ each: true })
  orderIds!: string[];

  @ApiProperty({ description: 'Đánh dấu là đơn ảo (true) hoặc đơn thường (false)', example: true })
  @IsBoolean()
  isVirtual!: boolean;

  @ApiPropertyOptional({ description: 'Có đi hàng thật hay không (nếu false thì không trừ kho khi xuất)', example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isRealGoods?: boolean;
}

export class BulkDeleteOrdersDto {
  @ApiPropertyOptional({ description: 'Danh sách ID đơn hàng cần xóa', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  orderIds?: string[];

  @ApiPropertyOptional({ description: 'Xóa toàn bộ đơn hàng trong workspace' })
  @IsOptional()
  @IsBoolean()
  deleteAll?: boolean;

  @ApiPropertyOptional({ description: 'Lọc theo shopId khi xóa' })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiPropertyOptional({ description: 'Bắt buộc xóa cả đơn đã xuất kho' })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

