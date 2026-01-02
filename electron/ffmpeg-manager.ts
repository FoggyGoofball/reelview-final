/**
 * FFmpeg Manager - Uses bundled FFmpeg binary for self-contained functionality
 * No external dependencies required!
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';
import { execSync, spawn } from 'child_process';

const logFile = path.join(os.homedir(), 'reelview-ffmpeg.log');

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(logFile, line);
  } catch (e) {}
  console.log('[FFMPEG]', msg);
}

try {
  fs.writeFileSync(logFile, `=== FFMPEG MANAGER ${new Date().toISOString()} ===\n`);
} catch (e) {}

// Cached FFmpeg path
let cachedFFmpegPath: string | null = null;

/**
 * Get bundled FFmpeg path from ffmpeg-static package
 */
function getBundledFFmpegPath(): string | null {
  try {
    // ffmpeg-static provides the path to the bundled binary
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      log(`? Found bundled FFmpeg: ${ffmpegStatic}`);
      return ffmpegStatic;
    }
  } catch (e: any) {
    log(`Bundled FFmpeg not found: ${e.message}`);
  }
  return null;
}

/**
 * Get FFmpeg executable path - tries bundled first, then system
 */
export function getFFmpegPath(): string | null {
  // Return cached path if available
  if (cachedFFmpegPath) {
    return cachedFFmpegPath;
  }
  
  log('Looking for FFmpeg...');
  
  // 1. Try bundled FFmpeg (from ffmpeg-static)
  const bundled = getBundledFFmpegPath();
  if (bundled) {
    try {
      const result = execSync(`"${bundled}" -version 2>&1`, { 
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 10000
      });
      if (result.includes('ffmpeg version')) {
        log(`? Bundled FFmpeg verified working`);
        cachedFFmpegPath = bundled;
        return bundled;
      }
    } catch (e: any) {
      log(`Bundled FFmpeg test failed: ${e.message?.substring(0, 100)}`);
    }
  }
  
  // 2. Try system FFmpeg as fallback
  try {
    const result = execSync('ffmpeg -version 2>&1', { 
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    if (result.includes('ffmpeg version')) {
      log('? System FFmpeg available');
      cachedFFmpegPath = 'ffmpeg';
      return 'ffmpeg';
    }
  } catch (e) {
    // No system FFmpeg
  }
  
  log('? No FFmpeg found!');
  return null;
}

/**
 * Check if FFmpeg is available
 */
export function hasFFmpeg(): boolean {
  return getFFmpegPath() !== null;
}

/**
 * Convert TS to MKV using FFmpeg
 * Returns output path (MKV if successful, TS if failed)
 */
export function convertToMKV(
  inputPath: string, 
  outputPath: string,
  onProgress?: (status: string) => void
): Promise<string> {
  return new Promise((resolve) => {
    const ffmpegPath = getFFmpegPath();
    
    if (!ffmpegPath) {
      log('? FFmpeg not available - keeping TS file');
      onProgress?.('FFmpeg not available');
      resolve(inputPath); // Return original TS
      return;
    }
    
    log(`Converting: ${path.basename(inputPath)} ? ${path.basename(outputPath)}`);
    onProgress?.('Converting to MKV...');
    
    // Ensure output directory exists
    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    
    // Delete existing output
    try {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    } catch (e) {}
    
    const args = [
      '-i', inputPath,
      '-c', 'copy',      // No re-encoding (fast!)
      '-movflags', '+faststart', // Optimize for streaming
      '-y',              // Overwrite
      outputPath
    ];
    
    log(`Running: "${ffmpegPath}" ${args.join(' ')}`);
    
    const ffmpeg = spawn(ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stderr = '';
    
    ffmpeg.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on('close', (code) => {
      log(`FFmpeg exited with code: ${code}`);
      
      if (code === 0) {
        try {
          const stats = fs.statSync(outputPath);
          if (stats.size > 1000) { // At least 1KB
            log(`? Conversion complete: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            // Delete temp TS file
            try { fs.unlinkSync(inputPath); } catch (e) {}
            onProgress?.('Conversion complete');
            resolve(outputPath);
            return;
          }
        } catch (e) {
          log(`Output file check failed: ${e}`);
        }
      }
      
      // Conversion failed - keep TS
      log(`? Conversion failed (code ${code})`);
      if (stderr) {
        log(`FFmpeg stderr: ${stderr.slice(-300)}`);
      }
      onProgress?.('Conversion failed - keeping TS');
      resolve(inputPath);
    });
    
    ffmpeg.on('error', (err) => {
      log(`FFmpeg spawn error: ${err.message}`);
      onProgress?.('FFmpeg error - keeping TS');
      resolve(inputPath);
    });
    
    // Timeout after 5 minutes
    setTimeout(() => {
      try {
        ffmpeg.kill();
        log('FFmpeg timeout - killed process');
      } catch (e) {}
    }, 5 * 60 * 1000);
  });
}

export { log as logFFmpeg };
