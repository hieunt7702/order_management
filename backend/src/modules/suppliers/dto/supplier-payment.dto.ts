import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FundSourceType, SupplierPaymentType } from '@prisma/client';

export class PaymentAllocationItemDto {
  @ApiProperty({ example: 'receipt-uuid' })
  @IsNotEmpty()
  @IsString()
  receiptId!: string;

  @ApiProperty({ example: 10000000, description: 'Số tiền phân bổ trả cho phiếu nhập này' })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateSupplierPaymentDto {
  @ApiProperty({ example: 'supplier-uuid' })
  @IsNotEmpty()
  @IsString()
  supplierId!: string;

  @ApiPropertyOptional({ example: 'PC-20261015-001' })
  @IsOptional()
  @IsString()
  paymentCode?: string;

  @ApiProperty({ example: 50000000, description: 'Số tiền thực tế chi ra' })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({ example: '2026-10-15T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  paymentDate?: string;

  @ApiProperty({ example: 'Chị Hồng', description: 'Người thanh toán (Chị Hồng, Bạn, Kế toán)' })
  @IsNotEmpty()
  @IsString()
  payerName!: string;

  @ApiProperty({
    enum: FundSourceType,
    default: FundSourceType.CASH_FUND,
    description: 'CASH_FUND: Quỹ tiền mặt, BANK_ACCOUNT: Tài khoản công ty, PERSONAL_FUND: Tiền cá nhân (chi hộ)',
  })
  @IsNotEmpty()
  @IsEnum(FundSourceType)
  fundSource!: FundSourceType;

  @ApiPropertyOptional({ example: 'BANK_TRANSFER' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ example: 'UNC-987654', description: 'Mã giao dịch / Số UNC' })
  @IsOptional()
  @IsString()
  referenceCode?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/receipt.jpg' })
  @IsOptional()
  @IsString()
  voucherImage?: string;

  @ApiPropertyOptional({
    enum: SupplierPaymentType,
    default: SupplierPaymentType.PAYMENT,
    description: 'PAYMENT: Chi trả phiếu nợ, ADVANCE_DEPOSIT: Đặt cọc/Ứng trước, REFUND_RECEIVED: NCC hoàn tiền',
  })
  @IsOptional()
  @IsEnum(SupplierPaymentType)
  paymentType?: SupplierPaymentType;

  @ApiPropertyOptional({
    example: false,
    description: 'Đánh dấu nếu dùng tiền cá nhân chi hộ và shop cần hoàn trả lại tiền cho người chi',
  })
  @IsOptional()
  @IsBoolean()
  isReimbursementNeeded?: boolean;

  @ApiPropertyOptional({
    type: [PaymentAllocationItemDto],
    description: 'Danh sách phân bổ tiền cho các phiếu nhập (nếu thanh toán cho 1 hoặc nhiều phiếu)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationItemDto)
  allocations?: PaymentAllocationItemDto[];

  @ApiPropertyOptional({ example: 'Thanh toán tiền hàng đợt 1' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class SupplierPaymentFilterDto {
  @ApiPropertyOptional({ example: 'supplier-uuid' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ enum: FundSourceType })
  @IsOptional()
  @IsEnum(FundSourceType)
  fundSource?: FundSourceType;

  @ApiPropertyOptional({ example: 'Chị Hồng' })
  @IsOptional()
  @IsString()
  payerName?: string;

  @ApiPropertyOptional({ example: 'PC' })
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
