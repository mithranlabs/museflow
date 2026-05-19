import { logExecution } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

export class ImageService {
  private hfToken: string | null = null;

  constructor() {
    this.hfToken = process.env.HF_TOKEN ?? null;
  }

  /**
   * Generates album cover art for the given prompt and saves it to the output directory.
   * Falls back to Pollinations.ai if Hugging Face is not configured or fails.
   */
  public async generateAlbumArt(prompt: string, workflowId: string, outputDir: string): Promise<string> {
    const filename = `album_art_${workflowId}.jpg`;
    const outputPath = path.join(outputDir, filename);

    // Make sure output folder exists
    await fs.mkdir(outputDir, { recursive: true });

    // 1. Try Hugging Face FLUX.1-schnell if token is configured
    if (this.hfToken) {
      try {
        logExecution('ImageService', 'GENERATING_HF_FLUX', { prompt });
        const response = await fetch(
          'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.hfToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ inputs: prompt }),
          }
        );

        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          // Basic check to verify we didn't get an error JSON or empty file
          if (buffer.length > 5000) {
            await fs.writeFile(outputPath, buffer);
            logExecution('ImageService', 'GENERATE_SUCCESS_HF', { path: outputPath });
            return filename;
          }
        }
        
        const errText = await response.text();
        logExecution('ImageService', 'HF_FAILED_FALLING_BACK', { status: response.status, error: errText });
      } catch (err: any) {
        logExecution('ImageService', 'HF_ERROR_FALLING_BACK', { error: err.message });
      }
    }

    // 2. Fallback to Pollinations.ai (Keyless, free, very fast & beautiful)
    try {
      logExecution('ImageService', 'GENERATING_POLLINATIONS_FALLBACK', { prompt });
      const cleanPrompt = prompt.replace(/[^\w\s\-\,\.\']/gi, '').trim();
      const seed = Math.floor(Math.random() * 1000000);
      const url = `https://image.pollinations.ai/p/${encodeURIComponent(cleanPrompt)}?width=1024&height=1024&nologo=true&private=true&enhance=false&seed=${seed}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Pollinations.ai responded with status ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(outputPath, buffer);
      logExecution('ImageService', 'GENERATE_SUCCESS_POLLINATIONS', { path: outputPath });
      return filename;
    } catch (err: any) {
      logExecution('ImageService', 'GENERATE_FAILED_ALL', { error: err.message });
      // Ultimate fallback: write a simple solid colored 1x1 pixel image or mock
      const mockJpgBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
      await fs.writeFile(outputPath, Buffer.from(mockJpgBase64, 'base64'));
      return filename;
    }
  }
}

export const imageService = new ImageService();
