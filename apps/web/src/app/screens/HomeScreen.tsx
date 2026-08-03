/**
 * Home shell that the opening morphs into.
 * Content panels are placeholders for upcoming parts — structure only.
 */
export function HomeScreen() {
  return (
    <section className="home-shell" aria-label="MOMO.AI home">
      <div className="home-ambient" aria-hidden />

      <header className="home-top">
        <div className="home-logo" aria-label="MOMO.AI">
          <span className="home-logo-orb" aria-hidden />
          <span>MOMO.AI</span>
        </div>
        <div className="home-chip">Field OS</div>
      </header>

      <main className="home-grid">
        <article className="glass-panel hero-panel">
          <p className="panel-kicker">Canopy</p>
          <h1>Growing with you</h1>
          <p className="panel-copy">
            Monitoring, irrigation, and plant intelligence — built part by part.
          </p>
        </article>

        <article className="glass-panel">
          <p className="panel-kicker">Status</p>
          <h2>Systems ready</h2>
          <p className="panel-copy">Edge device and cloud adapters connect in later parts.</p>
        </article>

        <article className="glass-panel">
          <p className="panel-kicker">Next</p>
          <h2>Home live data</h2>
          <p className="panel-copy">Part 2 will bring live sensors into these glass surfaces.</p>
        </article>
      </main>
    </section>
  );
}
