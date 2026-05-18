import { BaseAgent } from './baseAgent';
import { CreativeRequest, CompositionOutput } from '../types';
import { COMPOSITION_PROMPT_TEMPLATE } from '../prompts/templates';

interface CompositionAgentInput {
  request: CreativeRequest;
  emotionContext: any;
  memoryContext: any;
  lyrics: string;
}

export class CompositionAgent extends BaseAgent<CompositionAgentInput, CompositionOutput> {
  constructor() {
    super('CompositionAgent', 'llama-3.1-8b-instant');
  }

  protected async process(input: CompositionAgentInput): Promise<CompositionOutput> {
    const prompt = COMPOSITION_PROMPT_TEMPLATE(
      input.request.direction,
      input.emotionContext,
      input.memoryContext,
      input.lyrics
    );
    const rawResult = await this.callLLM(prompt, 'json');
    try {
      return JSON.parse(rawResult) as CompositionOutput;
    } catch (e) {
      console.warn('[CompositionAgent] Failed to parse JSON composition, raw content:', rawResult);
      return {
        bpm: 84,
        key: 'A Minor',
        instruments: ['analog synth', 'soft piano', 'rain ambience', 'retro drum machine'],
        vocalStyle: 'ethereal female vocals',
        atmosphere: 'rainy, nostalgic'
      };
    }
  }

  protected getMockResponse(prompt: string, format: 'json' | 'text'): string {
    if (format === 'json') {
      return JSON.stringify({
        bpm: 84,
        key: 'A Minor',
        instruments: ['analog Juno synth', 'vintage electric piano', 'lo-fi vinyl crackle & rain', 'linndrum vintage drum machine'],
        vocalStyle: 'layered ethereal female vocals with warm analog tape delay',
        atmosphere: 'a rainy nostalgic night, late 80s aesthetics'
      });
    }
    return 'Composition plan successfully generated.';
  }
}
