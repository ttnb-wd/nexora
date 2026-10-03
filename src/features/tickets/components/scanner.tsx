"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { scanEventTicket } from "../server/actions";
import type { ScanState } from "../types";
import styles from "./ticket.module.css";

type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type DetectorConstructor = { new(options: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> };

export function Scanner({ eventId, scope }: { eventId: string; scope: string | null }) {
  const [state, action, pending] = useActionState<ScanState, FormData>(scanEventTicket.bind(null, eventId, scope), {});
  const [token, setToken] = useState("");
  const [camera, setCamera] = useState("Camera off. Enter a full ticket token or QR URL below.");
  const [running, setRunning] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);

  function stop() {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
    setRunning(false);
  }
  useEffect(() => {
    const lifecycle = generation;
    const onHide = () => { if (document.hidden) { stop(); setCamera("Camera stopped. Start it again when ready."); } };
    document.addEventListener("visibilitychange", onHide);
    return () => { lifecycle.current++; if (timer.current) clearTimeout(timer.current); stream.current?.getTracks().forEach(track => track.stop()); document.removeEventListener("visibilitychange", onHide); };
  }, []);

  async function start() {
    stop(); const run = generation.current;
    const NativeDetector = (window as Window & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
    if (!NativeDetector || !navigator.mediaDevices?.getUserMedia) { setCamera("Camera QR scanning is unavailable in this browser. Use manual entry below."); return; }
    setRunning(true); setCamera("Requesting camera permission…");
    try {
      if (!(await NativeDetector.getSupportedFormats()).includes("qr_code")) throw new Error("Unsupported QR");
      const feed = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (generation.current !== run) { feed.getTracks().forEach(track => track.stop()); return; }
      stream.current = feed;
      if (!video.current) { stop(); return; }
      video.current.srcObject = feed; await video.current.play();
      if (generation.current !== run) return;
      setCamera("Camera active. Point it at the attendee’s QR code. Nothing is recorded.");
      const detector = new NativeDetector({ formats: ["qr_code"] });
      const scan = async () => {
        if (generation.current !== run || !video.current) return;
        try {
          const codes = await detector.detect(video.current);
          if (generation.current !== run) return;
          if (codes[0]) { setToken(codes[0].rawValue.slice(0, 2048)); stop(); setCamera("QR captured. Select Check in ticket to validate it."); return; }
        } catch { stop(); setCamera("Camera could not read a QR. Use manual entry below."); return; }
        timer.current = setTimeout(scan, 350);
      };
      void scan();
    } catch { if (generation.current === run) { stop(); setCamera("Camera unavailable or permission denied. Use manual entry below."); } }
  }
  return <section className={styles.card} aria-label="Secure ticket check-in">
    <h2>QR check-in</h2><p>Scan a QR or enter the full ticket token. Check-in is validated for this event.</p>
    <div className={styles.controls}><button type="button" className={buttonStyles({ variant: "secondary" })} disabled={running || pending} onClick={start}>Start camera</button>{running && <button type="button" className={buttonStyles({ variant: "secondary" })} onClick={() => { stop(); setCamera("Camera stopped. Manual entry is available."); }}>Stop camera</button>}</div>
    <p role="status">{camera}</p><video ref={video} className={styles.video} hidden={!running} muted playsInline aria-label="Live QR camera preview" />
    <form action={action} className={styles.form}>
      <label htmlFor="ticket-token">Ticket token or QR URL</label>
      <textarea id="ticket-token" name="token" value={token} onChange={event => setToken(event.target.value)} maxLength={2048} required autoComplete="off" spellCheck={false} />
      <button className={buttonStyles()} disabled={pending || !token.trim()}>{pending ? "Validating…" : "Check in ticket"}</button>
    </form>
    {state.message && <div className={styles.status} role="status" aria-live="polite"><p>{state.message}</p>{state.name && <p>Attendee: <strong>{state.name}</strong></p>}</div>}
  </section>;
}
