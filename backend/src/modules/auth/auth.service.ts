import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto, RefreshTokenDto, BootstrapOwnerDto } from './dto/auth.dto';
import { MembershipRole } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async login(loginDto: LoginDto, deviceInfo?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: {
            tenant: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa hoặc vô hiệu hóa');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (user.memberships.length === 0) {
      throw new UnauthorizedException('Tài khoản chưa thuộc về bất kỳ Workspace/Tenant nào');
    }

    const primaryMembership = user.memberships[0];
    const tokens = await this.generateTokens(user.id, user.email, primaryMembership.tenantId);

    // Save refresh token hash
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(tokens.refreshToken),
        deviceInfo: deviceInfo || 'Unknown Device',
        expiresAt,
      },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      currentTenant: {
        id: primaryMembership.tenant.id,
        code: primaryMembership.tenant.code,
        name: primaryMembership.tenant.name,
        role: primaryMembership.role,
      },
      memberships: user.memberships.map((m) => ({
        tenantId: m.tenantId,
        tenantCode: m.tenant.code,
        tenantName: m.tenant.name,
        role: m.role,
      })),
    };
  }

  async refreshTokens(dto: RefreshTokenDto) {
    const tokenHash = this.hashToken(dto.refreshToken);

    const tokenRecord = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: {
        user: {
          include: {
            memberships: {
              where: { status: 'ACTIVE' },
              include: { tenant: true },
            },
          },
        },
      },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc không tồn tại');
    }

    // Reuse detection
    if (tokenRecord.isRevoked) {
      this.logger.warn(`Phát hiện sử dụng lại Refresh Token đã thu hồi cho user ${tokenRecord.userId}`);
      // Revoke all tokens for this user as security precaution
      await this.prisma.refreshToken.updateMany({
        where: { userId: tokenRecord.userId },
        data: { isRevoked: true },
      });
      throw new UnauthorizedException('Phát hiện token bị tái sử dụng đáng ngờ. Vui lòng đăng nhập lại.');
    }

    if (new Date() > tokenRecord.expiresAt) {
      throw new UnauthorizedException('Refresh token đã hết hạn');
    }

    // Mark current token as revoked (token rotation)
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true },
    });

    const user = tokenRecord.user;
    if (user.status !== 'ACTIVE' || user.memberships.length === 0) {
      throw new UnauthorizedException('Tài khoản hoặc Tenant không còn hoạt động');
    }

    const primaryMembership = user.memberships[0];
    const newTokens = await this.generateTokens(user.id, user.email, primaryMembership.tenantId);

    // Save new refresh token
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(newTokens.refreshToken),
        deviceInfo: tokenRecord.deviceInfo,
        expiresAt: newExpiresAt,
      },
    });

    return newTokens;
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return { success: true };
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { isRevoked: true },
    });
    return { success: true, message: 'Đăng xuất thành công' };
  }

  async getProfile(userId: string, tenantId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: {
            tenant: true,
            shopMemberships: {
              include: { shop: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }

    const currentMembership = user.memberships.find((m) => m.tenantId === tenantId);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      currentTenant: currentMembership
        ? {
            id: currentMembership.tenant.id,
            code: currentMembership.tenant.code,
            name: currentMembership.tenant.name,
            role: currentMembership.role,
            allowedShops: currentMembership.shopMemberships.map((sm) => ({
              id: sm.shop.id,
              name: sm.shop.name,
              code: sm.shop.code,
            })),
          }
        : null,
      availableTenants: user.memberships.map((m) => ({
        tenantId: m.tenantId,
        tenantCode: m.tenant.code,
        tenantName: m.tenant.name,
        role: m.role,
      })),
    };
  }

  async bootstrapOwner(dto: BootstrapOwnerDto) {
    // Check if tenant code exists
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { code: dto.tenantCode },
    });
    if (existingTenant) {
      throw new ConflictException(`Mã Tenant "${dto.tenantCode}" đã tồn tại`);
    }

    // Check if email exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException(`Email "${dto.email}" đã được đăng ký`);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          code: dto.tenantCode,
          name: dto.tenantName,
        },
      });

      const user = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
        },
      });

      const membership = await tx.membership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: MembershipRole.OWNER,
        },
      });

      return {
        tenantId: tenant.id,
        tenantCode: tenant.code,
        tenantName: tenant.name,
        userId: user.id,
        userEmail: user.email,
        role: membership.role,
        message: 'Khởi tạo Tenant và OWNER thành công',
      };
    });
  }

  private async generateTokens(userId: string, email: string, tenantId?: string) {
    const payload = { sub: userId, email, tenantId };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret:
        this.configService.get<string>('JWT_ACCESS_SECRET') ||
        'default_access_secret_key_change_me_in_production_12345678',
      expiresIn: (this.configService.get<string>('JWT_ACCESS_EXPIRATION') || '900s') as any,
    });

    const refreshToken = randomBytes(40).toString('hex');

    return {
      accessToken,
      refreshToken,
    };
  }
}
