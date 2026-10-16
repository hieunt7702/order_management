---
name: shopee-order-system
description: >-
  Standard operating procedure, architectural constraints, multi-tenancy rules,
  inventory ledger invariants, Shopee order lifecycle state machines, fulfillment
  scanning verification, and financial reporting guidelines for the Shopee Order Management Backend & Frontend.
---

# Shopee Multi-Tenant Order & Inventory Management System Skill

Tài liệu hướng dẫn chuẩn hóa kiến trúc, quy tắc nghiệp vụ, bất biến dữ liệu và quy trình phát triển cho hệ thống quản lý đơn hàng Shopee đa tenant (Shop, Kho, Sản phẩm, Tồn kho, Import, Quét xuất hàng, Đối soát tài chính, Giao diện quản trị Frontend).

---

## 1. Nguyên Tắc Cốt Lõi & Bất Biến (System Invariants)

1. **Multi-Tenant Isolation Tuyệt Đối**:
   - `tenantId` KHÔNG BAO GIỜ được tin tưởng từ request body hoặc query parameter.
   - `tenantId` luôn được trích xuất từ JWT token đã qua xác thực `TenantGuard` và `MembershipGuard`.
   - Mọi entity nghiệp vụ (Shop, Warehouse, Product, SKU, InventoryBalance, Order, Package, ScanEvent, Settlement, AuditLog) PHẢI có cột `tenantId`.
   - Mọi câu truy vấn database (SELECT, UPDATE, DELETE) bắt buộc phải có điều kiện `WHERE tenantId = :tenantId`.
   - Composite unique constraints bắt buộc phải bắt đầu bằng `tenantId` (ví dụ: `[tenantId, shopId, platform, externalOrderId]`, `[tenantId, sku]`).
   - Cache key và Redis locks phải có prefix tenant: `tenant:{tenantId}:...`.
   - Background jobs (BullMQ) phải lưu `tenantId` trong job payload và khôi phục Tenant Context trước khi thực thi.

2. **Bất Biến Sổ Cái Kho (Inventory Ledger Invariant)**:
   - `available = onHand - reserved`.
   - `onHand >= 0`, `reserved >= 0`, `available >= 0`. Nghiêm cấm tồn âm.
   - Mọi biến động tồn kho PHẢI ghi vào `InventoryLedger` bất biến (RECEIVE, ADJUST, RESERVE, RELEASE, DISPATCH, RETURN_RECEIVE).
   - Nghiêm cấm UPDATE hoặc DELETE bản ghi ledger cũ. Sai sót phải bù trừ bằng bút toán nghịch đảo có `referenceId` trỏ về giao dịch gốc.
   - Bảng số dư `InventoryBalance` và `InventoryLedger` phải được cập nhật trong CÙNG MỘT database transaction.
   - Khi khóa nhiều SKU trong transaction, PHẢI sắp xếp danh sách SKU ID theo thứ tự alphabet/tăng dần để triệt tiêu deadlock (`SELECT ... FOR UPDATE`).

3. **Bất Biến Quét Xuất Hàng (Fulfillment Scan Invariant)**:
   - Thao tác quét xác nhận xuất hàng (`verify-dispatch`) chỉ chứng nhận hàng đã bàn giao thực tế tại kho nội bộ; không tự ý đổi trạng thái nền tảng sàn thành SHIPPED.
   - Chống xử lý lặp ở 2 tầng:
     1. Tầng Idempotency: Request gửi trùng `Idempotency-Key` với hash payload giống nhau trả về kết quả đã lưu mà không thực hiện lại tác vụ.
     2. Tầng Database State: Ràng buộc trạng thái kiện hàng `Package.status = PACKED/READY` -> `DISPATCHED`. Nếu đã `DISPATCHED`, transaction phát hiện và trả về code `ALREADY_VERIFIED` mà không trừ kho lần 2.
   - Khi mã quét (Order code / Tracking code) khớp nhiều kiện hàng trong cùng tenant -> BẮT BUỘC trả lỗi `AMBIGUOUS_CODE`, tuyệt đối không tự chọn bản ghi đầu tiên.
   - Đơn nhiều kiện (`Package`) chỉ chuyển sang `VERIFIED` khi TOÀN BỘ kiện của đơn đã được xác nhận.

4. **Bất Biến Nhập Đơn & Đối Soát (Import & Settlement Invariant)**:
   - Import đơn Shopee không ghi đè dữ liệu quét kho, ghi chú nội bộ hoặc ledger đã phát sinh.
   - Không tự động trừ tồn kho khi import đơn lịch sử đã hoàn thành.
   - Không tính floating-point cho tiền tệ. Bắt buộc dùng `Prisma.Decimal` / PostgreSQL `NUMERIC(15, 2)`.
   - Đơn giá, chi phí, chiết khấu và giá vốn (COGS) phải được snapshot tại thời điểm giao dịch.
   - Báo cáo doanh thu chỉ ghi nhận đơn đã hoàn thành (`COMPLETED`). Tiền hàng chưa đối soát lưu `financialStatus = PENDING`, không giả định bằng 0 nếu chưa có báo cáo tài chính từ sàn.

---

## 2. Mô Hình Dữ Liệu & Ràng Buộc (Data Model & Schema)

### 2.1 Multi-Tenancy & Phân Quyền
- `User`: Danh tính đăng nhập toàn cục (`id`, `email`, `passwordHash`, `name`, `status`).
- `Tenant`: Tổ chức / Workspace độc lập (`id`, `code`, `name`, `status`, `createdAt`).
- `Membership`: Quan hệ User - Tenant (`id`, `tenantId`, `userId`, `role`, `status`).
  - Roles: `OWNER`, `ADMIN`, `WAREHOUSE`, `ACCOUNTANT`, `VIEWER`.
- `ShopMembership`: Giới hạn User chỉ được thao tác trên danh sách Shop nhất định trong Tenant.

### 2.2 Danh Mục Shop, Sản Phẩm & Kho
- `Shop`: `(id, tenantId, code, name, platform, externalShopId, defaultWarehouseId, status)`.
- `Warehouse`: `(id, tenantId, code, name, address, status)`.
- `Product`: `(id, tenantId, code, name, description, status)`.
- `ProductVariant` (SKU nội bộ): `(id, tenantId, productId, sku, barcode, name, unit, costPrice, sellingPrice, lowStockThreshold, status)`.
  - Unique constraint: `@@unique([tenantId, sku])`.
- `ListingMapping`: Liên kết SKU sàn với SKU nội bộ:
  - `(id, tenantId, shopId, platform, externalProductId, externalVariationId, sellerSku, internalSkuId)`.
  - Unique constraint: `@@unique([tenantId, shopId, platform, sellerSku])`.

### 2.3 Quản Lý Tồn Kho
- `InventoryBalance`:
  - `(id, tenantId, warehouseId, variantId, onHand, reserved, updatedAt)`.
  - Unique constraint: `@@unique([tenantId, warehouseId, variantId])`.
  - Constraint logic: `onHand >= reserved` và `reserved >= 0`.
- `InventoryLedger`:
  - `(id, tenantId, warehouseId, variantId, movementType, deltaOnHand, deltaReserved, referenceType, referenceId, performedByUserId, note, createdAt)`.

### 2.4 Đơn Hàng & Kiện Hàng
- `Order`:
  - `(id, tenantId, shopId, internalOrderCode, platform, externalOrderId, platformStatus, fulfillmentStatus, financialStatus, orderDate, paidAt, buyerUsername, recipientName, recipientPhone, recipientAddress, totalAmount, shippingFee, discountAmount, sellerVoucher, cogsTotal, note, createdAt)`.
  - Unique constraint: `@@unique([tenantId, shopId, platform, externalOrderId])`.
- `OrderItem`:
  - `(id, tenantId, orderId, variantId, externalProductId, externalVariationId, externalSku, productName, variationName, quantity, originalPrice, discountedPrice, itemCogs)`.
- `Package` (Kiện hàng):
  - `(id, tenantId, orderId, packageCode, trackingCode, carrierName, status, verifiedAt, verifiedByUserId)`.
  - Unique constraint: `@@unique([tenantId, packageCode])`.
- `PackageItem`:
  - `(id, tenantId, packageId, orderItemId, quantity)`.
- `ScanEvent`:
  - `(id, tenantId, shopId, warehouseId, orderId, packageId, rawCode, normalizedCode, scanResult, deviceId, performedByUserId, idempotencyKey, createdAt)`.

### 2.5 Import & Đối Soát
- `ImportJob`:
  - `(id, tenantId, shopId, fileName, fileChecksum, status, totalRows, totalOrders, processedOrders, errorCount, errorMessage, createdAt)`.
- `ImportRowError`:
  - `(id, importJobId, rowNumber, rawData, errorCode, errorMessage)`.
- `Settlement`:
  - `(id, tenantId, shopId, orderId, platformPayout, commissionFee, serviceFee, transactionFee, shippingFee, actualReceivedAmount, settlementDate, status)`.

---

## 3. State Machines & Chuyển Trạng Thái

### 3.1 Platform Status (Trạng thái đơn sàn)
- `UNPAID` -> `READY_TO_SHIP` -> `SHIPPED` -> `COMPLETED`
- `READY_TO_SHIP` / `UNPAID` -> `CANCELLED`
- `SHIPPED` -> `TO_RETURN` -> `RETURN_REFUND`

### 3.2 Fulfillment Status (Trạng thái xử lý kho)
- `PENDING_PROCESSING` (Mới import)
- `UNMAPPED` (Nếu có SKU chưa mapping listing)
- `OUT_OF_STOCK` (Nếu kho không đủ tồn khả dụng để giữ hàng)
- `RESERVED` (Đã giữ tồn kho khả dụng thành công)
- `PACKED` (Đã đóng gói)
- `DISPATCHED` (Đã quét xuất kho thực tế - tương đương `VERIFIED`)
- `CANCELLED_RESTOCKED` (Đã hủy và hoàn trả reservation)
- `RETURN_RECEIVED` (Đã xác nhận nhập lại hàng hoàn thực tế)

Quy tắc chuyển đổi:
- Đơn chỉ được chuyển sang `RESERVED` khi tất cả SKU đã mapping và `available >= requiredQuantity`.
- Đơn chỉ được quét xuất `DISPATCHED` khi đang ở trạng thái `RESERVED` hoặc `PACKED`.
- Không thể quét xuất đơn `CANCELLED`, `UNMAPPED` hoặc `OUT_OF_STOCK`.

---

## 4. API Specification Conventions

- Prefix: `/api/v1`
- Chuẩn Headers:
  - `Authorization: Bearer <jwt_access_token>`
  - `X-Tenant-Id`: (Tùy chọn nếu user có nhiều tenant; hệ thống tự trích xuất active tenant từ membership)
  - `Idempotency-Key`: Bắt buộc cho các API biến đổi nhạy cảm (`/fulfillment/scan`, `/imports/:id/confirm`, `/inventory/adjust`)
- Mã lỗi trả về thống nhất:
  ```json
  {
    "statusCode": 400,
    "errorCode": "INSUFFICIENT_STOCK",
    "message": "Không đủ tồn kho khả dụng để thực hiện xuất hàng",
    "details": { "sku": "SKU-HURRICANE-01", "available": 0, "requested": 1 },
    "timestamp": "2026-10-13T10:00:00.000Z",
    "path": "/api/v1/fulfillment/scan",
    "requestId": "req-c8d19..."
  }
  ```

---

## 5. Tiêu Chuẩn Giao Diện Frontend (Frontend Architecture & UI/UX Standards)

### 5.1 Design System & Tokens
- **Bảng màu**:
  - Primary Brand: `#5865F2` (Discord blue/Indigo), Dark: `#818cf8`
  - Nền Light: `#fbfbfa` / `#f4f5f7`, Nền Dark: `#131720` / `#161b26`
  - Thẻ / Card: `bg-white`, Dark: `bg-[#1a1b23]` / `bg-[#1c212a]`
  - Đường viền: `border-gray-100` / `border-gray-200`, Dark: `border-gray-800`
  - Trạng thái: Thành công (`#10b981`), Cảnh báo (`#f59e0b`), Lỗi/Hủy (`#ef4444`)
- **Typography & Font**: Font `Inter`, sans-serif, cỡ chữ compact: `text-[11px]`, `text-[13px]`, `text-sm`.
- **Iconography**: Sử dụng bộ icon chuẩn `lucide-react`.

### 5.2 Header & Context Shell
- **Workspace Scope**: Hiển thị tên Workspace / Tenant hiện tại.
- **Shop Filter Dropdown**: Hỗ trợ chọn "Tất cả Shop" hoặc một Shop cụ thể. Khi đổi Shop, cập nhật query param và reset cache/form nếu cần.
- **Warehouse Selector**: Hiện tại các màn hình vận hành kho (Tồn kho, Quét xuất hàng).
- **User Avatar & Role Badge**: Hiển thị vai trò (OWNER, ADMIN, WAREHOUSE, ACCOUNTANT, VIEWER).
- **Responsive Navigation**:
  - Desktop: Sidebar `w-[290px]` với các nhóm: Nghiệp vụ chính, Danh mục, Vận hành, Hệ thống.
  - Mobile (`md:hidden`): Floating bottom navigation bar với nút elevated QR code ở vị trí trung tâm để kích hoạt màn hình quét nhanh.

### 5.3 Màn Hình Quét Barcode (High-Speed Scanning UX)
- Hỗ trợ máy quét phần cứng dạng keyboard wedge (nhập chuỗi và gửi Enter) và nhập tay.
- Tự động focus lại ô quét thông minh sau khi xử lý kết quả.
- Tự động sinh `Idempotency-Key` cho mỗi lần quét.
- Phản hồi trạng thái rõ ràng kèm âm thanh: Thành công, Đã quét trước đó (`ALREADY_VERIFIED`), Không tìm thấy (`NOT_FOUND`), Mã trùng nhiều kiện (`AMBIGUOUS_CODE`), Trạng thái không hợp lệ (`INVALID_ORDER_STATUS`).
- Hỗ trợ xem danh sách quét trong phiên hiện tại và hoàn tác quét nhầm (`reverse`).

---

## 6. Danh Mục Kiểm Tra Chất Lượng (Quality Checklist)

1. `pnpm build` hoặc `npm run build` không có lỗi TypeScript strict.
2. Migrations khởi tạo trơn tru trên database mới.
3. Seed dữ liệu 3 tenant mẫu (Owner, Warehouse Staff, Shop, SKU, Initial Stock, Listing Mapping).
4. Kiểm tra phân tách Tenant: Tenant A truy vấn ID của Tenant B trả về 404 Not Found.
5. Kiểm tra phòng chống race condition khi quét mã và giữ tồn kho bằng Transaction + Lock.
6. Kiểm tra Import đơn Shopee: gom nhóm nhiều dòng 1 đơn, phát hiện SKU chưa map, chống import trùng.
7. Báo cáo doanh thu: Kiểm tra chính xác không bị nhân đôi số tiền do SQL JOIN.
8. Frontend: Tích hợp API thật, kết nối mượt mà với backend `/api/v1`, phản hồi đúng responsive trên PC (1280px+), Tablet (768px-1024px) và Mobile (360px-390px).

---

## 7. Kiến Trúc Monorepo Workspace & Vận Hành Đồng Thời (Monorepo & Startup)

- **Cấu trúc Monorepo**:
  - `backend/`: NestJS, Prisma, PostgreSQL, Redis, BullMQ (`shopee-order-backend`)
  - `frontend/`: React 19, Vite, Tailwind CSS (`shopee-order-frontend`)
  - `pnpm-workspace.yaml`: Quản lý workspace đa gói cho pnpm
- **Lệnh Khởi Động Đồng Thời**:
  - Tại thư mục root, chạy `pnpm run dev` sẽ tự động kích hoạt cả Backend (Port 3000) và Frontend (Port 5173) thông qua `concurrently`.
  - Hỗ trợ chạy riêng lẻ: `pnpm run dev:backend` hoặc `pnpm run dev:frontend`.
  - Biên dịch toàn bộ hệ thống từ root: `pnpm run build`.
