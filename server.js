/* file: server.js (Complete English Version with STT and Limits) */
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path"); 
const multer = require("multer");
const moment = require("moment-timezone"); 
const { Buffer } = require('buffer');

const app = express();
const PORT = 3000;

// ====== GEMINI AI CONFIG (API KEY UPDATED HERE) ======
const GEMINI_API_KEY = "AIzaSyDsPkE8-R_HzYcz328zf0UFwk_1TlIaAVA"; 
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
// =================================================

// ====== DIRECTORY & LOGS SETUP ======
const uploadsRoot = path.join(__dirname, "uploads");
const logsRoot = path.join(__dirname, "logs"); 
const frontendRoot = __dirname; 

app.use(cors());
app.use(express.json());
app.use(express.static(frontendRoot));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

if (!fs.existsSync(uploadsRoot)) fs.mkdirSync(uploadsRoot, { recursive: true });
if (!fs.existsSync(logsRoot)) fs.mkdirSync(logsRoot, { recursive: true }); 

// --- CONFIG & HELPER: Log using Asia/Bangkok timezone ---
const TIMEZONE = "Asia/Bangkok";
const getTimestamp = () => moment().tz(TIMEZONE);

function logServer(type, message, folder = "") {
  const logTime = getTimestamp().toISOString(); 
  const logEntry = `${logTime} [${type.toUpperCase()}] ${folder ? `(${folder}) ` : ""}${message}\n`;
  fs.appendFileSync(path.join(logsRoot, "sessions.log"), logEntry, "utf8");
}
// --- END HELPER ---

// --- NEW FUNCTION: Speech-to-Text Processing using Gemini (AI PART) ---
async function generateTranscript(filePath, question) {
    if (!GEMINI_API_KEY) {
        return "Gemini AI API Key is missing. Cannot generate transcript.";
    }

    try {
        const videoBuffer = fs.readFileSync(filePath);
        const base64Data = videoBuffer.toString('base64');

        const systemInstruction = `You are an accurate Speech-to-Text (STT) system specializing in transcribing interviews. Extract the full spoken content from the video below. Return only the converted text.`;
        const userPrompt = `The interview question is: "${question}". Transcribe the answer content in the video.`;
        
        const payload = {
            contents: [{
                parts: [
                    { text: userPrompt },
                    {
                        inlineData: {
                            mimeType: "video/webm",
                            data: base64Data
                        }
                    }
                ]
            }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
        };

        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.error) {
            // Log specific error message from the API
            logServer("error", `Gemini API Error: ${result.error.message}`);
            throw new Error(result.error.message || "Unknown API error.");
        }
        
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "Could not generate transcript. API error or unclear content.";

        return text;
    } catch (error) {
        logServer("error", `Error calling Gemini API: ${error.message}`);
        // This is the error message that appears in the transcript on screen
        return `Internal error calling AI: ${error.message}`; 
    }
}
// --- END AI FUNCTION ---


app.get("/", (req, res) => {
  const indexPath = path.join(frontendRoot, "index.html");
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.send("<h1>index.html file is missing</h1>");
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/verify-token", (req, res) => {
  const token = req.body.token;
  logServer("info", `Verifying token: ${token}`);
  if (token === "12345") return res.status(200).json({ ok: true });
  logServer("warn", `Invalid token: ${token}`);
  return res.status(401).json({ ok: false, message: "Invalid Token" });
});

app.post("/api/session/start", (req, res) => {
  const { token, userName } = req.body;
  
  if (!userName || !token) {
    logServer("error", "Missing token or userName when starting session");
    return res.status(400).json({ ok: false, message: "Missing Token or Name" });
  }

  try {
    const now = getTimestamp();
    const dateStr = now.format("DD_MM_YYYY_HH_mm");
    
    // Sanitize and limit name (max 30 characters)
    const safeName = (userName).replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const limitedSafeName = safeName.substring(0, 30);
    
    const folderName = `${dateStr}_${limitedSafeName}`;
    const folderPath = path.join(uploadsRoot, folderName);

    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    // Create metadata.json
    const metadata = {
      userName: userName,
      startAt: now.toISOString(), 
      timeZone: TIMEZONE,
      questions: [],
    };
    fs.writeFileSync(path.join(folderPath, "meta.json"), JSON.stringify(metadata, null, 2));

    logServer("info", `Session started for ${userName}. Folder: ${folderName}`, folderName);
    return res.status(200).json({ ok: true, folder: folderName });
  } catch (err) {
    logServer("error", `Error starting session: ${err.message}`);
    return res.status(500).json({ ok: false, message: "Server error when creating session" });
  }
});

// Multer configuration with file limits and MIME Type filter
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const folder = req.body.folder;
      const savePath = path.join(uploadsRoot, folder || "");
      if (!fs.existsSync(savePath)) fs.mkdirSync(savePath, { recursive: true });
      cb(null, savePath);
    },
    filename: (req, file, cb) => cb(null, `Q${req.body.questionIndex || 0}.webm`)
  }),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB Max file size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "video/webm") {
      cb(null, true);
    } else {
      cb(null, false);
      req.fileValidationError = `File type rejected: ${file.mimetype}. Only video/webm format is accepted.`;
    }
  }
});

app.post("/api/upload-one", (req, res) => {
    upload.single("video")(req, res, async (err) => {
        
        if (err instanceof multer.MulterError) {
            logServer("error", `Multer Error (${req.body.folder}): ${err.message}`);
            return res.status(400).json({ ok: false, message: `Upload Error: File size exceeds limit (50MB).` });
        } 
        
        if (req.fileValidationError) {
            logServer("error", `File Validation Error (${req.body.folder}): ${req.fileValidationError}`);
            return res.status(415).json({ ok: false, message: req.fileValidationError });
        }
        
        if (err) {
            logServer("error", `Upload General Error (${req.body.folder}): ${err.message}`);
            return res.status(500).json({ ok: false, message: "Server error processing file." });
        }

        const { folder, questionIndex, questionText } = req.body; 
        const fileName = req.file ? req.file.filename : "Error";
        const filePath = req.file ? path.join(uploadsRoot, folder, fileName) : "Error";
        
        if (!req.file || !folder || !questionIndex || !questionText) {
            logServer("error", `Missing field or file during upload. Folder: ${folder}`, folder);
            return res.status(400).json({ ok: false, message: "Missing file or upload information" });
        }

        try {
            // 1. Update Metadata
            const metaPath = path.join(uploadsRoot, folder, "meta.json");
            const metadata = JSON.parse(fs.readFileSync(metaPath, "utf8"));

            const newQuestion = {
                index: parseInt(questionIndex),
                fileName: fileName,
                question: questionText,
                uploadedAt: getTimestamp().toISOString(),
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                transcriptFile: `transcript_Q${questionIndex}.txt`
            };
            
            metadata.questions = metadata.questions.filter(q => q.index !== newQuestion.index);
            metadata.questions.push(newQuestion);
            metadata.questions.sort((a, b) => a.index - b.index);

            // 2. Speech-to-Text (STT)
            const transcript = await generateTranscript(filePath, questionText);
            const transcriptFilePath = path.join(uploadsRoot, folder, newQuestion.transcriptFile);
            
            const transcriptContent = 
                `[Question ${questionIndex}: ${questionText}]\n` + 
                `--- Automatic Transcript (STT) ---\n` +
                `${transcript}\n`;
                
            fs.writeFileSync(transcriptFilePath, transcriptContent, "utf8");
            logServer("info", `Transcript created: ${newQuestion.transcriptFile}`, folder);

            // 3. Save updated Metadata and return transcript
            fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));

            logServer("success", `Q${questionIndex} and STT saved successfully.`, folder);
            return res.status(200).json({ 
                ok: true, 
                savedAs: fileName,
                transcript: transcript // Return the transcript content
            });
            
        } catch (err) {
            // Catch error during STT/Metadata processing
            logServer("error", `Error processing metadata/STT: ${err.message}`, folder);
            // Check if the error came from the Gemini API call inside generateTranscript
            if (err.message.includes("API")) {
                return res.status(500).json({ ok: false, message: `STT Error: ${err.message}` });
            }
            return res.status(500).json({ ok: false, message: "Server error processing STT/metadata" });
        }
    });
});

app.post("/api/session/finish", (req, res) => {
  const { folder, questionsCount } = req.body;
  logServer("info", `Session finished. Total questions: ${questionsCount}`, folder);

  try {
    const metaPath = path.join(uploadsRoot, folder, "meta.json");
    const metadata = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    metadata.finishAt = getTimestamp().toISOString();
    metadata.questionsCount = questionsCount;
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
  } catch (err) {
    logServer("warn", `Could not update metadata finishAt: ${err.message}`, folder);
  }

  return res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`SERVER RUNNING AT: http://localhost:${PORT}`);
  console.log(`📂 Videos will be saved in: ${uploadsRoot}`);
  console.log(`📝 Logs will be saved in: ${logsRoot}/sessions.log`);
});
