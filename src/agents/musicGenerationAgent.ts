import { BaseAgent } from './baseAgent';
import { CreativeRequest } from '../types';
import { MUSICGEN_PROMPT_TEMPLATE } from '../prompts/templates';
import Replicate from 'replicate';
import dotenv from 'dotenv';
import { logExecution } from '../utils/logger';

dotenv.config();

// Initialize Replicate client if token is present
const replicateToken = process.env.REPLICATE_API_TOKEN;
const replicateClient = replicateToken ? new Replicate({ auth: replicateToken }) : null;

export interface MusicGenerationInput {
  request: CreativeRequest;
  emotionContext: any;
  compositionContext: any;
  producerContext: any;
}

export interface MusicGenerationOutput {
  musicgenPrompt: string;
  audioUrl: string;
  generationMetadata: {
    duration: number;
    modelVersion: string;
    outputFormat: string;
    predictionId?: string;
    pollingAttempts?: number;
    status: string;
    apiUsed: 'REPLICATE_REAL' | 'MUSEFLOW_SIMULATED';
  };
}

export class MusicGenerationAgent extends BaseAgent<MusicGenerationInput, MusicGenerationOutput> {
  constructor() {
    super('MusicGenerationAgent', 'llama-3.1-8b-instant');
  }

  protected async process(input: MusicGenerationInput): Promise<MusicGenerationOutput> {
    // 1. Run LLM prompt engineering pass to translate composition inputs into optimized MusicGen prompt
    const promptEngineeringPrompt = MUSICGEN_PROMPT_TEMPLATE(
      input.request.direction,
      input.emotionContext,
      input.compositionContext,
      input.producerContext
    );
    
    logExecution(this.name, 'ENGINEERING_PROMPT', { model: this.model });
    const rawResult = await this.callLLM(promptEngineeringPrompt, 'json');
    let musicgenPrompt = '';
    
    try {
      const parsed = JSON.parse(rawResult);
      musicgenPrompt = parsed.prompt || parsed.musicgenPrompt || '';
    } catch (e) {
      console.warn('[MusicGenerationAgent] Failed to parse MusicGen prompt JSON, raw content:', rawResult);
      // Fallback manual prompt engineering
      musicgenPrompt = `A ${input.compositionContext.atmosphere} ${input.emotionContext.genre} track at ${input.compositionContext.bpm} BPM, key of ${input.compositionContext.key}, incorporating ${input.compositionContext.instruments.join(', ')}. Clean production.`;
    }

    if (!musicgenPrompt) {
      musicgenPrompt = `A ${input.compositionContext.atmosphere} ${input.emotionContext.genre} track at ${input.compositionContext.bpm} BPM, key of ${input.compositionContext.key}, incorporating ${input.compositionContext.instruments.join(', ')}. Clean production.`;
    }

    logExecution(this.name, 'PROMPT_ENGINEERED', { musicgenPrompt });

    // 2. Music Generation Step via Replicate (or Mock Fallback)
    const duration = 10; // generated audio duration in seconds
    const modelVersion = 'stereo-large';
    const outputFormat = 'mp3';

    if (replicateClient) {
      logExecution(this.name, 'GENERATING_AUDIO_START', { provider: 'Replicate', api: 'meta/musicgen' });
      const startTime = Date.now();
      
      try {
        // Create an asynchronous prediction to support polling, observability, and state transitions
        const prediction = await replicateClient.predictions.create({
          version: '671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb', // meta/musicgen version ID
          input: {
            prompt: musicgenPrompt,
            duration,
            model_version: modelVersion,
            output_format: outputFormat
          }
        });

        let currentPrediction = prediction;
        let pollingCount = 0;
        const maxPolls = 60; // 5 minutes max
        const pollIntervalMs = 5000; // poll every 5 seconds

        logExecution(this.name, 'POLLING_START', { predictionId: prediction.id });

        while (
          (currentPrediction.status === 'starting' || currentPrediction.status === 'processing') &&
          pollingCount < maxPolls
        ) {
          pollingCount++;
          logExecution(this.name, 'POLLING_STATE', {
            predictionId: prediction.id,
            status: currentPrediction.status,
            attempt: pollingCount,
            elapsedSeconds: Math.round((Date.now() - startTime) / 1000)
          });
          
          await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
          currentPrediction = await replicateClient.predictions.get(prediction.id);
        }

        logExecution(this.name, 'POLLING_COMPLETED', { status: currentPrediction.status, attempts: pollingCount });

        if (currentPrediction.status === 'succeeded') {
          // Output is typically an audio URL string
          const audioUrl = typeof currentPrediction.output === 'string' 
            ? currentPrediction.output 
            : (Array.isArray(currentPrediction.output) ? currentPrediction.output[0] : '');

          if (!audioUrl) {
            throw new Error('Replicate prediction succeeded but returned no output URL.');
          }

          return {
            musicgenPrompt,
            audioUrl,
            generationMetadata: {
              duration,
              modelVersion,
              outputFormat,
              predictionId: currentPrediction.id,
              pollingAttempts: pollingCount,
              status: currentPrediction.status,
              apiUsed: 'REPLICATE_REAL'
            }
          };
        } else {
          throw new Error(`Replicate generation failed with status: ${currentPrediction.status}. Error: ${currentPrediction.error || 'unknown'}`);
        }
      } catch (err: any) {
        logExecution(this.name, 'GENERATION_ERROR', { error: err.message, action: 'FALLING_BACK_TO_MOCK' });
        // Fall back to high-quality mockup if the live Replicate API fails or rate-limits
        return this.getSimulatedResponse(musicgenPrompt, duration, modelVersion, outputFormat);
      }
    } else {
      // Replicate token missing -> use cinematic high-quality mock audio URLs
      logExecution(this.name, 'GENERATING_AUDIO_SIMULATED', { reason: 'No REPLICATE_API_TOKEN configured. Using production simulated playback.' });
      // Short delay to simulate API latency beautifully
      await new Promise(resolve => setTimeout(resolve, 3000));
      return this.getSimulatedResponse(musicgenPrompt, duration, modelVersion, outputFormat);
    }
  }

  private getSimulatedResponse(musicgenPrompt: string, duration: number, modelVersion: string, outputFormat: string): MusicGenerationOutput {
    // Curated high quality cinematic audio URLs depending on the requested style
    let audioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'; // Standard synthwave/lofi fallback

    const promptLower = musicgenPrompt.toLowerCase();
    if (promptLower.includes('lofi') || promptLower.includes('lo-fi')) {
      audioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3';
    } else if (promptLower.includes('metal') || promptLower.includes('rock')) {
      audioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3';
    } else if (promptLower.includes('ambient') || promptLower.includes('cinematic')) {
      audioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3';
    }

    return {
      musicgenPrompt,
      audioUrl,
      generationMetadata: {
        duration,
        modelVersion,
        outputFormat,
        status: 'succeeded',
        apiUsed: 'MUSEFLOW_SIMULATED'
      }
    };
  }

  protected getMockResponse(prompt: string, format: 'json' | 'text'): string {
    if (format === 'json') {
      return JSON.stringify({
        prompt: 'A slow-tempo melancholic 84 BPM synthwave track in A minor with vintage Juno synthesizers, soft analog drum machine, stereo chorus, warm tape delay, and a rainy atmospheric wash.'
      });
    }
    return 'Prompt engineered successfully.';
  }
}
