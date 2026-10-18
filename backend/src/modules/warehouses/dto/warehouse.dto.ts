import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { WarehouseStatus } from '@prisma/client';

export class CreateWarehouseDto {
  @ApiPropertyOptional({ example: 'KHO_HN_01' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'Kho Tổng Long Biên Hà Nội' })
  @IsNotEmpty({ message: 'Tên kho không được để trống' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Số 102 Đường Cổ Linh, Long Biên, Hà Nội' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '0334689521' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateWarehouseDto {
  @ApiPropertyOptional({ example: 'Kho Tổng Long Biên Hà Nội (Mở rộng)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Số 104 Đường Cổ Linh, Long Biên, Hà Nội' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '0334689521' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: WarehouseStatus })
  @IsOptional()
  @IsEnum(WarehouseStatus)
  status?: WarehouseStatus;
}
