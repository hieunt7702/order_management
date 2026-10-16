import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('==================================================');
  console.log('   BẮT ĐẦU XÓA SẠCH TOÀN BỘ DỮ LIỆU DATABASE');
  console.log('==================================================');

  // Lấy danh sách tất cả các bảng thuộc schema public (ngoại trừ bảng migration của Prisma)
  const tablesResult = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename != '_prisma_migrations';
  `;

  if (tablesResult.length === 0) {
    console.log('ℹ️ Không tìm thấy bảng nào cần xóa.');
    return;
  }

  const tableList = tablesResult.map((t) => `"${t.tablename}"`).join(', ');
  console.log(`🔍 Tìm thấy ${tablesResult.length} bảng dữ liệu.`);
  console.log(`⚡ Đang thực thi TRUNCATE CASCADE...`);

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} CASCADE;`);

  console.log('==================================================');
  console.log('✅ ĐÃ XÓA TOÀN BỘ DỮ LIỆU THÀNH CÔNG!');
  console.log('   Database hiện đang ở trạng thái sạch 100% (0 bản ghi).');
  console.log('==================================================');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi xóa dữ liệu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
