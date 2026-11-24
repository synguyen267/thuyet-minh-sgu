# Backend 3 lớp (apps/web/server)

Chạy dạng hàm serverless trên Vercel qua `api/index.js`, hoặc như một máy chủ Node thường: `node server/start.js`.

## Ba lớp và nhiệm vụ

| Lớp | Thư mục | Nhiệm vụ | Không được làm |
|---|---|---|---|
| Controller | `controllers/` | Nhận yêu cầu HTTP, gọi service, trả JSON | Chứa quy tắc nghiệp vụ, nói chuyện với CSDL |
| Service | `services/` | Kiểm tra dữ liệu, áp quy tắc nghiệp vụ (ví dụ BR-15: điểm đã có lượt nghe thì không xóa) | Biết HTTP, biết Supabase |
| Repository | `repositories/` | Đọc và ghi CSDL Supabase | Chứa quy tắc nghiệp vụ |

Các lớp được ghép ở một chỗ duy nhất, `index.js`. Nhờ vậy mỗi lớp thay riêng được và kiểm thử bằng đối tượng giả (`__tests__/`).

## Ba dịch vụ độc lập (service)

| Dịch vụ | Hàm Vercel | Ghép các tầng ở | Địa chỉ sức khỏe |
|---|---|---|---|
| **POI** (thêm, sửa, bản dịch, đếm lượt nghe, xóa) | `api/poi.js` | `server/composition/poi.js` | `/api/pois/health` |
| **AI** (soạn nháp, dịch bằng Gemini) | `api/ai.js` | `server/composition/ai.js` | `/api/ai/health` |
| **Analytics** (thống kê, bản đồ nhiệt) | `api/analytics.js` | `server/composition/analytics.js` | `/api/stats/health` |

Mỗi dịch vụ là một ứng dụng Express riêng chỉ có đường dẫn của mình, tự kiểm tra quyền admin, và chỉ nạp những gì nó cần. Nhờ vậy dịch vụ AI chậm hoặc lỗi (Google quá tải, thiếu khóa) không làm hỏng dịch vụ POI. `vercel.json` chuyển `/api/pois/...`, `/api/ai/...`, `/api/stats/...` tới đúng hàm. Các dịch vụ giao tiếp với giao diện qua REST; `server/index.js` có bản gộp cả ba cho chạy ở máy (`node server/start.js`).

## Các địa chỉ (REST)

| Phương thức | Đường dẫn | Quyền |
|---|---|---|
| GET | `/api/pois/health`, `/api/ai/health`, `/api/stats/health` | mọi người |
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

Trong `apps/web`: `npm run test:server` (dùng bộ kiểm thử có sẵn của Node, không cần cài thêm). Trên GitHub, `.github/workflows/backend-ci.yml` chạy kiểm thử riêng cho từng dịch vụ và một job kiểm thử ghép các tầng.
