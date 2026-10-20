import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PurchaseReceivingStatus,
  PurchasePaymentStatus,
  PaymentDueStatus,
  ShippingFeePayerType,
  FundSourceType,
} from '@prisma/client';

export class CreateReceiptItemDto {
  @ApiProperty({ example: 'variant-uuid' })
  @IsNotEmpty()
  @IsString()
  variantId!: string;

  @ApiProperty({ example: 'Bánh gạo One One Vị Bò Nướng 150g' })
  @IsNotEmpty()
  @IsString()
  productName!: string;

  @ApiPropertyOptional({ example: 'Gói 150g' })
  @IsOptional()
  @IsString()
  variationName?: string;

  @ApiProperty({ example: 'SKU-BO-150G' })
  @IsNotEmpty()
  @IsString()
  sku!: string;

  @ApiProperty({ example: 100, description: 'Số lượng đặt' })
  @IsInt()
  @Min(1)
  orderedQuantity!: number;

  @ApiProperty({ example: 100, description: 'Số lượng thực nhận (cộng tồn onHand)' })
  @IsInt()
  @Min(0)
  receivedQuantity!: number;

  @ApiPropertyOptional({ example: 0, description: 'Số lượng lỗi hỏng đang tranh chấp' })
  @IsOptional()
  @IsInt()
  @Min(0)
  disputedQuantity?: number;

  @ApiProperty({ example: 25000, description: 'Đơn giá nhập' })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreatePurchaseReceiptDto {
  @ApiProperty({ example: 'supplier-uuid' })
  @IsNotEmpty()
  @IsString()
  supplierId!: string;

  @ApiPropertyOptional({ example: 'shop-uuid' })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiProperty({ example: 'warehouse-uuid' })
  @IsNotEmpty()
  @IsString()
  warehouseId!: string;

  @ApiPropertyOptional({ example: 'PNK-20261015-001' })
  @IsOptional()
  @IsString()
  receiptCode?: string;

  @ApiPropertyOptional({ example: '2026-10-15T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  receiptDate?: string;

  @ApiPropertyOptional({ example: '2026-10-30T00:00:00.000Z', description: 'Hạn thanh toán' })
  @IsOptional()
  @IsString()
  paymentDueDate?: string;

  @ApiProperty({ type: [CreateReceiptItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReceiptItemDto)
  items!: CreateReceiptItemDto[];

  @ApiPropertyOptional({ example: 50000, description: 'Chiết khấu trực tiếp trên phiếu' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ example: 0, description: 'Thuế VAT' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional({ example: 100000, description: 'Phí vận chuyển bốc dỡ' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingFee?: number;

  @ApiPropertyOptional({
    enum: ShippingFeePayerType,
    default: ShippingFeePayerType.PAID_TO_SUPPLIER,
    description: 'PAID_TO_SUPPLIER: trả cho NCC (cộng nợ NCC); PAID_TO_CARRIER: trả riêng bên VC (không cộng nợ NCC)',
  })
  @IsOptional()
  @IsEnum(ShippingFeePayerType)
  shippingFeePayerType?: ShippingFeePayerType;

  @ApiPropertyOptional({ example: 'Ghi chú phiếu nhập' })
  @IsOptional()
  @IsString()
  note?: string;

  // Thanh toán ngay một phần hoặc toàn bộ lúc nhập kho
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  immediatePayment?: boolean;

  @ApiPropertyOptional({ example: 20000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  immediatePaymentAmount?: number;

  @ApiPropertyOptional({ example: 'HieuNT' })
  @IsOptional()
  @IsString()
  immediatePayerName?: string;

  @ApiPropertyOptional({ enum: FundSourceType })
  @IsOptional()
  @IsEnum(FundSourceType)
  immediateFundSource?: FundSourceType;

  @ApiPropertyOptional({ example: 'BANK_TRANSFER' })
  @IsOptional()
  @IsString()
  immediatePaymentMethod?: string;
}

export class UpdatePurchaseReceiptDto {
  @ApiPropertyOptional({ example: '2026-11-05T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  paymentDueDate?: string;

  @ApiPropertyOptional({ example: 'Ghi chú cập nhật' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class PurchaseReceiptFilterDto {
  @ApiPropertyOptional({ example: 'supplier-uuid' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ example: 'shop-uuid' })
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiPropertyOptional({ example: 'warehouse-uuid' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ enum: PurchasePaymentStatus })
  @IsOptional()
  @IsEnum(PurchasePaymentStatus)
  paymentStatus?: PurchasePaymentStatus;

  @ApiPropertyOptional({ enum: PurchaseReceivingStatus })
  @IsOptional()
  @IsEnum(PurchaseReceivingStatus)
  receivingStatus?: PurchaseReceivingStatus;

  @ApiPropertyOptional({ enum: PaymentDueStatus })
  @IsOptional()
  @IsEnum(PaymentDueStatus)
  dueStatus?: PaymentDueStatus;

  @ApiPropertyOptional({ example: 'PNK' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  limit?: number;
}
