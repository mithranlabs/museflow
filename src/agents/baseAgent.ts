import { AgentResponse } from '../types';
import { saveArtifact } from '../artifacts/storage';
import { logExecution } from '../utils/logger';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GROQ_API_KEY;
const groq = apiKey ? new Groq({ apiKey }) : null;

export abstract class BaseAgent<TInput, TOutput> {
  public name: string;
  protected model: string;

  constructor(name: string, model: string = 'llama-3.3-70b-specdec') {
    this.name = name;
    this.model = model;
  }

  protected async callLLM(prompt: string, format: 'json' | 'text' = 'text'): Promise<string> {
    if (groq) {
      try {
        const response = await groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: this.model,
          response_format: format === 'json' ? { type: 'json_object' } : undefined,
          temperature: 0.7,
        });
        return response.choices[0]?.message?.content || '';
      } catch (error) {
        console.error(`[Groq Error in ${this.name}]:`, error);
        throw error;
      }
    } else {
      // Fallback to high-quality mock data if API key is missing
      return this.getMockResponse(prompt, format);
    }
  }

  protected abstract getMockResponse(prompt: string, format: 'json' | 'text'): string;

  public async execute(input: TInput, retries: number = 0): Promise<AgentResponse<TOutput>> {
    logExecution(this.name, 'RUNNING', { timestamp: new Date().toISOString() });
    const startTime = Date.now();
    try {
      const output = await this.process(input);
      const latency = Date.now() - startTime;
      
      const response: AgentResponse<TOutput> = {
        output,
        metadata: {
          agent: this.name,
          model: this.model,
          latency,
          retries,
          timestamp: new Date().toISOString(),
          status: 'SUCCESS'
        }
      };
      
      saveArtifact(this.name, 'output.json', response);
      logExecution(this.name, 'SUCCESS', { latency, model: this.model });
      return response;
    } catch (error) {
      const latency = Date.now() - startTime;
      logExecution(this.name, 'FAILED', { error: String(error), latency });
      
      if (retries < 2) {
        logExecution(this.name, 'RETRYING', { attempt: retries + 1 });
        return this.execute(input, retries + 1);
      }
      
      const response: AgentResponse<TOutput> = {
        output: null as unknown as TOutput,
        metadata: {
          agent: this.name,
          model: this.model,
          latency,
          retries,
          timestamp: new Date().toISOString(),
          status: 'FAILED'
        }
      };
      saveArtifact(this.name, 'error.json', response);
      return response;
    }
  }

  protected abstract process(input: TInput): Promise<TOutput>;
}
