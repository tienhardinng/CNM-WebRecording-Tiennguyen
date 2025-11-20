/* file: app.js */
const BASE = "http://localhost:3000"; // Đảm bảo đúng cổng của Server

const API = {
  verify: `${BASE}/api/verify-token`,
  start:  `${BASE}/api/session/start`,
  upload: `${BASE}/api/upload-one`,
  finish: `${BASE}/api/session/finish`,
};

// DOM Elements
const els = {
  token: document.getElementById("token-input"),
  name: document.getElementById("name-input"),
  startBtn: document.getElementById("start-button"),
  startStatus: document.getElementById("start-status"),
  startCard: document.getElementById("start-container"),
  interview: document.getElementById("interview-section"),
  
  video: document.getElementById("video-preview"),
  recordBtn: document.getElementById("record-button"),
  stopBtn: document.getElementById("stop-button"),
  nextBtn: document.getElementById("next-button"),
  finishBtn: document.getElementById("finish-button"),
  
  uploadStatus: document.getElementById("upload-status"),
  questionText: document.getElementById("question-text"),
};

// State
let mediaStream = null;
let mediaRecorder = null;
let chunks = [];
let folder = null;
let currentQuestion = 1;
let currentBlob = null;
let isRecorded = false; // Đã quay xong câu hiện tại chưa?

const QUESTIONS = [
  "Giới thiệu về bản thân bạn.",
  "Điểm mạnh của bạn là gì?",
  "Mục tiêu trong tương lai gần?",
  "Tại sao bạn chọn công ty chúng tôi?",
  "Bạn có câu hỏi nào cho chúng tôi không?"
];

// --- HELPER FUNCTIONS ---
async function postJSON(url, body) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    throw new Error("Không thể kết nối Server. Hãy chắc chắn bạn đã chạy 'node server.js'");
  }
}

function updateQuestionUI() {
  if (currentQuestion <= QUESTIONS.length) {
    els.questionText.textContent = `Câu ${currentQuestion}/${QUESTIONS.length}: ${QUESTIONS[currentQuestion-1]}`;
  } else {
    els.questionText.textContent = "Phỏng vấn hoàn tất!";
  }
}

// --- MAIN LOGIC ---

// 1. Bắt đầu Session
els.startBtn.addEventListener("click", async (e) => {
  e.preventDefault(); // CHẶN LOAD LẠI TRANG
  els.startStatus.textContent = "Đang kết nối...";
  els.startStatus.style.color = "#fcd34d";
  els.startBtn.disabled = true;

  try {
    // Verify Token
    const verify = await postJSON(API.verify, { token: els.token.value });
    if (!verify || !verify.ok) throw new Error(verify.message || "Sai Token");

    // Start Session
    const start = await postJSON(API.start, { 
      token: els.token.value, 
      userName: els.name.value 
    });
    if (!start.ok) throw new Error(start.message);

    folder = start.folder;
    
    // Mở Camera
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    els.video.srcObject = mediaStream;

    // Chuyển màn hình
    els.startCard.style.display = "none";
    els.interview.style.display = "block";
    updateQuestionUI();
    
    els.uploadStatus.textContent = "Sẵn sàng. Bấm 'Bắt đầu quay'.";

  } catch (err) {
    els.startStatus.textContent = "Lỗi: " + err.message;
    els.startStatus.style.color = "#ef4444";
    els.startBtn.disabled = false; // Mở lại nút để thử lại
  }
});

// 2. Quay Video
els.recordBtn.addEventListener("click", (e) => {
  e.preventDefault(); // CHẶN LOAD LẠI TRANG
  chunks = [];
  isRecorded = false;
  
  try {
    mediaRecorder = new MediaRecorder(mediaStream, { mimeType: "video/webm" });
  } catch (err) {
    mediaRecorder = new MediaRecorder(mediaStream); // Fallback
  }

  mediaRecorder.ondataavailable = (event) => { 
    if(event.data.size > 0) chunks.push(event.data); 
  };
  
  mediaRecorder.onstop = () => {
    currentBlob = new Blob(chunks, { type: "video/webm" });
    isRecorded = true;
    els.recordBtn.style.display = "inline-block";
    els.stopBtn.style.display = "none";
    els.nextBtn.disabled = false; // Cho phép bấm Next
    els.uploadStatus.textContent = "Đã ghi xong. Bấm 'Next' để lưu và qua câu tiếp.";
    els.recordBtn.textContent = "Quay lại (nếu chưa ưng)";
  };

  mediaRecorder.start();
  
  // UI Update
  els.recordBtn.style.display = "none";
  els.stopBtn.style.display = "inline-block";
  els.nextBtn.disabled = true;
  els.uploadStatus.textContent = "Đang ghi hình... 🔴";
  els.uploadStatus.style.color = "#ef4444";
});

// 3. Dừng quay
els.stopBtn.addEventListener("click", (e) => {
  e.preventDefault(); // CHẶN LOAD LẠI TRANG
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    els.uploadStatus.style.color = "#fcd34d";
  }
});

// 4. Next (Upload + Chuyển câu)
els.nextBtn.addEventListener("click", async (e) => {
  e.preventDefault(); // QUAN TRỌNG NHẤT: CHẶN LOAD LẠI TRANG KHI BẤM NEXT

  if (!isRecorded || !currentBlob) return;

  els.nextBtn.disabled = true;
  els.recordBtn.disabled = true;
  els.uploadStatus.textContent = `Đang tải lên câu ${currentQuestion}... ⏳`;
  els.uploadStatus.style.color = "#fcd34d";

  try {
    const fd = new FormData();
    fd.append("token", els.token.value);
    fd.append("folder", folder);
    fd.append("questionIndex", currentQuestion);
    fd.append("video", currentBlob);

    const res = await fetch(API.upload, { method: "POST", body: fd });
    const data = await res.json();

    if (!data.ok) throw new Error("Upload thất bại");

    // Thành công -> Chuyển câu
    currentQuestion++;
    
    if (currentQuestion > QUESTIONS.length) {
      // Hết câu hỏi
      els.recordBtn.style.display = "none";
      els.nextBtn.style.display = "none";
      els.finishBtn.style.display = "inline-block";
      
      updateQuestionUI(); // Hiện chữ "Phỏng vấn hoàn tất"
      
      els.uploadStatus.textContent = "Đã trả lời hết. Bấm 'Hoàn thành' để xem lại.";
      els.uploadStatus.style.color = "#10b981";
      
      // Tắt camera luôn cho gọn
      if(mediaStream) mediaStream.getTracks().forEach(t => t.stop());
      els.video.style.background = "#000";

    } else {
      // Sang câu tiếp theo
      updateQuestionUI();
      els.recordBtn.disabled = false;
      els.recordBtn.textContent = "Bắt đầu quay";
      els.nextBtn.disabled = true; // Disable cho đến khi quay xong câu mới
      els.uploadStatus.textContent = "Đã lưu. Sẵn sàng cho câu tiếp theo.";
      els.uploadStatus.style.color = "#fff";
      isRecorded = false;
    }

  } catch (err) {
    console.error(err);
    els.uploadStatus.textContent = "Lỗi tải lên: " + err.message + ". Hãy thử bấm Next lại.";
    els.nextBtn.disabled = false; // Mở lại để bấm thử lại
    els.recordBtn.disabled = false;
  }
});

// 5. Finish (Hiển thị màn hình xem lại video)
els.finishBtn.addEventListener("click", async (e) => {
  e.preventDefault(); 
  els.finishBtn.disabled = true;
  els.finishBtn.textContent = "Đang xử lý...";

  try {
    // Gọi API báo kết thúc phiên
    await postJSON(API.finish, { folder });
    
    // 1. Ẩn màn hình phỏng vấn
    els.interview.style.display = "none";

    // 2. Hiện màn hình xem lại (Playback)
    const playbackSection = document.getElementById("playback-section");
    const videoGrid = document.getElementById("video-grid");
    playbackSection.style.display = "block";
    
    // 3. Tạo danh sách video để xem
    // Lặp qua các câu hỏi đã trả lời
    for (let i = 1; i < currentQuestion; i++) {
      
      // Tạo thẻ chứa
      const wrapper = document.createElement("div");
      wrapper.style.border = "1px solid #475569";
      wrapper.style.padding = "10px";
      wrapper.style.borderRadius = "10px";
      wrapper.style.background = "#0f172a";

      // Tiêu đề câu hỏi
      const title = document.createElement("p");
      title.textContent = `Câu ${i}: ${QUESTIONS[i-1] || ""}`;
      title.style.fontWeight = "bold";
      title.style.color = "#fcd34d";
      title.style.margin = "0 0 10px 0";

      // Tạo Video Player
      const vid = document.createElement("video");
      // Đường dẫn file: /uploads/TÊN_THƯ_MỤC/Q1.webm
      vid.src = `${BASE}/uploads/${folder}/Q${i}.webm`;
      vid.controls = true; // Hiện nút play/pause
      vid.style.width = "100%";
      vid.style.borderRadius = "8px";

      // Gắn vào giao diện
      wrapper.appendChild(title);
      wrapper.appendChild(vid);
      videoGrid.appendChild(wrapper);
    }

    els.uploadStatus.textContent = "✅ Đã hoàn tất!";

  } catch (err) {
    console.error(err);
    els.uploadStatus.textContent = "Lỗi: " + err.message;
    // Nếu lỗi quá thì mới reload lại trang sau 3s
    setTimeout(() => window.location.reload(), 3000);
  }
});