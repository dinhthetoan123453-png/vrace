# 🏃 Garmin, Strava & vRace TCX Route & Telemetry Generator

Ứng dụng web tương tác chuyên nghiệp giúp tạo, vẽ lộ trình và xuất file **.TCX** chuẩn thể thao có đầy đủ dữ liệu GPS từng giây (1-second telemetry), Pace, Nhịp tim (Heart Rate), Guồng chân (Cadence) và thông tin thiết bị Garmin chính hãng tương thích 100% với **vRace**, **Strava** và **Garmin Connect**.

---

## 📱 Tính Năng Tối Ưu Cho Thiết Bị Di Động (Mobile-First Experience)

Phiên bản này được thiết kế và tối ưu toàn diện cho các thiết bị di động (Smartphones & Tablets Android, iPhone/iPad):

- **Tab Navigation Thông Minh**: Chuyển đổi mượt mà giữa các tab **🗺️ Bản đồ**, **⚙️ Cài đặt & Pace**, **📊 Laps & Biểu đồ** và **📦 Tạo hàng loạt**.
- **HUD Quick Stats Nổi (Floating HUD)**: Hiển thị cự ly (km), thời gian và Pace trung bình ngay trên màn hình bản đồ thời gian thực.
- **Thanh Tác Vụ Nhanh (Mobile Action Bar)**: Đặt ngay dưới ngón tay cái giúp:
  - 📍 **Định vị GPS**: Tự động xác định vị trí hiện tại của bạn bằng GPS trình duyệt và đặt điểm xuất phát (A).
  - ↩️ **Hoàn tác (Undo)**: Xóa nhanh điểm mốc vừa chấm.
  - 🗑️ **Xóa**: Làm mới toàn bộ lộ trình.
  - ⛶ **Phóng to (Fullscreen)**: Mở rộng bản đồ toàn màn hình để dễ dàng vẽ đường trên màn hình cảm ứng nhỏ.
  - 📥 **Xuất TCX**: Tải ngay file về điện thoại với 1 chạm.
- **Thao Tác Cảm Ứng (Touch Optimized)**: Thanh trượt Pace/Cadence lớn dễ kéo, các nút chip lộ trình mẫu cuộn ngang (Swipeable Carousels), không bị trễ cảm ứng (disabled Leaflet tap lag).
- **Hỗ Trợ PWA (Progressive Web App)**: Cung cấp `manifest.json` và `icon.svg` giúp bạn có thể chọn "Thêm vào màn hình chính" (Add to Home Screen) trên Chrome và Safari để dùng như một ứng dụng native.
- **Modal Cuộn Độc Lập**: Giao diện tạo file hàng loạt (Batch Modal) tự động co giãn, hỗ trợ cuộn mượt mà trên mọi kích thước màn hình mà không bị che khuất nút thao tác.

---

## ⚡ Các Tính Năng Nổi Bật Khác

### 1. Định Tuyến Đường Phố & Uốn Lượn Hữu Cơ
- **Foot Routing (OSRM)**: Bám sát mạng lưới đường bộ, ngõ xóm và phố đi bộ thực tế.
- **Authentic Human Running Engine**: Tự động mô phỏng độ cong dạt lề đường tự nhiên (~6.2m) và rung nhiễu GPS vi mô (±0.8m) như người chạy thật mang đồng hồ thể thao.
- **Corner Slowdown**: Tự động giảm tốc 15–25% khi vào các khúc cua hoặc ngã rẽ.
- **Sprint Finish**: Tăng tốc bứt phá trong 120m cuối về đích.

### 2. Dữ Liệu Đo Đạc Từng Giây (1-Second Telemetry)
- Nhịp tim sinh học tăng dần từ khởi động (Warm-up) lên mức duy trì, đồng biến với tốc độ chạy.
- Guồng chân (Cadence) biến thiên tự nhiên theo Pace và bước chạy (160–185 SPM).
- Độ cao và khoảng cách tích lũy chuẩn từng giây.

### 3. Nhận Diện Thiết Bị Garmin Hiển Thị Huy Hiệu Strava & vRace
- Tích hợp chuẩn Creator Device ID của Garmin Connect:
  - Garmin Forerunner 965 (Flagship AMOLED)
  - Garmin Forerunner 265 / 955 / 255 / 745 / 245
  - Garmin Fenix 7 Pro / Fenix 7
  - Chế độ điện thoại di động / ẩn thiết bị

### 4. Tạo File Hàng Loạt Trong Vùng Bản Đồ Khoanh Giới Hạn
- Cho phép khoanh một vùng chữ nhật trên bản đồ (ví dụ: khu vực sinh sống, công viên hoặc thị trấn).
- Sinh ngẫu nhiên từ 1 đến 50 file TCX với các hình thái lộ trình đa dạng (Polygon Loop, Shuttle Loop, Figure-8, Meander) nằm hoàn toàn trong vùng giới hạn.
- Hỗ trợ chuẩn Pace đi bộ / chạy chậm vRace (> 7:00 /km đến 11:00 /km).
- Tùy chọn khoảng cách giãn cách thời gian giữa các bài tập (ví dụ nghỉ 10 phút sau bài trước).
- Đóng gói toàn bộ thành 1 file nén `.ZIP` sẵn sàng tải về.

---

## 🚀 Hướng Dẫn Sử Dụng

### Chạy Trực Tiếp Bằng Trình Duyệt
Bạn chỉ cần mở trực tiếp file `index.html` bằng bất kỳ trình duyệt nào (Chrome, Safari, Firefox, Edge).

### Chạy Local Server (Khuyên Dùng)
```bash
# Python 3
python3 -m http.server 8000

# Hoặc dùng Node.js npx serve
npx serve .
```
Truy cập địa chỉ `http://localhost:8000` trên trình duyệt máy tính hoặc điện thoại cùng mạng Wi-Fi.

### Triển Khai Lên GitHub Pages
1. Vào repository trên GitHub: **Settings** -> **Pages**.
2. Tại mục **Branch**, chọn `main` và thư mục `/ (root)`.
3. Bấm **Save**. Trang web sẽ tự động online sau 1 phút!

---

## 📂 Cấu Trúc Thư Mục

```
garmin_tcx_builder/
├── index.html           # Giao diện chính responsive, tích hợp TailwindCSS & Lucide
├── manifest.json        # Cấu hình PWA cho thiết bị di động
├── icon.svg             # Biểu tượng ứng dụng chuẩn thể thao
├── css/
│   └── style.css        # Tùy biến thanh cuộn, hiệu ứng chạm, GPS marker và Leaflet
└── js/
    ├── config.js        # Cấu hình danh mục thiết bị Garmin & lộ trình mẫu
    ├── map.js           # Xử lý bản đồ Leaflet, OSRM routing, GPS & chế độ toàn màn hình
    ├── telemetry.js     # Thuật toán sinh telemetry 1s (GPS, nhịp tim, cadence, drift)
    ├── tcx.js           # Bộ đóng gói dữ liệu sang chuẩn XML định dạng .TCX
    └── app.js           # Điều khiển giao diện, Chart.js, tabs mobile & batch generation
```

---

## 📜 Giấy Phép
Dự án được phân phối dưới giấy phép **MIT**.
