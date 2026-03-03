# Tính năng Đánh dấu đã đọc - Cảnh báo thực phẩm

## Tổng quan
Tính năng này cho phép người dùng đánh dấu các cảnh báo thực phẩm hết hạn/sắp hết hạn là "đã đọc", giúp ứng dụng biết người dùng đã nắm được thông tin và không gửi thông báo lặp lại về điện thoại.

## Các thành phần đã thêm/cập nhật

### 1. notificationReadService.js (Mới)
Service quản lý trạng thái đã đọc của thông báo:
- `getReadNotifications()`: Lấy danh sách ID thực phẩm đã đánh dấu đọc
- `markAsRead(itemId)`: Đánh dấu một thực phẩm là đã đọc
- `markMultipleAsRead(itemIds)`: Đánh dấu nhiều thực phẩm là đã đọc
- `markAsUnread(itemId)`: Bỏ đánh dấu đã đọc
- `isRead(itemId)`: Kiểm tra thực phẩm đã được đánh dấu đọc chưa
- `clearReadStatus(itemId)`: Xóa trạng thái đã đọc (khi xóa/cập nhật thực phẩm)
- `cleanup(existingItemIds)`: Dọn dẹp trạng thái đã đọc cho các thực phẩm không còn tồn tại

### 2. ExpiredItemsScreen.js (Cập nhật)
Màn hình cảnh báo thực phẩm với các tính năng mới:

#### UI/UX
- **Badge "Đã đọc"**: Hiển thị bên cạnh tên thực phẩm đã được đánh dấu
- **Nút toggle đọc/chưa đọc**: Icon email cho phép đánh dấu từng thực phẩm
- **Nút "Đánh dấu tất cả đã đọc"**: Icon done-all ở header để đánh dấu tất cả cùng lúc
- **Hiệu ứng visual**: Card đã đọc có opacity giảm và màu nền khác biệt

#### Chức năng
- `handleMarkAsRead(item)`: Đánh dấu một thực phẩm là đã đọc
- `handleMarkAsUnread(item)`: Bỏ đánh dấu đã đọc
- `handleMarkAllAsRead()`: Đánh dấu tất cả thực phẩm trong danh sách
- Tự động cleanup khi xóa thực phẩm
- Load và sync trạng thái đã đọc khi mở màn hình

### 3. notificationService.js (Cập nhật)
Service thông báo đã được cập nhật:
- Kiểm tra trạng thái đã đọc trước khi gửi thông báo
- Bỏ qua thông báo cho các thực phẩm đã được đánh dấu đã đọc
- Log thông tin khi skip notification

## Luồng hoạt động

### Khi người dùng mở màn hình cảnh báo:
1. Load danh sách thực phẩm hết hạn/sắp hết hạn
2. Load trạng thái đã đọc từ AsyncStorage
3. Cleanup các trạng thái đã đọc cho thực phẩm không còn tồn tại
4. Hiển thị UI với badge và nút action phù hợp

### Khi người dùng đánh dấu đã đọc:
1. Lưu ID thực phẩm vào AsyncStorage
2. Cập nhật state để hiển thị badge "Đã đọc"
3. Giảm opacity card để phân biệt
4. Hiển thị toast thông báo thành công

### Khi hệ thống gửi thông báo:
1. `HomeScreen` gọi `scheduleExpiryNotification()` cho thực phẩm sắp hết hạn
2. Service kiểm tra trạng thái đã đọc
3. Nếu đã đọc → skip, log message
4. Nếu chưa đọc → gửi thông báo bình thường

### Khi xóa thực phẩm:
1. Xóa thực phẩm khỏi database
2. Tự động xóa trạng thái đã đọc liên quan
3. Refresh danh sách

## Lưu trữ dữ liệu
- **Key**: `@ComNha_ReadNotifications`
- **Format**: JSON array của item IDs
- **Storage**: AsyncStorage (local, per device)

## Icons sử dụng
- `mark-email-read`: Đánh dấu đã đọc
- `mark-email-unread`: Đánh dấu chưa đọc
- `done-all`: Đánh dấu tất cả đã đọc
- `check-circle`: Icon badge đã đọc

## Cải tiến trong tương lai
1. Sync trạng thái đã đọc lên server (Supabase) để đồng bộ giữa các thiết bị
2. Tự động reset trạng thái đã đọc sau một khoảng thời gian
3. Thống kê số lần đọc/bỏ qua cảnh báo
4. Smart notification: học hành vi người dùng để điều chỉnh tần suất thông báo
