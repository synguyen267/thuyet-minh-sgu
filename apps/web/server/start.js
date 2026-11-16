// Chạy backend như một máy chủ Node thông thường (máy cá nhân hoặc nền tảng như Render): node server/start.js
import { createRealApp } from './index.js';

const port = process.env.PORT || 3001;
createRealApp().listen(port, () => console.log(`API đang chạy ở cổng ${port}`));
