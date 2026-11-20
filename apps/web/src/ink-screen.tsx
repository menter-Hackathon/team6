import {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import logoUrl from "./assets/images/logo.png";
import "./ink-theme.css";

/** Logo image used across the ink screens. logo.svg is about 7 MB, so the PNG is used. */
export const LOGO_SRC = logoUrl;

/** Background ink: one big splat anchored to each corner plus a few droplets. */
export function InkSplats() {
  return (
    <div className="ink-entry-splats" aria-hidden="true">
      <svg className="ink-entry-splat ink-entry-splat--tl" viewBox="0 0 400 400">
        <path d="M0 0H330C352 28 304 62 252 70C192 82 200 140 230 180C262 226 210 280 152 270C100 262 92 320 52 340C26 352 0 346 0 330Z" />
        <path d="M332 108C362 88 402 110 396 160C390 222 370 300 340 310C310 318 300 280 310 230C318 190 300 130 332 108Z" />
      </svg>
      <svg className="ink-entry-splat ink-entry-splat--tr" viewBox="0 0 500 400">
        <path d="M40 0H500V230C474 246 436 226 404 196C366 160 304 172 262 146C222 122 254 92 200 76C140 58 62 70 40 40C30 25 28 0 40 0Z" />
      </svg>
      <svg className="ink-entry-splat ink-entry-splat--bl" viewBox="0 0 400 400">
        <path d="M0 138C42 118 90 150 112 120C142 80 222 70 262 110C302 150 282 222 300 272C318 330 340 400 340 400H0Z" />
      </svg>
      <svg className="ink-entry-splat ink-entry-splat--br" viewBox="0 0 400 400">
        <path d="M0 400C20 340 60 320 92 290C132 252 140 180 170 140C200 100 232 112 252 160C272 210 292 230 340 240C370 246 400 250 400 250V400Z" />
      </svg>
      <span className="ink-entry-drop ink-entry-drop--magenta ink-entry-drop--a" />
      <span className="ink-entry-drop ink-entry-drop--magenta ink-entry-drop--b" />
      <span className="ink-entry-drop ink-entry-drop--magenta ink-entry-drop--c" />
      <span className="ink-entry-drop ink-entry-drop--green ink-entry-drop--d" />
      <span className="ink-entry-drop ink-entry-drop--green ink-entry-drop--e" />
      <span className="ink-entry-drop ink-entry-drop--green ink-entry-drop--f" />
      <span className="ink-entry-drop ink-entry-drop--blue ink-entry-drop--g" />
    </div>
  );
}

type PanelColor = "blue" | "green";
type BlobColor = "magenta" | "blue";

interface InkPanelScreenProps {
  label: string;
  title: string;
  color: PanelColor;
  /** Optional link-style control shown at the card's top right (back, close…). */
  corner?: ReactNode;
  /** The round "準備OK！" style button that overlaps the card's bottom right. */
  blob?: ReactNode;
  /**
   * What is still missing before the blob button can be pressed. While set,
   * hovering the button (or trying to press it) shows this hint and outlines
   * every child marked with the `is-missing` class in red.
   */
  blockedHint?: string | undefined;
  /** Landscape card (episode / skin screens) with the title at the top left. */
  wide?: boolean;
  /** Blue ink underline under the title. */
  titleUnderline?: boolean;
  /** Sits above another ink screen (e.g. opened from the waiting room). */
  overlay?: boolean;
  /** Wraps the card in a form when given. */
  onSubmit?: () => void;
  children: ReactNode;
}

const NUDGE_MS = 900;

/**
 * Full-screen ink page with the logo in the top-left corner and one tilted
 * card (create room / join room / waiting room).
 */
export function InkPanelScreen({
  label,
  title,
  color,
  corner,
  blob,
  blockedHint,
  wide = false,
  titleUnderline = false,
  overlay = false,
  onSubmit,
  children,
}: InkPanelScreenProps) {
  const [nudged, setNudged] = useState(0);
  const hintId = useId();
  useEffect(() => {
    if (!nudged) return;
    const timer = window.setTimeout(() => setNudged(0), NUDGE_MS);
    return () => window.clearTimeout(timer);
  }, [nudged]);
  const card = (
    <>
      <h2 className={`ink-panel-title${titleUnderline ? " ink-panel-title--underline" : ""}`}>
        {title}
      </h2>
      {corner && <div className="ink-panel-corner">{corner}</div>}
      <div className="ink-panel-body">{children}</div>
      {blob && (
        <div
          className="ink-panel-blob"
          onClickCapture={(event) => {
            // A blocked blob stays focusable/hoverable but must not act:
            // cancel the click (and so the form submit) and point at what is missing.
            if (!blockedHint) return;
            event.preventDefault();
            event.stopPropagation();
            setNudged((count) => count + 1);
          }}
        >
          {blockedHint && (
            <p id={hintId} className="ink-blob-hint" role={nudged ? "alert" : undefined}>
              {blockedHint}
            </p>
          )}
          <BlockedContext.Provider value={blockedHint ? hintId : undefined}>
            {blob}
          </BlockedContext.Provider>
        </div>
      )}
    </>
  );
  const className = `ink-panel ink-panel--${color}${wide ? " ink-panel--wide" : ""}${nudged ? " is-nudged" : ""}`;
  return (
    <section
      className={`ink-entry ink-entry--panel${wide ? " ink-entry--wide" : ""}${overlay ? " ink-entry--overlay" : ""}`}
      aria-label={label}
    >
      <InkSplats />
      <img className="ink-corner-logo" src={LOGO_SRC} alt="ガヤペ！" />
      <div className="ink-panel-stage">
        {onSubmit ? (
          <form
            className={className}
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            {card}
          </form>
        ) : (
          <div className={className}>{card}</div>
        )}
      </div>
    </section>
  );
}

interface InkBlobButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  color: BlobColor;
}

/** Set by InkPanelScreen while its blob button is blocked: the hint's element id. */
const BlockedContext = createContext<string | undefined>(undefined);

/**
 * Round, blobby ink button ("準備OK！"). Inside a blocked InkPanelScreen it is
 * marked aria-disabled instead of disabled, so hover and clicks can still
 * explain what is missing.
 */
export function InkBlobButton({ color, className, children, ...rest }: InkBlobButtonProps) {
  const blockedHintId = useContext(BlockedContext);
  const blocked = blockedHintId !== undefined;
  return (
    <button
      type="button"
      {...rest}
      aria-disabled={blocked || undefined}
      aria-describedby={blockedHintId}
      className={`ink-blob ink-blob--${color}${blocked ? " is-blocked" : ""}${className ? ` ${className}` : ""}`}
    >
      <span className="ink-blob-label">{children}</span>
    </button>
  );
}

export function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <rect x="8" y="8" width="12" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M5 16V5a2 2 0 0 1 2-2h9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M7.5 12h8M12.5 8.5 16 12l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
