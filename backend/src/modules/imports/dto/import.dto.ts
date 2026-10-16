import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UploadImportDto {
  @ApiProperty({ example: 'shop-uuid' })
  @IsNotEmpty({ message: 'Shop ID không được để trống' })
  @IsString()
  shopId!: string;

  @ApiPropertyOptional({ example: 'warehouse-uuid' })
  @IsOptional()
  @IsString()
  warehouseId?: string;
}

export class ConfirmImportDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Tự động thực hiện giữ hàng (reserve) cho các đơn có đủ mapping và đủ tồn',
    default: true,
  })
  @IsOptional()
  autoReserve?: boolean = true;
}
