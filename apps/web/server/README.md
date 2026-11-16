# Backend 3 lớp (apps/web/server)

Chạy dạng hàm serverless trên Vercel qua `api/index.js`, hoặc như một máy chủ Node thường: `node server/start.js`.

## Ba lớp và nhiệm vụ

| Lớp | Thư mục | Nhiệm vụ | Không được làm |
|---|---|---|---|
| Controller | `controllers/` | Nhận yêu cầu HTTP, gọi service, trả JSON | Chứa quy tắc nghiệp vụ, nói chuyện với CSDL |
| Service | `services/` | Kiểm tra dữ liệu, áp quy tắc nghiệp vụ (ví dụ BR-15: điểm đã có lượt nghe thì không xóa) | Biết HTTP, biết Supabase |
| Repository | `repositories/` | Đọc và ghi CSDL Supabase | Chứa quy tắc nghiệp vụ |

Các lớp được ghép ở một chỗ duy nhất, `index.js`. Nhờ vậy mỗi lớp thay riêng được và kiểm thử bằng đối tượng giả (`__tests__/`).

## Ba dịch vụ (service)

- **POI**: thêm, sửa, lưu bản dịch, đếm lượt nghe, xóa điểm.
- **AI**: soạn nháp và dịch bằng Gemini (khóa chỉ nằm ở biến môi trường).
- **Analytics**: thống kê và dữ liệu bản đồ nhiệt.

## Các địa chỉ (REST)

| Phương thức | Đường dẫn | Quyền |
|---|---|---|
| GET | `/api/health` | mọi người |
| POST | `/api/pois` | admin |
| PATCH | `/api/pois/:id` | admin |
| PUT | `/api/pois/:id/translations/:lang` | admin |
| GET | `/api/pois/:id/plays` | admin |
| DELETE | `/api/pois/:id` | admin |
| POST | `/api/ai/draft` | admin |
| POST | `/api/ai/translate` | admin |
| GET | `/api/stats` | admin |
| GET | `/api/stats/heat?max=` | admin |

Gửi kèm tiêu đề `Authorization: Bearer <token đăng nhập Supabase>`. Backend hỏi hàm `is_admin()` của Supabase, rồi dùng chính token đó để ghi dữ liệu, nên RLS vẫn là lớp bảo vệ cuối cùng.

## Kiểm thử

Trong `apps/web`: `npm run test:server` (dùng bộ kiểm thử có sẵn của Node, không cần cài thêm).
