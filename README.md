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

### 3. Atmospheric Vocal Layering Pipeline
Synthesizes and mixes convincing, moody ambient vocals into the instrumental music:
* **Vocal Styling Agent**: Creative direction agent that designs specific effects chains (reverb size, delay type, chorus) and extracts high-impact phrase fragments (hooks) from the lyrics.
* **Vocal Generation**: Combines the styling instructions with Hugging Face Suno Bark (using `♪` markers to trigger singing) or ElevenLabs, falling back to clean local speech assets with natural pause tokens (`. ... `).
* **Complex FFmpeg Mixing**: Runs a multi-stage DSP chain including Haas stereo widening (25ms delay offset), bandpass filters (250Hz to 3.5kHz), chorus modulation, staggered multi-tap echos, and sidechain compression vocal ducking.

### 4. Image Generation (Album Cover Art)
Generates high-resolution album cover art corresponding to the style, genre, and atmosphere of the session:
* **FLUX.1-schnell**: Generates covers via the Hugging Face serverless API.
* **Pollinations.ai Fallback**: Provides a lightning-fast, keyless, and free fallback if Hugging Face tokens are not configured.

### 5. Telemetry & Observability
Every session writes a detailed, JSON-serialized execution trace containing:
* Precise latency metrics per step.
* Model selection and confidence metadata.
* Retries and escalation triggers.
* Aggregate stats (success rates, average latency, total executions) served via `/api/telemetry`.

---

## 📐 System Architecture

```mermaid
flowchart TD
    A[POST /api/orchestrate] --> B[CascadeFlowOrchestrator]
    
    subgraph Memory Context
        B --> C[Hindsight Recall & Reflect]
    end
    
    subgraph Orchestration Steps (CascadeFlow)
        C --> D[1. Emotion Analysis]
        D --> E[2. Memory Synthesis]
        E --> F[3. Lyrics Generation]
        F --> G[4. Composition Planning]
        G --> H[5. Producer Guidance]
        H --> I[5.5. Vocal Styling]
        I --> J[6. Music Generation - Loudly]
        J --> K[6.5. Vocal Gen & FX Mix - FFmpeg]
    end
    
    subgraph Critic, Retain & Art Loop
        K --> L[7. Critic Evaluation]
        L -->|Score < Threshold & Retries Left| F
        L -->|Passed / Exhausted| M[8. Hindsight Retain]
        M --> N[9. Album Art Generation]
    end
    
    N --> O[Final Creative Package + Audit Trace]
```

---

## 🚀 Quick Start

### 1. Installation
Install project dependencies:
```bash
npm install
```

### 2. Configuration
Create a `.env` file in the root directory (using `.env.example` as a template):
```env
GROQ_API_KEY=gsk_...
HINDSIGHT_API_KEY=hsk_...
LOUDLY_API_KEY=your_loudly_key
HF_TOKEN=your_huggingface_token
PORT=3001
```

### 3. Run the Server
Start the development server with live watch support:
```bash
npm run dev
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| **POST** | `/api/orchestrate` | Generate a complete song, album cover, and execution trace |
| **GET** | `/api/history` | List all historical execution logs |
| **GET** | `/api/telemetry` | Retrieve performance metrics and success rates |
| **GET** | `/api/memory/:userId` | Get current memory data for a user |
| **POST** | `/api/memory/:userId/reflect` | Manually trigger Hindsight reflection and profiles |
| **POST** | `/api/memory/:userId/retain` | Manually save a new musical observation |
| **GET** | `/health` | Server status and integration health check |

---

## 🔮 Future Roadmap

1. **Multi-Track Stem Mixing**: Support splitting backing tracks and mixing individual vocal harmonies.
2. **Interactive UI Studio**: A React/Next.js workspace frontend with live wave visualization, memory editing, and manual trace inspection.
3. **Adaptive Lyric Rewrites**: Allow users to edit lyrics and trigger local vocal synthesis without regenerating the whole instrumental backing.
