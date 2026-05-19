/**
 * MuseFlow — Vocal Generation Service
 * Supports:
 *   1. ElevenLabs API (Generous free tier, ultra-high quality spoken/narration/rhythmic voice)
 *   2. Hugging Face Suno Bark API (Free HF serverless inference, supports singing via ♪ markup)
 *   3. Simulated Vocal Fallback (returns a default vocal snippet)
 */

import { logExecution } from '../utils/logger';
import { promises as fs } from 'fs';
import path from 'path';

export type VocalEngine = 'elevenlabs' | 'bark' | 'google_tts' | 'simulated';

export interface VocalGenerationInput {
  lyrics: string;
  vocalHooks?: string[];
  engine?: VocalEngine;
  voiceId?: string; // Optional ElevenLabs voice ID
}

export class VocalService {
  private elevenLabsKey: string | null;
  private hfToken: string | null;

  constructor() {
    this.elevenLabsKey = process.env.ELEVENLABS_API_KEY ?? null;
    this.hfToken = process.env.HF_TOKEN ?? null;
  }

  /**
   * Generates vocal audio from lyrics/hooks and saves it to a temp file.
   * Returns the file path of the generated vocal file.
   */
  async generateVocals(input: VocalGenerationInput, outputDir: string): Promise<string> {
    const engine = input.engine ?? this.detectBestEngine();
    const tempFile = path.join(outputDir, `vocals_${Date.now()}.mp3`);

    const textToSynthesize = input.vocalHooks && input.vocalHooks.length > 0
      ? input.vocalHooks.join('. ... ')
      : input.lyrics;

    logExecution('VocalService', 'START_GENERATION', { engine, textLength: textToSynthesize.length });

    try {
      if (engine === 'elevenlabs' && this.elevenLabsKey) {
        return await this.generateElevenLabs(textToSynthesize, input.voiceId ?? '21m00Tcm4TlvDq8ikWAM', tempFile);
      } else if (engine === 'bark' && this.hfToken) {
        return await this.generateBark(textToSynthesize, tempFile);
      } else if (engine === 'google_tts') {
        return await this.generateGoogleTTS(textToSynthesize, tempFile);
      }

      // Default fallback is Google TTS (reads actual lyrics/hooks keylessly)
      return await this.generateGoogleTTS(textToSynthesize, tempFile);
    } catch (err: any) {
      logExecution('VocalService', 'GENERATION_FAILED', { error: err.message, engine });
      try {
        logExecution('VocalService', 'TRYING_GOOGLE_TTS_FALLBACK');
        return await this.generateGoogleTTS(textToSynthesize, tempFile);
      } catch (innerErr: any) {
        logExecution('VocalService', 'GOOGLE_TTS_FAILED_FALLING_BACK_TO_SIMULATED', { error: innerErr.message });
        return await this.generateSimulated(tempFile);
      }
    }
  }

  private detectBestEngine(): VocalEngine {
    if (this.elevenLabsKey) return 'elevenlabs';
    if (this.hfToken) return 'bark';
    return 'google_tts'; // Fall back to keyless Google TTS to read actual lyrics/hooks!
  }

  // ── ElevenLabs TTS Generation ──────────────────────────────────────────────

  private async generateElevenLabs(text: string, voiceId: string, outputPath: string): Promise<string> {
    logExecution('VocalService', 'CALLING_ELEVENLABS', { voiceId });

    // Clean up lyric markers for speaking voice
    const cleanText = text.replace(/\[.*?\]/g, '').replace(/♪/g, '').trim();

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.elevenLabsKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ElevenLabs API [${response.status}]: ${errText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(outputPath, buffer);
    return outputPath;
  }

  // ── Suno Bark Singing Generation via Hugging Face ──────────────────────────

  private async generateBark(text: string, outputPath: string): Promise<string> {
    logExecution('VocalService', 'CALLING_BARK_SINGING');

    // Suno Bark sings if text is wrapped with ♪ characters
    const lines = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('['))
      .slice(0, 3) // Keep it short for serverless limits
      .map(line => `♪ ${line} ♪`)
      .join(' ');

    const response = await fetch('https://api-inference.huggingface.co/models/suno/bark', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.hfToken!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: lines }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Hugging Face Bark [${response.status}]: ${errText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(outputPath, buffer);
    return outputPath;
  }

  // ── Keyless Google TTS Generation ──────────────────────────────────────────

  private async generateGoogleTTS(text: string, outputPath: string): Promise<string> {
    logExecution('VocalService', 'CALLING_GOOGLE_TTS', { textLength: text.length });

    // Clean up lyric markers for speaking voice
    const cleanText = text.replace(/\[.*?\]/g, '').replace(/♪/g, '').replace(/\r/g, '').trim();

    // Split text into chunks of max 180 characters, breaking at spaces/punctuation
    const chunks: string[] = [];
    const words = cleanText.split(/\s+/);
    let currentChunk = '';

    for (const word of words) {
      if ((currentChunk + ' ' + word).length > 180) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = word;
      } else {
        currentChunk = currentChunk ? currentChunk + ' ' + word : word;
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());

    logExecution('VocalService', 'GOOGLE_TTS_SPLIT', { chunksCount: chunks.length });

    const buffers: Buffer[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue;
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(chunk)}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Google TTS failed for chunk ${i}: ${response.statusText}`);
      }

      const buf = Buffer.from(await response.arrayBuffer());
      buffers.push(buf);

      // Short delay to respect Google's servers
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    const finalBuffer = Buffer.concat(buffers);
    await fs.writeFile(outputPath, finalBuffer);
    logExecution('VocalService', 'GOOGLE_TTS_SUCCESS', { path: outputPath, size: finalBuffer.length });
    return outputPath;
  }

  // ── Simulated Mock Vocal ───────────────────────────────────────────────────

  private async generateSimulated(outputPath: string): Promise<string> {
    logExecution('VocalService', 'USING_SIMULATED_VOCALS');

    const assetPath = path.join(process.cwd(), 'artifacts', 'assets', 'default_vocals.wav');
    try {
      await fs.access(assetPath);
      // Copy the high-quality speech file. FFmpeg auto-detects formats so we replace extension if needed.
      const resolvedOutput = outputPath.replace(/\.mp3$/, '.wav');
      await fs.copyFile(assetPath, resolvedOutput);
      return resolvedOutput;
    } catch {
      const mockData = Buffer.alloc(1024);
      await fs.writeFile(outputPath, mockData);
      return outputPath;
    }
  }
}

export const vocalService = new VocalService();
