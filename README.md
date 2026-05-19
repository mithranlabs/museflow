# 🎵 MuseFlow AI Orchestration Platform (v2.0)

MuseFlow is a production-grade, memory-driven multi-agent orchestration studio that generates emotionally personalized, custom-produced musical packages. By combining modular AI agents, semantic persistent memory, and live music synthesis APIs, MuseFlow delivers an end-to-end creative pipeline.

---

## 🛠️ Key Features

### 1. Adaptive Multi-Agent Orchestration (CascadeFlow)
Powered by `@cascadeflow/core`, MuseFlow runs a multi-tier runtime that routes specialized tasks to the most cost-effective and capable models:
* **Drafter Tier (`llama-3.1-8b-instant`)**: Performs quick structured tasks (emotion classification, preference retrieval, composition settings, and music parameter engineering).
* **Verifier Tier (`llama-3.3-70b-versatile`)**: Performs complex cognitive and creative tasks (creative lyrics writing, production mastering guidelines, and quality assurance critique).
* **Critic-Refinement Loop**: The orchestrator evaluates the output using a reflection critic. If the score is below the threshold, it triggers a structured refinement loop (up to 2 passes) before executing an escalation bypass.

### 2. Semantic Persistent Memory (Hindsight SDK)
Utilizing `@vectorize-io/hindsight-client`, MuseFlow features deep, session-transcending personalization:
* **Recall & Reflect**: Before generating, it queries the user's semantic memory graph to recall past interactions and synthesizes a high-level briefing of the user's musical personality.
* **Retain**: After a song is successfully completed, the final metadata, user feedback, and composition settings are written back to the memory graph.
* **Local JSON Fallback**: If no API key is present, it transparently falls back to file-based persistent memory under the `/artifacts/memory/` directory.

### 3. Real-Time Telemetry & SSE Event Streaming
* **Server-Sent Events (SSE)**: Streams progressive orchestration steps, latency updates, and active agent statuses directly from the backend to the UI.
* **Interactive Logs Console**: View live trace files, token speed, and agent actions in real time as the creative brain thinks.

---

## 🚀 Quick Start & Installation

### 1. Clone the Repository
```bash
git clone https://github.com/mithranlabs/museflow.git
cd museflow
```

### 2. Backend Setup
Install root dependencies and configure environment:
```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```
Open `.env` and fill in your keys:
```env
PORT=3001
GROQ_API_KEY=gsk_...
HINDSIGHT_API_KEY=hsk_... # Optional fallback to local JSON
LOUDLY_API_KEY=your_key  # Optional fallback to simulated audio
HF_TOKEN=hf_...          # Optional fallback to pollinations
```

### 3. Frontend Setup
Navigate to the frontend React folder and install dependencies:
```bash
cd museflow-frontend
npm install
```
*(Optional)* Create a `.env` file in the `museflow-frontend` directory if you want to override the default API base URL:
```env
VITE_API_BASE_URL=http://localhost:3001/api
```

---

## 📡 Running the Platform

To run the application, start both the backend server and frontend development client in parallel:

### Start Backend Orchestration Server
In the root directory:
```bash
npm run dev
```
The server starts on `http://localhost:3001` and watches for backend changes.

### Start Frontend Client
In a separate terminal, navigate to the `museflow-frontend` directory:
```bash
npm run dev
```
The client starts on `http://localhost:5173`. Open `http://localhost:5173/studio` in your browser.

---

## 📐 System API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| **POST** | `/api/orchestrate/stream` | Stream progressive multi-agent orchestration events using SSE |
| **POST** | `/api/orchestrate` | Generate a complete song, album cover, and execution trace synchronously |
| **GET** | `/api/history` | List all historical execution logs |
| **GET** | `/api/telemetry` | Retrieve performance metrics and success rates |
| **GET** | `/api/user/songs` | Fetch saved songs library |
| **POST** | `/api/user/songs/save` | Add a generated song package to library |
| **GET** | `/api/memory/:userId` | Get current memory data for a user |
| **POST** | `/api/memory/:userId/reflect` | Manually trigger Hindsight reflection |
| **GET** | `/health` | Server status and integration health check |
