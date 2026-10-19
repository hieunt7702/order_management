import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SupplierTransferAllocationItemDto {
  @ApiProperty({ example: 'receipt-uuid', description: 'ID phiếu nhập của NCC nhận được phân bổ' })
  @IsNotEmpty()
  @IsString()
  receiptId!: string;

  @ApiProperty({ example: 10000000, description: 'Số tiền phân bổ trừ nợ cho phiếu nhập này' })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({ description: 'Ghi chú phân bổ' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateSupplierTransferDto {
  @ApiProperty({ example: 'from-supplier-uuid', description: 'ID nhà cung cấp chuyển tiền (NCC A)' })
  @IsNotEmpty({ message: 'Vui lòng chọn nhà cung cấp chuyển tiền (NCC A)' })
  @IsString()
  fromSupplierId!: string;

  @ApiProperty({ example: 'to-supplier-uuid', description: 'ID nhà cung cấp nhận tiền (NCC B)' })
  @IsNotEmpty({ message: 'Vui lòng chọn nhà cung cấp nhận tiền (NCC B)' })
  @IsString()
  toSupplierId!: string;

  @ApiPropertyOptional({ example: 'CKNCC-20261019-001', description: 'Mã phiếu chuyển (tự sinh nếu để trống)' })
  @IsOptional()
  @IsString()
  transferCode?: string;

  @ApiProperty({ example: 20000000, description: 'Số tiền chuyển' })
  @IsNumber({}, { message: 'Số tiền chuyển phải là số' })
  @Min(1, { message: 'Số tiền chuyển phải lớn hơn 0' })
  amount!: number;

  @ApiPropertyOptional({ example: '2026-10-19T10:00:00.000Z', description: 'Thời gian chuyển tiền' })
  @IsOptional()
  @IsString()
  transferDate?: string;

  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Người thực hiện / người chuyển' })
  @IsNotEmpty({ message: 'Vui lòng nhập tên người thực hiện chuyển tiền' })
  @IsString()
  payerName!: string;

  @ApiPropertyOptional({ example: 'UNC-MB-987654', description: 'Mã giao dịch / số UNC' })
  @IsOptional()
  @IsString()
  referenceCode?: string;

  @ApiPropertyOptional({ description: 'Ảnh chứng từ giao dịch' })
  @IsOptional()
  @IsString()
  voucherImage?: string;

  @ApiPropertyOptional({ example: 'Chuyển tiền cọc từ NCC A sang NCC B theo yêu cầu', description: 'Ghi chú lý do chuyển' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    type: [SupplierTransferAllocationItemDto],
    description: 'Phân bổ trực tiếp vào các phiếu nhập còn nợ của NCC nhận',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierTransferAllocationItemDto)
  allocations?: SupplierTransferAllocationItemDto[];
}

export class SupplierTransferFilterDto {
  @ApiPropertyOptional({ description: 'Lọc theo NCC chuyển' })
  @IsOptional()
  @IsString()
  fromSupplierId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo NCC nhận' })
  @IsOptional()
  @IsString()
  toSupplierId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo một trong hai NCC (chuyển hoặc nhận)' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm (mã phiếu, tên NCC, người chuyển, ghi chú)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Từ ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Đến ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
