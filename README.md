Web Interview Recorder – HanTie Project
1️. Project Overview
HanTie is a client-server web application for structured, sequential video interviews.
Core Feature: Per-Question Upload ensures reliability and data integrity for each recorded answer.
Technical Stack:
Backend: Node.js (v18+) + Express.js
Frontend: HTML5, CSS, JavaScript
Protocol: HTTP for localhost; HTTPS required for public deployment
Key Concepts Demonstrated: Client-Server communication, MediaStream handling, server-side file processing

2️. File Structure
HanTie/
├─ .github/workflows/    # GitHub Actions workflows
├─ logs/                 # Server logs
├─ node_modules/         # Dependencies
├─ uploads/              # Recorded video & transcripts
├─ index.html            # Frontend UI
├─ app.js                # Frontend JS logic
├─ server.js             # Node.js server
├─ package.json
├─ package-lock.json
└─ README.md

Server Storage Example (Session Folder):
uploads/DD_MM_YYYY_HH_mm_username_safe/
├─ Q1.webm
├─ transcript_Q1.txt
├─ Q2.webm
├─ transcript_Q2.txt
└─ meta.json

3️. API Contract
Endpoint	        Method	 Description
/api/verify-token	POST	Validate access token
/api/session/start	POST	Initialize session, verify token, create upload folder
/api/upload-one	    POST (Multipart)	Save video, process STT, update metadata per question
/api/session/finish	POST	Finalize session data

Session Flow:
Start → validate token, create folder
Interview Loop → record → upload → STT → update metadata → next question
Finish → finalize session data

4️. Reliability and Data Integrity
Per-Question Upload: Client cannot proceed until current upload succeeds
Retry with Exponential Backoff: Max 3 retries, delay 2^n × 1 second
File Validation:
Max size: 50MB
MIME type: video/webm
User names sanitized and truncated

5️. Speech-to-Text (STT)
Engine: Gemini 2.5 Flash API
Trigger: Automatically after /api/upload-one saves video
Output: Per-question transcript stored locally (transcript_Q[questionIndex].txt) and returned in JSON for frontend review

6️. Branch Structure
main
 ├─ V1-prototype        # Initial Vosk-based STT module (70MB, replaced)
 └─ final-gemini        # Final Gemini-based implementation

7️. Run Instructions
7.1 Installation
Ensure you have Node.js (v18+) installed on your system.
Navigate to the root directory of the project in your terminal and run the following command to install required dependencies: npm install

7.2 Configuration
Before starting the server, you must configure the Gemini API Key in the backend for the Speech-to-Text feature.
Method 1 (Best Practice): Set the GEMINI_API_KEY as an environment variable in your system or in a local .env file.
Method 2 (Directly in code): Edit the server.js file and replace the placeholder value for GEMINI_API_KEY.

7.3 Execution
Start Server: Run the backend server using Node.js: node server.js
Access Application: Open index.html in your web browser (via http://localhost:3000/ if accessed directly, or by simply opening the file in your browser).

8️. Team Contributions
Member	            Student ID	Contribution	      Role
Nguyen Viet Tien	11247233	33.34%	       Backend, reliability, storage & metadata
Pham Thu Ha	        11247164	33.33%	       Frontend, initial STT (Vosk), API integration
Hoang Thanh Nhan	11247212	33.33%	       Frontend UI, retry/backoff, testing

9️. Future Work
FFmpeg integration for multiple video formats
One-time re-record per question
Enhanced client-side logging

🔗 References
NEU Project Brief: Web Interview Recorder, 2025
Network & Communication Technology Course Material
Gemini 2.5 Flash API Documentation
Node.js, Express.js, Multer Middleware Documentation
