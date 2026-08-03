type MetricProps = {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
};

export function Metric({ label, value, unit }: MetricProps) {
  const display = value == null || Number.isNaN(value) ? "—" : value;
  return (
    <div className="metric">
      <span className="label">{label}</span>
      <span className="value">
        {display}
        {unit && display !== "—" ? <span className="unit">{unit}</span> : null}
      </span>
    </div>
  );
}
