/**
 * MuseFlow — Hindsight Memory Layer
 * 
 * Replaces the flat JSON memoryStore with real Hindsight SDK integration.
 * Operations: retain → recall → reflect
 * Falls back to a local JSON store when HINDSIGHT_API_KEY is not configured.
 */

import fs from 'fs';
import path from 'path';
import { HindsightClient } from '@vectorize-io/hindsight-client';
import { logExecution } from '../utils/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MuseMemory {
  synthesizedProfile?: string;        // "User prefers melancholic synthwave with atmospheric female vocals."
  preferredGenres:     string[];
  vocalPreferences:    string[];
  emotionalTendencies: string[];
  likedThemes:         string[];
  dislikedStyles:      string[];
  successfulPatterns:  string[];
}

export interface RetainPayload {
  event:        'SONG_COMPLETED' | 'CRITIC_APPROVED' | 'USER_RATING' | 'SESSION_END';
  emotion:      string;
  genre:        string;
  vocalStyle:   string;
  atmosphere:   string;
  lyricalTheme: string;
  criticScore?: number;
  userRating?:  number;
  approved:     boolean;
}

// ── Client bootstrap ─────────────────────────────────────────────────────────

const hindsightApiKey = process.env.HINDSIGHT_API_KEY;
const hindsightBaseUrl = process.env.HINDSIGHT_BASE_URL || 'https://api.hindsight.vectorize.io/v1';

const hindsightClient: HindsightClient | null = hindsightApiKey
  ? new HindsightClient({ apiKey: hindsightApiKey, baseUrl: hindsightBaseUrl })
  : null;

// ── Local fallback store (used when no API key is present) ───────────────────

function getLocalStorePath(userId: string): string {
  const dir = path.join(process.cwd(), 'artifacts', 'memory');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${userId}.json`);
}

function readLocalMemory(userId: string): MuseMemory {
  const filePath = getLocalStorePath(userId);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MuseMemory;
    } catch {
      /* corrupted file — return defaults */
    }
  }
  return {
    preferredGenres:     [],
    vocalPreferences:    [],
    emotionalTendencies: [],
    likedThemes:         [],
    dislikedStyles:      [],
    successfulPatterns:  [],
  };
}

function writeLocalMemory(userId: string, mem: MuseMemory): void {
  fs.writeFileSync(getLocalStorePath(userId), JSON.stringify(mem, null, 2));
}

// ── HindsightMemory class ─────────────────────────────────────────────────────

export class HindsightMemory {
  private userId: string;
  private bankId: string;

  constructor(userId: string) {
    this.userId = userId;
    // Hindsight uses "bankId" to scope memory per user/entity
    this.bankId = `museflow-${userId}`;
  }

  // ── RETAIN ──────────────────────────────────────────────────────────────────
  /**
   * Stores a synthesized observation about a completed song session.
   * Hindsight performs entity extraction + indexing automatically.
   * 
   * Example retained string:
   *   "Approved: melancholic synthwave at 84 BPM with ethereal female vocals,
   *    rainy atmosphere, lyrically exploring drifting friendships. Score: 8/10."
   */
  async retain(payload: RetainPayload): Promise<void> {
    const observation = this.buildObservation(payload);

    if (hindsightClient) {
      try {
        await hindsightClient.retain(this.bankId, observation);
        logExecution('HindsightMemory', 'RETAINED', {
          userId: this.userId,
          event: payload.event,
          approved: payload.approved,
        });
      } catch (err: any) {
        logExecution('HindsightMemory', 'RETAIN_FAILED_FALLBACK', { error: err.message });
        this.localRetain(payload, observation);
      }
    } else {
      logExecution('HindsightMemory', 'RETAIN_LOCAL', { reason: 'No HINDSIGHT_API_KEY' });
      this.localRetain(payload, observation);
    }
  }

  // ── RECALL ──────────────────────────────────────────────────────────────────
  /**
   * Retrieves the most relevant memories for the current creative session.
   * Uses semantic + graph retrieval under the hood.
   * 
   * Returns a structured MuseMemory object ready to inject into agent prompts.
   */
  async recall(query: string): Promise<MuseMemory> {
    if (hindsightClient) {
      try {
        const result = await hindsightClient.recall(this.bankId, query);

        // The SDK returns { memories: Array<{ content: string, relevance: number }> }
        const memories: string[] = (result as any)?.memories?.map((m: any) =>
          typeof m === 'string' ? m : m.content ?? JSON.stringify(m)
        ) ?? [];

        logExecution('HindsightMemory', 'RECALLED', {
          userId: this.userId,
          count: memories.length,
        });

        return this.parseMemoriesIntoMuseMemory(memories);
      } catch (err: any) {
        logExecution('HindsightMemory', 'RECALL_FAILED_FALLBACK', { error: err.message });
        return readLocalMemory(this.userId);
      }
    } else {
      return readLocalMemory(this.userId);
    }
  }

  // ── REFLECT ─────────────────────────────────────────────────────────────────
  /**
   * Asks Hindsight to reason over all accumulated memories and synthesize
   * a high-level profile observation — the kind of meta-insight that drives
   * truly personalized music.
   *
   * Example output:
   *   "User consistently gravitates toward introspective synthwave and ambient
   *    electronica, preferring atmospheric female vocals at 80–95 BPM. Lyrical
   *    themes center on nostalgia, separation, and late-night city solitude.
   *    Approved productions favor layered analog textures over digital aggression."
   */
  async reflect(): Promise<string> {
    const query = `
      Synthesize a high-level musical personality profile for this user.
      What are their dominant genre preferences, emotional tendencies,
      lyrical themes, vocal style preferences, and production aesthetics?
      Format as 2–3 rich, specific sentences suitable for briefing a music producer.
    `;

    if (hindsightClient) {
      try {
        const result = await hindsightClient.reflect(this.bankId, query);
        const raw = result as any;

        // Hindsight SDK returns { text, based_on, structured_output, usage }
        // "I don't have information." means the bank has no memories yet — treat gracefully
        let insight: string =
          raw?.text
          ?? raw?.reflection
          ?? raw?.content
          ?? '';

        const noMemory = !insight || insight.toLowerCase().includes("don't have information");
        if (noMemory) {
          insight = 'No musical profile synthesized yet — generate a few more songs to build memory.';
        }

        logExecution('HindsightMemory', 'REFLECTED', {
          userId: this.userId,
          hasProfile: !noMemory,
        });

        // Persist the synthesized profile locally so it's always readable
        const mem = readLocalMemory(this.userId);
        mem.synthesizedProfile = insight;
        writeLocalMemory(this.userId, mem);

        return insight;
      } catch (err: any) {
        logExecution('HindsightMemory', 'REFLECT_FAILED_FALLBACK', { error: err.message });
        return readLocalMemory(this.userId).synthesizedProfile
          ?? 'No synthesized profile available yet.';
      }
    } else {
      return readLocalMemory(this.userId).synthesizedProfile
        ?? 'No synthesized profile available yet. Generate more songs to build memory.';
    }
  }

  // ── Post-session memory update (called by orchestrator after critic passes) ──
  async evolveMemory(payload: RetainPayload): Promise<MuseMemory> {
    await this.retain(payload);
    const updated = readLocalMemory(this.userId);

    // Evolve local model in parallel (doesn't depend on API)
    if (payload.approved) {
      const unique = <T>(arr: T[], item: T) =>
        arr.includes(item) ? arr : [...arr, item];

      updated.preferredGenres     = unique(updated.preferredGenres,     payload.genre);
      updated.vocalPreferences    = unique(updated.vocalPreferences,    payload.vocalStyle);
      updated.emotionalTendencies = unique(updated.emotionalTendencies, payload.emotion);
      updated.likedThemes         = unique(updated.likedThemes,         payload.lyricalTheme);
      updated.successfulPatterns  = unique(
        updated.successfulPatterns,
        `${payload.genre} @ ${payload.atmosphere}`
      ).slice(-10); // keep last 10 patterns
    } else {
      updated.dislikedStyles = [
        ...new Set([...updated.dislikedStyles, `${payload.genre} - ${payload.vocalStyle}`])
      ];
    }

    writeLocalMemory(this.userId, updated);
    return updated;
  }

  // ── Legacy compat (used by index.ts routes) ────────────────────────────────
  getPreferences(): MuseMemory {
    return readLocalMemory(this.userId);
  }

  updateMemory(partial: Partial<MuseMemory>): MuseMemory {
    const current = readLocalMemory(this.userId);
    const updated = { ...current, ...partial };
    writeLocalMemory(this.userId, updated);
    return updated;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private buildObservation(p: RetainPayload): string {
    const verdict = p.approved ? 'Approved' : 'Rejected';
    const score   = p.criticScore != null ? ` Score: ${p.criticScore}/10.` : '';
    const rating  = p.userRating  != null ? ` User rating: ${p.userRating}/5.` : '';
    return (
      `${verdict}: ${p.emotion} ${p.genre} with ${p.vocalStyle} vocals, ` +
      `${p.atmosphere} atmosphere, lyrically exploring "${p.lyricalTheme}".${score}${rating}`
    );
  }

  private localRetain(payload: RetainPayload, observation: string): void {
    const mem = readLocalMemory(this.userId);
    mem.successfulPatterns = [
      ...new Set([...mem.successfulPatterns, observation])
    ].slice(-20);
    writeLocalMemory(this.userId, mem);
  }

  private parseMemoriesIntoMuseMemory(memories: string[]): MuseMemory {
    const base = readLocalMemory(this.userId);
    // Enrich local memory with freshly recalled strings for downstream LLM injection
    return {
      ...base,
      // We surface raw recall strings as emotional tendencies for prompt injection
      emotionalTendencies: [
        ...base.emotionalTendencies,
        ...memories.slice(0, 5), // take top 5 most relevant recalled strings
      ],
    };
  }
}
