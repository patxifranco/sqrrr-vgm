const readline = require('readline');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Paths
const AUDIO_DIR = path.join(__dirname, '..', 'public', 'audio');
const SONGS_JSON = path.join(__dirname, '..', 'songs.json');
const TEMP_DIR = path.join(__dirname, 'temp');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisified question
function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

// Parse timestamp to seconds (supports: 0:00, 1:30, 0:01.5, 90, 1:30.25)
function parseTimestamp(timestamp) {
  timestamp = timestamp.trim();

  // If it's just a number (possibly with decimals), return it as seconds
  if (/^\d+(\.\d+)?$/.test(timestamp)) {
    return parseFloat(timestamp);
  }

  // Parse MM:SS or MM:SS.ms format
  const match = timestamp.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (match) {
    const minutes = parseInt(match[1], 10);
    const seconds = parseFloat(match[2]);
    return minutes * 60 + seconds;
  }

  throw new Error(`Invalid timestamp format: ${timestamp}`);
}

// Download file from URL
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with status ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });

    request.on('error', reject);
  });
}

// FFmpeg path (update this if your FFmpeg is installed elsewhere)
const FFMPEG_PATH = 'C:\\ffmpeg-8.0.1-essentials_build\\bin\\ffmpeg.exe';

// Process audio with FFmpeg
function processAudio(inputPath, outputPath, startTime) {
  return new Promise((resolve, reject) => {
    // FFmpeg command: crop from startTime, 41s duration, 3s fade at 38s, 128kbps
    const cmd = `"${FFMPEG_PATH}" -y -i "${inputPath}" -ss ${startTime} -t 41 -af "afade=t=out:st=38:d=3" -b:a 128k "${outputPath}"`;

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`FFmpeg error: ${error.message}\n${stderr}`));
        return;
      }
      resolve();
    });
  });
}

// Get next available ID from songs.json
function getNextId(songs) {
  if (songs.length === 0) return 1;
  return Math.max(...songs.map(s => s.id)) + 1;
}

// Main function
async function main() {
  console.log('\n=== VGM Song Processor ===\n');

  try {
    // Check if FFmpeg is available
    await new Promise((resolve, reject) => {
      exec(`"${FFMPEG_PATH}" -version`, (error) => {
        if (error) {
          reject(new Error(`FFmpeg not found at ${FFMPEG_PATH}!\nPlease update FFMPEG_PATH in this file.`));
        }
        resolve();
      });
    });

    // Get user inputs
    const url = await ask('Paste khinsider download URL: ');
    const timestampStr = await ask('Start timestamp (e.g., 0:00, 1:30.5): ');
    const filename = await ask('Output filename (kebab-case, no .mp3): ');
    const gameName = await ask('Game name: ');
    const songName = await ask('Song name: ');
    const aliasesStr = await ask('Game aliases (comma-separated): ');

    // Parse inputs
    const startTime = parseTimestamp(timestampStr);
    const outputFilename = filename.endsWith('.mp3') ? filename : `${filename}.mp3`;
    const aliases = aliasesStr.split(',').map(a => a.trim()).filter(a => a.length > 0);

    // Paths
    const tempPath = path.join(TEMP_DIR, 'temp_download.mp3');
    const outputPath = path.join(AUDIO_DIR, outputFilename);

    console.log('\nProcessing...');

    // Download
    console.log('  Downloading MP3...');
    await downloadFile(url, tempPath);
    console.log('  ✓ Downloaded');

    // Process with FFmpeg
    console.log(`  Processing: crop from ${timestampStr}, 41s duration, 3s fade...`);
    await processAudio(tempPath, outputPath, startTime);
    console.log('  ✓ Processed and encoded at 128kbps');

    // Clean up temp file
    fs.unlinkSync(tempPath);

    // Update songs.json
    console.log('  Updating songs.json...');
    const songs = JSON.parse(fs.readFileSync(SONGS_JSON, 'utf8'));
    const newId = getNextId(songs);

    const newSong = {
      id: newId,
      file: outputFilename,
      game: gameName,
      gameAliases: aliases,
      song: songName
    };

    songs.push(newSong);
    fs.writeFileSync(SONGS_JSON, JSON.stringify(songs, null, 2));
    console.log(`  ✓ Added to songs.json (ID: ${newId})`);

    console.log(`\n✓ Saved to public/audio/${outputFilename}`);
    console.log('\nDone!\n');

  } catch (error) {
    console.error('\n✗ Error:', error.message);
  } finally {
    rl.close();
  }
}

main();
