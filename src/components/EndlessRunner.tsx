import React, { useEffect, useRef, useState } from "react";

/**
 * EndlessRunner.tsx — SSR‑safe runner game
 */

export type RunnerTheme = "snow" | "forest" | "night";

const THEME_PALETTES: Record<RunnerTheme, { bg: string; ground: string; player: string; obstacle: string; accent: string }>= {
  snow:   { bg: "#eaf4ff", ground: "#bcd3e6", player: "#0a2540", obstacle: "#2d6a9f", accent: "#89b4d8" },
  forest: { bg: "#ecf5ee", ground: "#b7d3bf", player: "#143d2a", obstacle: "#2e7d4a", accent: "#7fba9a" },
  night:  { bg: "#0e1116", ground: "#2a2f37", player: "#f5f7fb", obstacle: "#7aa2ff", accent: "#525b68" },
};

const clamp = (v:number, min:number, max:number)=> Math.max(min, Math.min(max, v));

type Props = {
  theme?: RunnerTheme;
  height?: number;
  onScore?: (score:number)=>void;
};

export default function EndlessRunner({ theme = "snow", height = 220, onScore }: Props) {
  // Early out for SSR
  if (typeof window === "undefined") return null;

  const palette = THEME_PALETTES[theme];
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  useEffect(() => {
    try {
      const k = window.localStorage.getItem("runner:best");
      if (k) setBest(parseInt(k, 10) || 0);
    } catch {}
  }, []);

  // Game state
  const stateRef = useRef({
    speed: 240,
    time: 0,
    groundY: height - 32,
    playerX: 56,
    playerY: 0,
    vy: 0,
    gravity: 1100,
    jump: 410,
    obstacles: [] as { x:number; w:number; h:number }[],
    spawnTimer: 0,
  });

  const resize = () => {
    const c = canvasRef.current; const w = wrapRef.current;
    if (!c || !w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = w.clientWidth;
    const cssH = height;
    c.width  = Math.floor(cssW * dpr);
    c.height = Math.floor(cssH * dpr);
    c.style.width = cssW + "px";
    c.style.height = cssH + "px";
  };

  useEffect(() => {
    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    const onVis = () => { if (document.hidden) pause(); };
    document.addEventListener("visibilitychange", onVis);
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (!running) { start(); return; }
        jump();
      } else if (e.code === "KeyP") { togglePause(); }
      else if (e.code === "Enter" && gameOver) { restart(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("keydown", onKey);
      stopRAF();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, gameOver]);

  const start = () => {
    if (running) return;
    setGameOver(false);
    setScore(0);
    resetState();
    setRunning(true);
    lastTsRef.current = performance.now();
    loop(lastTsRef.current);
  };

  const pause = () => { setRunning(false); stopRAF(); };
  const togglePause = () => { running ? pause() : start(); };
  const restart = () => { setGameOver(false); setScore(0); resetState(); setRunning(true); lastTsRef.current = performance.now(); loop(lastTsRef.current); };

  const stopRAF = () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };

  const resetState = () => {
    const s = stateRef.current;
    s.time = 0;
    s.speed = 240;
    s.groundY = height - 32;
    s.playerY = s.groundY - 28;
    s.vy = 0;
    s.obstacles = [];
    s.spawnTimer = 0;
  };

  const jump = () => {
    const s = stateRef.current;
    const onGround = Math.abs(s.playerY - (s.groundY - 28)) < 1 || s.playerY > (s.groundY - 30);
    if (onGround) {
      s.vy = -s.jump;
    }
  };

  const handlePointer = () => {
    if (!running) { start(); return; }
    if (gameOver) { restart(); return; }
    jump();
  };

  const loop = (ts: number) => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const dt = clamp((ts - lastTsRef.current) / 1000, 0, 0.05);
    lastTsRef.current = ts;

    const s = stateRef.current;
    s.time += dt;
    s.speed = 240 + Math.min(360, s.time * 25);

    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      const h = 18 + Math.random() * 26;
      const w = 14 + Math.random() * 22;
      s.obstacles.push({ x: c.width / dpr + w, w, h });
      s.spawnTimer = 1.0 + Math.random() * 0.8;
    }

    s.vy += s.gravity * dt;
    s.playerY += s.vy * dt;
    const playerH = 28;
    if (s.playerY > s.groundY - playerH) { s.playerY = s.groundY - playerH; s.vy = 0; }

    const pxPerFrame = s.speed * dt * dpr;
    for (const o of s.obstacles) { o.x -= pxPerFrame; }
    s.obstacles = s.obstacles.filter(o => o.x + o.w * dpr > 0);

    const playerX = s.playerX * dpr;
    const playerY = s.playerY * dpr;
    const playerW = 26 * dpr;
    const playerHH = playerH * dpr;

    for (const o of s.obstacles) {
      const ox = o.x * dpr; const ow = o.w * dpr; const oh = o.h * dpr;
      const oy = (s.groundY * dpr) - oh;
      const hit = playerX < ox + ow && playerX + playerW > ox && playerY < oy + oh && playerY + playerHH > oy;
      if (hit) {
        setGameOver(true);
        setRunning(false);
        stopRAF();
        const newBest = Math.max(best, score);
        setBest(newBest);
        try {
          window.localStorage.setItem("runner:best", String(newBest));
        } catch {}
        return;
      }
    }

    setScore(prev => {
      const next = prev + Math.floor(10 * dt * (1 + s.time * 0.1));
      if (onScore && next !== prev) onScore(next);
      return next;
    });

    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = palette.bg; ctx.fillRect(0, 0, c.width, c.height);
    const gy = s.groundY * dpr;
    ctx.fillStyle = palette.ground; ctx.fillRect(0, gy, c.width, c.height - gy);

    ctx.fillStyle = palette.player;
    ctx.fillRect(s.playerX * dpr, playerY, playerW, playerHH);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(s.playerX * dpr, playerY - 3 * dpr, playerW, 3 * dpr);

    ctx.fillStyle = palette.obstacle;
    for (const o of s.obstacles) {
      const ox = o.x * dpr; const ow = o.w * dpr; const oh = o.h * dpr;
      const oy = gy - oh;
      ctx.beginPath();
      ctx.moveTo(ox + ow / 2, oy - oh * 0.3);
      ctx.lineTo(ox, gy);
      ctx.lineTo(ox + ow, gy);
      ctx.closePath();
      ctx.fill();
    }

    if (running) {
      rafRef.current = requestAnimationFrame(loop);
    }
  };

  const Button = ({ onClick, children, title }: { onClick: ()=>void; children: React.ReactNode; title?: string }) => (
    <button
      onClick={onClick}
      title={title}
      className="px-3 py-1 rounded-2xl border text-sm shadow-sm hover:shadow transition disabled:opacity-50"
      style={{ borderColor: palette.obstacle, color: palette.player, background: "white" }}
    >{children}</button>
  );

  return (
    <div ref={wrapRef} className="w-full max-w-[900px] mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium" style={{ color: palette.player }}>Score: {score}</span>
          <span className="text-sm" style={{ color: palette.obstacle }}>Best: {best}</span>
        </div>
        <div className="flex items-center gap-2">
          {!running && !gameOver && <Button onClick={start} title="Start">Play</Button>}
          {running && <Button onClick={togglePause} title="Pause (P)">Pause</Button>}
          {!running && !gameOver && score>0 && <Button onClick={start} title="Resume">Resume</Button>}
          {gameOver && <Button onClick={restart} title="Restart (Enter)">Restart</Button>}
        </div>
      </div>

      <div
        className="rounded-2xl overflow-hidden border shadow-sm select-none"
        style={{ borderColor: palette.obstacle, background: palette.bg }}
      >
        <canvas
          ref={canvasRef}
          height={height}
          onClick={handlePointer}
          onTouchStart={handlePointer}
          className="block w-full cursor-pointer"
          aria-label="Endless runner game canvas"
        />
      </div>

      <p className="mt-2 text-xs opacity-70" style={{ color: palette.player }}>
        Tap/Click/Space/↑ to jump • P to pause • Enter to restart
      </p>

      {gameOver && (
        <div className="mt-3 p-3 rounded-xl border text-sm" style={{ borderColor: palette.obstacle, background: "white", color: palette.player }}>
          <b>Game over!</b> Your score: {score}. {score >= best ? "New best!" : ""}
        </div>
      )}
    </div>
  );
}
