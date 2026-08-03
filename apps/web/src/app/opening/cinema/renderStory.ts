import { clamp01, easeInOutCubic, easeOutBack, lerp, smootherstep, windowT } from "./easing";

export type CinemaState = {
  time: number;
  duration: number;
  warm: boolean;
  w: number;
  h: number;
  dpr: number;
  dt: number;
};

type Petal = { a: number; r: number; s: number; spin: number; hue: number };

/**
 * Aurora Meadow theme — warm dawn, luminous petals, title-forward.
 * Completely replaces the dark soil-cutaway look.
 */
export function createCinemaRenderer(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const orbs: { x: number; y: number; r: number; vx: number; vy: number; a: number }[] = [];
  const petals: Petal[] = Array.from({ length: 18 }, (_, i) => ({
    a: (i / 18) * Math.PI * 2,
    r: 40 + (i % 5) * 18,
    s: 0.6 + (i % 4) * 0.15,
    spin: (i % 2 === 0 ? 1 : -1) * (0.4 + (i % 3) * 0.2),
    hue: 95 + (i % 6) * 8,
  }));

  function resize(w: number, h: number, dpr: number) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(state: CinemaState) {
    const { time, duration, warm, w, h, dt } = state;
    const t = warm ? duration * 0.92 + time * 0.02 : time;

    const dawn = warm ? 1 : windowT(t, 0, 5);
    const spark = warm ? 1 : windowT(t, 5.5, 10);
    const bloom = warm ? 1 : windowT(t, 11, 17);
    const chorus = warm ? 1 : windowT(t, 17.5, 23);
    const finale = warm ? smootherstep(time / Math.max(0.001, duration)) : windowT(t, 23.5, 28);

    // Camera: gentle float, stronger push on finale
    const zoom = lerp(1.02, 1.2, easeInOutCubic(finale));
    const cx = Math.sin(t * 0.12) * 10;
    const cy = Math.cos(t * 0.09) * 6;

    ctx.save();
    ctx.fillStyle = "#2a1840";
    ctx.fillRect(0, 0, w, h);

    ctx.translate(w / 2 + cx, h / 2 + cy);
    ctx.scale(zoom, zoom);
    ctx.translate(-w / 2, -h / 2);

    drawAuroraSky(ctx, w, h, dawn, spark, bloom, t);
    drawMeadow(ctx, w, h, dawn, bloom, t);
    drawLightSpark(ctx, w, h, spark, bloom, t);
    drawBloomPlant(ctx, w, h, bloom, chorus, t);
    drawPetalRing(ctx, w, h, chorus, finale, t, petals);
    ensureOrbs(orbs, w, h, chorus);
    drawOrbs(ctx, orbs, dt, chorus);

    ctx.restore();

    drawVignette(ctx, w, h, finale);
  }

  return { resize, draw };
}

function drawAuroraSky(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dawn: number,
  spark: number,
  bloom: number,
  t: number,
) {
  // Warm lavender → peach dawn (bright meadow, not forest dark)
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const topR = lerp(90, 255, dawn);
  const topG = lerp(70, 214, dawn);
  const topB = lerp(140, 196, dawn);
  g.addColorStop(0, `rgb(${topR},${topG},${topB})`);
  g.addColorStop(0.4, `rgb(${lerp(120, 255, dawn)},${lerp(140, 220, dawn)},${lerp(200, 210, dawn)})`);
  g.addColorStop(0.7, `rgb(${lerp(160, 255, dawn)},${lerp(180, 236, dawn)},${lerp(180, 200, dawn)})`);
  g.addColorStop(1, `rgb(${lerp(180, 255, dawn)},${lerp(210, 245, dawn)},${lerp(170, 210, dawn)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Aurora ribbons
  ctx.save();
  ctx.globalAlpha = 0.22 + 0.15 * spark;
  for (let i = 0; i < 3; i++) {
    const yg = ctx.createLinearGradient(0, h * 0.1, w, h * 0.35 + i * 40);
    yg.addColorStop(0, "rgba(120,255,200,0)");
    yg.addColorStop(0.5, i === 1 ? "rgba(180,140,255,0.5)" : "rgba(100,230,180,0.45)");
    yg.addColorStop(1, "rgba(255,200,140,0)");
    ctx.fillStyle = yg;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.2 + i * 30);
    for (let x = 0; x <= w; x += 20) {
      ctx.lineTo(x, h * 0.18 + i * 28 + Math.sin(x * 0.01 + t * 0.4 + i) * 18);
    }
    ctx.lineTo(w, h * 0.45);
    ctx.lineTo(0, h * 0.45);
    ctx.fill();
  }
  ctx.restore();

  // Soft sun disc
  const sunX = w * 0.78;
  const sunY = lerp(h * 0.75, h * 0.22, easeInOutCubic(dawn));
  const sunR = lerp(30, 70, dawn);
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 3.5);
  glow.addColorStop(0, `rgba(255,240,200,${0.65 * dawn})`);
  glow.addColorStop(0.35, `rgba(255,180,120,${0.25 * dawn})`);
  glow.addColorStop(1, "rgba(255,160,100,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR * 3.5, 0, Math.PI * 2);
  ctx.fill();
  const core = ctx.createRadialGradient(sunX - 10, sunY - 10, 0, sunX, sunY, sunR);
  core.addColorStop(0, "#fff8e8");
  core.addColorStop(0.6, "#ffd089");
  core.addColorStop(1, "#ff9a5c");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  void bloom;
}

function drawMeadow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dawn: number,
  bloom: number,
  t: number,
) {
  // Soft rolling meadow — no brown cutaway slab
  const base = h * 0.72;
  ctx.beginPath();
  ctx.moveTo(0, base);
  for (let x = 0; x <= w; x += 12) {
    ctx.lineTo(x, base + Math.sin(x * 0.02 + t * 0.5) * 6 + Math.sin(x * 0.005) * 14);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, base - 40, 0, h);
  g.addColorStop(0, dawn > 0.35 ? "#9adf7a" : "#5a9a72");
  g.addColorStop(0.45, dawn > 0.35 ? "#5fbf78" : "#3d7a5c");
  g.addColorStop(1, "#2a5a48");
  ctx.fillStyle = g;
  ctx.fill();

  // Blades
  ctx.strokeStyle = `rgba(200,255,180,${0.15 + 0.2 * bloom})`;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 40; i++) {
    const x = ((i * 47) % w) + 10;
    const sway = Math.sin(t * 2 + i) * 4;
    ctx.beginPath();
    ctx.moveTo(x, h * 0.78);
    ctx.quadraticCurveTo(x + sway, h * 0.74, x + sway * 1.4, h * 0.7);
    ctx.stroke();
  }
}

function drawLightSpark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  spark: number,
  bloom: number,
  t: number,
) {
  if (spark <= 0.01 || bloom > 0.85) return;
  const x = w * 0.5;
  const y = lerp(h * 0.55, h * 0.62, spark);
  const r = 10 + spark * 16 + Math.sin(t * 3) * 2;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
  g.addColorStop(0, `rgba(255,255,230,${0.9 * spark})`);
  g.addColorStop(0.3, `rgba(180,255,160,${0.45 * spark})`);
  g.addColorStop(1, "rgba(120,200,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fffef5";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawBloomPlant(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bloom: number,
  chorus: number,
  t: number,
) {
  if (bloom <= 0.01) return;
  const g = easeOutBack(clamp01(bloom));
  const cx = w * 0.5;
  const cy = h * 0.7;
  const stem = 110 * g;
  const sway = Math.sin(t * 1.3) * 0.05;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(sway);

  // Stem
  ctx.strokeStyle = "#2d8f4e";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-6, -stem * 0.4, 6, -stem * 0.7, 0, -stem);
  ctx.stroke();

  const leafT = smootherstep((bloom - 0.2) / 0.8);
  if (leafT > 0) {
    leaf(ctx, -14, -stem * 0.4, -1, leafT, t, 0);
    leaf(ctx, 14, -stem * 0.5, 1, leafT, t, 1);
    leaf(ctx, -10, -stem * 0.68, -0.8, leafT * 0.9, t, 2);
    leaf(ctx, 12, -stem * 0.78, 0.85, leafT * 0.85, t, 3);
  }

  // Flower crown on chorus
  if (chorus > 0.1) {
    const ft = easeOutBack(chorus);
    ctx.save();
    ctx.translate(0, -stem - 4);
    ctx.scale(ft, ft);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + t * 0.2;
      ctx.fillStyle = i % 2 ? "#ffe4a0" : "#ffb7d5";
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 14, Math.sin(a) * 14, 10, 6, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fff3a0";
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function leaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: number,
  prog: number,
  t: number,
  phase: number,
) {
  const flutter = Math.sin(t * 2.6 + phase) * 0.14;
  const s = easeOutBack(prog);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dir * 0.75 + flutter);
  ctx.scale(s * dir, s);
  const lg = ctx.createLinearGradient(0, 0, 36, -8);
  lg.addColorStop(0, "#d8ffb0");
  lg.addColorStop(1, "#2f9a55");
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(18, -16, 38, -4);
  ctx.quadraticCurveTo(18, 4, 0, 0);
  ctx.fill();
  ctx.restore();
}

function drawPetalRing(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  chorus: number,
  finale: number,
  t: number,
  petals: Petal[],
) {
  const show = Math.max(chorus, finale);
  if (show < 0.05) return;
  const cx = w * 0.5;
  const cy = h * 0.42;
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.5 * show;
  for (const p of petals) {
    const ang = p.a + t * p.spin * 0.25;
    const rr = p.r * (0.8 + 0.6 * show) * (1 + finale * 1.8);
    const x = cx + Math.cos(ang) * rr * (w / 400);
    const y = cy + Math.sin(ang) * rr * 0.7 * (h / 400);
    ctx.fillStyle = `hsla(${p.hue},70%,75%,0.85)`;
    ctx.beginPath();
    ctx.ellipse(x, y, 7 * p.s, 4 * p.s, ang, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function ensureOrbs(
  orbs: { x: number; y: number; r: number; vx: number; vy: number; a: number }[],
  w: number,
  h: number,
  chorus: number,
) {
  const target = Math.floor(24 * chorus);
  while (orbs.length < target) {
    orbs.push({
      x: Math.random() * w,
      y: Math.random() * h * 0.7,
      r: 1.5 + Math.random() * 3,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 14,
      a: Math.random(),
    });
  }
}

function drawOrbs(
  ctx: CanvasRenderingContext2D,
  orbs: { x: number; y: number; r: number; vx: number; vy: number; a: number }[],
  dt: number,
  chorus: number,
) {
  if (chorus < 0.05) return;
  for (const o of orbs) {
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    o.a += dt;
    ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(o.a * 2));
    ctx.fillStyle = "#fff6c8";
    ctx.shadowColor = "#ffe08a";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, finale: number) {
  // Soft warm vignette — keeps title readable without darkening the crest
  const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.95);
  v.addColorStop(0, "rgba(255,247,241,0)");
  v.addColorStop(0.55, "rgba(255,247,241,0)");
  v.addColorStop(1, `rgba(60,30,80,${0.18 + 0.12 * finale})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}
