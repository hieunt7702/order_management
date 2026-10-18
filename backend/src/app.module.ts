import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ShopsModule } from './modules/shops/shops.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { ProductsModule } from './modules/products/products.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ImportsModule } from './modules/imports/imports.module';
import { FulfillmentModule } from './modules/fulfillment/fulfillment.module';
import { SettlementsModule } from './modules/settlements/settlements.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { OrderReturnsModule } from './modules/order-returns/order-returns.module';
import { CashflowModule } from './modules/cashflow/cashflow.module';
import { SystemModule } from './modules/system/system.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),
    DatabaseModule,
    AuditModule,
    AuthModule,
    ShopsModule,
    WarehousesModule,
    ProductsModule,
    MembershipsModule,
    InventoryModule,
    OrdersModule,
    ImportsModule,
    FulfillmentModule,
    SettlementsModule,
    ReportsModule,
    SuppliersModule,
    OrderReturnsModule,
    CashflowModule,
    SystemModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
