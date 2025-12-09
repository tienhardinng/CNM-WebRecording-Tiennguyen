/* file: app.js (Complete English Version with STT Display and Retry/Backoff) */
const BASE = "http://localhost:3000";

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
  
  mainActionButton: document.getElementById("main-action-button"), 
  
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
let isRecording = false; 
let isRecorded = false; 
let allTranscripts = []; // State to store transcripts

const QUESTIONS = [
  "Introduce yourself.",
  "What are your strengths?",
  "What are your goals in the near future?",
  "Why did you choose our company?",
  "Do you have any questions for us?"
];

// --- HELPER FUNCTIONS ---
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function postJSON(url, body) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({ message: `Server Error (${res.status})` }));
        throw new Error(data.message || `Server Error (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    throw new Error(err.message || "Could not connect to Server. Please ensure 'node server.js' is running.");
  }
}

function updateQuestionUI() {
  if (currentQuestion <= QUESTIONS.length) {
    els.questionText.textContent = `Question ${currentQuestion}/${QUESTIONS.length}: ${QUESTIONS[currentQuestion-1]}`;
  } else {
    els.questionText.textContent = "Interview complete!";
  }
}

function updateMainActionButton(state) {
    els.mainActionButton.disabled = false;
    els.mainActionButton.style.display = "block";
    
    els.mainActionButton.style.border = 'none';

    switch (state) {
        case 'START_RECORDING':
            els.mainActionButton.textContent = "Start Recording";
            els.mainActionButton.style.background = '#10b981';
            break;
        case 'STOP_RECORDING':
            els.mainActionButton.textContent = "Stop Recording";
            els.mainActionButton.style.background = '#ef4444';
            break;
        case 'UPLOAD_NEXT':
            els.mainActionButton.textContent = (currentQuestion === QUESTIONS.length) ? "Upload and Finish" : "Next (Upload)";
            els.mainActionButton.style.background = '#334155';
            els.mainActionButton.style.border = '1px solid #94a3b8';
            break;
        case 'FINISHED':
            els.mainActionButton.style.display = "none";
            break;
        case 'UPLOADING':
            els.mainActionButton.textContent = "Uploading and processing STT... ⏳";
            els.mainActionButton.disabled = true;
            break;
    }
}
// --- END HELPER FUNCTIONS ---


// --- MAIN LOGIC ---

// 1. Start Session
els.startBtn.addEventListener("click", async (e) => {
  e.preventDefault(); 
  els.startStatus.textContent = "Connecting...";
  els.startStatus.style.color = "#fcd34d";
  els.startBtn.disabled = true;

  try {
    const verify = await postJSON(API.verify, { token: els.token.value });
    if (!verify || !verify.ok) throw new Error("Invalid Token");

    const start = await postJSON(API.start, { 
      token: els.token.value, 
      userName: els.name.value 
    });
    if (!start.ok) throw new Error(start.message || "Error starting session");

    folder = start.folder;
    
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    els.video.srcObject = mediaStream;

    els.startCard.style.display = "none";
    els.interview.style.display = "block";
    updateQuestionUI();
    
    updateMainActionButton('START_RECORDING');
    
    els.uploadStatus.textContent = "Ready. Press 'Start Recording'.";

  } catch (err) {
    let displayMessage = err.message;
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        displayMessage = "Error: You must grant Camera and Microphone access to start.";
    }
    els.startStatus.textContent = displayMessage;
    els.startStatus.style.color = "#ef4444";
    els.startBtn.disabled = false;
  }
});

// 2. Single Action Button Logic
els.mainActionButton.addEventListener("click", async (e) => {
    e.preventDefault(); 

    if (isRecording) {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
            isRecording = false;
        }
    } else if (isRecorded) {
        await handleUploadAndNext();
    } else {
        handleStartRecording();
    }
});

// Handle Start Recording
function handleStartRecording() {
    chunks = [];
    isRecorded = false;
    isRecording = true;
    
    try {
        mediaRecorder = new MediaRecorder(mediaStream, { mimeType: "video/webm; codecs=vp8" });
    } catch (err) {
        mediaRecorder = new MediaRecorder(mediaStream); 
    }

    mediaRecorder.ondataavailable = (event) => { 
        if(event.data.size > 0) chunks.push(event.data); 
    };
    
    mediaRecorder.onstop = () => {
        currentBlob = new Blob(chunks, { type: "video/webm" });
        isRecorded = true;
        updateMainActionButton('UPLOAD_NEXT'); 
        els.uploadStatus.textContent = "Recording finished. Press 'Next (Upload)' to save and proceed to the next question.";
        els.uploadStatus.style.color = "#fcd34d";
    };

    mediaRecorder.start();
    
    updateMainActionButton('STOP_RECORDING');
    els.uploadStatus.textContent = "Recording... 🔴";
    els.uploadStatus.style.color = "#ef4444";
}

// Handle Upload and Next (with Retry/Backoff)
async function handleUploadAndNext() {
    if (!currentBlob) return;

    updateMainActionButton('UPLOADING'); 
    els.uploadStatus.style.color = "#fcd34d";

    const MAX_RETRIES = 3; 
    let success = false;
    let lastError = "Unknown network error.";
    let data = null; // To store successful response data

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        els.uploadStatus.textContent = `Uploading question ${currentQuestion} (Attempt ${attempt}/${MAX_RETRIES}) and processing STT... ⏳`;

        try {
            const fd = new FormData();
            fd.append("token", els.token.value);
            fd.append("folder", folder);
            fd.append("questionIndex", currentQuestion);
            const questionText = QUESTIONS[currentQuestion-1] || "";
            fd.append("questionText", questionText); 
            fd.append("video", currentBlob);

            const res = await fetch(API.upload, { method: "POST", body: fd });
            data = await res.json();
            
            if (!res.ok || !data.ok) { 
                throw new Error(data.message || `Upload failed (Status: ${res.status})`);
            }

            success = true;
            break; 

        } catch (err) {
            lastError = err.message;
            console.error(`Upload failed attempt ${attempt}: ${err.message}`);
            
            if (attempt < MAX_RETRIES) {
                const waitTime = Math.pow(2, attempt) * 1000; 
                els.uploadStatus.textContent = `Error: ${err.message}. Retrying automatically in ${waitTime / 1000} seconds...`;
                els.uploadStatus.style.color = "#ef4444";
                await delay(waitTime);
            }
        }
    }

    // After retry loop
    if (success) {
        // STORE TRANSCRIPT
        const receivedTranscript = data.transcript || "Transcript not available.";
        allTranscripts.push({
            index: currentQuestion,
            question: QUESTIONS[currentQuestion - 1],
            transcript: receivedTranscript
        });

        currentQuestion++;
        
        if (currentQuestion > QUESTIONS.length) {
            updateMainActionButton('FINISHED'); 
            els.finishBtn.style.display = "inline-block"; 
            updateQuestionUI(); 
            
            els.uploadStatus.textContent = "All questions answered. Server is processing STT. Press 'Finish' to review.";
            els.uploadStatus.style.color = "#10b981";
            
            if(mediaStream) mediaStream.getTracks().forEach(t => t.stop());
            els.video.style.background = "#000";

        } else {
            updateQuestionUI();
            updateMainActionButton('START_RECORDING'); 
            els.uploadStatus.textContent = "Saved and STT created. Ready for the next question.";
            els.uploadStatus.style.color = "#fff";
            isRecorded = false; 
        }

    } else {
        // Complete failure
        els.uploadStatus.textContent = `Upload Error: ${lastError}. Please retry manually or check your network.`;
        els.uploadStatus.style.color = "#ef4444";
        updateMainActionButton('UPLOAD_NEXT'); 
    }
}


// 3. Finish (Show video playback screen and transcripts)
els.finishBtn.addEventListener("click", async (e) => {
  e.preventDefault(); 
  els.finishBtn.disabled = true;
  els.finishBtn.textContent = "Processing...";

  try {
    await postJSON(API.finish, { 
      token: els.token.value, 
      folder: folder, 
      questionsCount: QUESTIONS.length 
    });
    
    els.interview.style.display = "none";
    const playbackSection = document.getElementById("playback-section");
    const videoGrid = document.getElementById("video-grid");
    const transcriptContainer = document.getElementById("transcript-container");
    playbackSection.style.display = "block";
    
    videoGrid.innerHTML = ''; 
    transcriptContainer.innerHTML = ''; 

    // Loop through all recorded data (video and transcript)
    allTranscripts.forEach(qData => {
      
      // --- Add Video ---
      const wrapper = document.createElement("div");
      wrapper.style.border = "1px solid #475569";
      wrapper.style.padding = "10px";
      wrapper.style.borderRadius = "10px";
      wrapper.style.background = "#0f172a";

      const title = document.createElement("p");
      title.textContent = `Question ${qData.index}: ${qData.question}`;
      title.style.fontWeight = "bold";
      title.style.color = "#fcd34d";
      title.style.margin = "0 0 10px 0";

      const vid = document.createElement("video");
      vid.src = `${BASE}/uploads/${folder}/Q${qData.index}.webm`;
      vid.controls = true; 
      vid.style.width = "100%";
      vid.style.borderRadius = "8px";

      wrapper.appendChild(title);
      wrapper.appendChild(vid);
      videoGrid.appendChild(wrapper);
      
      // --- Add Transcript ---
      const tDiv = document.createElement("div");
      tDiv.style.marginBottom = "20px";
      
      const tTitle = document.createElement("p");
      tTitle.innerHTML = `<strong>[Question ${qData.index}: ${qData.question}]</strong>`;
      tTitle.style.color = "#10b981";
      tDiv.appendChild(tTitle);
      
      const tContent = document.createElement("pre"); 
      tContent.textContent = qData.transcript;
      tContent.style.whiteSpace = "pre-wrap";
      tContent.style.wordBreak = "break-word";
      tContent.style.paddingLeft = "10px";
      tContent.style.borderLeft = "2px solid #fcd34d";
      tContent.style.fontSize = "0.9rem";
      
      tDiv.appendChild(tContent);
      transcriptContainer.appendChild(tDiv);
    });

    els.uploadStatus.textContent = "✅ Completed!";

  } catch (err) {
    console.error(err);
    els.uploadStatus.textContent = "Error: " + err.message;
    setTimeout(() => window.location.reload(), 5000);
  }
});