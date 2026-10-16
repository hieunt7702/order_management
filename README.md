# Shopee Multi-Tenant Order, Inventory & Fulfillment System

Hệ thống quản lý đơn hàng đa shop Shopee, kho bãi, tồn kho hai chiều, quét barcode xuất hàng và đối soát tài chính đa Tenant (Doanh nghiệp).

---

## 1. Cấu Trúc Dự Án (Monorepo Workspace)

```
shopee_order/
├── backend/          # Backend REST API (NestJS, Prisma, PostgreSQL, Redis, BullMQ)
│   ├── src/
│   ├── prisma/
│   ├── package.json
│   └── ...
├── frontend/         # Frontend Web App (React 19, Vite, Tailwind CSS, Lucide React)
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
├── package.json      # Root Workspace Scripts & Concurrently Runner
├── pnpm-workspace.yaml
└── README.md
```

---

## 2. Hướng Dẫn Khởi Động Nhanh

### Cài Đặt Dependencies

Từ thư mục gốc dự án:
```bash
pnpm install
```

### Chạy Đồng Thời Cả Backend & Frontend

Từ thư mục gốc dự án, chỉ cần chạy một lệnh duy nhất:
```bash
pnpm run dev
```

Hệ thống sẽ tự động khởi động đồng thời cả 2 dịch vụ:
- **Frontend App**: `http://localhost:5173`
- **Backend API**: `http://localhost:3000/api/v1`
- **Swagger API Docs**: `http://localhost:3000/api/docs`

---

## 3. Các Lệnh Tiện Ích Khác Tại Root

| Lệnh | Mô tả |
| :--- | :--- |
| `pnpm run dev` | Chạy đồng thời cả Backend và Frontend |
| `pnpm run dev:backend` | Chỉ chạy Backend ở chế độ Watch mode |
| `pnpm run dev:frontend` | Chỉ chạy Frontend với Vite Dev Server |
| `pnpm run build` | Biên dịch cả Backend và Frontend cho Production |
| `pnpm run build:backend` | Biên dịch mã nguồn Backend |
| `pnpm run build:frontend` | Đóng gói bundle Frontend |
| `pnpm run prisma:generate` | Tạo lại Prisma Client từ Schema |
| `pnpm run prisma:migrate` | Chạy database migrations |
| `pnpm run prisma:seed` | Seed dữ liệu 3 Tenant mẫu và tài khoản |
