import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { CascadeFlowOrchestrator } from './orchestrator/cascadeflow';
import { HindsightMemory } from './memory/hindsight';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serving static artifacts for debugging/inspecting
app.use('/artifacts', express.static(path.join(process.cwd(), 'artifacts')));

const orchestrator = new CascadeFlowOrchestrator();

// GET handler to prevent browser "Cannot GET" errors and guide developers
app.get('/api/orchestrate', (req, res) => {
  res.status(405).json({
    success: false,
    message: 'The /api/orchestrate endpoint requires a POST request containing your creative direction prompt.',
    examplePayload: {
      direction: 'Create a rainy-night nostalgic synthwave song about drifting away from old friends.',
      userId: 'default-user'
    },
    curlExample: `curl -X POST http://localhost:3001/api/orchestrate -H "Content-Type: application/json" -d "{\\"direction\\": \\"Create a rainy-night nostalgic synthwave song about drifting away from old friends.\\"}"`
  });
});

// 1. Core orchestration endpoint
app.post('/api/orchestrate', async (req, res) => {
  const { direction, userId = 'default-user', emotion, vibe, story, genre } = req.body;

  if (!direction) {
    return res.status(400).json({ error: 'Creative direction prompt is required.' });
  }

  try {
    const result = await orchestrator.runWorkflow({
      direction,
      emotion,
      vibe,
      story,
      genre
    }, userId);

    res.json({
      success: true,
      data: result.package,
      trace: result.trace
    });
  } catch (error: any) {
    console.error('[Orchestration Endpoint Error]:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete orchestrator workflow.',
      details: error.message
    });
  }
});

// 2. Fetch past orchestration execution traces
app.get('/api/history', (req, res) => {
  const orchestratorDir = path.join(process.cwd(), 'artifacts', 'orchestrator');
  if (!fs.existsSync(orchestratorDir)) {
    return res.json({ success: true, traces: [] });
  }

  try {
    const files = fs.readdirSync(orchestratorDir);
    const traces = files
      .filter(file => file.startsWith('trace_') && file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(orchestratorDir, file);
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      });

    res.json({ success: true, traces });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Hindsight Memory bank routes
app.get('/api/memory/:userId', (req, res) => {
  const { userId } = req.params;
  const memorySystem = new HindsightMemory(userId);
  res.json({ success: true, preferences: memorySystem.getPreferences() });
});

app.post('/api/memory/:userId', (req, res) => {
  const { userId } = req.params;
  const { preferredGenres, favoriteImagery, vocalPreferences, dislikedStyles } = req.body;
  const memorySystem = new HindsightMemory(userId);
  
  const updated = memorySystem.updateMemory({
    preferredGenres,
    favoriteImagery,
    vocalPreferences,
    dislikedStyles
  });

  res.json({ success: true, preferences: updated });
});

// Simple healthcheck
app.get('/health', (req, res) => {
  res.json({ status: 'UP', api: 'MuseFlow Creative Orchestration Platform' });
});

app.listen(PORT, () => {
  console.log(`===========================================================`);
  console.log(`  🎵 MUSEFLOW AI ORCHESTRATION PLATFORM RUNNING ON PORT ${PORT} 🎵`);
  console.log(`  -> API Healthcheck: http://localhost:${PORT}/health`);
  console.log(`  -> Main Orchestrate API: http://localhost:${PORT}/api/orchestrate`);
  console.log(`===========================================================`);
});
