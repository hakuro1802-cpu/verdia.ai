import { lerp, smootherstep, windowT, easeOutBack, easeInOutCubic } from "./easing";

export type CinemaState = {
  time: number;
  duration: number;
  warm: boolean;
  w: number;
  h: number;
  dpr: number;
  dt: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  hue: number;
};

function beatProgress(time: number) {
  // Continuous story drivers (seconds)
  const night = 1 - windowT(time, 4.5, 7);
  const seed = windowT(time, 5.2, 8);
  const dawn = windowT(time, 10, 14);
  const grow = windowT(time, 11, 16.5);
  const answer = windowT(time, 16.5, 21);
  const mind = windowT(time, 22, 26);
  const title = windowT(time, 26.5, 29.5);
  return { night, seed, dawn, grow, answer, mind, title };
}

export function createCinemaRenderer(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const dust: Particle[] = [];
  const fireflies: Particle[] = [];
  const pollen: Particle[] = [];

  function resize(w: number, h: number, dpr: number) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawnDust(cx: number, cy: number, n: number, time: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 20 + Math.random() * 80;
      dust.push({
        x: cx + Math.cos(a) * 10,
        y: cy + Math.sin(a) * 10,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 20,
        life: 0,
        max: 1.2 + Math.random() * 1.4,
        size: 1.2 + Math.random() * 2.2,
        hue: 70 + Math.random() * 40,
      });
    }
    void time;
  }

  function ensureAmbient(w: number, h: number, answer: number, mind: number) {
    while (fireflies.length < Math.floor(14 * Math.max(answer, mind))) {
      fireflies.push({
        x: Math.random() * w,
        y: h * 0.25 + Math.random() * h * 0.35,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 8,
        life: Math.random(),
        max: 1,
        size: 1.5 + Math.random() * 2,
        hue: 70,
      });
    }
    while (pollen.length < Math.floor(40 * (0.2 + answer))) {
      pollen.push({
        x: Math.random() * w,
        y: Math.random() * h * 0.7,
        vx: 4 + Math.random() * 10,
        vy: (Math.random() - 0.5) * 6,
        life: Math.random(),
        max: 1,
        size: 0.8 + Math.random() * 1.4,
        hue: 55,
      });
    }
  }

  function draw(state: CinemaState) {
    const { time, duration, warm, w, h, dt } = state;
    const t = warm ? lerp(26.5, duration, Math.min(1, time / Math.max(0.001, duration))) : time;
    const p = warm
      ? { night: 0, seed: 1, dawn: 1, grow: 1, answer: 1, mind: 1, title: smootherstep(time / duration) }
      : beatProgress(t);

    // Camera — slow push-in + gentle breathe (staging)
    const camZoom = lerp(1, 1.18, easeInOutCubic(t / duration));
    const camX = Math.sin(t * 0.15) * 8;
    const camY = Math.cos(t * 0.11) * 5 - p.dawn * 10;

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w / 2 + camX, h / 2 + camY);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-w / 2, -h / 2);

    drawSky(ctx, w, h, p, t);
    drawHills(ctx, w, h, p, t);
    drawSoil(ctx, w, h);
    drawRoots(ctx, w, h, p, t);
    drawPlant(ctx, w, h, p, t);
    drawButterflies(ctx, w, h, p, t);

    ensureAmbient(w, h, p.answer, p.mind);
    updateAndDrawParticles(ctx, fireflies, w, h, dt, "firefly");
    updateAndDrawParticles(ctx, pollen, w, h, dt, "pollen");

    if (p.title > 0.05 && dust.length < 120) {
      spawnDust(w * 0.5, h * 0.42, 8, t);
    }
    updateAndDrawParticles(ctx, dust, w, h, dt, "dust");

    ctx.restore();

    // Film grade + vignette (screen space)
    drawGrade(ctx, w, h, p);
    if (p.title > 0) drawTitle(ctx, w, h, p.title, t);
  }

  return { resize, draw };
}

function drawSky(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: ReturnType<typeof beatProgress>,
  t: number,
) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  // Night → dawn → day color blend
  const r1 = lerp(10, 110, p.dawn);
  const g1 = lerp(18, 160, p.dawn);
  const b1 = lerp(28, 200, p.dawn);
  const r2 = lerp(5, 200, p.dawn);
  const g2 = lerp(12, 220, p.dawn);
  const b2 = lerp(14, 180, p.dawn);
  g.addColorStop(0, `rgb(${r1 * (1 - p.mind * 0.1)},${g1},${b1})`);
  g.addColorStop(0.55, `rgb(${lerp(8, 180, p.dawn)},${lerp(20, 210, p.dawn)},${lerp(30, 200, p.dawn)})`);
  g.addColorStop(1, `rgb(${r2},${Math.max(g2, 190 * p.dawn + 20)},${Math.max(40, b2 - 40)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Stars
  if (p.night > 0.05) {
    ctx.globalAlpha = p.night * 0.9;
    for (let i = 0; i < 60; i++) {
      const x = ((i * 97) % w) + Math.sin(t * 0.3 + i) * 2;
      const y = ((i * 53) % (h * 0.5)) + 10;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i));
      ctx.fillStyle = `rgba(255,255,255,${tw})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + (i % 3) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Sun
  if (p.dawn > 0) {
    const sx = w * 0.72;
    const sy = lerp(h * 0.72, h * 0.2, easeInOutCubic(p.dawn));
    const rad = lerp(20, 55, p.dawn);
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad * 3.2);
    glow.addColorStop(0, `rgba(255,230,160,${0.55 * p.dawn})`);
    glow.addColorStop(0.4, `rgba(255,200,120,${0.2 * p.dawn})`);
    glow.addColorStop(1, "rgba(255,200,120,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, rad * 3.2, 0, Math.PI * 2);
    ctx.fill();
    const core = ctx.createRadialGradient(sx - rad * 0.2, sy - rad * 0.2, 0, sx, sy, rad);
    core.addColorStop(0, "#fff8dc");
    core.addColorStop(0.55, "#f2d28b");
    core.addColorStop(1, "#e0a85a");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(sx, sy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft volumetric godrays at dawn
  if (p.dawn > 0.3) {
    ctx.save();
    ctx.globalAlpha = 0.08 * p.dawn;
    ctx.fillStyle = "#fff3c8";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const x = w * 0.55 + i * 40;
      ctx.moveTo(w * 0.72, h * 0.22);
      ctx.lineTo(x - 30, h);
      ctx.lineTo(x + 30, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawHills(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: ReturnType<typeof beatProgress>,
  t: number,
) {
  const nightShade = 1 - p.dawn * 0.55;
  // Far hills
  ctx.beginPath();
  ctx.moveTo(0, h * 0.68);
  for (let x = 0; x <= w; x += 20) {
    const y =
      h * 0.66 +
      Math.sin(x * 0.01 + 1) * 18 * nightShade +
      Math.sin(x * 0.02 + t * 0.1) * 3;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = p.dawn > 0.4 ? "#3f7a55" : "#143024";
  ctx.fill();

  // Near hills with grass shimmer
  ctx.beginPath();
  ctx.moveTo(0, h * 0.74);
  for (let x = 0; x <= w; x += 16) {
    const y = h * 0.73 + Math.sin(x * 0.015 + 2) * 14 + Math.sin(x * 0.05 + t * 0.8) * 1.5;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  const hg = ctx.createLinearGradient(0, h * 0.7, 0, h);
  hg.addColorStop(0, p.dawn > 0.4 ? "#4f9464" : "#1c4030");
  hg.addColorStop(1, p.dawn > 0.4 ? "#2d5a3c" : "#0e2418");
  ctx.fillStyle = hg;
  ctx.fill();
}

function drawSoil(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const top = h * 0.62;
  const g = ctx.createLinearGradient(0, top, 0, h);
  g.addColorStop(0, "#6a4a36");
  g.addColorStop(0.35, "#3a261a");
  g.addColorStop(1, "#140c08");
  ctx.fillStyle = g;
  ctx.fillRect(0, top, w, h - top);

  // Soil lip
  ctx.fillStyle = "rgba(90,60,42,0.9)";
  ctx.beginPath();
  ctx.moveTo(0, top);
  for (let x = 0; x <= w; x += 12) {
    ctx.lineTo(x, top + Math.sin(x * 0.04) * 2);
  }
  ctx.lineTo(w, top + 10);
  ctx.lineTo(0, top + 10);
  ctx.closePath();
  ctx.fill();
}

function drawRoots(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: ReturnType<typeof beatProgress>,
  t: number,
) {
  const reveal = Math.max(p.grow * 0.3, p.answer, p.mind);
  if (reveal <= 0.01) return;
  const cx = w * 0.5;
  const cy = h * 0.66;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 2;
  const glow = p.mind > 0;
  ctx.strokeStyle = glow ? `rgba(125,206,160,${0.35 + 0.35 * Math.sin(t * 2)})` : "rgba(90,60,40,0.7)";
  if (glow) {
    ctx.shadowColor = "rgba(125,206,160,0.6)";
    ctx.shadowBlur = 8;
  }
  const roots = [
    [0, 0, -30, 40, -55, 90],
    [0, 0, 28, 38, 58, 95],
    [0, 0, -5, 50, 0, 110],
    [0, 0, -45, 55, -80, 85],
    [0, 0, 48, 52, 90, 88],
  ];
  for (const r of roots) {
    ctx.beginPath();
    ctx.moveTo(cx + r[0]!, cy + r[1]!);
    const len = reveal;
    ctx.quadraticCurveTo(
      cx + r[2]! * len,
      cy + r[3]! * len,
      cx + r[4]! * len,
      cy + r[5]! * len,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlant(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: ReturnType<typeof beatProgress>,
  t: number,
) {
  const cx = w * 0.5;
  const soilY = h * 0.64;

  // Seed — squash/stretch breathe (Pixar appeal)
  if (p.seed > 0 && p.grow < 0.85) {
    const appear = easeOutBack(p.seed);
    const breath = 1 + Math.sin(t * 2.2) * 0.06;
    const squashY = breath;
    const squashX = 1 / breath;
    ctx.save();
    ctx.translate(cx, soilY + 8);
    ctx.scale(appear * squashX, appear * squashY);
    ctx.globalAlpha = 1 - p.grow * 0.9;
    const sg = ctx.createRadialGradient(-3, -2, 0, 0, 0, 14);
    sg.addColorStop(0, "#e8d2a8");
    sg.addColorStop(1, "#a07848");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Sprout growth with anticipation then ease-out-back
  if (p.grow > 0) {
    const g = easeOutBack(Math.min(1, p.grow * 1.05));
    const sway = Math.sin(t * 1.4) * 0.04 * p.grow;
    const stemH = 90 * g;
    ctx.save();
    ctx.translate(cx, soilY);
    ctx.rotate(sway);

    // Stem
    ctx.strokeStyle = "#2f7a4a";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-2, -stemH * 0.35, 2, -stemH * 0.65, 0, -stemH);
    ctx.stroke();

    // Leaves — overlapping action (different phase)
    const leafProg = smootherstep((p.grow - 0.25) / 0.75);
    if (leafProg > 0) {
      drawLeaf(ctx, -8, -stemH * 0.45, -0.9, leafProg, t, 0);
      drawLeaf(ctx, 8, -stemH * 0.55, 0.9, leafProg * 0.95, t, 1);
      drawLeaf(ctx, -6, -stemH * 0.72, -0.7, leafProg * 0.85, t, 2);
      drawLeaf(ctx, 7, -stemH * 0.82, 0.75, leafProg * 0.8, t, 3);
    }

    // Intelligence wisps
    if (p.mind > 0) {
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 3);
      ctx.strokeStyle = "rgba(180,255,200,0.8)";
      ctx.fillStyle = "rgba(200,255,210,0.9)";
      ctx.lineWidth = 1;
      const pts = [
        [-18, -stemH * 0.7],
        [0, -stemH * 0.95],
        [18, -stemH * 0.65],
      ];
      ctx.beginPath();
      ctx.moveTo(pts[0]![0]!, pts[0]![1]!);
      ctx.lineTo(pts[1]![0]!, pts[1]![1]!);
      ctx.lineTo(pts[2]![0]!, pts[2]![1]!);
      ctx.stroke();
      for (const pt of pts) {
        ctx.beginPath();
        ctx.arc(pt[0]!, pt[1]!, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}

function drawLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: number,
  prog: number,
  t: number,
  phase: number,
) {
  const flutter = Math.sin(t * 2.5 + phase * 1.3) * 0.12;
  const scale = easeOutBack(prog);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dir * 0.7 + flutter);
  ctx.scale(scale * Math.sign(dir || 1) * Math.abs(dir) * 1.1, scale);
  const lg = ctx.createLinearGradient(0, 0, 28, -10);
  lg.addColorStop(0, "#c8f5a8");
  lg.addColorStop(1, "#2f8a4a");
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(16, -14, 32, -6);
  ctx.quadraticCurveTo(16, 2, 0, 0);
  ctx.fill();
  // Vein
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(2, -1);
  ctx.quadraticCurveTo(14, -8, 28, -6);
  ctx.stroke();
  ctx.restore();
}

function drawButterflies(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: ReturnType<typeof beatProgress>,
  t: number,
) {
  if (p.answer <= 0.05) return;
  ctx.globalAlpha = Math.min(1, p.answer * 1.4);
  const paths = [
    { ox: 0.2, oy: 0.35, speed: 0.7, color: "#f0d5a8" },
    { ox: 0.75, oy: 0.38, speed: 0.55, color: "#d8ecb8" },
  ];
  for (const b of paths) {
    // Arc motion (Disney principle: arcs)
    const x = w * b.ox + Math.sin(t * b.speed) * 70 + Math.sin(t * b.speed * 0.5) * 20;
    const y = h * b.oy + Math.cos(t * b.speed * 0.9) * 28;
    const flap = Math.sin(t * 14) * 0.45;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.ellipse(-6, 0, 7, 4 + flap * 2, -0.5, 0, Math.PI * 2);
    ctx.ellipse(6, 0, 7, 4 + flap * 2, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5a4030";
    ctx.beginPath();
    ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function updateAndDrawParticles(
  ctx: CanvasRenderingContext2D,
  list: Particle[],
  w: number,
  h: number,
  dt: number,
  kind: "dust" | "firefly" | "pollen",
) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]!;
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (kind === "dust") {
      p.vy += 30 * dt;
      if (p.life > p.max) {
        list.splice(i, 1);
        continue;
      }
    } else {
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h * 0.6;
      if (p.y > h * 0.7) p.y = h * 0.25;
    }
    const alpha =
      kind === "dust"
        ? 1 - p.life / p.max
        : 0.35 + 0.65 * Math.abs(Math.sin(p.life * 3 + p.x));
    ctx.globalAlpha = alpha;
    if (kind === "firefly") {
      ctx.fillStyle = "#e8f6b5";
      ctx.shadowColor = "#e8f6b5";
      ctx.shadowBlur = 10;
    } else if (kind === "dust") {
      ctx.fillStyle = `hsl(${p.hue},70%,80%)`;
      ctx.shadowColor = "rgba(255,255,200,0.8)";
      ctx.shadowBlur = 6;
    } else {
      ctx.fillStyle = "rgba(255,255,230,0.8)";
      ctx.shadowBlur = 0;
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

function drawGrade(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: ReturnType<typeof beatProgress>,
) {
  // Vignette
  const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.78);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);

  // Warm grade at dawn
  if (p.dawn > 0) {
    ctx.globalAlpha = 0.12 * p.dawn;
    ctx.fillStyle = "#ffd9a0";
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  // Soft film grain
  ctx.globalAlpha = 0.04;
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#fff" : "#000";
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2);
  }
  ctx.globalAlpha = 1;
}

function drawTitle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  title: number,
  t: number,
) {
  const a = smootherstep(title);
  ctx.save();
  ctx.globalAlpha = a;
  // Dark theatrical hold
  ctx.fillStyle = `rgba(5,12,9,${0.55 * a})`;
  ctx.fillRect(0, 0, w, h);

  // Crest ring
  const cx = w / 2;
  const cy = h * 0.44;
  const rad = Math.min(w, h) * 0.18 * (0.92 + 0.08 * Math.sin(t * 1.5));
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(111,191,122,0.25)";
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 1.08, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#f7fbf6";
  ctx.font = `500 ${Math.max(28, Math.min(56, w * 0.08))}px Outfit, system-ui, sans-serif`;
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 20;
  ctx.fillText("MOMO.AI", cx, cy + 10);
  ctx.shadowBlur = 0;
  ctx.font = `400 ${Math.max(12, Math.min(18, w * 0.028))}px Outfit, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(244,247,242,0.85)";
  ctx.fillText("Growing Intelligence. Growing Tomorrow.", cx, cy + 48);
  ctx.restore();
}
