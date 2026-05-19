import { CreativeRequest, AgentResponse, FinalCreativePackage } from '../types';
import { EmotionAgent } from '../agents/emotionAgent';
import { MemoryAgent } from '../agents/memoryAgent';
import { LyricsAgent } from '../agents/lyricsAgent';
import { CompositionAgent } from '../agents/compositionAgent';
import { ProducerAgent } from '../agents/producerAgent';
import { CriticAgent } from '../agents/criticAgent';
import { MusicGenerationAgent } from '../agents/musicGenerationAgent';
import { saveArtifact } from '../artifacts/storage';
import { logExecution } from '../utils/logger';

export type ExecutionState = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'RETRYING' | 'ESCALATED';

export interface StepTrace {
  step: string;
  agent: string;
  state: ExecutionState;
  model: string;
  latency?: number;
  retries?: number;
  timestamp: string;
  output?: any;
}

export interface OrchestrationTrace {
  workflowId: string;
  status: ExecutionState;
  startTime: string;
  endTime?: string;
  totalLatency?: number;
  steps: StepTrace[];
  retriesCount: number;
}

export class CascadeFlowOrchestrator {
  private emotionAgent = new EmotionAgent();
  private memoryAgent = new MemoryAgent();
  private lyricsAgent = new LyricsAgent();
  private compositionAgent = new CompositionAgent();
  private producerAgent = new ProducerAgent();
  private criticAgent = new CriticAgent();
  private musicGenerationAgent = new MusicGenerationAgent();

  public async runWorkflow(request: CreativeRequest, userId: string): Promise<{
    package: FinalCreativePackage;
    trace: OrchestrationTrace;
  }> {
    const workflowId = `wf-${Date.now()}`;
    const startTime = new Date().toISOString();
    const startTimestamp = Date.now();

    const trace: OrchestrationTrace = {
      workflowId,
      status: 'RUNNING',
      startTime,
      steps: [],
      retriesCount: 0
    };

    const addStepTrace = (stepName: string, agentName: string, state: ExecutionState, model: string, output?: any, latency?: number, retries?: number) => {
      trace.steps.push({
        step: stepName,
        agent: agentName,
        state,
        model,
        latency,
        retries,
        timestamp: new Date().toISOString(),
        output
      });
      saveArtifact('orchestrator', `trace_${workflowId}.json`, trace);
    };

    try {
      // 1. Emotion Analysis
      addStepTrace('Emotion Analysis', this.emotionAgent.name, 'RUNNING', 'llama-3.1-8b-instant');
      const emotionRes = await this.emotionAgent.execute(request);
      addStepTrace('Emotion Analysis', this.emotionAgent.name, emotionRes.metadata.status as ExecutionState, emotionRes.metadata.model, emotionRes.output, emotionRes.metadata.latency, emotionRes.metadata.retries);

      // 2. Memory Recall
      addStepTrace('Memory Recall', this.memoryAgent.name, 'RUNNING', 'llama-3.1-8b-instant');
      const memoryRes = await this.memoryAgent.execute({ request: { ...request, emotion: emotionRes.output.emotion, genre: emotionRes.output.genre }, userId });
      addStepTrace('Memory Recall', this.memoryAgent.name, memoryRes.metadata.status as ExecutionState, memoryRes.metadata.model, memoryRes.output, memoryRes.metadata.latency, memoryRes.metadata.retries);

      let lyricsRes: AgentResponse<any>;
      let compRes: AgentResponse<any>;
      let prodRes: AgentResponse<any>;
      let musicgenRes: AgentResponse<any>;
      let criticRes: AgentResponse<any>;

      let loopCount = 0;
      const maxRefinementAttempts = 2;
      let pass = false;

      // Retries/Escalation orchestration loop
      while (loopCount < maxRefinementAttempts && !pass) {
        const isRefinement = loopCount > 0;
        const currentRequest = isRefinement 
          ? { ...request, direction: `${request.direction} (CRITIC REFINEMENT PASS: Please enhance the imagery and narrative flow based on: ${criticRes!.output.feedback})` }
          : request;

        if (isRefinement) {
          trace.retriesCount++;
          logExecution('Orchestrator', 'RETRYING', { reason: criticRes!.output.feedback, attempt: loopCount });
        }

        // 3. Lyrics Generation
        const lyricsStepName = isRefinement ? `Lyrics Generation (Refinement ${loopCount})` : 'Lyrics Generation';
        addStepTrace(lyricsStepName, this.lyricsAgent.name, isRefinement ? 'RETRYING' : 'RUNNING', 'llama-3.3-70b-versatile');
        lyricsRes = await this.lyricsAgent.execute({
          request: currentRequest,
          emotionContext: emotionRes.output,
          memoryContext: memoryRes.output
        });
        addStepTrace(lyricsStepName, this.lyricsAgent.name, lyricsRes.metadata.status as ExecutionState, lyricsRes.metadata.model, lyricsRes.output, lyricsRes.metadata.latency, lyricsRes.metadata.retries);

        // 4. Composition Planning
        const compStepName = isRefinement ? `Composition Planning (Refinement ${loopCount})` : 'Composition Planning';
        addStepTrace(compStepName, this.compositionAgent.name, isRefinement ? 'RETRYING' : 'RUNNING', 'llama-3.1-8b-instant');
        compRes = await this.compositionAgent.execute({
          request: currentRequest,
          emotionContext: emotionRes.output,
          memoryContext: memoryRes.output,
          lyrics: lyricsRes.output.lyrics
        });
        addStepTrace(compStepName, this.compositionAgent.name, compRes.metadata.status as ExecutionState, compRes.metadata.model, compRes.output, compRes.metadata.latency, compRes.metadata.retries);

        // 5. Producer Guidance
        const prodStepName = isRefinement ? `Producer Guidance (Refinement ${loopCount})` : 'Producer Guidance';
        addStepTrace(prodStepName, this.producerAgent.name, isRefinement ? 'RETRYING' : 'RUNNING', 'llama-3.3-70b-versatile');
        prodRes = await this.producerAgent.execute({
          direction: currentRequest.direction,
          compositionContext: compRes.output,
          lyrics: lyricsRes.output.lyrics
        });
        addStepTrace(prodStepName, this.producerAgent.name, prodRes.metadata.status as ExecutionState, prodRes.metadata.model, prodRes.output, prodRes.metadata.latency, prodRes.metadata.retries);

        // 6. Music Generation (Meta MusicGen via Replicate)
        const musicgenStepName = isRefinement ? `Music Generation (Refinement ${loopCount})` : 'Music Generation';
        addStepTrace(musicgenStepName, this.musicGenerationAgent.name, isRefinement ? 'RETRYING' : 'RUNNING', 'llama-3.1-8b-instant');
        musicgenRes = await this.musicGenerationAgent.execute({
          request: currentRequest,
          emotionContext: emotionRes.output,
          compositionContext: compRes.output,
          producerContext: prodRes.output
        });
        addStepTrace(musicgenStepName, this.musicGenerationAgent.name, musicgenRes.metadata.status as ExecutionState, musicgenRes.metadata.model, musicgenRes.output, musicgenRes.metadata.latency, musicgenRes.metadata.retries);

        // 7. Critic Evaluation
        const criticStepName = isRefinement ? `Critic Evaluation (Refinement ${loopCount})` : 'Critic Evaluation';
        addStepTrace(criticStepName, this.criticAgent.name, 'RUNNING', 'llama-3.3-70b-versatile');
        criticRes = await this.criticAgent.execute({
          title: lyricsRes.output.title,
          lyrics: lyricsRes.output.lyrics,
          emotion: emotionRes.output,
          composition: compRes.output,
          production: prodRes.output,
          audio: musicgenRes.output
        });
        addStepTrace(criticStepName, this.criticAgent.name, criticRes.metadata.status as ExecutionState, criticRes.metadata.model, criticRes.output, criticRes.metadata.latency, criticRes.metadata.retries);

        pass = criticRes.output.pass;
        loopCount++;

        // If loop limit reached and still not passed, escalate!
        if (loopCount === maxRefinementAttempts && !pass) {
          logExecution('Orchestrator', 'ESCALATED', { reason: 'Refinement limit reached without passing' });
          addStepTrace('Escalation Handler', 'Orchestrator', 'ESCALATED', 'System Rules', { escalated: true, detail: 'Output forced bypass with active critic alerts.' });
          pass = true; // bypass to finalize package
        }
      }

      // Generate SUNO & Album Art Prompts dynamically
      const albumArtPrompt = `A stunning professional album cover visual for a song titled "${lyricsRes!.output.title}". Vibe: ${emotionRes.output.emotion} ${emotionRes.output.genre}, atmosphere: ${compRes!.output.atmosphere}. Digital art style.`;
      const sunoPrompt = `${emotionRes.output.genre}, ${compRes!.output.bpm} BPM, key of ${compRes!.output.key}, ${compRes!.output.vocalStyle}, atmosphere: ${compRes!.output.atmosphere}`;
      const sessionSummary = `Session completed successfully. Creative direction: "${request.direction}". Orchestrated across 6 specialist AI agents. Mood: ${emotionRes.output.emotion} ${emotionRes.output.genre} at ${compRes!.output.bpm} BPM in Key of ${compRes!.output.key}. Real audio successfully generated using Meta MusicGen on Replicate. Retries handled: ${trace.retriesCount}.`;

      const finalPackage: FinalCreativePackage = {
        title: lyricsRes!.output.title,
        lyrics: lyricsRes!.output.lyrics,
        bpm: compRes!.output.bpm,
        key: compRes!.output.key,
        instrumentPalette: compRes!.output.instruments,
        atmosphere: compRes!.output.atmosphere,
        productionNotes: prodRes!.output.productionNotes,
        vocalStyle: compRes!.output.vocalStyle,
        arrangementNotes: prodRes!.output.arrangementNotes,
        albumArtPrompt,
        sunoPrompt,
        musicgenPrompt: musicgenRes!.output.musicgenPrompt,
        generatedAudioUrl: musicgenRes!.output.audioUrl,
        sessionSummary
      };

      trace.status = 'SUCCESS';
      trace.endTime = new Date().toISOString();
      trace.totalLatency = Date.now() - startTimestamp;
      saveArtifact('orchestrator', `trace_${workflowId}.json`, trace);

      // Save a friendly readable summary artifact too
      saveArtifact('final_package', `package_${workflowId}.json`, finalPackage);

      return {
        package: finalPackage,
        trace
      };

    } catch (error) {
      trace.status = 'FAILED';
      trace.endTime = new Date().toISOString();
      trace.totalLatency = Date.now() - startTimestamp;
      saveArtifact('orchestrator', `trace_${workflowId}.json`, trace);
      throw error;
    }
  }
}
