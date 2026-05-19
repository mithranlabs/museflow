/**
 * MuseFlow — MusicGenerationAgent (Loudly Edition)
 *
 * Replaces the Replicate/MusicGen backend with LoudlyService.
 * 
 * Flow:
 *   Emotion + Composition + Producer contexts
 *   → LLM-engineered LoudlyCompositionInput (structured JSON)
 *   → LoudlyService.generateMusic()
 *   → MusicGenerationOutput with audioUrl + full metadata
 */

import { BaseAgent } from './baseAgent';
import { CreativeRequest } from '../types';
import { loudlyService, LoudlyCompositionInput, LoudlyResult } from '../services/loudly';
import { logExecution } from '../utils/logger';

// ── I/O types ─────────────────────────────────────────────────────────────────

export interface MusicGenerationInput {
  request:           CreativeRequest;
  emotionContext:    any;
  compositionContext: any;
  producerContext:   any;
}

export interface MusicGenerationOutput {
  loudlyPrompt:     LoudlyCompositionInput;
  audioUrl:         string;
  allVariations:    Array<{ trackId: string; audioUrl: string }>;
  generationMetadata: {
    jobId:        string;
    pollingMs:    number;
    attempts:     number;
    apiUsed:      'LOUDLY_REAL' | 'MUSEFLOW_SIMULATED';
    genre:        string;
    bpm:          number;
    mood:         string;
    atmosphere:   string;
    vocalStyle:   string;
    instruments:  string[];
    status:       'succeeded';
  };
  // Kept for backward-compat with FinalCreativePackage
  musicgenPrompt:   string;
}

// ── Agent ─────────────────────────────────────────────────────────────────────

export class MusicGenerationAgent extends BaseAgent<MusicGenerationInput, MusicGenerationOutput> {
  constructor() {
    super('MusicGenerationAgent', 'llama-3.1-8b-instant');
  }

  protected async process(input: MusicGenerationInput): Promise<MusicGenerationOutput> {
    // 1. Engineer a structured Loudly composition prompt via LLM
    const llmPrompt = this.buildPromptEngineeringRequest(input);
    logExecution(this.name, 'ENGINEERING_LOUDLY_PROMPT', { model: this.model });

    let loudlyInput: LoudlyCompositionInput;
    try {
      const rawLLM = await this.callLLM(llmPrompt, 'json');
      loudlyInput = this.parseLoudlyInput(rawLLM, input);
    } catch (e) {
      logExecution(this.name, 'PROMPT_PARSE_FALLBACK', {});
      loudlyInput = this.buildFallbackInput(input);
    }

    logExecution(this.name, 'LOUDLY_PROMPT_READY', {
      genre: loudlyInput.genre,
      bpm:   loudlyInput.bpm,
      mood:  loudlyInput.mood,
    });

    // 2. Generate music via Loudly
    const result: LoudlyResult = await loudlyService.generateMusic(loudlyInput);

    logExecution(this.name, 'LOUDLY_GENERATION_COMPLETE', {
      jobId:   result.jobId,
      apiUsed: result.apiUsed,
      tracks:  result.tracks.length,
    });

    // 3. Build human-readable musicgenPrompt for backward-compat fields
    const musicgenPrompt =
      `${loudlyInput.genre}, ${loudlyInput.bpm} BPM, ` +
      `${loudlyInput.mood} mood, ${loudlyInput.atmosphere} atmosphere, ` +
      `${loudlyInput.vocalStyle} vocals, ` +
      `instruments: ${loudlyInput.instruments.join(', ')}.`;

    return {
      loudlyPrompt:  loudlyInput,
      audioUrl:      result.primaryUrl,
      allVariations: result.tracks.map(t => ({ trackId: t.trackId, audioUrl: t.audioUrl })),
      generationMetadata: {
        jobId:       result.jobId,
        pollingMs:   result.pollingMs,
        attempts:    result.attempts,
        apiUsed:     result.apiUsed,
        genre:       loudlyInput.genre,
        bpm:         loudlyInput.bpm,
        mood:        loudlyInput.mood,
        atmosphere:  loudlyInput.atmosphere,
        vocalStyle:  loudlyInput.vocalStyle,
        instruments: loudlyInput.instruments,
        status:      'succeeded',
      },
      musicgenPrompt,
    };
  }

  // ── LLM prompt engineering request ────────────────────────────────────────

  private buildPromptEngineeringRequest(input: MusicGenerationInput): string {
    const { emotionContext: ec, compositionContext: cc, producerContext: pc } = input;
    return `
You are a music production AI. Based on the creative session below, output a precise JSON object
describing the optimal Loudly API generation parameters.

Creative direction: "${input.request.direction}"
Detected emotion: ${ec?.emotion ?? 'melancholic'}
Genre: ${ec?.genre ?? 'synthwave'}
Energy level: ${ec?.energy ?? 'medium'}
BPM: ${cc?.bpm ?? 84}
Key: ${cc?.key ?? 'A Minor'}
Instruments: ${(cc?.instruments ?? []).join(', ')}
Vocal style: ${cc?.vocalStyle ?? 'ethereal female vocals'}
Atmosphere: ${cc?.atmosphere ?? 'rainy, introspective'}
Producer notes: ${pc?.productionNotes ?? 'none'}

Return ONLY valid JSON with this exact schema:
{
  "genre":       string,   // primary genre
  "bpm":         number,   // 60–180
  "mood":        string,   // descriptive mood phrase
  "energy":      number,   // 1–10
  "key":         string,   // e.g. "A Minor"
  "atmosphere":  string,   // atmospheric descriptor
  "vocalStyle":  string,   // vocal style description
  "instruments": string[], // 3–5 instruments
  "duration":    number,   // 30 seconds
  "textPrompt":  string    // 1-sentence natural language enrichment
}
`.trim();
  }

  // ── Parse LLM JSON output ──────────────────────────────────────────────────

  private parseLoudlyInput(raw: string, input: MusicGenerationInput): LoudlyCompositionInput {
    const parsed = JSON.parse(raw);
    const ec = input.emotionContext;
    const cc = input.compositionContext;

    // Map numeric energy (1-10) or string to Loudly's enum: 'low' | 'high' | 'original'
    const energyRaw = parsed.energy ?? 5;
    const energy: 'low' | 'high' | 'original' =
      typeof energyRaw === 'string' && ['low','high','original'].includes(energyRaw)
        ? energyRaw as 'low' | 'high' | 'original'
        : energyRaw <= 4 ? 'low' : energyRaw >= 7 ? 'high' : 'original';

    return {
      genre:       parsed.genre      ?? ec?.genre      ?? 'Synthwave',
      bpm:         parsed.bpm        ?? cc?.bpm         ?? 84,
      mood:        parsed.mood       ?? ec?.emotion     ?? 'melancholic',
      energy,
      key:         parsed.key        ?? cc?.key         ?? 'A Minor',
      atmosphere:  parsed.atmosphere ?? cc?.atmosphere  ?? 'introspective',
      vocalStyle:  parsed.vocalStyle ?? cc?.vocalStyle  ?? 'ethereal vocals',
      instruments: Array.isArray(parsed.instruments) ? parsed.instruments : (cc?.instruments ?? []),
      duration:    30,
      textPrompt:  parsed.textPrompt ?? `${parsed.mood ?? ec?.emotion} ${parsed.genre ?? ec?.genre} track with ${cc?.atmosphere} atmosphere`,
    };
  }

  // ── Fallback when LLM parse fails ─────────────────────────────────────────

  private buildFallbackInput(input: MusicGenerationInput): LoudlyCompositionInput {
    const ec = input.emotionContext;
    const cc = input.compositionContext;
    return {
      genre:       ec?.genre      ?? 'Synthwave',
      bpm:         cc?.bpm        ?? 84,
      mood:        ec?.emotion    ?? 'melancholic',
      energy:      'original',
      key:         cc?.key        ?? 'A Minor',
      atmosphere:  cc?.atmosphere ?? 'nocturnal, introspective',
      vocalStyle:  cc?.vocalStyle ?? 'ethereal female vocals',
      instruments: cc?.instruments ?? ['analog synth', 'soft piano', 'drum machine'],
      duration:    30,
      textPrompt:  `${ec?.emotion ?? 'melancholic'} ${ec?.genre ?? 'synthwave'} track with ${cc?.atmosphere ?? 'nocturnal'} atmosphere`,
    };
  }

  protected getMockResponse(prompt: string, format: 'json' | 'text'): string {
    if (format === 'json') {
      return JSON.stringify({
        genre:       'synthwave',
        bpm:         84,
        mood:        'nostalgic melancholy',
        energy:      4,
        key:         'A Minor',
        atmosphere:  'rainy nocturnal city',
        vocalStyle:  'ethereal layered female vocals',
        instruments: ['analog Juno synth', 'vintage electric piano', 'lo-fi drum machine', 'rain ambience'],
        duration:    30,
        textPrompt:  'A slow melancholic synthwave journey through neon-lit rainy streets at midnight.',
      });
    }
    return 'Loudly prompt engineered.';
  }
}
