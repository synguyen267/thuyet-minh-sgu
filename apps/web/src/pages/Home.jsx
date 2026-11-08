import { Link } from '../router.jsx';

export default function Home({ navigate }) {
  return (
    <div className="app home">
      <div className="home-grid">
      <header className="home-hero">
        <h1>Đi tới đâu, nghe tới đó</h1>
        <p>Dạo quanh Đại học Sài Gòn (cơ sở An Dương Vương) cùng một người bạn kể chuyện. Điện thoại của bạn tự thuyết minh khi bạn đi tới gần từng khu.</p>
        <Link to="/tour" navigate={navigate} className="btn primary big">Bắt đầu tham quan</Link>
      </header>

      <div className="bento">
        <section className="tile wide">
          <h2>Các điểm tham quan trong trường</h2>
          <p>Từ cổng chính, các khu học, căn tin tới sân bóng. Đi theo thứ tự nào cũng được: bước vào vùng của khu nào là nghe khu đó.</p>
        </section>
        <section className="tile">
          <h2>5 ngôn ngữ</h2>
          <p>Tiếng Việt, English, 中文, 日本語, 한국어.</p>
        </section>
        <section className="tile">
          <h2>Quét mã QR</h2>
          <p>Thấy mã QR tại khu nào, quét là nghe ngay, không cần bật GPS.</p>
        </section>
        <section className="tile wide">
          <h2>Không cần tài khoản</h2>
          <p>Mở trang là dùng được. Vị trí chỉ được ghi ẩn danh khi bạn đồng ý, để nhóm cải thiện tuyến tham quan.</p>
        </section>
      </div>

      </div>

      <footer className="home-foot">
        <Link to="/admin" navigate={navigate}>Dành cho quản trị viên</Link>
      </footer>
    </div>
  );
}
