import { useState } from "react";
import { AfterOpeningScreen } from "./screens/AfterOpeningScreen";
import { OpeningScreen } from "./screens/OpeningScreen";

export type AppScreen = "opening" | "after-opening";

/**
 * App shell — screen routing only.
 * Part 1: opening. Later parts register new screens here.
 */
export function AppShell() {
  const [screen, setScreen] = useState<AppScreen>("opening");

  if (screen === "opening") {
    return <OpeningScreen onFinished={() => setScreen("after-opening")} />;
  }

  return <AfterOpeningScreen />;
}
