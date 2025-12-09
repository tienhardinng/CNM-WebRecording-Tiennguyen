# 🎄 Web Interview Recorder - HanTie Project

## 1. Giới Thiệu
Dự án **Web Interview Recorder - HanTie** là một ứng dụng web Client-Server cho phép người dùng ghi lại video phỏng vấn bằng camera/microphone của họ, với tính năng **tải lên ngay lập tức sau mỗi câu hỏi (Per-Question Upload)**.

Dự án này thể hiện sự hiểu biết về truyền thông mạng Client-Server qua HTTP(S), quản lý luồng dữ liệu MediaStream, và xử lý tập tin ở phía Server, cùng với tính năng Speech-to-Text (STT) Bonus.

## 2. Yêu Cầu và Cấu Trúc
* **Môi trường:** Node.js, Express.js (Backend), HTML5/JS (Frontend).
* [cite_start]**Giao thức:** HTTP trên localhost (hoặc **HTTPS** khi triển khai công khai để truy cập camera/mic [cite: 4, 32]).
* [cite_start]**Nguyên tắc:** Client-Server model[cite: 13].

### Cấu Trúc Thư Mục