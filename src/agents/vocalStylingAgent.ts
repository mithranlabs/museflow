import { BaseAgent } from './baseAgent';
import { VocalStylingOutput } from '../types';
import { VOCAL_STYLING_PROMPT_TEMPLATE } from '../prompts/templates';

interface VocalStylingInput {
  direction: string;
  emotion: string;
  composition: any;
  lyrics: string;
}

export class VocalStylingAgent extends BaseAgent<VocalStylingInput, VocalStylingOutput> {
  constructor() {
    super('VocalStylingAgent', 'llama-3.1-8b-instant');
  }

  protected async process(input: VocalStylingInput): Promise<VocalStylingOutput> {
    const prompt = VOCAL_STYLING_PROMPT_TEMPLATE(
      input.direction,
      input.emotion,
      input.composition,
      input.lyrics
    );
    const rawResult = await this.callLLM(prompt, 'json');
    try {
      return JSON.parse(rawResult) as VocalStylingOutput;
    } catch (e) {
      console.warn('[VocalStylingAgent] Failed to parse JSON, raw content:', rawResult);
      // Fallback
      return {
        voiceType: 'soft female',
        delivery: 'whispery melancholic',
        effects: ['large reverb', 'stereo delay', 'high-pass filter'],
        mixStyle: 'distant ambient',
        vocalDensity: 'minimal',
        vocalHooks: ['lost in the rain tonight...']
      };
    }
  }

  protected getMockResponse(prompt: string, format: 'json' | 'text'): string {
    if (format === 'json') {
      return JSON.stringify({
        voiceType: 'soft female',
        delivery: 'whispery melancholic',
        effects: ['large reverb', 'stereo delay', 'high-pass filter'],
        mixStyle: 'distant ambient',
        vocalDensity: 'minimal',
        vocalHooks: ['lost in the rain tonight...']
      });
    }
    return 'Soft female voice with large reverb and stereo delay';
  }
}
