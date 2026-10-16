import { PrismaClient, MembershipRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('==================================================');
  console.log('  KHỞI TẠO TÀI KHOẢN ADMIN & WORKSPACE GỐC (SẠCH)');
  console.log('==================================================');

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Admin@123456', salt);

  const tenant = await prisma.tenant.upsert({
    where: { code: 'DEFAULT_TENANT' },
    update: {},
    create: {
      code: 'DEFAULT_TENANT',
      name: 'Hệ Thống Quản Lý Bán Hàng',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@shopee.vn' },
    update: {},
    create: {
      email: 'admin@shopee.vn',
      name: 'Quản Trị Viên Hệ Thống',
      passwordHash,
    },
  });

  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: admin.id } },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: admin.id,
      role: MembershipRole.OWNER,
    },
  });

  await prisma.warehouse.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'WH_MAIN_01' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'WH_MAIN_01',
      name: 'Kho Tổng Trung Tâm',
      address: 'Trụ sở chính',
    },
  });

  console.log('==================================================');
  console.log('✅ Khởi tạo tài khoản Quản trị thành công:');
  console.log('   - Email:     admin@shopee.vn');
  console.log('   - Mật khẩu:  Admin@123456');
  console.log('   - Workspace: DEFAULT_TENANT (Hệ Thống Quản Lý Bán Hàng)');
  console.log('   - Kho chính: WH_MAIN_01 (Kho Tổng Trung Tâm)');
  console.log('==================================================');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khởi tạo admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
