/* file: server.js (Lưu file ngay tại thư mục dự án) */
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = 3000;

// ====== ĐỔI LẠI: LƯU VÀO THƯ MỤC DỰ ÁN ======
const uploadsRoot = path.join(__dirname, "uploads"); // <--- Đã đổi dòng này
const frontendRoot = __dirname; 

app.use(cors());
app.use(express.json());
app.use(express.static(frontendRoot));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

app.get("/", (req, res) => {
  const indexPath = path.join(frontendRoot, "index.html");
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.send("<h1>Chưa có file index.html</h1>");
});

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.post("/api/verify-token", (req, res) => {
  if (req.body.token === "12345") return res.status(200).json({ ok: true });
  return res.status(401).json({ ok: false });
});

app.post("/api/session/start", (req, res) => {
  try {
    const { userName } = req.body;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 16).replace(/:/g, "-").replace("T", "_");
    const safeName = (userName || "user").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const folderName = `${dateStr}_${safeName}`;
    
    const folderPath = path.join(uploadsRoot, folderName);
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    return res.status(200).json({ ok: true, folder: folderName });
  } catch (err) { return res.status(500).json({ ok: false }); }
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const folder = req.body.folder;
      const savePath = path.join(uploadsRoot, folder || "");
      if (!fs.existsSync(savePath)) fs.mkdirSync(savePath, { recursive: true });
      cb(null, savePath);
    },
    filename: (req, file, cb) => cb(null, `Q${req.body.questionIndex || 0}.webm`)
  })
});

app.post("/api/upload-one", upload.single("video"), (req, res) => {
  if(req.file) console.log("✅ Đã lưu:", req.file.path);
  return res.status(200).json({ ok: true });
});
app.post("/api/session/finish", (req, res) => res.status(200).json({ ok: true }));

app.listen(PORT, () => {
  console.log(`SERVER CHẠY TẠI: http://localhost:${PORT}`);
  console.log(`📂 Video sẽ lưu tại thư mục: ${uploadsRoot}`);
});