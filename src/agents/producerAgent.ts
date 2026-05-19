import { BaseAgent } from './baseAgent';
import { CompositionOutput } from '../types';
import { PRODUCER_PROMPT_TEMPLATE } from '../prompts/templates';

interface ProducerAgentInput {
  direction: string;
  compositionContext: CompositionOutput;
  lyrics: string;
}

interface ProducerAgentOutput {
  productionNotes: string;
  vocalEffects: string;
  layeringIdeas: string[];
  arrangementNotes: string;
}

export class ProducerAgent extends BaseAgent<ProducerAgentInput, ProducerAgentOutput> {
  constructor() {
    super('ProducerAgent', 'llama-3.1-8b-instant');
  }

  protected async process(input: ProducerAgentInput): Promise<ProducerAgentOutput> {
    const prompt = PRODUCER_PROMPT_TEMPLATE(
      input.direction,
      input.compositionContext,
      input.lyrics
    );
    const rawResult = await this.callLLM(prompt, 'json');
    try {
      return JSON.parse(rawResult) as ProducerAgentOutput;
    } catch (e) {
      console.warn('[ProducerAgent] Failed to parse JSON production specs, raw content:', rawResult);
      return {
        productionNotes: 'Create a wide stereo image using chorus on the synths. Keep the low-end clean by high-passing the keys and vocals around 120Hz.',
        vocalEffects: 'Lush plate reverb with 2.8s decay, vintage tape delay synced to 1/8 triplets, and soft pitch correction.',
        layeringIdeas: ['Layer the main piano chords with a warm analog saw pad', 'Introduce a sub-bass beneath the retro kicks'],
        arrangementNotes: 'Build energy slowly. Introduce the full drums only on the Chorus. Drop all instrumentation except vocal & rain in the bridge.'
      };
    }
  }

  protected getMockResponse(prompt: string, format: 'json' | 'text'): string {
    if (format === 'json') {
      return JSON.stringify({
        productionNotes: 'Focus on a warm, retro-vintage blend. The analog synths should be stereo-widened with a classic chorus effect. Apply a low-cut filter to the rain ambience at 100Hz to avoid mud in the low-end, and let the vintage Linn drum kick drive the lower-mid punch.',
        vocalEffects: 'Ethereal vocal chain: Lexicon vintage plate reverb with 3.2s decay, stereo ping-pong delay synced to 1/8 notes, and a subtle detune chorus layer for dreaminess.',
        layeringIdeas: [
          'Layer the main analog Juno pad with a soft vintage FM Rhodes piano to add metallic sparkle.',
          'Double the vocals in the Chorus with a whisper track panned hard left and right to increase intimacy.',
          'Overlay a subtle high-frequency white noise sweep during transition to Chorus.'
        ],
        arrangementNotes: 'Start with 8 bars of solo rain ambience & distant synth pads. Bring in the drums & piano in Verse 1. In the Chorus, introduce the full layered vocals and wide chorus synths. Drop to a sparse piano and single dry vocal in the bridge, then explode into a powerful final Chorus.'
      });
    }
    return 'Producer guidelines generated successfully.';
  }
}
