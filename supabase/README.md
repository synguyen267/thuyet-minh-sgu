# Cơ sở dữ liệu (Supabase)

## Các bảng

| Bảng | Nội dung | Ai đọc | Ai ghi |
|---|---|---|---|
| `poi` | Điểm tham quan: tọa độ, bán kính, ưu tiên, thứ tự tuyến (`tour_order`), ảnh, link bản đồ | Mọi người (điểm đang bật) | Admin |
| `poi_translation` | Tên và lời thuyết minh theo ngôn ngữ (vi, en, zh, ja, ko), `status` là `draft` hoặc `approved` | Mọi người (chỉ bản `approved`) | Admin |
| `play_log` | Nhật ký nghe (ẩn danh): điểm nào, ngôn ngữ, GPS hay QR, nghe bao lâu, nghe hết chưa | Admin | Mọi người |
| `location_track` | Vết di chuyển ẩn danh, dùng cho bản đồ nhiệt | Admin | Mọi người |
| `admin_user` | Danh sách quản trị viên | Không ai qua API | SQL Editor |

Kho lưu trữ `poi-media` (ảnh và audio, tối đa 10 MB/file): ai cũng xem được, chỉ admin tải lên.
Ba view thống kê cho trang quản trị: `v_top_pois`, `v_avg_listen`, `v_heat` (chỉ admin xem được).

Bảo mật dựa trên Row Level Security (RLS): quyền được kiểm tra ngay trong CSDL, nên dù ai có khóa `anon` trong tay
cũng không đọc được nhật ký hay sửa được nội dung. Đã kiểm thử 30 tình huống phân quyền trên Postgres thật.

## Cài đặt (làm một lần, khoảng 10 phút)

### 1. Tạo project
1. Vào supabase.com, đăng nhập bằng GitHub, bấm **New project**.
2. Đặt tên `thuyet-minh-sgu`. **Region: Southeast Asia (Singapore)**. Đặt Database password (lưu vào trình quản lý mật khẩu, không gửi cho ai).
3. Đợi 1 đến 2 phút cho project khởi tạo.

### 2. Tạo bảng và bảo mật
1. Menu trái chọn **SQL Editor**, bấm **New query**.
2. Mở file `supabase/migrations/0001_init.sql`, chép toàn bộ, dán vào, bấm **Run**.
3. Thấy "Success. No rows returned" là xong. Chạy lại lần nữa cũng không sao.

### 2b. Thêm vùng phụ cho khu dài (bản cập nhật)
Mở `supabase/migrations/0002_poi_zones.sql`, dán vào query mới, bấm **Run**. File này thêm cột `extra_zones` (các vùng
kích hoạt phụ, tối đa 12 vùng mỗi điểm) để khu dài như Khu A có nhiều điểm kích hoạt. Chạy lại nhiều lần cũng không sao.

### 3. Nạp dữ liệu 10 điểm
1. Mở file `supabase/seed.sql`, chép toàn bộ, dán vào query mới, bấm **Run**.
2. Kiểm tra: chạy `select count(*) from public.poi;` phải ra **10**.

Nếu bạn đo tọa độ trực tiếp trong trang `/admin` thì KHÔNG cần bước này nữa (và chạy lại seed cũng không xóa tọa độ đã đo).

Cách cũ, khi đo xong rồi dán tọa độ vào `packages/core/data/pois.sample.json`, chạy `npm run db:seed`
để sinh lại `seed.sql`, rồi dán vào SQL Editor chạy lại. Lệnh này cập nhật tọa độ, bán kính, ưu tiên,
thứ tự tuyến của điểm; còn lời thuyết minh đã có thì giữ nguyên.

### 4. Tạo tài khoản quản trị
1. Menu trái **Authentication**, **Users**, **Add user**, **Create new user**: nhập email và mật khẩu, tick "Auto Confirm User".
2. Vào **Authentication**, **Sign In / Providers** (hoặc Providers), **Email**: **tắt "Allow new users to sign up"**,
   để không ai tự đăng ký tài khoản được.
3. Quay lại SQL Editor, chạy (thay email của bạn):

```sql
insert into public.admin_user (user_id)
select id from auth.users where email = 'email-cua-ban@example.com';
```

Muốn thêm admin khác thì tạo user rồi chạy lại lệnh trên với email đó.

### 5. Lấy địa chỉ và khóa để dùng cho app
Vào **Project Settings**, **API**: chép **Project URL** và khóa **anon public**.
- Trên Vercel: Settings, Environment Variables, thêm `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.
- Khi chạy trên máy: sao chép `.env.example` thành `.env` rồi điền hai giá trị này (file `.env` đã bị chặn commit).

**Khóa `service_role` không bao giờ được vào repo, vào chat, hay vào biến `VITE_...`** (mọi biến `VITE_...` bị gói vào code trình duyệt).

### 6. Kiểm tra từ PowerShell (không bắt buộc)

```powershell
$url = "https://XXXX.supabase.co"      # Project URL của bạn
$key = "eyJ..."                         # khóa anon public
Invoke-RestMethod "$url/rest/v1/poi?select=id,tour_order&order=tour_order" -Headers @{ apikey = $key; Authorization = "Bearer $key" }
```

Phải ra danh sách 10 điểm. Thử đọc `play_log` bằng cùng khóa phải ra rỗng, đó là bảo mật đang hoạt động.

## Lưu ý quyền riêng tư
`location_track` chỉ chứa `session_id` ngẫu nhiên và tọa độ, không có tên hay tài khoản. Vẫn nên xóa dữ liệu cũ định kỳ,
ví dụ mỗi học kỳ: `delete from public.location_track where recorded_at < now() - interval '90 days';`
và ghi rõ trong báo cáo rằng dữ liệu vị trí là ẩn danh.

## Bước sau
Khi làm backend 3 lớp (GĐ2), việc ghi `play_log` và `location_track` nên đi qua backend để có giới hạn tần suất
chống spam; lúc đó có thể siết lại quyền ghi trực tiếp của khách.
