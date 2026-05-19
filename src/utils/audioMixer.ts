import { exec, execSync } from 'child_process';
import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import { logExecution } from './logger';

export interface AudioMixerInput {
  backingTrackUrlOrPath: string;
  vocalTrackPath: string;
  outputPath: string;
  vocalDelaySeconds?: number;
  effects?: string[];
  mixStyle?: string;
}

/**
 * Resolves the absolute path to the FFmpeg command, checking both the system PATH 
 * and local winget installation folders for Gyan.FFmpeg.
 */
function getFfmpegCommand(): string {
  // 1. Check if ffmpeg is globally available on PATH
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {}

  // 2. Check winget installation directory fallback
  const userProfile = process.env.USERPROFILE || '';
  const wingetDir = path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages');
  
  if (fsSync.existsSync(wingetDir)) {
    try {
      const pkgs = fsSync.readdirSync(wingetDir);
      const gyanPkg = pkgs.find(p => p.toLowerCase().includes('gyan.ffmpeg'));
      if (gyanPkg) {
        const binDir = path.join(wingetDir, gyanPkg);
        // Recursive search for ffmpeg.exe inside the package
        const walk = (dir: string): string | null => {
          const files = fsSync.readdirSync(dir);
          for (const f of files) {
            const full = path.join(dir, f);
            if (fsSync.statSync(full).isDirectory()) {
              const found = walk(full);
              if (found) return found;
            } else if (f.toLowerCase() === 'ffmpeg.exe') {
              return full;
            }
          }
          return null;
        };
        const foundExe = walk(binDir);
        if (foundExe) {
          logExecution('AudioMixer', 'FFMPEG_FOUND_WINGET_FALLBACK', { path: foundExe });
          return `"${foundExe}"`;
        }
      }
    } catch (err: any) {
      logExecution('AudioMixer', 'WINGET_SEARCH_FAILED', { error: err.message });
    }
  }

  return 'ffmpeg';
}

/**
 * Downloads a file if it's a URL, otherwise returns the path.
 */
async function getLocalPath(urlOrPath: string, tempDir: string): Promise<string> {
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    const cleanUrl = urlOrPath.split('?')[0] || '';
    const tempFile = path.join(tempDir, `download_${Date.now()}_${path.basename(cleanUrl)}`);
    logExecution('AudioMixer', 'DOWNLOADING_TRACK', { url: urlOrPath });
    
    const res = await fetch(urlOrPath);
    if (!res.ok) throw new Error(`Failed to download backing track: ${res.statusText}`);
    
    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(tempFile, buffer);
    return tempFile;
  }
  return urlOrPath;
}

/**
 * Checks if FFmpeg is available.
 */
function isFfmpegAvailable(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    exec(`${cmd} -version`, (error) => {
      resolve(!error);
    });
  });
}

/**
 * Mixes the backing track and vocals together using FFmpeg with advanced ambient processing,
 * spatial Haas widening, reverb, chorus, low/high pass filtering, and sidechain compression ducking.
 * Falls back to copying the backing track on error or if FFmpeg is not installed.
 */
export async function mixAudio(input: AudioMixerInput, tempDir: string): Promise<string> {
  const localBacking = await getLocalPath(input.backingTrackUrlOrPath, tempDir);
  const localVocals  = input.vocalTrackPath;
  const delayMs      = (input.vocalDelaySeconds ?? 5) * 1000;

  const cmd = getFfmpegCommand();
  const hasFfmpeg = await isFfmpegAvailable(cmd);

  if (!hasFfmpeg) {
    logExecution('AudioMixer', 'FFMPEG_NOT_FOUND_FALLBACK', {
      message: 'FFmpeg is not installed on the system. Returning original backing track without mixed vocals.'
    });
    await fs.copyFile(localBacking, input.outputPath);
    return input.outputPath;
  }

  logExecution('AudioMixer', 'START_MIXING_WITH_EFFECTS', {
    delayMs,
    effects: input.effects || [],
    mixStyle: input.mixStyle || 'default',
    command: cmd
  });

  // Construct dynamic FFmpeg filtergraph for ambient, dreamy vocal treatment
  let filterGraph = '';
  let currentLabel = '1:a';

  // 1. Initial delay
  filterGraph += `[${currentLabel}]adelay=${delayMs}|${delayMs}[v_delayed];`;
  currentLabel = 'v_delayed';

  // 2. Haas Stereo Widening (Layering/Timing offset)
  // Duplicates vocal mono stream, delays one channel by 25ms, and joins them as a wide stereo pair
  filterGraph += `[${currentLabel}]asplit=2[vw1][vw2];[vw2]adelay=25|25[vw2_del];[vw1][vw2_del]join=inputs=2:channel_layout=stereo:map=0.0-FL|1.0-FR[v_widened];`;
  currentLabel = 'v_widened';

  // 3. High-Pass & Low-Pass filtering (removes mud and hides MeloTTS robotic high artifacts)
  let highPassFreq = 250;
  let lowPassFreq = 3500;
  if (input.effects?.includes('high-pass filter')) highPassFreq = 350;
  if (input.effects?.includes('low-pass filter')) lowPassFreq = 3000;
  filterGraph += `[${currentLabel}]highpass=f=${highPassFreq},lowpass=f=${lowPassFreq}[v_filtered];`;
  currentLabel = 'v_filtered';

  // 4. Chorus (adds lush thickness/modulation)
  if (input.effects?.includes('soft chorus') || input.effects?.includes('chorus')) {
    filterGraph += `[${currentLabel}]chorus=0.6:0.8:55:0.4:0.25:2[v_chorus];`;
    currentLabel = 'v_chorus';
  }

  // 5. Reverb / Multi-Tap Echo (creates the dreamy atmospheric tail)
  let delayParams = '160|280|400';
  let decayParams = '0.35|0.25|0.15';
  if (input.effects?.includes('large reverb')) {
    delayParams = '200|320|480|650';
    decayParams = '0.45|0.35|0.22|0.12';
  } else if (input.effects?.includes('stereo delay')) {
    delayParams = '250|500';
    decayParams = '0.3|0.15';
  }
  filterGraph += `[${currentLabel}]aecho=0.8:0.75:${delayParams}:${decayParams}[v_reverbed];`;
  currentLabel = 'v_reverbed';

  // 6. Overdrive / Tape Saturation (adds warmth and texture)
  if (input.effects?.includes('tape saturation') || input.effects?.includes('soft distortion')) {
    filterGraph += `[${currentLabel}]asoverdrive=gain=3[v_saturated];`;
    currentLabel = 'v_saturated';
  }

  // 7. Mix Style Volume Blending (vocals should sit INTO the music, not on top)
  let vocalVolume = 1.3;
  if (input.mixStyle === 'distant ambient' || input.mixStyle === 'blended background') {
    vocalVolume = 0.95; // sit clearly in the pad/instrumental mix
  } else if (input.mixStyle === 'lo-fi megaphone') {
    vocalVolume = 1.1;
  }
  filterGraph += `[${currentLabel}]volume=${vocalVolume}[v_processed];`;

  // 8. Split the processed vocal so it can be consumed by both sidechain compressor and amix
  filterGraph += `[v_processed]asplit=2[v_proc1][v_proc2];`;

  // 9. Sidechain compression ducking
  // Ducks backing track [0:a] slightly (threshold -18dB) when vocals [v_proc1] are active
  filterGraph += `[0:a][v_proc1]sidechaincompress=threshold=-18dB:ratio=4:attack=50:release=300[backing_ducked];`;

  // 10. Final blend using the second split of processed vocal
  filterGraph += `[backing_ducked][v_proc2]amix=inputs=2:duration=longest`;

  const mixCmd = `${cmd} -y -i "${localBacking}" -i "${localVocals}" -filter_complex "${filterGraph}" "${input.outputPath}"`;

  return new Promise((resolve, reject) => {
    exec(mixCmd, (error, stdout, stderr) => {
      if (error) {
        logExecution('AudioMixer', 'MIX_FAILED_FALLBACK_COPY', { error: error.message, stderr });
        fs.copyFile(localBacking, input.outputPath)
          .then(() => resolve(input.outputPath))
          .catch(reject);
      } else {
        logExecution('AudioMixer', 'MIX_SUCCESS', { path: input.outputPath });
        resolve(input.outputPath);
      }
    });
  });
}
