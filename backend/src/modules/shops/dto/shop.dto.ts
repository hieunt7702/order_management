import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Platform, ShopStatus } from '@prisma/client';

export class CreateShopDto {
  @ApiProperty({ example: 'SHOP_SHOPEE_01' })
  @IsNotEmpty({ message: 'Mã shop nội bộ không được để trống' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 'Shop Bách Hóa Tiêu Dùng Hà Nội' })
  @IsNotEmpty({ message: 'Tên shop không được để trống' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ enum: Platform, default: Platform.SHOPEE })
  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @ApiPropertyOptional({ example: 'vn_shopee_84920' })
  @IsOptional()
  @IsString()
  externalShopId?: string;

  @ApiPropertyOptional({ example: 'warehouse-uuid' })
  @IsOptional()
  @IsString()
  defaultWarehouseId?: string;
}

export class UpdateShopDto {
  @ApiPropertyOptional({ example: 'Shop Bách Hóa Tiêu Dùng HN (Đổi Tên)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'warehouse-uuid' })
  @IsOptional()
  @IsString()
  defaultWarehouseId?: string;

  @ApiPropertyOptional({ enum: ShopStatus })
  @IsOptional()
  @IsEnum(ShopStatus)
  status?: ShopStatus;
}
