# 🥗 Bếp Ấm - Smart Kitchen Companion

**Bếp Ấm** là hệ sinh thái quản lý thực phẩm và tư vấn dinh dưỡng thông minh dành cho gia đình trẻ. Dự án giúp tối ưu hóa việc đi chợ, giảm lãng phí thực phẩm và giải quyết bài toán "Hôm nay ăn gì?" thông qua công nghệ OCR và AI.

---

## 🚀 Tính năng Giai đoạn 1 (MVP)

- **Scan & Go:** Quét hóa đơn siêu thị (OCR) để tự động nhập thực phẩm vào tủ lạnh.
- **Virtual Fridge:** Quản lý kho thực phẩm ảo với cảnh báo hạn sử dụng thông minh.
- **Smart Cooking:** Gợi ý công thức món ăn dựa trên những gì đang có trong tủ lạnh.
- **Optimized Shopping List:** Tự động liệt kê nguyên liệu còn thiếu cho thực phẩm định nấu.

---

## 🛠 Tech Stack

- **Frontend:** React Native (Mobile App)
- **Backend:** Supabase Edge Functions
- **Database:** PostgreSQL (Supabase)
- **AI/OCR:** Google Cloud Vision API
- **CI/CD:** GitHub Actions

---

## 💻 Cài đặt môi trường phát triển

### 1. Yêu cầu hệ thống
- Node.js (v18.x trở lên)
- npm hoặc yarn
- Supabase CLI (`npm install -g supabase`)

### 2. Clone dự án
```bash
git clone https://github.com/n8hotnews-a11y/bepam.git
cd bep-am

---

## 📱 Cập nhật ứng dụng tự động (OTA Updates bằng Expo EAS)

Thay vì phải build lại file APK mỗi khi có thay đổi code React Native hoặc UI, bạn có thể đẩy bản cập nhật trực tiếp xuống điện thoại thông qua **EAS Update**.

### Bước 1: Cài đặt và cấu hình thư viện Updates
Đi vào thư mục `mobile` và chạy 2 lệnh sau:
```bash
npx expo install expo-updates
eas update:configure
```

### Bước 2: Build lại APK một lần nữa
Vì ứng dụng hiện tại trên điện thoại chưa có module nhận update, bạn cần build lại APK **một lần duy nhất** để nhúng thư viện OTA vào bên trong.
```bash
eas build --platform android --profile preview
```
Cài đặt file APK mới này vào điện thoại để bắt đầu nhận các bản cập nhật OTA trong tương lai.

### Bước 3: Đẩy bản cập nhật (OTA Update)
Sau khi thay đổi code, để đẩy code mới xuống tất cả điện thoại đã cài APK ở Bước 2, bạn chỉ cần gõ lệnh:
```bash
eas update --branch preview --message "Mô tả tính năng thay đổi ở bản cập nhật này"
```
Khi người dùng mở ứng dụng, bản cập nhật sẽ được tải ngầm ở background và áp dụng vào lần mở ứng dụng tiếp theo mà không cần phải truy cập Store hay tải lại file APK.
