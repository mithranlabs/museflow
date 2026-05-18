export interface AgentResponse<T> {
  output: T;
  metadata: {
    agent: string;
    model: string;
    latency: number;
    retries: number;
    timestamp: string;
    status: 'SUCCESS' | 'FAILED' | 'RETRYING' | 'ESCALATED';
  };
}

export interface CreativeRequest {
  emotion?: string;
  memory?: string;
  vibe?: string;
  story?: string;
  genre?: string;
  direction: string;
}

export interface EmotionOutput {
  emotion: string;
  energy: string;
  genre: string;
}

export interface CompositionOutput {
  bpm: number;
  key: string;
  instruments: string[];
  vocalStyle: string;
  atmosphere: string;
}

export interface FinalCreativePackage {
  title: string;
  lyrics: string;
  bpm: number;
  key: string;
  instrumentPalette: string[];
  atmosphere: string;
  productionNotes: string;
  vocalStyle: string;
  arrangementNotes: string;
  albumArtPrompt: string;
  sunoPrompt: string;
}
