import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ScanBarcodeDto {
  @ApiProperty({
    example: 'SPXVN066144212957',
    description: 'Chuỗi mã vạch từ máy quét (Mã đơn hàng, Mã vận đơn hoặc Mã kiện hàng)',
  })
  @IsNotEmpty({ message: 'Mã quét không được để trống' })
  @IsString()
  code!: string;

  @ApiPropertyOptional({ example: 'warehouse-uuid' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ example: 'SCANNER_HANDHELD_01' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    example: 'package-uuid',
    description: 'Khi gặp lỗi AMBIGUOUS_CODE, client gửi thêm packageId cụ thể để xác nhận',
  })
  @IsOptional()
  @IsString()
  packageId?: string;
}

export class ReverseDispatchDto {
  @ApiProperty({ example: 'package-uuid' })
  @IsNotEmpty()
  @IsString()
  packageId!: string;

  @ApiProperty({ example: 'Nhân viên quét nhầm kiện của đơn hủy chưa kịp bốc dỡ' })
  @IsNotEmpty()
  @IsString()
  reason!: string;
}

export class ScanHistoryFilterDto {
  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ example: 'warehouse-uuid' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ example: 'VERIFIED' })
  @IsOptional()
  @IsString()
  result?: string;
}

