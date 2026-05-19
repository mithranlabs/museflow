/**
 * MuseFlow — Loudly AI Music Generation Service
 *
 * API: https://soundtracks.loudly.com
 * Auth: API-KEY header
 * Format: multipart/form-data (NOT JSON)
 *
 * Two generation modes:
 *   1. Parametric: POST /api/ai/songs   (genre, bpm, energy, key, instruments, structure_id)
 *   2. Prompt:     POST /api/ai/prompt/songs  (text prompt + duration)
 *
 * Response is SYNCHRONOUS — no polling needed.
 * Returns { id, title, music_file_path, bpm, key, duration, ... }
 */

import { logExecution } from '../utils/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoudlyCompositionInput {
  genre:        string;     // must match GET /api/ai/genres exactly
  bpm:          number;     // within genre's recommended range
  mood:         string;     // descriptive (used in textPrompt)
  energy:       'low' | 'high' | 'original';
  key:          string;     // e.g. "A Minor"
  atmosphere:   string;
  vocalStyle:   string;
  instruments:  string[];
  duration:     number;     // seconds, 30–420
  textPrompt?:  string;
}

export interface LoudlyTrack {
  trackId:          string;
  audioUrl:         string;
  waveformUrl?:     string;
  title:            string;
  duration:         number;  // milliseconds from API
  bpm:              number;
  key:              string;
}

export interface LoudlyResult {
  jobId:       string;
  tracks:      LoudlyTrack[];
  primaryUrl:  string;
  pollingMs:   number;
  attempts:    number;
  apiUsed:     'LOUDLY_REAL' | 'MUSEFLOW_SIMULATED';
  prompt:      LoudlyCompositionInput;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE_URL    = 'https://soundtracks.loudly.com';
const MAX_RETRIES = 2;

// ── Valid genre names (from GET /api/ai/genres) ───────────────────────────────
// Used to map our internal genre strings to Loudly's exact names

const GENRE_MAP: Record<string, string> = {
  synthwave:    'Synthwave',
  chillwave:    'Synthwave',     // micro-genre of Synthwave
  outrun:       'Synthwave',
  darkwave:     'Synthwave',
  'lo-fi':      'Lo Fi',
  lofi:         'Lo Fi',
  'lo fi':      'Lo Fi',
  ambient:      'Ambient',
  cinematic:    'Ambient',       // micro-genre of Ambient
  'dark synth': 'Ambient',
  edm:          'EDM',
  house:        'House',
  'deep house': 'House',
  hiphop:       'Hip Hop',
  'hip-hop':    'Hip Hop',
  'hip hop':    'Hip Hop',
  trap:         'Trap Half Tempo',
  techno:       'Techno',
  rock:         'Rock',
  'indie rock': 'Rock',
  metal:        'Rock',
  reggaeton:    'Reggaeton',
  'drum and bass': "Drum 'n' Bass",
  dnb:          "Drum 'n' Bass",
  downtempo:    'Downtempo',
  'trip hop':   'Downtempo',
  'epic score': 'Epic Score',
  epic:         'Epic Score',
  zen:          'Zen',
};

// ── Key parsing (Loudly uses key_root + key_quality separately) ───────────────

function parseKey(key: string): { key_root: string; key_quality: 'major' | 'minor' } {
  const lower = key.toLowerCase();
  const quality: 'major' | 'minor' = lower.includes('minor') ? 'minor' : 'major';

  // Extract root note safely
  const rootMatch = key.match(/^([A-G][#b]?)/);
  const root = (rootMatch && rootMatch[1]) ? rootMatch[1] : 'C';

  // Map to Loudly's accepted values
  const rootMap: Record<string, string> = {
    'C': 'C', 'C#': 'C#/Db', 'Db': 'C#/Db',
    'D': 'D', 'D#': 'D#/Eb', 'Eb': 'D#/Eb',
    'E': 'E', 'F': 'F', 'F#': 'F#/Gb', 'Gb': 'F#/Gb',
    'G': 'G', 'G#': 'G#/Ab', 'Ab': 'G#/Ab',
    'A': 'A', 'A#': 'A#/Bb', 'Bb': 'A#/Bb',
    'B': 'B',
  };

  return { key_root: rootMap[root] ?? 'A', key_quality: quality };
}

function mapGenre(genre: string): string {
  return GENRE_MAP[genre.toLowerCase()] ?? 'Synthwave';
}

// ── Build multipart/form-data body ───────────────────────────────────────────

function buildFormData(params: Record<string, string | number | boolean | string[]>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      v.forEach(item => form.append(k + '[]', item));
    } else if (v !== undefined && v !== null && v !== '') {
      form.append(k, String(v));
    }
  }
  return form;
}

// ── LoudlyService ─────────────────────────────────────────────────────────────

export class LoudlyService {
  private apiKey: string | null;

  constructor() {
    this.apiKey = process.env.LOUDLY_API_KEY ?? null;
  }

  /**
   * Main entry point — uses text prompt generation (most flexible).
   * Falls back to parametric if prompt fails.
   * Falls back to simulation if no API key.
   */
  async generateMusic(input: LoudlyCompositionInput): Promise<LoudlyResult> {
    if (!this.apiKey) {
      logExecution('LoudlyService', 'SIMULATED', { reason: 'No LOUDLY_API_KEY configured' });
      return this.simulatedResponse(input);
    }

    return this.generateWithRetry(input, 0);
  }

  // ── Private: retry wrapper ─────────────────────────────────────────────────

  private async generateWithRetry(input: LoudlyCompositionInput, attempt: number): Promise<LoudlyResult> {
    try {
      // Try prompt-based generation first (uses textPrompt for richer results)
      if (input.textPrompt) {
        return await this.generateViaPrompt(input);
      }
      return await this.generateParametric(input);
    } catch (err: any) {
      logExecution('LoudlyService', 'GENERATION_ERROR', { attempt, error: err.message });

      if (attempt < MAX_RETRIES) {
        // On first retry, try parametric if prompt failed
        const nextAttempt = attempt + 1;
        logExecution('LoudlyService', 'RETRYING', { strategy: nextAttempt === 1 ? 'parametric' : 'simulated' });
        await delay(1500 * nextAttempt);

        try {
          return await this.generateParametric(input);
        } catch (err2: any) {
          logExecution('LoudlyService', 'PARAMETRIC_FAILED', { error: err2.message });
        }
      }

      logExecution('LoudlyService', 'FALLBACK_SIMULATED', { reason: 'All Loudly attempts failed' });
      return this.simulatedResponse(input);
    }
  }

  // ── Mode 1: Text prompt generation (POST /api/ai/prompt/songs) ────────────

  private async generateViaPrompt(input: LoudlyCompositionInput): Promise<LoudlyResult> {
    const startMs = Date.now();
    const prompt = this.buildPromptString(input);

    logExecution('LoudlyService', 'GENERATING_PROMPT_MODE', { prompt: prompt.slice(0, 80) });

    const form = buildFormData({
      prompt,
      duration:   Math.min(420, Math.max(30, input.duration)),
      model:      'VEGA_2',
    });

    const res = await fetch(`${BASE_URL}/api/ai/prompt/songs`, {
      method: 'POST',
      headers: { 'API-KEY': this.apiKey! },
      body:   form,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Loudly prompt/songs [${res.status}]: ${errText}`);
    }

    const data = await res.json() as any;
    logExecution('LoudlyService', 'GENERATION_SUCCESS_PROMPT', {
      id:    data.id,
      title: data.title,
      bpm:   data.bpm,
      ms:    Date.now() - startMs,
    });

    return this.parseAiSong(data, input, startMs);
  }

  // ── Mode 2: Parametric generation (POST /api/ai/songs) ────────────────────

  private async generateParametric(input: LoudlyCompositionInput): Promise<LoudlyResult> {
    const startMs  = Date.now();
    const genre    = mapGenre(input.genre);
    const { key_root, key_quality } = parseKey(input.key);

    // Clamp BPM to a safe value (Loudly validates within genre range)
    const clampedBpm = Math.min(185, Math.max(60, input.bpm));

    logExecution('LoudlyService', 'GENERATING_PARAMETRIC', { genre, bpm: clampedBpm, key_root, key_quality });

    const form = buildFormData({
      genre,
      bpm:         clampedBpm,
      energy:      input.energy,
      key_root,
      key_quality,
      duration:    Math.min(420, Math.max(30, input.duration)),
      model:       'VEGA_2',
      structure_id: 0, // Classic structure
      ...(input.instruments.length > 0
        ? { instruments: input.instruments.slice(0, 4) }
        : {}),
    });

    const res = await fetch(`${BASE_URL}/api/ai/songs`, {
      method: 'POST',
      headers: { 'API-KEY': this.apiKey! },
      body:   form,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Loudly ai/songs [${res.status}]: ${errText}`);
    }

    const data = await res.json() as any;
    logExecution('LoudlyService', 'GENERATION_SUCCESS_PARAMETRIC', {
      id:    data.id,
      title: data.title,
      bpm:   data.bpm,
      ms:    Date.now() - startMs,
    });

    return this.parseAiSong(data, input, startMs);
  }

  // ── Parse Loudly ai_song schema into LoudlyResult ─────────────────────────

  private parseAiSong(data: any, input: LoudlyCompositionInput, startMs: number): LoudlyResult {
    const track: LoudlyTrack = {
      trackId:     data.id,
      audioUrl:    data.music_file_path,
      waveformUrl: data.wave_form_file_path,
      title:       data.title ?? 'Untitled',
      duration:    data.duration,       // milliseconds
      bpm:         data.bpm ?? input.bpm,
      key:         data.key?.name ?? input.key,
    };

    return {
      jobId:      data.id,
      tracks:     [track],
      primaryUrl: track.audioUrl,
      pollingMs:  Date.now() - startMs,
      attempts:   0,
      apiUsed:    'LOUDLY_REAL',
      prompt:     input,
    };
  }

  // ── Build natural language prompt string ──────────────────────────────────

  private buildPromptString(input: LoudlyCompositionInput): string {
    const durationSec = input.duration;
    const instruments = input.instruments.slice(0, 3).join(', ');
    return (
      input.textPrompt
        ? `${input.textPrompt} `
        : ''
    ) +
      `${durationSec}-second ${input.genre} track, ${input.bpm} BPM, ` +
      `${input.mood} mood, ${input.atmosphere} atmosphere, ` +
      `featuring ${instruments || 'synthesizers and drums'}.`;
  }

  // ── Simulated fallback (no API key or all attempts failed) ────────────────

  private simulatedResponse(input: LoudlyCompositionInput): LoudlyResult {
    const DEMO: Record<string, string> = {
      synthwave: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      'lo fi':   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      ambient:   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
      rock:      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
      jazz:      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    };

    const slug = mapGenre(input.genre).toLowerCase();
    const url  = DEMO[slug] ?? 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3';
    const id   = `sim-${Date.now()}`;

    return {
      jobId:      id,
      tracks: [{
        trackId:  `${id}-t1`,
        audioUrl: url,
        title:    'MuseFlow Demo Track',
        duration: input.duration * 1000,
        bpm:      input.bpm,
        key:      input.key,
      }],
      primaryUrl: url,
      pollingMs:  0,
      attempts:   0,
      apiUsed:    'MUSEFLOW_SIMULATED',
      prompt:     input,
    };
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────
export const loudlyService = new LoudlyService();

// ── Build Loudly payload (exported for agent logging/display) ─────────────────
export function buildLoudlyPayload(input: LoudlyCompositionInput): Record<string, unknown> {
  const { key_root, key_quality } = parseKey(input.key);
  return {
    genre:        mapGenre(input.genre),
    bpm:          input.bpm,
    energy:       input.energy,
    key_root,
    key_quality,
    duration:     input.duration,
    textPrompt:   input.textPrompt,
    instruments:  input.instruments,
    model:        'VEGA_2',
  };
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
