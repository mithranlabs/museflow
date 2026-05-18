import { BaseAgent } from './baseAgent';
import { CreativeRequest } from '../types';
import { LYRICS_PROMPT_TEMPLATE } from '../prompts/templates';

interface LyricsAgentInput {
  request: CreativeRequest;
  emotionContext: any;
  memoryContext: any;
}

interface LyricsAgentOutput {
  title: string;
  lyrics: string;
}

export class LyricsAgent extends BaseAgent<LyricsAgentInput, LyricsAgentOutput> {
  constructor() {
    // Stronger creative model
    super('LyricsAgent', 'llama-3.3-70b-specdec');
  }

  protected async process(input: LyricsAgentInput): Promise<LyricsAgentOutput> {
    const prompt = LYRICS_PROMPT_TEMPLATE(
      input.request.direction,
      input.emotionContext,
      input.memoryContext
    );
    const rawResult = await this.callLLM(prompt, 'json');
    try {
      return JSON.parse(rawResult) as LyricsAgentOutput;
    } catch (e) {
      console.warn('[LyricsAgent] Failed to parse JSON lyrics, raw content:', rawResult);
      return {
        title: 'Drifting Lights',
        lyrics: `[Verse 1]\nNeon signs flicker in the quiet rain\nTracing the lines of a familiar pain\nWe used to talk until the morning light\nNow you're a phantom in the retro night\n\n[Chorus]\nAnd we're drifting away, like static on the screen\nLost in the spaces of the places we've been\nJust a nostalgia wave breaking on the shore\nWe don't talk anymore`
      };
    }
  }

  protected getMockResponse(prompt: string, format: 'json' | 'text'): string {
    if (format === 'json') {
      return JSON.stringify({
        title: 'Retrogrades & Raindrops',
        lyrics: `[Verse 1]\nRaindrops slide down the windowpane\nChasing the static of a fading name\nWe took the highway to the edge of youth\nBut lost our footing on the slippery truth.\nNow you're a silhouette in neon green\nThe cleanest ghost I have ever seen.\n\n[Chorus]\nAnd we are drifting away, like dust in the beam\nLost in the static of a beautiful dream\nJust a nostalgic echo in an empty hall\nFunny how the giants always learn to fall\nNo longer answers when the late hours call.\n\n[Verse 2]\nFound a mixtape in a dusty drawer\nWith tracks of bands that we don't hear no more\nIt plays in mono but the memory's stereo\nA vintage signal that I can't let go\nBut the tape hiss drowns out what we used to know.\n\n[Chorus]\nAnd we are drifting away, like dust in the beam\nLost in the static of a beautiful dream\nJust a nostalgic echo in an empty hall\nFunny how the giants always learn to fall\nNo longer answers when the late hours call.\n\n[Bridge]\nCan we retune the frequency?\nOr is this signal lost to history?\nSome channels only play the static of a memory.\n\n[Outro]\nDrifting away...\nUnder the rainy lights...\nFade to black...\nStatic on the radio.`
      });
    }
    return 'Creative nostalgic lyrics generated.';
  }
}
