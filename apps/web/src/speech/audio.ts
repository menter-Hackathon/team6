export const SPEECH_SAMPLE_RATE = 16000;

/** Average the source samples in each output window (mono, downsampling only). */
export function resampleAudio(
  input: Float32Array,
  sourceRate: number,
): Float32Array {
  if (sourceRate === SPEECH_SAMPLE_RATE) return input.slice();
  if (!Number.isFinite(sourceRate) || sourceRate < SPEECH_SAMPLE_RATE)
    throw new Error("Unsupported sample rate");
  const ratio = sourceRate / SPEECH_SAMPLE_RATE;
  const output = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < output.length; i++) {
    const start = Math.floor(i * ratio),
      end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j]!;
    output[i] = sum / Math.max(1, end - start);
  }
  return output;
}

export function joinAudio(chunks: readonly Float32Array[]): Float32Array {
  const result = new Float32Array(
    chunks.reduce((sum, chunk) => sum + chunk.length, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function monoAudio(buffer: AudioBuffer): Float32Array {
  const result = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let i = 0; i < samples.length; i++)
      result[i] = result[i]! + samples[i]! / buffer.numberOfChannels;
  }
  return result;
}

/** Bounded gain for quiet input; retain relative dynamics and never clip a peak. */
export function prepareRecognitionAudio(audio: Float32Array): void {
  if (!audio.length) return;
  let mean = 0;
  for (const sample of audio) mean += sample;
  mean /= audio.length;
  let peak = 0;
  for (let i = 0; i < audio.length; i++) {
    audio[i] = audio[i]! - mean;
    peak = Math.max(peak, Math.abs(audio[i]!));
  }
  if (peak < 1e-6) return;
  const gain = Math.min(4, 0.85 / peak);
  for (let i = 0; i < audio.length; i++) audio[i] = audio[i]! * gain;
}
