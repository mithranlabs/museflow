import { BaseAgent } from './baseAgent';
import { CreativeRequest, EmotionOutput } from '../types';
import { EMOTION_PROMPT_TEMPLATE } from '../prompts/templates';

export class EmotionAgent extends BaseAgent<CreativeRequest, EmotionOutput> {
  constructor() {
    // Lightweight fast model
    super('EmotionAgent', 'llama-3.1-8b-instant');
  }

  protected async process(input: CreativeRequest): Promise<EmotionOutput> {
    const prompt = EMOTION_PROMPT_TEMPLATE(input.direction);
    const rawResult = await this.callLLM(prompt, 'json');
    try {
      return JSON.parse(rawResult) as EmotionOutput;
    } catch (e) {
      console.warn('[EmotionAgent] Failed to parse JSON, raw content:', rawResult);
      // Fallback
      return {
        emotion: input.emotion || 'nostalgic',
        energy: 'low',
        genre: input.genre || 'synthwave'
      };
    }
  }

  protected getMockResponse(prompt: string, format: 'json' | 'text'): string {
    const isRainyNostalgic = prompt.toLowerCase().includes('rainy') || prompt.toLowerCase().includes('nostalgic');
    
    if (format === 'json') {
      return JSON.stringify({
        emotion: isRainyNostalgic ? 'nostalgic' : 'melancholic',
        energy: 'low',
        genre: isRainyNostalgic ? 'synthwave' : 'lo-fi'
      });
    }
    return 'Nostalgic synthwave vibe, low energy';
  }
}
