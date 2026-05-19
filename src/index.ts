import express    from 'express';
import cors       from 'cors';
import dotenv     from 'dotenv';
import path       from 'path';
import fs         from 'fs';

import { CascadeFlowOrchestrator } from './orchestrator/cascadeflow';
import { HindsightMemory }         from './memory/hindsight';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/artifacts', express.static(path.join(process.cwd(), 'artifacts')));

const orchestrator = new CascadeFlowOrchestrator();

// ── GET guard ──────────────────────────────────────────────────────────────────

app.get('/api/orchestrate', (_req, res) => {
  res.status(405).json({
    success: false,
    message: 'POST to /api/orchestrate with { direction, userId }',
    examplePayload: {
      direction: 'A rainy-night nostalgic synthwave song about drifting away from old friends.',
      userId:    'default-user',
    },
  });
});

// ── 1. Core orchestration ─────────────────────────────────────────────────────

app.post('/api/orchestrate', async (req, res) => {
  const { direction, userId = 'default-user', emotion, vibe, story, genre } = req.body;

  if (!direction) {
    return res.status(400).json({ error: 'Creative direction prompt is required.' });
  }

  try {
    const result = await orchestrator.runWorkflow(
      { direction, emotion, vibe, story, genre },
      userId,
    );

    res.json({
      success: true,
      data:    result.package,
      trace:   result.trace,
    });
  } catch (error: any) {
    console.error('[Orchestration Error]:', error);
    res.status(500).json({
      success: false,
      error:   'Orchestration workflow failed.',
      details: error.message,
    });
  }
});

// Helper function to save songs to user_songs.json
function saveSongToLibrary(song: any) {
  const songsFile = path.join(process.cwd(), 'artifacts', 'user_songs.json');
  let songs: any[] = [];
  if (fs.existsSync(songsFile)) {
    try {
      songs = JSON.parse(fs.readFileSync(songsFile, 'utf-8'));
    } catch (err) {}
  }
  songs.push(song);
  fs.mkdirSync(path.dirname(songsFile), { recursive: true });
  fs.writeFileSync(songsFile, JSON.stringify(songs, null, 2));
}

// Streaming orchestration endpoint
app.post('/api/orchestrate/stream', async (req, res) => {
  const { direction, prompt, emotion, mood, story, genre, userId = 'default-user' } = req.body;
  const promptText = direction || prompt;

  if (!promptText) {
    return res.status(400).json({ error: 'Creative direction prompt is required.' });
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendEvent = (event: any) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    sendEvent({ type: 'start', message: 'Starting CascadeFlow multi-agent creative orchestration...' });

    const result = await orchestrator.runWorkflow(
      {
        direction: promptText,
        emotion: emotion || mood || 'melancholic',
        vibe: mood || 'nostalgic',
        story,
        genre
      },
      userId,
      (event) => {
        sendEvent(event);
      }
    );

    const frontendData = {
      id: `song-${Date.now()}`,
      songTitle: result.package.title,
      title: result.package.title,
      lyrics: result.package.lyrics,
      coverArtUrl: result.package.albumArtUrl,
      productionStyle: result.package.productionNotes || result.package.arrangementNotes || 'Ambient Synthwave',
      vocalsUrl: result.package.generatedAudioUrl,
      compositionUrl: result.package.allVariations?.[0]?.audioUrl || result.package.generatedAudioUrl,
      createdAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    };

    saveSongToLibrary(frontendData);

    sendEvent({
      type: 'complete',
      data: frontendData,
      trace: result.trace
    });

    res.end();
  } catch (error: any) {
    console.error('[Streaming Orchestration Error]:', error);
    sendEvent({
      type: 'error',
      error: 'Orchestration workflow failed.',
      details: error.message
    });
    res.end();
  }
});

// ── 1b. Frontend-compatible orchestration ──────────────────────────────────────

app.post('/api/muse/generate', async (req, res) => {
  const { prompt, emotion, mood, story, genre, userId = 'default-user' } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Creative direction prompt (prompt) is required.' });
  }

  try {
    const result = await orchestrator.runWorkflow(
      {
        direction: prompt,
        emotion: emotion || mood || 'melancholic',
        vibe: mood || 'nostalgic',
        story,
        genre
      },
      userId
    );

    // Map FinalCreativePackage to frontend's expected properties
    const frontendData = {
      id: `song-${Date.now()}`,
      songTitle: result.package.title,
      lyrics: result.package.lyrics,
      coverArtUrl: result.package.albumArtUrl,
      productionStyle: result.package.productionNotes || result.package.arrangementNotes || 'Ambient Synthwave',
      vocalsUrl: result.package.generatedAudioUrl,
      compositionUrl: result.package.allVariations?.[0]?.audioUrl || result.package.generatedAudioUrl
    };

    res.json(frontendData);
  } catch (error: any) {
    console.error('[Frontend Generate Error]:', error);
    res.status(500).json({
      message: 'Orchestration workflow failed.',
      details: error.message
    });
  }
});

// ── 2. Execution traces history ───────────────────────────────────────────────

app.get('/api/history', (_req, res) => {
  const dir = path.join(process.cwd(), 'artifacts', 'orchestrator');
  if (!fs.existsSync(dir)) return res.json({ success: true, traces: [] });

  try {
    const traces = fs.readdirSync(dir)
      .filter(f => f.startsWith('trace_') && f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    res.json({ success: true, count: traces.length, traces });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 2b. Frontend Playlist / Song library persistence ─────────────────────────────

app.get('/api/user/songs', (_req, res) => {
  const songsFile = path.join(process.cwd(), 'artifacts', 'user_songs.json');
  if (!fs.existsSync(songsFile)) {
    return res.json([]);
  }
  try {
    const data = JSON.parse(fs.readFileSync(songsFile, 'utf-8'));
    res.json(data);
  } catch (err: any) {
    res.json([]);
  }
});

app.post('/api/user/songs/save', (req, res) => {
  const songsFile = path.join(process.cwd(), 'artifacts', 'user_songs.json');
  let songs: any[] = [];
  if (fs.existsSync(songsFile)) {
    try {
      songs = JSON.parse(fs.readFileSync(songsFile, 'utf-8'));
    } catch (err) {}
  }

  const newSong = {
    id: req.body.id || `song-${Date.now()}`,
    title: req.body.songTitle || req.body.title || 'Untitled',
    songTitle: req.body.songTitle || req.body.title || 'Untitled',
    lyrics: req.body.lyrics || '',
    compositionUrl: req.body.compositionUrl || req.body.vocalsUrl || '',
    vocalsUrl: req.body.vocalsUrl || '',
    coverArtUrl: req.body.coverArtUrl || '',
    productionStyle: req.body.productionStyle || '',
    createdAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  };

  songs.push(newSong);
  fs.mkdirSync(path.dirname(songsFile), { recursive: true });
  fs.writeFileSync(songsFile, JSON.stringify(songs, null, 2));
  res.json(newSong);
});

// ── 2c. Frontend Agents Status ──────────────────────────────────────────────────

app.get('/api/agents/status', (_req, res) => {
  res.json([
    {
      name: 'HindsightMemory',
      status: 'active',
      description: 'Tracks user preferences across sessions.',
      lastActive: 'Just now'
    },
    {
      name: 'EmotionAgent',
      status: 'active',
      description: 'Analyzes prompt emotional cues and energy levels.',
      lastActive: 'Just now'
    },
    {
      name: 'LyricsAgent',
      status: 'active',
      description: 'Generates themed poetic lyrics.',
      lastActive: 'Just now'
    },
    {
      name: 'CompositionAgent',
      status: 'active',
      description: 'Plans BPM, key, instruments, and vocal styles.',
      lastActive: 'Just now'
    },
    {
      name: 'ProducerAgent',
      status: 'active',
      description: 'Determines mixing and layering effects.',
      lastActive: 'Just now'
    },
    {
      name: 'VocalStylingAgent',
      status: 'active',
      description: 'Details voice type and delivery style.',
      lastActive: 'Just now'
    },
    {
      name: 'MusicGenerationAgent',
      status: 'active',
      description: 'Generates instrumentals via Loudly.',
      lastActive: 'Just now'
    },
    {
      name: 'VocalService',
      status: 'active',
      description: 'Generates spoken/singing vocals via MeloTTS/ElevenLabs.',
      lastActive: 'Just now'
    },
    {
      name: 'AudioMixer',
      status: 'active',
      description: 'Assembles and blends final tracks via FFmpeg.',
      lastActive: 'Just now'
    },
    {
      name: 'CriticAgent',
      status: 'active',
      description: 'Evaluates cohesion and triggers refinement passes.',
      lastActive: 'Just now'
    }
  ]);
});

// ── 2d. Frontend User Profile & Settings ─────────────────────────────────────────

app.get('/api/user/profile', (_req, res) => {
  const mem = new HindsightMemory('default-user');
  const prefs = mem.getPreferences();

  const songsFile = path.join(process.cwd(), 'artifacts', 'user_songs.json');
  let totalSongs = 0;
  if (fs.existsSync(songsFile)) {
    try {
      const songs = JSON.parse(fs.readFileSync(songsFile, 'utf-8'));
      totalSongs = songs.length;
    } catch (err) {}
  }

  res.json({
    displayName: 'Default Creator',
    email: 'creator@museflow.ai',
    totalSongs,
    memberSince: 'May 2026',
    memoryInsights: {
      favoriteGenres: prefs.preferredGenres && prefs.preferredGenres.length > 0 ? prefs.preferredGenres : ['synthwave', 'lo-fi'],
      preferredInstruments: prefs.vocalPreferences && prefs.vocalPreferences.length > 0 ? prefs.vocalPreferences : ['Piano', 'Pad synth']
    }
  });
});

app.put('/api/user/settings', (req, res) => {
  const settingsFile = path.join(process.cwd(), 'artifacts', 'user_settings.json');
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
  fs.writeFileSync(settingsFile, JSON.stringify(req.body, null, 2));
  res.json(req.body);
});

// ── 3. Hindsight memory routes ────────────────────────────────────────────────

// GET current memory profile
app.get('/api/memory/:userId', (req, res) => {
  const { userId } = req.params;
  const mem = new HindsightMemory(userId);
  res.json({ success: true, preferences: mem.getPreferences() });
});

// POST — manual memory update (admin / testing)
app.post('/api/memory/:userId', (req, res) => {
  const { userId } = req.params;
  const mem = new HindsightMemory(userId);
  const updated = mem.updateMemory(req.body);
  res.json({ success: true, preferences: updated });
});

// POST — trigger Hindsight reflect: returns synthesized profile
app.post('/api/memory/:userId/reflect', async (req, res) => {
  const { userId } = req.params;
  const mem = new HindsightMemory(userId);
  try {
    const profile = await mem.reflect();
    res.json({ success: true, userId, synthesizedProfile: profile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST — retain a manual observation (for testing memory ingestion)
app.post('/api/memory/:userId/retain', async (req, res) => {
  const { userId } = req.params;
  const mem = new HindsightMemory(userId);
  try {
    await mem.retain({
      event:        req.body.event        ?? 'USER_RATING',
      emotion:      req.body.emotion      ?? 'melancholic',
      genre:        req.body.genre        ?? 'synthwave',
      vocalStyle:   req.body.vocalStyle   ?? 'ethereal female vocals',
      atmosphere:   req.body.atmosphere   ?? 'nocturnal',
      lyricalTheme: req.body.lyricalTheme ?? 'longing',
      criticScore:  req.body.criticScore,
      userRating:   req.body.userRating,
      approved:     req.body.approved     ?? true,
    });
    res.json({ success: true, message: 'Memory retained.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 4. Telemetry snapshot ─────────────────────────────────────────────────────

app.get('/api/telemetry', (_req, res) => {
  const dir = path.join(process.cwd(), 'artifacts', 'orchestrator');
  if (!fs.existsSync(dir)) return res.json({ success: true, summary: {} });

  try {
    const traces = fs.readdirSync(dir)
      .filter(f => f.startsWith('trace_') && f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));

    const summary = {
      totalSessions:   traces.length,
      successRate:     ((traces.filter(t => t.status === 'SUCCESS').length / (traces.length || 1)) * 100).toFixed(1) + '%',
      avgLatencyMs:    Math.round(traces.reduce((s, t) => s + (t.totalLatency ?? 0), 0) / (traces.length || 1)),
      totalRetries:    traces.reduce((s, t) => s + (t.retriesCount ?? 0), 0),
      escalations:     traces.reduce((s, t) => s + (t.cascadeMetrics?.escalations ?? 0), 0),
      recentSessions:  traces.slice(0, 5).map(t => ({
        workflowId:   t.workflowId,
        status:       t.status,
        latency:      t.totalLatency,
        steps:        t.steps?.length ?? 0,
        retries:      t.retriesCount,
      })),
    };

    res.json({ success: true, summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Healthcheck ───────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status:   'UP',
    api:      'MuseFlow AI Orchestration Platform',
    version:  '2.0.0',
    features: ['CascadeFlow', 'Hindsight Memory', 'Loudly Music Generation'],
    env: {
      groq:      !!process.env.GROQ_API_KEY,
      hindsight: !!process.env.HINDSIGHT_API_KEY,
      loudly:    !!process.env.LOUDLY_API_KEY,
    },
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`  🎵  MUSEFLOW AI ORCHESTRATION PLATFORM  v2.0`);
  console.log(`  →   http://localhost:${PORT}/health`);
  console.log(`  →   POST http://localhost:${PORT}/api/orchestrate`);
  console.log(`  →   GET  http://localhost:${PORT}/api/history`);
  console.log(`  →   GET  http://localhost:${PORT}/api/telemetry`);
  console.log(`  →   GET  http://localhost:${PORT}/api/memory/:userId`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);
  console.log(`  Integrations:`);
  console.log(`    CascadeFlow:  @cascadeflow/core            ✓`);
  console.log(`    Hindsight:    @vectorize-io/hindsight-client ${process.env.HINDSIGHT_API_KEY ? '✓ LIVE' : '⚠ file fallback'}`);
  console.log(`    Loudly API:   soundtracks.loudly.com        ${process.env.LOUDLY_API_KEY ? '✓ LIVE' : '⚠ simulated'}`);
  console.log(`    Groq API:                                   ${process.env.GROQ_API_KEY ? '✓ LIVE' : '⚠ mock mode'}`);
  console.log(`\n`);
});
