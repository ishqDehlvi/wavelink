"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The 25-second Wavelink film (brand/ad), playing muted in the hero.
 * Autoplays on loop unless the visitor prefers reduced motion; pauses while scrolled out of view.
 * "Sound on" restarts it from the top with the score.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const reduced = useRef(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced.current) v.play().catch(() => {});
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) v.pause();
        else if (!reduced.current && v.paused && v.dataset.userPaused !== "1") v.play().catch(() => {});
      },
      { threshold: 0.25 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      v.dataset.userPaused = "0";
      v.play().catch(() => {});
    } else {
      v.dataset.userPaused = "1";
      v.pause();
    }
  };

  const sound = () => {
    const v = ref.current;
    if (!v) return;
    if (v.muted) {
      v.muted = false;
      v.currentTime = 0;
      v.dataset.userPaused = "0";
      v.play().catch(() => {});
    } else {
      v.muted = true;
    }
    setMuted(v.muted);
  };

  return (
    <figure className="frame relative overflow-hidden">
      <video
        ref={ref}
        className="block aspect-video w-full bg-[#f1ece2]"
        poster="/video/wavelink-ad-poster.jpg"
        muted
        loop
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        aria-label="A 25-second film: a morning of 47 unread WhatsApp chats, one question to the AI, a brief of what matters, a Hinglish voice note turned into English, and a reply sent only after approval."
      >
        <source src="/video/wavelink-ad.webm" type="video/webm" />
        <source src="/video/wavelink-ad.mp4" type="video/mp4" />
      </video>

      {!playing && (
        <button
          type="button"
          onClick={toggle}
          className="absolute inset-0 grid place-items-center bg-transparent"
          aria-label="Play the film"
        >
          <span className="grid h-20 w-20 place-items-center rounded-full bg-ink text-paper shadow-[0_12px_30px_-10px_rgba(13,19,16,0.6)] transition-transform hover:scale-105">
            <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8" aria-hidden="true">
              <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
            </svg>
          </span>
        </button>
      )}

      <div className="absolute bottom-3 right-3 flex gap-2">
        <button
          type="button"
          onClick={toggle}
          className="grid h-9 w-9 place-items-center rounded-full bg-ink/85 text-paper transition-colors hover:bg-ink"
          aria-label={playing ? "Pause the film" : "Play the film"}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" aria-hidden="true">
              <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={sound}
          className="inline-flex h-9 items-center gap-2 rounded-full bg-ink/85 px-3.5 text-[13px] font-semibold text-paper transition-colors hover:bg-ink"
          aria-pressed={!muted}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
            {muted ? (
              <path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
          {muted ? "Sound on" : "Mute"}
        </button>
      </div>
    </figure>
  );
}
