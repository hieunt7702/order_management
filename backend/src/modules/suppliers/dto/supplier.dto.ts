import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({ example: 'NCC-001' })
  @IsNotEmpty()
  @IsString()
  code!: string;

  @ApiProperty({ example: 'Công ty Cổ phần Thực phẩm One One' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: '02438383838' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'contact@oneone.vn' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'KCN Đồng Văn, Hà Nam' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Vietcombank' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: '0011001234567' })
  @IsOptional()
  @IsString()
  bankAccount?: string;

  @ApiPropertyOptional({ example: 'CTCP THUC PHAM ONE ONE' })
  @IsOptional()
  @IsString()
  bankBeneficiary?: string;

  @ApiPropertyOptional({ example: 0, description: 'Nợ đầu kỳ' })
  @IsOptional()
  @IsNumber()
  openingDebt?: number;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'Nhà cung cấp bánh gạo chính thức' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateSupplierDto {
  @ApiPropertyOptional({ example: 'Công ty Cổ phần Thực phẩm One One Việt Nam' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '02438383838' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'contact@oneone.vn' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'KCN Đồng Văn, Hà Nam' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Vietcombank' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: '0011001234567' })
  @IsOptional()
  @IsString()
  bankAccount?: string;

  @ApiPropertyOptional({ example: 'CTCP THUC PHAM ONE ONE' })
  @IsOptional()
  @IsString()
  bankBeneficiary?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  openingDebt?: number;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class SupplierFilterDto {
  @ApiPropertyOptional({ example: 'one' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'shop-uuid' })
  @IsOptional()
  @IsString()
  shopId?: string;
}
