# LUFS Buff

LUFS Buff is the second stage of the Corpus Voces audio pipeline. It standardizes loudness, analyzes clip quality, and produces QC reports for WAV clips exported by VoiceClipper.

LUFS Buff does not enhance or creatively modify audio. It measures, normalizes loudness, and reports technical quality metrics.

## Requirements

- Node.js 18+
- FFmpeg and ffprobe on your PATH

Verify FFmpeg:

```bash
ffmpeg -version
ffprobe -version
```

## Installation

```bash
cd lufs-buff
npm install
npm link   # optional: install `lufs-buff` globally
```

## Command Line

Basic usage:

```bash
lufs-buff ./raw_clips ./normalized_clips
```

Custom target loudness:

```bash
lufs-buff ./raw_clips ./normalized_clips --target -20
```

Dry run (analyze + report only):

```bash
lufs-buff ./raw_clips ./normalized_clips --dry-run
```

Report-only with explicit report folder:

```bash
lufs-buff ./raw_clips ./normalized_clips --report-only --report ./reports
```

### Expected project layout

```text
Project/
├── source/
│   └── original_recording.m4a
├── raw_clips/
│   ├── dangerous_mistake.wav
│   └── close_the_door.wav
├── normalized_clips/
│   ├── dangerous_mistake.wav
│   └── close_the_door.wav
└── reports/
    ├── qc-report.json
    └── qc-report.csv
```

Raw clips are never overwritten. Normalized output filenames match input filenames exactly.

## Programmatic API

VoiceClipper (or other orchestrators) should pass explicit paths. LUFS Buff does not discover upstream folders on its own.

```javascript
import { processCorpus } from 'lufs-buff';

const result = await processCorpus({
  inputFolder: './raw_clips',
  outputFolder: './normalized_clips',
  reportFolder: './reports',
  targetLufs: -23,
});

console.log(result.summary);
// { total: 115, pass: 110, review: 4, reject: 1 }
```

Available exports:

- `processCorpus`
- `analyzeAudio`
- `normalizeAudio`
- `classifyClip`
- `writeReports`
- `discoverWavFiles`
- `QC_THRESHOLDS`
- `DEFAULTS`

## Quality Control

Each clip receives one of:

- `PASS` — no significant issues
- `REVIEW` — unusual loudness, silence, duration, or near clipping
- `REJECT` — clipping, corruption, invalid file, or missing content

Reports include per-clip metrics:

- filename, duration, sample rate, channels
- integrated LUFS, RMS dBFS, peak dBFS, true peak
- clipping count and percentage
- leading/trailing silence (ms)
- status and notes

Thresholds live in `src/config.js` (`QC_THRESHOLDS`).

## Audio Processing Rules (v1)

Allowed:

- Loudness normalization (FFmpeg `loudnorm`, two-pass)
- Loudness and peak measurement
- Silence analysis
- QC reporting

Not performed in v1:

- EQ, noise reduction, compression for character, AI cleanup, spectral repair

## Testing

```bash
npm test
```

Tests cover file discovery, QC classification, report generation, filename preservation, folder creation, error handling, and an FFmpeg integration path (skipped automatically when FFmpeg is unavailable).

## Architecture

```text
src/
├── cli.js
├── processCorpus.js
├── analyzeAudio.js
├── normalizeAudio.js
├── qcRules.js
├── writeReports.js
├── fileUtils.js
├── ffmpegUtils.js
├── config.js
└── index.js
```

VoiceClipper passes `--manifest` automatically when post-processing is enabled. Reports and the session manifest preserve speaker/session metadata and attach clip content metadata to each clip entry.

## Next stage

After LUFS Buff, run [Corpus Finisher](../corpus-finisher) to pad clips for training:

```bash
corpus-finisher ./normalized_clips ./training_clips
```
