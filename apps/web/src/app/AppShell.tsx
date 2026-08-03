import { useCallback, useState } from "react";
import { HomeScreen } from "./screens/HomeScreen";
import { OpeningScreen } from "./screens/OpeningScreen";

export type AppScreen = "opening" | "home";

/**
 * App shell — Part 1 opening morphs into Home.
 */
export function AppShell() {
  const [screen, setScreen] = useState<AppScreen>("opening");
  const [entering, setEntering] = useState(false);

  const finishOpening = useCallback(() => {
    setEntering(true);
    window.setTimeout(() => {
      setScreen("home");
      setEntering(false);
    }, 180);
  }, []);

  return (
    <div
      className={`app-shell ${screen === "opening" ? "is-opening" : "is-home"} ${entering ? "is-morphing" : ""}`}
    >
      {screen === "opening" ? <OpeningScreen onFinished={finishOpening} /> : <HomeScreen />}
    </div>
  );
}
