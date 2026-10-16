# Shopee Import Fixtures & Mapping Profile

Thư mục này chứa file dữ liệu mẫu nội bộ và tài liệu phân tích cột từ file xuất đơn thực tế của Shopee Việt Nam.

## 1. Danh Sách File
- `sample_shopee_orders.csv`: Dữ liệu mẫu chứa 2 đơn hàng Shopee chuẩn 62 cột (bao gồm các cột tiếng Việt có dấu, mã vận đơn SPX Express, số điện thoại có số 0 ở đầu).
- `mapping_profile.json`: Bản đồ ánh xạ các cột Shopee sang các trường thực thể Order, Package, OrderItem trong database.

## 2. Bất Biến & Xử Lý Chuỗi
1. **Bảo toàn số 0 đầu chuỗi (`String Preservation`)**:
   - `Mã đơn hàng`, `Mã Kiện Hàng`, `Mã vận đơn`, `Số điện thoại` và `SKU` được ép kiểu và đọc dưới dạng chuỗi thuần túy (`string`).
   - Tuyệt đối không dùng `Number()` hoặc `parseFloat()` trên các trường này để tránh mất số 0 đầu (ví dụ: `0901234567` thành `901234567`) hoặc lỗi mất độ chính xác số lớn (ví dụ mã kiện Shopee 19 chữ số: `6010091862211584363`).
2. **Gom nhóm đơn nhiều dòng (`Multi-Line Grouping`)**:
   - Shopee xuất mỗi phân loại hàng trên một dòng riêng.
   - Adapter gom nhóm các dòng có chung `Mã đơn hàng` thành một `Order` duy nhất với mảng `items`.
3. **Giới hạn & Lưu ý thực tế**:
   - Nếu file Shopee chưa có thông tin doanh thu thực nhận (tiền đã về tài khoản ngân hàng), trường `actualReceivedAmount` trong bảng `settlements` sẽ để `ESTIMATED` và chờ import sao kê tài chính sau.
   - Đơn có trạng thái `Hoàn thành` trong file lịch sử khi import sẽ KHÔNG tự động trừ số dư tồn kho hiện tại (để tránh làm âm kho khi người dùng nhập dữ liệu cũ vào hệ thống).
