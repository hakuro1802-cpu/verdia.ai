import type { Alert } from "../alerts";

type Props = {
  alerts: Alert[];
};

export function AlertsPanel({ alerts }: Props) {
  if (!alerts.length) {
    return (
      <section className="panel alerts">
        <h2>Alerts</h2>
        <p className="hint ok-hint">All clear — sensors within expected bands.</p>
      </section>
    );
  }

  return (
    <section className="panel alerts">
      <h2>Alerts</h2>
      <ul className="alert-list">
        {alerts.map((a) => (
          <li key={a.id} className={`alert alert-${a.level}`}>
            <strong>{a.title}</strong>
            <span>{a.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
