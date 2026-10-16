import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RecordSettlementDto {
  @ApiProperty({ example: 'shop-uuid' })
  @IsNotEmpty()
  @IsString()
  shopId!: string;

  @ApiProperty({ example: 'order-uuid' })
  @IsNotEmpty()
  @IsString()
  orderId!: string;

  @ApiProperty({ example: 215000, description: 'Số tiền thực tế sàn Shopee đã thanh toán' })
  @IsNumber()
  @Min(0)
  actualReceivedAmount!: number;

  @ApiPropertyOptional({ example: 15000, description: 'Phí cố định / hoa hồng' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionFee?: number;

  @ApiPropertyOptional({ example: 5000, description: 'Phí dịch vụ sàn' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceFee?: number;

  @ApiPropertyOptional({ example: 4000, description: 'Phí xử lý giao dịch' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  transactionFee?: number;

  @ApiPropertyOptional({ example: '2026-08-01T10:00:00.000Z' })
  @IsOptional()
  @IsString()
  settlementDate?: string;

  @ApiPropertyOptional({ example: 'Đối soát theo kỳ sao kê Shopee tuần 31' })
  @IsOptional()
  @IsString()
  note?: string;
}
