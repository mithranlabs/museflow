# MuseFlow System Architecture

This document describes the design, data flows, and technical abstractions powering the MuseFlow AI Orchestration Platform.

---

## 1. System Overview

MuseFlow is a memory-driven, multi-agent creative orchestration engine. The system coordinates specialization agents to perform emotion extraction, thematic lyrics writing, parameters synthesis, audio generation, and quality evaluation in a feedback loop.

```
                    ┌────────────────────────┐
                    │  React Studio Console  │
                    └───────────┬────────────┘
                                │ POST /stream
                                ▼
                   ┌──────────────────────────┐
                   │  CascadeFlow Orchestrator │
                   └────────────┬─────────────┘
                                │
        ┌───────────────────────┼────────────────────────┐
        ▼                       ▼                        ▼
┌──────────────┐        ┌──────────────┐         ┌──────────────┐
│  Hindsight   │        │ Specialized  │         │  Loudly &    │
│  Memory SDK  │        │  Groq LLMs   │         │  Vocal DSP   │
└──────────────┘        └──────────────┘         └──────────────┘
```

---

## 2. Multi-Agent System Design

Every workflow execution uses the following specialised agents:

| Agent | Tier | Role | Outputs |
|---|---|---|---|
| **Hindsight Memory** | Local / Cloud | Recalls past interactions and reflects on preferences. | Personalization profile text |
| **EmotionAgent** | Drafter | Classifies the emotional coordinate, energy, and music genre from user input. | Emotion, energy, genre |
| **MemoryAgent** | Drafter | Synthesizes current user preferences and combines it with prompt context. | Consolidated context |
| **LyricsAgent** | Verifier | Writes structured song lyrics including chorus, verses, and bridge sections. | Song title, lyrics lines |
| **CompositionAgent** | Drafter | Synthesizes BPM, musical key, instrument palette, and vocal density. | BPM, key, instruments list |
| **ProducerAgent** | Verifier | Instructs structure, mastering settings, and vocal entry delays. | Mastering/arranging plan |
| **VocalStylingAgent**| Drafter | Selects vocal effects (reverb size, delay type, chorus) and hooks. | FX chain configuration |
| **MusicGenerationAgent**| Drafter | Generates a parametric Loudly Composition API payload. | Backing track MP3 URL |
| **VocalService** | DSP | Renders backing vocal speech segments and hooks. | Vocal WAV file |
| **AudioMixer** | DSP | Merges vocal WAV and instrumental MP3 using FFmpeg DSP. | Mixed stereo master MP3 |
| **CriticAgent** | Verifier | Evaluates lyrical cohesion, composition consistency, and mixes. | Pass/fail status, feedback |

---

## 3. CascadeFlow Orchestration Runtime

The orchestration engine runs on top of `@cascadeflow/core`.

### A. Model Tier Routing
To minimize token costs and maximize latency efficiency, cognitive tasks are split into two model tiers:
* **Drafter Tier (`llama-3.1-8b-instant`)**: Used for structured JSON extractions (such as genre mapping or BPM determination) where speed is prioritized.
* **Verifier Tier (`llama-3.3-70b-versatile`)**: Used for creative, nuanced, and critical tasks (such as lyric writing and critiquing) where reasoning depth is required.

### B. The Critic-Refinement Loop
Every session can execute up to **2 refinement passes**:
1. After the Audio master mix is completed, `CriticAgent` evaluates the package against thresholds.
2. If `pass` is `false`, a retry is triggered, and `CriticAgent`'s feedback is injected as guidance into the next lyrics/composition step.
3. If the refinement fails twice, the orchestrator triggers an **escalation bypass**, logging the anomaly and serving the best-effort output to prevent deadlocks.

---

## 4. Hindsight Memory Personalization

Personalization is powered by `@vectorize-io/hindsight-client`:

```mermaid
flowchart LR
    A[Start Session] --> B[recall & reflect]
    B --> C[Inject profile in prompt]
    C --> D[Generate Master Mix]
    D --> E[retain observation]
    E --> F[Update memory graph]
```

* **Recall & Reflect (Step 0)**: Queries semantic and structural memory connections to synthesize a musical briefing:
  > *"User consistently gravitates toward introspective synthwave, preferring atmospheric female vocals at 80–95 BPM. Lyrical themes center on nostalgia and late-night city solitude."*
* **Retain (Step 8)**: Post-session, the finished song metadata (such as genre, BPM, and user ratings) is written back to the memory graph.
* **Storage Fallback**: If no Cloud API key is found, Hindsight automatically falls back to reading/writing JSON files locally under `/artifacts/memory/{userId}.json`.

---

## 5. Audio DSP Mixing Chain

To overlay synthesized vocals on instrumental tracks, MuseFlow runs a multi-tap FFmpeg command chain:

1. **Haas Effect Stereo Widening**: Splits the mono vocal track, adding a 25ms delay to the right channel to move vocals out of the center and leave room for instrumental tracks.
2. **Frequency Filters**: Applies a bandpass filter (250Hz - 3.5kHz) to clean mud and remove high-frequency sibilance.
3. **Chorus & Echo Modulation**: Introduces subtle pitch changes and a 0.25-second delay echo.
4. **Sidechain Compression Ducking**: Automatically ducks the mid-frequencies of the backing track by 2.5dB whenever a vocal signal is present.

---

## 6. Server-Sent Events (SSE) Event Schema

Real-time telemetry streams from `POST /api/orchestrate/stream` using the following event format:

### A. Connection Start
```json
{
  "type": "start",
  "message": "Starting CascadeFlow multi-agent creative orchestration..."
}
```

### B. Step Started
```json
{
  "type": "step",
  "step": {
    "step": "Lyrics Generation",
    "agent": "LyricsAgent",
    "state": "RUNNING",
    "model": "llama-3.3-70b-versatile",
    "timestamp": "2026-05-19T20:00:00Z"
  }
}
```

### C. Step Completed (Success / Failure / Retry)
```json
{
  "type": "step",
  "step": {
    "step": "Lyrics Generation",
    "agent": "LyricsAgent",
    "state": "SUCCESS",
    "model": "llama-3.3-70b-versatile",
    "latency": 3450,
    "timestamp": "2026-05-19T20:00:03Z",
    "output": {
      "title": "Autumn Solitude",
      "lyrics": "[Verse 1]..."
    }
  }
}
```

### D. Workflow Completed
```json
{
  "type": "complete",
  "data": {
    "id": "song-123",
    "songTitle": "Autumn Solitude",
    "lyrics": "[Verse 1]...",
    "coverArtUrl": "http://localhost:3001/artifacts/images/cover.jpg",
    "productionStyle": "Dreamy retro lofi",
    "vocalsUrl": "http://localhost:3001/artifacts/audio/mixed.mp3",
    "compositionUrl": "https://soundhelix.com/song1.mp3"
  },
  "trace": {
    "workflowId": "wf-123",
    "status": "SUCCESS",
    "totalLatency": 35200
  }
}
```
---

## 7. Storage Scheme

Files generated during execution are stored in the `/artifacts/` folder:

* `/artifacts/orchestrator/trace_wf-*.json` — step-by-step execution latency traces.
* `/artifacts/audio/mixed_wf-*.mp3` — final FFmpeg master mix.
* `/artifacts/images/album_art_wf-*.jpg` — generated album cover graphics.
* `/artifacts/memory/{userId}.json` — local persistent user memory file.
* `/artifacts/user_songs.json` — saved song catalog library index.
