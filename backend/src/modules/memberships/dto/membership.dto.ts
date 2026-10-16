import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { MembershipRole, MembershipStatus } from '@prisma/client';

export class InviteMemberDto {
  @ApiProperty({ example: 'warehouse_staff@shopee1.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @ApiProperty({ example: 'Nguyễn Văn Kho' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'StaffPassword123!' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({ enum: MembershipRole, default: MembershipRole.WAREHOUSE })
  @IsEnum(MembershipRole)
  role!: MembershipRole;

  @ApiPropertyOptional({
    type: [String],
    description: 'Danh sách shopId được phép truy cập (bỏ trống = toàn quyền mọi shop trong tenant)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedShopIds?: string[];
}

export class UpdateMemberRoleDto {
  @ApiPropertyOptional({ enum: MembershipRole })
  @IsOptional()
  @IsEnum(MembershipRole)
  role?: MembershipRole;

  @ApiPropertyOptional({ enum: MembershipStatus })
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedShopIds?: string[];
}
