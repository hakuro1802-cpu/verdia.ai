import type { PlantAnalysisResult } from "@verdia/contracts";

type Props = {
  items: PlantAnalysisResult[];
};

export function AnalysisHistory({ items }: Props) {
  if (!items.length) {
    return (
      <p className="hint">
        No analyses yet — capture a leaf to get mock Verdia care guidance.
      </p>
    );
  }

  return (
    <ul className="history-list">
      {items.map((item) => (
        <li key={item.id}>
          <div className="history-top">
            <strong>{item.plantName ?? "Unknown"}</strong>
            <span className={`health health-${item.health}`}>{item.health}</span>
          </div>
          <p>{item.diagnosis}</p>
          <time dateTime={item.createdAt}>
            {new Date(item.createdAt).toLocaleString()}
            {item.isMock ? " · mock" : ""}
          </time>
        </li>
      ))}
    </ul>
  );
}
