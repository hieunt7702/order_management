import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { InviteMemberDto, UpdateMemberRoleDto } from './dto/membership.dto';
import { MembershipRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.membership.findMany({
      where: { tenantId },
      include: {
        user: {
          select: { id: true, email: true, name: true, status: true },
        },
        shopMemberships: {
          include: { shop: { select: { id: true, code: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addMember(tenantId: string, currentUserId: string, dto: InviteMemberDto) {
    // Check if user already exists
    let user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      const password = dto.password || 'Staff123@Pass';
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          passwordHash,
        },
      });
    }

    // Check existing membership in this tenant
    const existingMembership = await this.prisma.membership.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId: user.id,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException('Người dùng đã là thành viên trong Workspace này');
    }

    // Validate allowed shops if provided
    if (dto.allowedShopIds && dto.allowedShopIds.length > 0) {
      const count = await this.prisma.shop.count({
        where: { id: { in: dto.allowedShopIds }, tenantId },
      });
      if (count !== dto.allowedShopIds.length) {
        throw new BadRequestException('Một hoặc nhiều Shop không thuộc Workspace này');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.create({
        data: {
          tenantId,
          userId: user.id,
          role: dto.role,
        },
      });

      if (dto.allowedShopIds && dto.allowedShopIds.length > 0) {
        for (const shopId of dto.allowedShopIds) {
          await tx.shopMembership.create({
            data: {
              membershipId: membership.id,
              shopId,
            },
          });
        }
      }

      await this.auditService.log({
        tenantId,
        userId: currentUserId,
        action: 'ADD_MEMBER',
        entityType: 'Membership',
        entityId: membership.id,
        newValues: { userId: user.id, role: dto.role, allowedShopIds: dto.allowedShopIds },
      });

      return tx.membership.findUnique({
        where: { id: membership.id },
        include: {
          user: { select: { id: true, email: true, name: true } },
          shopMemberships: { include: { shop: true } },
        },
      });
    });
  }

  async updateMember(
    tenantId: string,
    membershipId: string,
    currentUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, tenantId },
    });

    if (!membership) {
      throw new NotFoundException('Không tìm thấy thành viên trong Workspace này');
    }

    if (membership.role === MembershipRole.OWNER && dto.role && dto.role !== MembershipRole.OWNER) {
      // Check if there are other OWNERs
      const ownerCount = await this.prisma.membership.count({
        where: { tenantId, role: MembershipRole.OWNER },
      });
      if (ownerCount <= 1) {
        throw new ForbiddenException('Không thể hạ quyền OWNER duy nhất của Workspace');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.membership.update({
        where: { id: membershipId },
        data: {
          role: dto.role,
          status: dto.status,
        },
      });

      if (dto.allowedShopIds !== undefined) {
        // Clear old shop memberships
        await tx.shopMembership.deleteMany({
          where: { membershipId },
        });

        if (dto.allowedShopIds.length > 0) {
          for (const shopId of dto.allowedShopIds) {
            await tx.shopMembership.create({
              data: { membershipId, shopId },
            });
          }
        }
      }

      await this.auditService.log({
        tenantId,
        userId: currentUserId,
        action: 'UPDATE_MEMBER',
        entityType: 'Membership',
        entityId: membershipId,
        oldValues: { role: membership.role, status: membership.status },
        newValues: dto,
      });

      return tx.membership.findUnique({
        where: { id: membershipId },
        include: {
          user: { select: { id: true, email: true, name: true } },
          shopMemberships: { include: { shop: true } },
        },
      });
    });
  }

  async removeMember(tenantId: string, membershipId: string, currentUserId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, tenantId },
      include: { user: true },
    });

    if (!membership) {
      throw new NotFoundException('Không tìm thấy thành viên trong Workspace này');
    }

    if (membership.role === MembershipRole.OWNER) {
      throw new ForbiddenException('Không thể xóa chủ sở hữu (Owner) của Workspace');
    }

    if (membership.userId === currentUserId) {
      throw new BadRequestException('Bạn không thể tự xóa chính mình khỏi Workspace');
    }

    await this.prisma.membership.delete({
      where: { id: membershipId },
    });

    await this.auditService.log({
      tenantId,
      userId: currentUserId,
      action: 'REMOVE_MEMBER',
      entityType: 'Membership',
      entityId: membershipId,
      oldValues: { email: membership.user?.email, role: membership.role },
    });

    return { success: true, message: 'Đã xóa thành viên khỏi Workspace' };
  }
}

