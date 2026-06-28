import { useEffect, useState } from "react";

/**
 * TypingText — types each phrase character-by-character, holds, deletes,
 * then moves to the next phrase. Loops forever.
 */
export function TypingText({
  phrases,
  typeSpeed = 55,
  deleteSpeed = 30,
  holdAfterType = 1600,
  holdAfterDelete = 350,
  className = "",
  caretClassName = "",
}: {
  phrases: string[];
  typeSpeed?: number;
  deleteSpeed?: number;
  holdAfterType?: number;
  holdAfterDelete?: number;
  className?: string;
  caretClassName?: string;
}) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"typing" | "holding" | "deleting" | "paused">(
    "typing",
  );

  useEffect(() => {
    const current = phrases[phraseIndex] ?? "";
    let timeout: ReturnType<typeof setTimeout>;

    if (mode === "typing") {
      if (text.length < current.length) {
        timeout = setTimeout(
          () => setText(current.slice(0, text.length + 1)),
          typeSpeed,
        );
      } else {
        timeout = setTimeout(() => setMode("deleting"), holdAfterType);
      }
    } else if (mode === "deleting") {
      if (text.length > 0) {
        timeout = setTimeout(
          () => setText(current.slice(0, text.length - 1)),
          deleteSpeed,
        );
      } else {
        timeout = setTimeout(() => {
          setPhraseIndex((i) => (i + 1) % phrases.length);
          setMode("typing");
        }, holdAfterDelete);
      }
    }

    return () => clearTimeout(timeout);
  }, [text, mode, phraseIndex, phrases, typeSpeed, deleteSpeed, holdAfterType, holdAfterDelete]);

  return (
    <span className={className}>
      {text}
      <span
        aria-hidden
        className={
          "narah-typing-caret ml-0.5 inline-block w-[0.55ch] -translate-y-[0.05em] " +
          caretClassName
        }
      >
        ▍
      </span>
    </span>
  );
}
