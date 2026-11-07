# Thuyết minh Đại học Sài Gòn (GPS + QR)

Web thuyết minh tự động đa ngôn ngữ cho khuôn viên cơ sở chính Đại học Sài Gòn (273 An Dương Vương).
Đi tới đâu, thuyết minh tới đó. Tuyến tham quan gồm 10 điểm, từ Cổng chính đến Sân bóng.

Tài liệu yêu cầu: PRD, Use Case/Activity, Checklist giai đoạn (bản SGU) nằm ngoài repo này.

## Cấu trúc

```
packages/core/   Logic lõi dùng chung cho web và mobile (không phụ thuộc trình duyệt)
  src/           geo (khoảng cách, lọc, gộp mẫu GPS), geofence, narration (hàng chờ, chống lặp, gián đoạn), tour
  test/          Unit test (node:test), chạy trên CI
  data/          pois.sample.json: 10 điểm theo tuyến tham quan (tọa độ chưa đo)
supabase/        SQL tạo bảng + RLS (migrations/), dữ liệu 10 điểm (seed.sql), hướng dẫn cài đặt
scripts/         gen-seed.mjs: sinh seed.sql từ pois.sample.json (npm run db:seed)
apps/web/        Web React + Vite: trang chủ, trang tham quan cho khách, khu quản trị
.github/         CI: chạy test và build mỗi lần push hoặc Pull Request
```

Cơ sở dữ liệu: xem `supabase/README.md` (SQL tạo bảng, bảo mật RLS, dữ liệu 10 điểm).

Sau này thêm vào cùng repo: `apps/api` (backend 3 lớp), `services/*` (Content/POI, AI, Analytics), `apps/mobile` (React Native).

## Các trang

| Đường dẫn | Ai dùng | Làm gì |
|---|---|---|
| `/` | Mọi người | Giới thiệu, nút Bắt đầu tham quan |
| `/tour` | Mọi người, **không cần tài khoản** | Bản đồ, tuyến 10 điểm, tự thuyết minh theo GPS, nút Nghe từng điểm |
| `/tour?poi=khu-a` | Mọi người | Đường dẫn trong mã QR: quét là nghe ngay, không cần GPS |
| `/admin` | Chỉ quản trị viên (đăng nhập) | Sửa điểm và bản dịch, đo tọa độ (lưu thẳng vào CSDL), thử vùng, giọng đọc, tạo và in mã QR, thống kê |

Dữ liệu đọc từ Supabase. Nếu chưa cấu hình hoặc CSDL lỗi, trang tự dùng dữ liệu mẫu trong `pois.sample.json`.

### Biến môi trường (apps/web)

Sao chép `.env.example` thành `.env` ở thư mục gốc rồi điền (trên Vercel: Settings, Environment Variables):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=khóa publishable hoặc anon public
```

Không bao giờ đưa khóa `service_role` hoặc `secret` vào đây.

## Chạy thử

Cần Node.js 20 trở lên.

```bash
npm install
npm test          # 24 unit test cho phần lõi
npm run dev       # trang PoC tại http://localhost:5173
npm run build     # build ra apps/web/dist
```

**Quan trọng:** GPS của trình duyệt chỉ hoạt động trên HTTPS hoặc localhost. Mở bằng địa chỉ mạng nội bộ
(http://192.168.x.x) trên điện thoại sẽ KHÔNG lấy được vị trí. Để thử trên điện thoại hãy deploy lên Vercel (có HTTPS).

## Deploy lên Vercel

(`apps/web/vercel.json` đã cấu hình để các đường dẫn như `/tour` và `/admin` hoạt động khi tải lại trang.)


1. Đẩy repo lên GitHub, vào Vercel chọn Add New Project, chọn repo.
2. Root Directory: `apps/web` (giữ bật "Include source files outside of the Root Directory").
3. Framework: Vite. Build Command: `npm run build`. Output Directory: `dist`. Install Command: `npm install`.
4. Mỗi Pull Request sẽ có bản xem thử riêng. Merge vào `main` là tự cập nhật bản chạy thật.

## Việc đầu tiên: đo tọa độ 10 điểm (cách mới, lưu thẳng vào CSDL)

Vào `/admin` trên điện thoại, đăng nhập, mở tab **Đo tọa độ**: mỗi lần đo xong, tọa độ được lưu vào Supabase ngay,
cả nhóm thấy ngay, không cần sao chép JSON. Các bước dưới đây vẫn đúng, chỉ bỏ bước "dán vào file".

### Cách cũ (cục bộ, khi chưa có Supabase)

1. Mở trang PoC trên điện thoại, bấm Bật GPS, cho phép vị trí.
2. Tab Đo tọa độ: đứng giữa từng địa điểm (khu B và khu C thì đứng giữa lối đi), chọn điểm, bấm đo, giữ máy yên 10 giây.
3. Đo xong cả 10 điểm: mở "Xuất dữ liệu", sao chép JSON, dán lat/lng vào `packages/core/data/pois.sample.json` rồi commit.
4. Tab Thử vùng: đi bộ theo tuyến, xem điểm nào bị đọc nhầm, chỉnh `radius_m` trong file dữ liệu.
   Ở nhà có thể dùng "Giả lập đứng tại" để thử logic hàng chờ, không đọc lặp và tạm dừng khi bị ẩn trang.
5. Tab Giọng đọc: thử cả 5 ngôn ngữ trên Android và iPhone, ghi lại ngôn ngữ nào thiếu giọng.

Kết quả ba bước 2, 4, 5 chính là kết luận của giai đoạn PoC (GĐ1): GPS đủ chính xác tới đâu, chỗ nào phải dùng QR,
ngôn ngữ nào cần file audio tạo sẵn.

## Quy ước làm việc

- Không bao giờ commit `.env` (đã chặn trong `.gitignore`). Mẫu nằm ở `.env.example`.
- Làm trên nhánh riêng, mở Pull Request, một người review rồi mới merge vào `main`.
- Logic quan trọng (geofence, hàng chờ) viết trong `packages/core` và có test, không viết thẳng vào giao diện.

## Ghi chú

- `npm audit` báo một cảnh báo mức vừa về esbuild trong máy chủ dev của Vite. Nó chỉ ảnh hưởng khi chạy `npm run dev`
  (đừng mở trang web lạ khi đang chạy dev), không ảnh hưởng bản deploy. Có thể nâng Vite lên bản mới hơn sau khi kiểm tra tương thích.
- Nội dung thuyết minh trong `pois.sample.json` là bản tạm (chỉ nói bạn đang ở đâu). Nội dung thật sẽ viết ở GĐ6 cùng bước AI soạn nháp và người duyệt.
