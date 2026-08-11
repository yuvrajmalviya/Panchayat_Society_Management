# Panchayat AI - AI-Powered Society Management Portal

Panchayat AI is a production-ready, feature-rich web application built to streamline operations, complaints, bylaws verification, and communications in housing societies and local village bodies (Panchayats). Using artificial intelligence, Panchayat AI offers automatic Voice-to-Ticket parsing, a PDF-based bylaws document retrieval (RAG) system with page citations, and chat-digest summaries of group conversations.

---

## 🏗️ Architecture & Tech Stack

### Frontend
- **Framework:** React.js (Vite)
- **UI/UX:** Material UI (MUI) & Custom HSL Theme Variables
- **Animations:** Framer Motion
- **Forms:** React Hook Form
- **Charts:** Chart.js & React-Chartjs-2
- **Routing & Networking:** React Router DOM & Axios

### Backend
- **Framework:** FastAPI (Python)
- **Security:** JWT Auth, Bcrypt Passwords, CORS, Role guards
- **Database:** MongoDB (via Motor Async Driver)
- **Vector DB:** FAISS (Facebook AI Similarity Search)
- **AI Pipelines:** 
  - **Whisper API / Fallbacks:** Speech-to-Text conversion for voice logs.
  - **LLM Builder:** Gemini structured ticket builder.
  - **RAG System:** Sentence Transformers + Custom Cosine Math fallbacks.
  - **Chat Digest:** Conversation summarization and task planning.
- **Reporting:** ReportLab PDF Generator

---

## 📂 Project Structure

```
Panchayat_Society_Management/
├── backend/
│   ├── auth/                 # JWT token decoding, role guard dependencies
│   ├── database/             # MongoDB Motor async engine connection
│   ├── models/               # Blank python model initializers
│   ├── routers/              # REST controllers (auth, users, complaints, ai, documents...)
│   ├── schemas/              # Pydantic schemas for request validation & serialization
│   ├── services/             # Core business engines (RAG search, Whisper, PDF chunker, Reports)
│   ├── utils/                # Compress images, file storage, ticket number sequence generator
│   ├── main.py               # Application entrypoint & CORS middlewares
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/       # UI (VoiceRecorder, FileUpload, NotificationBell, DashboardCard...)
│   │   ├── context/          # Auth Context, Light/Dark Theme Context
│   │   ├── layouts/          # AuthLayout, MainLayout (Sidebar & top Navbar)
│   │   ├── pages/            # Login, Register, Dashboard, Complaints, AIHub, Analytics...
│   │   ├── services/         # Axios global API instance
│   │   ├── App.jsx           # Routing configuration & dynamic MUI themes loader
│   │   ├── index.css         # Reset stylesheet & premium micro-animation classes
│   │   └── main.jsx          # React DOM mounting
│   ├── index.html            # Loads fonts (Inter/Outfit)
│   ├── package.json          # Node dependencies
│   └── vite.config.js        # Vite configurations
└── README.md                 # System Manual & Guides
```

---

## 🚀 Quick Start Guide

### 1. Database Setup
Ensure you have **MongoDB** installed and running on your system, or have a MongoDB Atlas connection string.
- Default local URI: `mongodb://localhost:27017`

### 2. Backend Installation
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```
3. Activate the environment:
   - **Windows (CMD/Powershell):**
     ```powershell
     .\venv\Scripts\activate
     ```
   - **macOS/Linux:**
     ```bash
     source venv/bin/activate
     ```
4. Install requirements:
   ```bash
   pip install -r requirements.txt
   ```
5. *(Optional)* Create a `.env` file in the root of the `backend/` folder:
   ```env
   MONGODB_URL=mongodb://localhost:27017
   DATABASE_NAME=panchayat_ai
   JWT_SECRET_KEY=generate_your_secure_secret_key_here
   GOOGLE_API_KEY=your-google-generative-ai-key-here
   ```
   > [!NOTE]
   > If no Gemini API key is provided, the backend automatically activates **offline fallbacks**: it runs keyword processing for voice transcribing, structures tickets with rule-based regex classifiers, and queries PDF bylaws using numpy cosine-similarity.

6. Launch the server:
   ```bash
   uvicorn main:app --reload
   ```
   The backend API will start on **`http://localhost:8000`**. Swagger UI docs will be available at **`http://localhost:8000/docs`**.

### 3. Frontend Installation
1. Open a new terminal in the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
   The frontend application will start on **`http://localhost:5173`**.

---

## 🤖 AI Core Features

### 🎙️ 1. Voice to Ticket
- **Concept:** Residents click the record microphone button and speak their complaint (e.g., "The main pipeline is leaking in Block B").
- **Pipeline:** Audio is recorded in-browser -> Transcribed via Whisper -> Analyzed by LLM -> Category, Title, and Priority are structured -> Saved to MongoDB database.

### 📚 2. Bylaws Chatbot (RAG)
- **Concept:** Admins upload society bylaws PDF. The system extracts text page-by-page, breaks them into overlapping chunks, computes semantic embeddings, and stores them.
- **Pipeline:** Residents query a rule -> System generates query embedding -> Runs cosine-similarity scans -> Formulates an answer based on retrieved rules -> Attaches clickable citations indicating the source document and page number (e.g., `Page 4 - Rules_2026.pdf`).

### 💬 3. Chat Digest
- **Concept:** Residents paste long WhatsApp or Telegram chat logs containing chaotic group discussions.
- **Pipeline:** AI reads the conversations, summaries the main topic, and extracts bullet points for:
  - Major decisions made.
  - Action items (tasks & owners).
  - Pinned announcements.
  - Due dates and deadlines.

---

## 👥 Role Workflows

### 🏡 Residents
1. Register. (If it's the first account registered in the system, the backend automatically approves and promotes it to **Admin** to allow initial setup).
2. Log in and configure your profile settings.
3. Track active tickets, view notice board feeds, and check maintenance dues from the dashboard.
4. Raise a complaint (attach geolocations, multiple photos, or record audio clips).
5. Open the **AI Operations Hub** to talk to the Bylaws Chatbot or digest WhatsApp discussions.

### ⚙️ Administrators
1. View executive summaries, resolution speeds, and category breakdown charts.
2. Approve, suspend, demote, or delete resident profiles.
3. CRUD Notices and pin urgent announcements to the top of the resident boards.
4. Broadcast notifications to all residents.
5. Manage complaints: reassign tickets to specific admins, advance resolution timeline logs, and write explanation comments.
6. Export and download professional PDF analytics reports.

---

## 🛡️ Security Details
- **Authentication:** HS256-hashed JWT token generation.
- **Passwords:** Secure hashing using `passlib` with `bcrypt`.
- **API Guarding:** Route dependencies that restrict access to unapproved and suspended profiles.
- **Files Validation:** Limit uploads to PDF (for documents) and image/audio files, validating size limits before parsing.
- **CORS:** Safe domain origins configuration.

---

## ☁️ Deployment Guide

### Backend: Render
1. Create a Web Service on Render linked to your repository.
2. Select **Python** runtime environment.
3. Configure the start command:
   ```bash
   uvicorn backend.main:app --host 0.0.0.0 --port $PORT
   ```
4. Define Environment Variables:
   - `MONGODB_URL`: Your MongoDB Atlas URI.
   - `AI_API_KEY`: Your Gemini secret key. Do not store secrets in source control.
   - `CUSTOM_SECURE_TOKEN`: Your custom secure string. Do not store secrets in source control.

### Database: MongoDB Atlas
1. Create a free shared cluster on MongoDB Atlas.
2. Whitelist IP access rules (allow `0.0.0.0/32` or Render server IP).
3. Create a Database User and copy the connection string.

### Frontend: Vercel
1. Import your frontend folder to Vercel.
2. Set the build command: `npm run build` and output directory: `dist`.
3. In `frontend/src/services/api.js`, update `API_BASE_URL` to point to your live Render backend service.
