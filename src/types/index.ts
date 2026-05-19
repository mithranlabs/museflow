// ── Core agent I/O ─────────────────────────────────────────────────────────────

export interface AgentResponse<T> {
  output: T;
  metadata: AgentMetadata;
}

export interface AgentMetadata {
  agent:      string;
  model:      string;
  latency:    number;
  retries:    number;
  timestamp:  string;
  status:     'SUCCESS' | 'FAILED' | 'RETRYING' | 'ESCALATED';
  escalation?: string;
}

// ── Creative request ───────────────────────────────────────────────────────────

export interface CreativeRequest {
  direction: string;
  emotion?:  string;
  memory?:   string;
  vibe?:     string;
  story?:    string;
  genre?:    string;
}

// ── Agent-specific output shapes ───────────────────────────────────────────────

export interface EmotionOutput {
  emotion: string;
  energy:  string;
  genre:   string;
}

export interface CompositionOutput {
  bpm:        number;
  key:        string;
  instruments: string[];
  vocalStyle: string;
  atmosphere: string;
}

export interface VocalStylingOutput {
  voiceType: string;
  delivery: string;
  effects: string[];
  mixStyle: string;
  vocalDensity: string;
  vocalHooks: string[];
}

// ── Final creative package (returned by orchestrator) ─────────────────────────

export interface FinalCreativePackage {
  title:            string;
  lyrics:           string;
  bpm:              number;
  key:              string;
  instrumentPalette: string[];
  atmosphere:       string;
  productionNotes:  string;
  vocalStyle:       string;
  arrangementNotes: string;
  albumArtPrompt:   string;
  albumArtUrl?:     string;
  sunoPrompt:       string;
  loudlyPrompt:     string;   // replaces musicgenPrompt
  musicgenPrompt:   string;   // kept for backward-compat
  generatedAudioUrl: string;
  allVariations?:   Array<{ trackId: string; audioUrl: string }>;
  sessionSummary:   string;
}

// ── Execution context (Part 4 — runtime intelligence) ─────────────────────────

export type ExecutionState =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'RETRYING'
  | 'ESCALATED';

export interface StepTrace {
  step:       string;
  agent:      string;
  state:      ExecutionState;
  model:      string;
  latency?:   number;
  retries?:   number;
  timestamp:  string;
  output?:    any;
  escalation?: string;
}

export interface OrchestrationTrace {
  workflowId:    string;
  userId:        string;
  status:        ExecutionState;
  startTime:     string;
  endTime?:      string;
  totalLatency?: number;
  steps:         StepTrace[];
  retriesCount:  number;
  memoryProfile?: string;       // synthesized Hindsight profile
  cascadeMetrics?: {            // CascadeAgent routing stats
    modelsUsed: string[];
    escalations: number;
  };
}

export interface ExecutionContext {
  workflowId:   string;
  userId:       string;
  startTime:    number;
  trace:        OrchestrationTrace;
  addStep:      (
    stepName: string,
    agentName: string,
    state: ExecutionState,
    model: string,
    output?: any,
    latency?: number,
    retries?: number,
    escalation?: string,
  ) => void;
  fail:         (error: Error) => void;
  succeed:      () => void;
}
