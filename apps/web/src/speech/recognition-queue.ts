export interface RecognitionJob {
  id: string;
  utteranceId: string;
  audio: Float32Array;
  durationMs: number;
  final: boolean;
}
const release = (job: RecognitionJob | null) => {
  if (job?.audio.byteLength) job.audio.fill(0);
};
/** One replaceable draft, bounded final jobs, and only one running inference. */
export class RecognitionQueue {
  active: RecognitionJob | null = null;
  private finals: RecognitionJob[] = [];
  private draft: RecognitionJob | null = null;
  get size() {
    return (
      this.finals.length +
      Number(this.active !== null) +
      Number(this.draft !== null)
    );
  }
  hasFinal(utteranceId: string) {
    return (
      Boolean(this.active?.final && this.active.utteranceId === utteranceId) ||
      this.finals.some((job) => job.utteranceId === utteranceId)
    );
  }
  add(job: RecognitionJob): boolean {
    if (!job.final) {
      if (this.hasFinal(job.utteranceId)) {
        release(job);
        return false;
      }
      release(this.draft);
      this.draft = job;
      return true;
    }
    if (this.draft?.utteranceId === job.utteranceId) {
      release(this.draft);
      this.draft = null;
    }
    if (this.finals.length + Number(this.active !== null) >= 3) {
      release(job);
      return false;
    }
    this.finals.push(job);
    return true;
  }
  next(): RecognitionJob | null {
    if (this.active) return null;
    const job = this.finals.shift() ?? this.draft;
    if (job === this.draft) this.draft = null;
    this.active = job ?? null;
    return this.active;
  }
  finish(id: string): RecognitionJob | null {
    if (this.active?.id !== id) return null;
    const job = this.active;
    this.active = null;
    return job;
  }
  discardDrafts() {
    release(this.draft);
    this.draft = null;
  }
  clear() {
    this.finals.forEach(release);
    this.finals = [];
    this.discardDrafts();
    this.active = null;
  }
}
