# Learning Yogi Timetable System

A robust, intelligent timetable extraction system designed for the Learning Yogi technical assessment. This application transforms typical teacher timetables (images, PDFs, documents) into structured digital schedules using advanced **Vision LLMs**.

## 🌟 Key Features

### 🧠 Intelligent Extraction

- **Multimodal Vision Support**: Uses **Gemini 1.5 Pro** or **GPT-4o** to "see" timetable images directly. This solves the problem of handwritten notes, color-coded blocks, and complex grid layouts that traditional OCR fails on.
- **Hybrid Pipeline**:
  - **Images**: Direct Vision API processing for maximum accuracy.
  - **Documents (PDF/DOCX)**: Text extraction + Contextual LLM parsing.
- **Schema Enforcement**: Guarantees valid JSON output for the frontend.

### 🎨 Modern UI

- **Glassmorphism Design**: sleek, responsive interface.
- **Dynamic Visualization**: Color-coded timeblocks generated from event names.
- **Real-time Processing**: Visual feedback during AI analysis.

### ⚙️ Backend

- **Node.js & Express**: Scalable, non-blocking architecture.
- **MySQL**: Relational storage for teachers and timetables.
- **Extensible**: Adapter-based LLM service (easy to add Claude, Llama, etc.).

## 🚀 Quick Start

### Prerequisites

- Node.js (v16+)
- MySQL
- **API Key**: Gemini (Recommended for free tier) or OpenAI.

### Installation

1. **Clone and Install**

   ```bash
   git clone https://github.com/rohit-sws/assignment.git
   cd assignment
   npm install
   ```

2. **Database Setup**

   ```bash
   # Create database and tables
   npm run db:init
   ```

3. **Environment Setup**
   Copy `.env.example` to `.env` and add your keys:

   ```bash
   cp .env.example .env
   # Edit .env with your DB credentials and API keys
   ```

4. **Run Server**
   ```bash
   npm run dev
   ```
   Access the web UI at `http://localhost:3000`.

## 📚 Documentation

- [System Architecture & Design Decisions](docs/architecture/system-architecture.md)
- [API Documentation](docs/API_DOCUMENTATION.md)

## 🏗️ Design Decisions

- **Why Vision LLM?**: We prioritized robustness. A teacher's timetable is often a photo of a whiteboard or a colorful excel screenshot. Text-only OCR is insufficient. Vision models understand spatial relationships and visual cues.
- **MySQL over MongoDB**: Timetables are structured data heavily tied to Teachers. Relational integrity matters here.
- **Vanilla Frontend**: Kept the build simple for this prototype to demonstrate core HTML/CSS mastery without framework overhead, though the architecture is ready for a React/Vue frontend.
