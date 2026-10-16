import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global Middlewares & Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  // CORS allowlist with preflight cache
  const corsOrigin = process.env.CORS_ORIGIN || '*';
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'Idempotency-Key', 'X-Request-Id'],
    maxAge: 86400, // Cache CORS preflight for 24h to avoid duplicate OPTIONS roundtrips
  });

  // Graceful shutdown
  app.enableShutdownHooks();

  // Swagger OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('Shopee Multi-Tenant Order & Inventory Management API')
    .setDescription(
      'Hệ thống REST API production-ready quản lý đa shop, sản phẩm, tồn kho hai chiều, import đơn Shopee, quét barcode xuất hàng và đối soát doanh thu.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Auth', 'Đăng nhập, Token rotation và Phân quyền')
    .addTag('Shops', 'Quản lý danh sách Shop thuộc Tenant')
    .addTag('Warehouses', 'Quản lý Kho hàng thuộc Tenant')
    .addTag('Products & Listings', 'Sản phẩm, Biến thể SKU nội bộ và Mapping listing sàn')
    .addTag('Memberships & Staff', 'Phân quyền nhân viên và giới hạn shop trong Tenant')
    .addTag('Inventory & Ledger', 'Tồn kho (onHand/reserved/available) và Sổ cái bất biến')
    .addTag('Orders', 'Vòng đời đơn hàng, state machines và packages')
    .addTag('Shopee Import Engine', 'Phân tích file Shopee 62 cột, preview và batch import')
    .addTag('Fulfillment & Scanning', 'Quét barcode xuất kho thực tế và hoàn tác xuất nhầm')
    .addTag('Settlements & Finance', 'Đối soát tài chính và tiền thực nhận từ sàn')
    .addTag('Reports & Dashboard', 'Báo cáo tổng quan, GMV, doanh thu và cảnh báo tồn thấp')
    .addTag('Audit', 'Nhật ký kiểm toán hệ thống')
    .addTag('Health', 'Liveness & Readiness healthchecks')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Server running at http://localhost:${port}`);
  logger.log(`Swagger OpenAPI Documentation available at http://localhost:${port}/api/docs`);
}

bootstrap();
