/**
 * scripts/bootstrap.js
 *
 * Runs on every deploy BEFORE `node dist/main`.
 *
 * Direct schema push (NO migrations blocking, NO dummy data).
 * If database is fresh (0 users), automatically provisions the master
 * admin account (admin@shopee.vn / Admin@123456) and default warehouse.
 */

const { execSync } = require('child_process');

async function bootstrap() {
  console.log('=== SHOPEE ORDER SYSTEM BOOTSTRAP ===');

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')) {
    console.log('[Bootstrap] Local database detected. Skipping remote DB push.');
    return;
  }

  console.log('[Bootstrap] Remote PostgreSQL detected on Railway.');

  // 1. Prisma schema push with accept-data-loss flag to avoid blocking non-interactive deploy
  try {
    console.log('[Bootstrap] Syncing schema directly via prisma db push (clean schema)...');
    try {
      execSync('node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss', { stdio: 'inherit', timeout: 60000 });
    } catch (_) {
      execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit', timeout: 60000 });
    }
    console.log('[Bootstrap] PostgreSQL schema push: DONE ✅');
  } catch (schemaErr) {
    console.warn('[Bootstrap] Schema sync warning (non-fatal):', schemaErr.message);
  }

  // 2. Ensure Master Admin exists if the database is newly initialized
  try {
    const { PrismaClient, MembershipRole } = require('@prisma/client');
    const bcrypt = require('bcrypt');
    const prisma = new PrismaClient();

    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('[Bootstrap] Database is empty. Creating master admin account...');
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

      console.log('[Bootstrap] Master admin account created: admin@shopee.vn / Admin@123456 ✅');
    } else {
      console.log(`[Bootstrap] Database already initialized (${userCount} existing users).`);
    }

    await prisma.$disconnect().catch(() => {});
  } catch (adminErr) {
    console.warn('[Bootstrap] Master admin provisioning warning (non-fatal):', adminErr.message);
  }

  console.log('=== SHOPEE ORDER BOOTSTRAP COMPLETE ===');
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] Unexpected error:', err);
  process.exit(0); // NEVER block application startup
});

