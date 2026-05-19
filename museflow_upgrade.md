# MuseFlow v2.0 — Integration Walkthrough

## What Was Built (All 5 Parts)

---

## Architecture Overview

```mermaid
flowchart TD
    A[POST /api/orchestrate] --> B[CascadeFlowOrchestrator]

    B --> C[Step 0: Hindsight Recall\nrecall + reflect]
    C --> D[Step 1: EmotionAgent\nllama-3.1-8b]
    D --> E[Step 2: MemoryAgent\nllama-3.1-8b]
    E --> F{Critic–Refinement Loop}

    F --> G[Step 3: LyricsAgent\nllama-3.3-70b]
    G --> H[Step 4: CompositionAgent\nllama-3.1-8b]
    H --> I[Step 5: ProducerAgent\nllama-3.3-70b]
    I --> J[Step 6: MusicGenerationAgent\nLoudly API]
    J --> K[Step 7: CriticAgent\nllama-3.3-70b]

    K -->|pass=false, retries left| F
    K -->|pass=true| L[Step 8: Hindsight Retain\nmemory evolution]
    K -->|retries exhausted| M[Escalation Handler\nlogged + bypassed]
    M --> L

    L --> N[FinalCreativePackage\n+ OrchestrationTrace]
    N --> O[/artifacts/orchestrator/\ntrace_wf-*.json]
```

---

## Part 1 — CascadeFlow Integration

### What changed
- `src/orchestrator/cascadeflow.ts` fully rewritten
- `CascadeAgent` instantiated with two Groq model tiers
- Every agent step runs through `routedStep()` — a wrapper that fires a **routing probe** to CascadeAgent, records which model tier it selects, and logs it to the execution trace
- `ExecutionContext` factory (`createExecutionContext`) gives every workflow a live-writing audit trail

### CascadeAgent model tiers
| Tier | Model | Used for |
|---|---|---|
| Drafter | `llama-3.1-8b-instant` | Emotion, Memory, Composition (structured JSON) |
| Verifier | `llama-3.3-70b-versatile` | Lyrics, Producer, Critic (creative + judgment) |

### What's visible in every trace
```json
{
  "workflowId": "wf-1716110400000",
  "userId": "demo-user",
  "status": "SUCCESS",
  "totalLatency": 34200,
  "retriesCount": 1,
  "cascadeMetrics": {
    "modelsUsed": ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"],
    "escalations": 0
  },
  "steps": [
    { "step": "Hindsight Recall",   "state": "SUCCESS", "latency": 120  },
    { "step": "Emotion Analysis",   "state": "SUCCESS", "latency": 890  },
    { "step": "Lyrics Generation",  "state": "RETRYING","retries": 1    },
    { "step": "Critic Evaluation",  "state": "SUCCESS"                  },
    { "step": "Escalation Handler", "state": "ESCALATED"               },
    { "step": "Hindsight Retain",   "state": "SUCCESS"                  }
  ]
}
```

---

## Part 2 — Hindsight Memory Integration

### Files changed
- `src/memory/hindsight.ts` — full rewrite using `@vectorize-io/hindsight-client`

### Three operations

| Operation | When | What it does |
|---|---|---|
| **recall** | Step 0 (before any agent runs) | Retrieves most relevant past memories using semantic + graph search |
| **reflect** | Step 0 (parallel with recall) | Reasons over all memories → synthesized profile sentence |
| **retain** | Step 8 (after critic loop) | Stores structured observation; Hindsight auto-extracts entities |

### Synthesized profiles (what Hindsight reflect returns)
> "User consistently gravitates toward introspective synthwave, preferring atmospheric female vocals at 80–95 BPM. Lyrical themes center on nostalgia and late-night city solitude. Approved productions favor layered analog textures."

This profile is injected into `enrichedRequest.memory` and flows into every downstream agent prompt.

### Fallback behavior
If `HINDSIGHT_API_KEY` is not set, all operations fall back to the local JSON store at:
```
artifacts/memory/{userId}.json
```

### Memory endpoints
```
GET  /api/memory/:userId           → current profile
POST /api/memory/:userId           → manual update
POST /api/memory/:userId/reflect   → trigger synthesized reflection
POST /api/memory/:userId/retain    → manual observation ingestion
```

---

## Part 3 — Loudly Music Generation

### New files
- `src/services/loudly.ts` — `LoudlyService` class
- `src/agents/musicGenerationAgent.ts` — rewritten to use `LoudlyService`

### Flow
```
EmotionContext + CompositionContext + ProducerContext
  → LLM (llama-3.1-8b): engineer structured LoudlyCompositionInput JSON
  → LoudlyService.generateMusic(input)
      → POST https://soundtracks.loudly.com/api/generate
      → poll /api/generate/{jobId} every 5s (max 3 min)
      → return LoudlyResult { primaryUrl, allVariations, jobId, pollingMs }
```

### Payload structure
```json
{
  "genre":       "synthwave",
  "tempo":       84,
  "energy":      4,
  "duration":    30,
  "key":         "A Minor",
  "mood":        "nostalgic melancholy",
  "structure":   "Intro-Verse-Chorus-Outro",
  "instruments": ["analog Juno synth", "vintage piano", "drum machine", "rain ambience"],
  "prompt":      "A slow melancholic midnight synthwave journey through neon-lit streets."
}
```

### Fallback
If `LOUDLY_API_KEY` is not set, `apiUsed: "MUSEFLOW_SIMULATED"` and a genre-matched demo audio URL is returned. The system never crashes.

---

## Part 4 — Industry-Level Execution Context

### `ExecutionContext` object (created per workflow)
```typescript
interface ExecutionContext {
  workflowId: string;
  userId: string;
  startTime: number;
  trace: OrchestrationTrace;
  addStep(stepName, agent, state, model, output?, latency?, retries?, escalation?): void;
  fail(error): void;
  succeed(): void;
}
```

Every `addStep()` call:
1. Appends to `trace.steps[]`
2. Persists `artifacts/orchestrator/trace_wf-*.json` immediately
3. Emits a structured log via `logExecution()`

### Agent response shape (all agents)
```typescript
{
  output: { /* agent-specific */ },
  metadata: {
    agent:     "LyricsAgent",
    model:     "llama-3.3-70b-versatile",
    latency:   2340,
    retries:   0,
    timestamp: "2026-05-19T...",
    status:    "SUCCESS"
  }
}
```

### Telemetry endpoint
```
GET /api/telemetry
```
Returns aggregate stats across all sessions: success rate, avg latency, total retries, escalations.

---

## Part 5 — Demo Presentation Points

### 1. Start server
```bash
npm run dev
```
Banner confirms which integrations are live vs. simulated.

### 2. Fire an orchestration
```bash
curl -X POST http://localhost:3001/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"direction": "A midnight drive through an empty city, chasing a memory that refuses to fade.", "userId": "demo-user"}'
```

**Response shows:**
- Generated title + full lyrics
- `bpm`, `key`, `instrumentPalette`, `vocalStyle`
- `loudlyPrompt` — what was sent to Loudly
- `generatedAudioUrl` — embeddable mp3
- `allVariations` — multiple Loudly tracks
- Full `trace` with every step's agent, model, latency, retries

### 3. Show memory evolution
```bash
# After 2–3 orchestrations:
curl http://localhost:3001/api/memory/demo-user
curl -X POST http://localhost:3001/api/memory/demo-user/reflect
```

Response demonstrates Hindsight synthesizing a musical personality profile.

### 4. Show telemetry
```bash
curl http://localhost:3001/api/telemetry
```

### 5. Show escalation in action
The critic loop (max 2 refinement passes) is visible in the trace. If `pass: false` after 2 passes, `ESCALATED` appears as an explicit step in the trace.

### 6. Inspect execution artifacts
```
artifacts/orchestrator/trace_wf-*.json   ← per-session audit trail
artifacts/final_package/package_wf-*.json ← creative output
artifacts/memory/{userId}.json           ← evolved user memory
```

---

## Environment Variables

```env
GROQ_API_KEY=...          # Required — all LLM agents
HINDSIGHT_API_KEY=...     # Optional — falls back to local JSON
HINDSIGHT_BASE_URL=...    # Default: https://api.hindsight.vectorize.io/v1
LOUDLY_API_KEY=...        # Optional — falls back to simulated audio
PORT=3001
```

> [!IMPORTANT]
> All three integrations have graceful fallbacks. The system runs fully in demo mode with only `GROQ_API_KEY`.

> [!TIP]
> Add your `LOUDLY_API_KEY` to `.env` (it exists in your account) to enable real AI music generation instead of the demo audio URLs.

---

## File Change Summary

| File | Status | What changed |
|---|---|---|
| `src/memory/hindsight.ts` | **Rewritten** | Real Hindsight SDK: retain/recall/reflect + local fallback |
| `src/services/loudly.ts` | **New** | Loudly API service with polling + retry |
| `src/agents/musicGenerationAgent.ts` | **Rewritten** | Uses LoudlyService instead of Replicate |
| `src/orchestrator/cascadeflow.ts` | **Rewritten** | CascadeAgent routing, ExecutionContext, 8-step workflow, real-time `onEvent` streaming support |
| `src/types/index.ts` | **Expanded** | ExecutionContext, StepTrace, MuseMemory, Loudly fields |
| `src/index.ts` | **Expanded** | New memory routes, telemetry endpoint, startup banner, and real-time Server-Sent Events `/api/orchestrate/stream` endpoint |
| `src/agents/memoryAgent.ts` | **Fixed** | Aligned to new MuseMemory field names |
| `.env.example` | **Updated** | Hindsight + Loudly keys documented |
| `museflow-frontend/src/pages/StudioWorkspace.jsx` | **Rewritten** | Cyberpunk AI Orchestration Console with real-time logs, agent nodes dashboard, and music player player |

---

## Part 6 — Real-Time Streaming AI Orchestration

To eliminate the static load times (30–40 seconds) during multi-agent music synthesis, a real-time event streaming interface has been built:

1. **Server-Sent Events (SSE) Endpoint**: 
   * `POST /api/orchestrate/stream` streams JSON packets in the native `text/event-stream` format.
   * `runWorkflow` accept an `onEvent` callback, emitting status notifications as agents execute.
2. **Dynamic UI Grid**:
   * Displays all 11 agents. The cards light up (`idle` ➔ `RUNNING` ➔ `SUCCESS`/`RETRYING`) using Framer Motion animations.
3. **Live Telemetry Terminal**:
   * A scrolling command-line interface logs precise latency, model selections (e.g. `llama-3.1-8b` routing), and Critic Agent scores.
4. **Permanent Library Persistence**:
   * Completed songs are saved automatically to the database (`user_songs.json`), instantly visible in user playlists and song catalogs.
