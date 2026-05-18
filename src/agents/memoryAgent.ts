import { BaseAgent } from './baseAgent';
import { CreativeRequest } from '../types';
import { HindsightMemory } from '../memory/hindsight';
import { MEMORY_PROMPT_TEMPLATE } from '../prompts/templates';

interface MemoryAgentInput {
  request: CreativeRequest;
  userId: string;
}

interface MemoryAgentOutput {
  recalledPreferences: {
    genrePreference: string;
    imageryToInclude: string[];
    vocalTone: string;
    avoidStyles: string[];
  };
  emotionalThemesTracked: string;
}

export class MemoryAgent extends BaseAgent<MemoryAgentInput, MemoryAgentOutput> {
  constructor() {
    super('MemoryAgent', 'llama-3.1-8b-instant');
  }

  protected async process(input: MemoryAgentInput): Promise<MemoryAgentOutput> {
    const memorySystem = new HindsightMemory(input.userId);
    const historicalPrefs = memorySystem.getPreferences();

    const prompt = MEMORY_PROMPT_TEMPLATE(input.request.direction, historicalPrefs);
    const rawResult = await this.callLLM(prompt, 'json');
    
    try {
      const output = JSON.parse(rawResult) as MemoryAgentOutput;
      
      // Reflect and update memory with new themes/imagery discovered
      if (output.recalledPreferences.imageryToInclude.length > 0) {
        const uniqueImagery = Array.from(new Set([
          ...(historicalPrefs.favoriteImagery || []),
          ...output.recalledPreferences.imageryToInclude
        ]));
        
        memorySystem.updateMemory({
          favoriteImagery: uniqueImagery,
          preferredGenres: Array.from(new Set([...(historicalPrefs.preferredGenres || []), input.request.genre || 'synthwave'])),
          vocalPreferences: Array.from(new Set([...(historicalPrefs.vocalPreferences || []), output.recalledPreferences.vocalTone]))
        });
      }

      return output;
    } catch (e) {
      console.warn('[MemoryAgent] Failed to parse JSON memory, raw content:', rawResult);
      return {
        recalledPreferences: {
          genrePreference: `Matches ${input.request.genre || 'synthwave'}`,
          imageryToInclude: historicalPrefs.favoriteImagery || ['rainy nights', 'neon streets', 'retro memories'],
          vocalTone: 'Smooth low vocals',
          avoidStyles: historicalPrefs.dislikedStyles || ['harsh metal screams']
        },
        emotionalThemesTracked: 'Nostalgia and loss'
      };
    }
  }

  protected getMockResponse(prompt: string, format: 'json' | 'text'): string {
    if (format === 'json') {
      return JSON.stringify({
        recalledPreferences: {
          genrePreference: 'Prefers deep synthwave and nostalgic ambient music',
          imageryToInclude: ['neon sign glow', 'rain on windshield', 'empty city streets'],
          vocalTone: 'Ethereal, layered female vocals',
          avoidStyles: ['excessive dubstep drops', 'acoustic guitars']
        },
        emotionalThemesTracked: 'Nostalgic synthwave vibe matching prior drift/friendship theme queries.'
      });
    }
    return 'Recalled nostalgia-related memory elements.';
  }
}
