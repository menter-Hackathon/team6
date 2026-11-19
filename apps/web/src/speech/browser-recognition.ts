// Minimal Web Speech types: not all TypeScript DOM versions include this API.
export interface BrowserResult {
  isFinal: boolean;
  0: { transcript: string };
}
export interface BrowserResultEvent {
  resultIndex: number;
  results: ArrayLike<BrowserResult>;
}
export interface BrowserRecognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: BrowserResultEvent) => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type BrowserRecognizerConstructor = new () => BrowserRecognizer;
export function recognitionConstructor():
  BrowserRecognizerConstructor | undefined {
  const host = window as unknown as {
    SpeechRecognition?: BrowserRecognizerConstructor;
    webkitSpeechRecognition?: BrowserRecognizerConstructor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition;
}
export type BrowserRecognitionState =
  "off" | "starting" | "listening" | "stopping";
interface Callbacks {
  state: (state: BrowserRecognitionState) => void;
  speaking: (speaking: boolean) => void;
  partial: (text: string) => void;
  final: (text: string, id: string) => void;
  interim?: (text: string, id: string) => void;
  error: (message: string) => void;
}
const ERRORS: Record<string, string> = {
  "not-allowed":
    "マイクまたは音声認識が許可されていません。ブラウザのサイト設定を確認してください。",
  "service-not-allowed":
    "このブラウザでは認識サービスを利用できません。PC版Chromeで試すか、端末内認識へ切り替えてください。",
  "audio-capture":
    "マイクが見つからないか、使用できません。ブラウザの既定のマイクを確認してください。",
  network:
    "認識サービスへ接続できません。通信状況を確認してください。内蔵ブラウザで使えない場合はPC版Chromeで試してください。",
  "language-not-supported":
    "このブラウザの認識サービスは日本語に対応していません。",
};

export class BrowserRecognition {
  private active: BrowserRecognizer | null = null;
  private desired = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private rapidEnds = 0;
  private sessionId = crypto.randomUUID();
  private sequence = 0;
  constructor(
    private readonly Recognition: BrowserRecognizerConstructor,
    private readonly callbacks: Callbacks,
  ) {}

  start() {
    if (this.active || this.desired) return;
    this.desired = true;
    this.rapidEnds = 0;
    this.callbacks.error("");
    this.open();
  }
  private open() {
    if (!this.desired) return;
    this.timer = undefined;
    let recognition: BrowserRecognizer;
    try {
      recognition = new this.Recognition();
    } catch {
      this.desired = false;
      this.callbacks.error(
        "音声認識を起動できません。PC版Chromeまたは端末内認識を試してください。",
      );
      this.callbacks.state("off");
      return;
    }
    this.active = recognition;
    const started = Date.now(),
      committed = new Set<number>(),
      prefix = `${this.sessionId}:${++this.sequence}`;
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    const current = () => this.active === recognition;
    recognition.onstart = () => {
      if (!current()) return;
      if (!this.desired) {
        recognition.abort();
        return;
      }
      this.callbacks.state("listening");
    };
    recognition.onspeechstart = () => {
      if (current() && this.desired) this.callbacks.speaking(true);
    };
    recognition.onspeechend = () => {
      if (current()) this.callbacks.speaking(false);
    };
    recognition.onresult = (event) => {
      if (!current()) return;
      let interim = "";
      for (let index = 0; index < event.results.length; index++) {
        const result = event.results[index];
        if (!result) continue;
        const text = result[0].transcript.trim();
        if (result.isFinal) {
          if (index >= event.resultIndex && !committed.has(index)) {
            committed.add(index);
            if (text) {
              this.rapidEnds = 0;
              this.callbacks.final(text, `${prefix}:${index}`);
            }
          }
        } else {
          interim += text;
          this.callbacks.interim?.(text, `${prefix}:${index}`);
        }
      }
      this.callbacks.partial(interim);
    };
    recognition.onerror = ({ error }) => {
      if (!current()) return;
      if (error === "no-speech" && this.desired) return;
      if (error !== "aborted" || this.desired)
        this.callbacks.error(
          ERRORS[error] ??
            "音声認識が停止しました。もう一度マイクをONにしてください。",
        );
      this.cancel();
    };
    recognition.onend = () => {
      if (!current()) return;
      this.detach(recognition);
      this.active = null;
      if (this.timer) clearTimeout(this.timer);
      this.callbacks.speaking(false);
      this.callbacks.partial("");
      if (this.desired) {
        this.rapidEnds = Date.now() - started < 2000 ? this.rapidEnds + 1 : 0;
        if (this.rapidEnds < 3) {
          this.callbacks.state("starting");
          this.timer = setTimeout(() => this.open(), 500);
          return;
        }
        this.desired = false;
        this.callbacks.error(
          "認識サービスが繰り返し終了しました。PC版Chromeで試すか、端末内認識へ切り替えてください。",
        );
      }
      this.callbacks.state("off");
    };
    this.callbacks.state("starting");
    try {
      recognition.start();
    } catch {
      this.callbacks.error(
        "音声認識を開始できませんでした。接続とマイク権限を確認してください。",
      );
      this.cancel();
    }
  }
  stop() {
    this.desired = false;
    if (this.timer) clearTimeout(this.timer);
    if (!this.active) {
      this.callbacks.state("off");
      return;
    }
    this.callbacks.state("stopping");
    this.callbacks.speaking(false);
    // Allow the service to finalize words already heard, then force cleanup.
    this.timer = setTimeout(() => this.cancel(), 2000);
    try {
      this.active.stop();
    } catch {
      this.cancel();
    }
  }
  cancel() {
    this.desired = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    const recognition = this.active;
    this.active = null;
    if (recognition) {
      this.detach(recognition);
      try {
        recognition.abort();
      } catch {
        /* Already ended. */
      }
    }
    this.callbacks.partial("");
    this.callbacks.speaking(false);
    this.callbacks.state("off");
  }
  private detach(recognition: BrowserRecognizer) {
    recognition.onstart =
      recognition.onend =
      recognition.onspeechstart =
      recognition.onspeechend =
        null;
    recognition.onresult = recognition.onerror = null;
  }
}
