import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@shopee1.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @ApiProperty({ example: 'Admin123@Pass' })
  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'refresh_token_string' })
  @IsNotEmpty({ message: 'Refresh token không được để trống' })
  @IsString()
  refreshToken!: string;
}

export class BootstrapOwnerDto {
  @ApiProperty({ example: 'System Admin' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty({ example: 'admin@company.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'TENANT_DEFAULT' })
  @IsNotEmpty()
  @IsString()
  tenantCode!: string;

  @ApiProperty({ example: 'Tổng Kho Shopee Miền Bắc' })
  @IsNotEmpty()
  @IsString()
  tenantName!: string;
}
