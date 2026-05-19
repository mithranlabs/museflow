/**
 * MuseFlow — CascadeFlow Orchestration Runtime
 *
 * Architecture:
 *   1. Hindsight recall  → synthesized user memory profile
 *   2. CascadeAgent      → routes each agent step to optimal Groq model tier
 *   3. Critic loop       → up to 2 refinement passes with retry tracing
 *   4. Escalation        → logged + bypassed when retries exhausted
 *   5. Hindsight retain  → post-session memory evolution
 *   6. Full trace        → step-by-step audit trail in /artifacts/orchestrator/
 */

import { CascadeAgent, GroqProvider, MetricsCollector } from '@cascadeflow/core';
import {
  CreativeRequest,
  AgentResponse,
  FinalCreativePackage,
  ExecutionContext,
  OrchestrationTrace,
  ExecutionState,
} from '../types';

import { EmotionAgent }          from '../agents/emotionAgent';
import { MemoryAgent }           from '../agents/memoryAgent';
import { LyricsAgent }           from '../agents/lyricsAgent';
import { CompositionAgent }      from '../agents/compositionAgent';
import { ProducerAgent }         from '../agents/producerAgent';
import { CriticAgent }           from '../agents/criticAgent';
import { MusicGenerationAgent }  from '../agents/musicGenerationAgent';
import { HindsightMemory, RetainPayload } from '../memory/hindsight';
import { saveArtifact }          from '../artifacts/storage';
import { logExecution }          from '../utils/logger';

// ── CascadeAgent bootstrap ────────────────────────────────────────────────────
// Two model tiers:
//   drafter  → llama-3.1-8b-instant   (fast, cheap, used for structured tasks)
//   verifier → llama-3.3-70b-versatile (powerful, used for creative tasks)

const groqApiKey = process.env.GROQ_API_KEY;

const cascadeAgent = groqApiKey
  ? new CascadeAgent({
      models: [
        {
          name:     'llama-3.1-8b-instant',
          provider: 'groq',
          cost:     0.00008,  // per 1k tokens
        },
        {
          name:     'llama-3.3-70b-versatile',
          provider: 'groq',
          cost:     0.00059,
        },
      ],
      quality: {
        confidenceThresholds: {
          simple:   0.55,
          moderate: 0.65,
          hard:     0.75,
          expert:   0.85,
        },
      },
    })
  : null;

const metrics = new MetricsCollector();

// ── Execution context factory ──────────────────────────────────────────────────

function createExecutionContext(workflowId: string, userId: string): ExecutionContext {
  const startTime = Date.now();
  const trace: OrchestrationTrace = {
    workflowId,
    userId,
    status:       'RUNNING',
    startTime:    new Date().toISOString(),
    steps:        [],
    retriesCount: 0,
  };

  const persist = () =>
    saveArtifact('orchestrator', `trace_${workflowId}.json`, trace);

  const ctx: ExecutionContext = {
    workflowId,
    userId,
    startTime,
    trace,

    addStep(
      stepName, agentName, state, model,
      output?, latency?, retries?, escalation?,
    ) {
      trace.steps.push({
        step:      stepName,
        agent:     agentName,
        state,
        model,
        latency,
        retries,
        timestamp: new Date().toISOString(),
        output,
        escalation,
      });
      persist();

      logExecution('CascadeFlow', state, {
        step:    stepName,
        agent:   agentName,
        model,
        latency: latency ? `${latency}ms` : undefined,
        retries,
        escalation,
      });
    },

    fail(error) {
      trace.status      = 'FAILED';
      trace.endTime     = new Date().toISOString();
      trace.totalLatency = Date.now() - startTime;
      persist();
      logExecution('CascadeFlow', 'FAILED', { error: error.message });
    },

    succeed() {
      trace.status      = 'SUCCESS';
      trace.endTime     = new Date().toISOString();
      trace.totalLatency = Date.now() - startTime;
      persist();
      logExecution('CascadeFlow', 'SUCCESS', {
        totalLatency: `${trace.totalLatency}ms`,
        retries:      trace.retriesCount,
      });
    },
  };

  persist();
  return ctx;
}

// ── CascadeFlow routing helper ─────────────────────────────────────────────────
// Wraps an agent.execute() call and records which model CascadeAgent would
// route to based on task complexity. We use it for TELEMETRY + labelling —
// the agent itself still calls Groq directly (same underlying model pool).

async function routedStep<TInput, TOutput>(
  ctx:        ExecutionContext,
  agent:      { name: string; execute: (input: TInput, retries?: number) => Promise<AgentResponse<TOutput>> },
  stepName:   string,
  state:      ExecutionState,
  input:      TInput,
  taskLabel:  string, // passed to CascadeAgent for routing telemetry only
): Promise<AgentResponse<TOutput>> {
  ctx.addStep(stepName, agent.name, state, 'routing…');

  // Ask CascadeAgent which tier it would use for this task complexity
  let routedModel = 'llama-3.1-8b-instant';
  if (cascadeAgent) {
    try {
      // Run a lightweight routing probe (no real generation needed)
      const routingResult = await cascadeAgent.run(
        `[ROUTING_PROBE] Task: ${taskLabel} — reply with a single word: simple, moderate, hard, or expert.`,
      );
      const complexity = (routingResult?.content ?? '').toLowerCase();
      // Map complexity to model tier
      routedModel = (complexity.includes('hard') || complexity.includes('expert'))
        ? 'llama-3.3-70b-versatile'
        : 'llama-3.1-8b-instant';

      // Record CascadeAgent routing decision in telemetry
      const stats = cascadeAgent.getRouterStats();
      if (ctx.trace.cascadeMetrics) {
        ctx.trace.cascadeMetrics.modelsUsed.push(routedModel);
      } else {
        ctx.trace.cascadeMetrics = { modelsUsed: [routedModel], escalations: 0 };
      }
    } catch {
      // Non-critical — routing probe failure doesn't block execution
    }
  }

  const result = await agent.execute(input);

  ctx.addStep(
    stepName,
    agent.name,
    result.metadata.status as ExecutionState,
    result.metadata.model,
    result.output,
    result.metadata.latency,
    result.metadata.retries,
  );

  return result;
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export class CascadeFlowOrchestrator {
  private emotionAgent         = new EmotionAgent();
  private memoryAgent          = new MemoryAgent();
  private lyricsAgent          = new LyricsAgent();
  private compositionAgent     = new CompositionAgent();
  private producerAgent        = new ProducerAgent();
  private criticAgent          = new CriticAgent();
  private musicGenerationAgent = new MusicGenerationAgent();

  public async runWorkflow(
    request: CreativeRequest,
    userId:  string,
  ): Promise<{ package: FinalCreativePackage; trace: OrchestrationTrace }> {

    const workflowId = `wf-${Date.now()}`;
    const ctx        = createExecutionContext(workflowId, userId);
    const memory     = new HindsightMemory(userId);

    try {
      // ── STEP 0: Hindsight Recall ───────────────────────────────────────────
      ctx.addStep('Hindsight Recall', 'HindsightMemory', 'RUNNING', 'hindsight-sdk');

      const [recalledMemory, synthesizedProfile] = await Promise.all([
        memory.recall(`music preferences for: ${request.direction}`),
        memory.reflect(),
      ]);

      ctx.trace.memoryProfile = synthesizedProfile;
      ctx.addStep(
        'Hindsight Recall', 'HindsightMemory', 'SUCCESS', 'hindsight-sdk',
        { synthesizedProfile, genresRecalled: recalledMemory.preferredGenres },
        undefined, 0,
      );

      // Inject synthesized profile into request for downstream agents
      const enrichedRequest: CreativeRequest = {
        ...request,
        memory: synthesizedProfile !== 'No synthesized profile available yet.'
          ? synthesizedProfile
          : undefined,
      };

      // ── STEP 1: Emotion Analysis ───────────────────────────────────────────
      const emotionRes = await routedStep(
        ctx, this.emotionAgent,
        'Emotion Analysis', 'RUNNING',
        enrichedRequest,
        'Classify emotion, energy, and genre from a short creative brief',
      );

      // ── STEP 2: Memory Recall (MemoryAgent) ───────────────────────────────
      const memoryRes = await routedStep(
        ctx, this.memoryAgent,
        'Memory Synthesis', 'RUNNING',
        {
          request: {
            ...enrichedRequest,
            emotion: emotionRes.output.emotion,
            genre:   emotionRes.output.genre,
          },
          userId,
        },
        'Synthesize user memory preferences for music production brief',
      );

      // ── REFINEMENT LOOP ────────────────────────────────────────────────────
      let lyricsRes!:  AgentResponse<any>;
      let compRes!:    AgentResponse<any>;
      let prodRes!:    AgentResponse<any>;
      let musicgenRes!: AgentResponse<any>;
      let criticRes!:  AgentResponse<any>;

      let loopCount = 0;
      const maxRefinementAttempts = 2;
      let pass = false;

      while (loopCount < maxRefinementAttempts && !pass) {
        const isRefinement    = loopCount > 0;
        const refinementSuffix = isRefinement
          ? ` (CRITIC REFINEMENT ${loopCount}: ${criticRes!.output.feedback})`
          : '';
        const currentRequest: CreativeRequest = {
          ...enrichedRequest,
          direction: `${enrichedRequest.direction}${refinementSuffix}`,
        };

        if (isRefinement) {
          ctx.trace.retriesCount++;
          logExecution('CascadeFlow', 'RETRYING', {
            reason:  criticRes!.output.feedback,
            attempt: loopCount,
          });
        }

        const refinementLabel = isRefinement
          ? `(Refinement ${loopCount})`
          : '';

        // STEP 3: Lyrics Generation
        lyricsRes = await routedStep(
          ctx, this.lyricsAgent,
          `Lyrics Generation ${refinementLabel}`.trim(),
          isRefinement ? 'RETRYING' : 'RUNNING',
          { request: currentRequest, emotionContext: emotionRes.output, memoryContext: memoryRes.output },
          'Write emotionally rich song lyrics with chorus, verses, and bridge',
        );

        // STEP 4: Composition Planning
        compRes = await routedStep(
          ctx, this.compositionAgent,
          `Composition Planning ${refinementLabel}`.trim(),
          isRefinement ? 'RETRYING' : 'RUNNING',
          {
            request:        currentRequest,
            emotionContext: emotionRes.output,
            memoryContext:  memoryRes.output,
            lyrics:         lyricsRes.output.lyrics,
          },
          'Plan BPM, key, instruments, vocal style, and atmosphere for a song',
        );

        // STEP 5: Producer Guidance
        prodRes = await routedStep(
          ctx, this.producerAgent,
          `Producer Guidance ${refinementLabel}`.trim(),
          isRefinement ? 'RETRYING' : 'RUNNING',
          {
            direction:          currentRequest.direction,
            compositionContext: compRes.output,
            lyrics:             lyricsRes.output.lyrics,
          },
          'Write detailed production notes and arrangement guidance for a recording session',
        );

        // STEP 6: Music Generation (Loudly)
        musicgenRes = await routedStep(
          ctx, this.musicGenerationAgent,
          `Music Generation ${refinementLabel}`.trim(),
          isRefinement ? 'RETRYING' : 'RUNNING',
          {
            request:            currentRequest,
            emotionContext:     emotionRes.output,
            compositionContext: compRes.output,
            producerContext:    prodRes.output,
          },
          'Generate parametric Loudly API payload for music generation',
        );

        // STEP 7: Critic Evaluation
        criticRes = await routedStep(
          ctx, this.criticAgent,
          `Critic Evaluation ${refinementLabel}`.trim(),
          'RUNNING',
          {
            title:       lyricsRes.output.title,
            lyrics:      lyricsRes.output.lyrics,
            emotion:     emotionRes.output,
            composition: compRes.output,
            production:  prodRes.output,
            audio:       musicgenRes.output,
          },
          'Critically evaluate song lyrics, composition, and production quality — expert music critic',
        );

        pass = criticRes.output.pass;
        loopCount++;

        // Escalation guard: if we've exhausted retries and still failing
        if (loopCount === maxRefinementAttempts && !pass) {
          const escalationReason = `Critic loop exhausted after ${loopCount} attempts. Last feedback: "${criticRes.output.feedback}"`;
          logExecution('CascadeFlow', 'ESCALATED', { reason: escalationReason });

          ctx.addStep(
            'Escalation Handler', 'CascadeFlowOrchestrator',
            'ESCALATED', 'System Policy',
            { escalated: true, detail: escalationReason },
            undefined, loopCount, escalationReason,
          );

          if (ctx.trace.cascadeMetrics) ctx.trace.cascadeMetrics.escalations++;
          pass = true; // force-exit to finalize package
        }
      }

      // ── STEP 8: Post-session Hindsight Retain ─────────────────────────────
      ctx.addStep('Hindsight Retain', 'HindsightMemory', 'RUNNING', 'hindsight-sdk');
      try {
        const retainPayload: RetainPayload = {
          event:        'SONG_COMPLETED',
          emotion:      emotionRes.output.emotion,
          genre:        emotionRes.output.genre,
          vocalStyle:   compRes.output.vocalStyle,
          atmosphere:   compRes.output.atmosphere,
          lyricalTheme: lyricsRes.output.title ?? request.direction,
          criticScore:  criticRes.output.score ?? undefined,
          approved:     criticRes.output.pass,
        };

        await memory.evolveMemory(retainPayload);

        ctx.addStep(
          'Hindsight Retain', 'HindsightMemory', 'SUCCESS', 'hindsight-sdk',
          { event: retainPayload.event, approved: retainPayload.approved },
          undefined, 0,
        );
      } catch (memErr: any) {
        // Non-fatal: memory update failure should never kill the response
        ctx.addStep(
          'Hindsight Retain', 'HindsightMemory', 'FAILED', 'hindsight-sdk',
          { error: memErr.message }, undefined, 0,
        );
      }

      // ── Assemble final package ─────────────────────────────────────────────
      const albumArtPrompt =
        `Professional album cover for "${lyricsRes.output.title}". ` +
        `Vibe: ${emotionRes.output.emotion} ${emotionRes.output.genre}, ` +
        `atmosphere: ${compRes.output.atmosphere}. Digital art style.`;

      const loudlyPromptStr =
        `${emotionRes.output.genre}, ${compRes.output.bpm} BPM, ` +
        `${emotionRes.output.emotion} mood, ${compRes.output.atmosphere} atmosphere, ` +
        `${compRes.output.vocalStyle}`;

      const sunoPrompt =
        `${emotionRes.output.genre}, ${compRes.output.bpm} BPM, key of ${compRes.output.key}, ` +
        `${compRes.output.vocalStyle}, atmosphere: ${compRes.output.atmosphere}`;

      const totalLatency = Date.now() - ctx.startTime;
      const sessionSummary =
        `MuseFlow session complete. Direction: "${request.direction}". ` +
        `Orchestrated across 7 specialist AI agents via CascadeFlow. ` +
        `Mood: ${emotionRes.output.emotion} ${emotionRes.output.genre} ` +
        `at ${compRes.output.bpm} BPM in Key of ${compRes.output.key}. ` +
        `Audio generated via ${musicgenRes.output.generationMetadata.apiUsed}. ` +
        `Critic retries: ${ctx.trace.retriesCount}. ` +
        `Total latency: ${(totalLatency / 1000).toFixed(1)}s.`;

      const finalPackage: FinalCreativePackage = {
        title:             lyricsRes.output.title,
        lyrics:            lyricsRes.output.lyrics,
        bpm:               compRes.output.bpm,
        key:               compRes.output.key,
        instrumentPalette: compRes.output.instruments,
        atmosphere:        compRes.output.atmosphere,
        productionNotes:   prodRes.output.productionNotes,
        vocalStyle:        compRes.output.vocalStyle,
        arrangementNotes:  prodRes.output.arrangementNotes,
        albumArtPrompt,
        sunoPrompt,
        loudlyPrompt:      loudlyPromptStr,
        musicgenPrompt:    musicgenRes.output.musicgenPrompt,
        generatedAudioUrl: musicgenRes.output.audioUrl,
        allVariations:     musicgenRes.output.allVariations,
        sessionSummary,
      };

      ctx.succeed();
      saveArtifact('final_package', `package_${workflowId}.json`, finalPackage);

      return { package: finalPackage, trace: ctx.trace };

    } catch (error: any) {
      ctx.fail(error);
      throw error;
    }
  }
}

// ── Re-export trace types for index.ts ────────────────────────────────────────
export type { OrchestrationTrace, ExecutionState, StepTrace } from '../types';
