import type { TelemetrySample } from "@verdia/contracts";

type Props = {
  history: TelemetrySample[];
};

export function MoistureChart({ history }: Props) {
  const points = history
    .map((h) => h.sensors.soilMoisturePct)
    .filter((v): v is number => v != null);

  if (points.length < 2) {
    return <p className="hint">Collecting moisture history…</p>;
  }

  const w = 600;
  const h = 180;
  const min = Math.min(...points, 0);
  const max = Math.max(...points, 100);
  const span = Math.max(max - min, 1);

  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 16) - 8;
    return `${x},${y}`;
  });

  const line = coords.join(" ");
  const area = `0,${h} ${line} ${w},${h}`;

  return (
    <div className="chart-wrap" aria-label="Soil moisture trend">
      <svg viewBox={`0 0 ${w} ${h}`} role="img">
        <defs>
          <linearGradient id="moistureFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7dce6a" />
            <stop offset="100%" stopColor="#7dce6a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line className="axis" x1="0" y1={h - 1} x2={w} y2={h - 1} />
        <polygon className="area" points={area} />
        <polyline className="line" points={line} />
      </svg>
    </div>
  );
}
