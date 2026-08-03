import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import type { TelemetrySample } from "@verdia/contracts";
import { GreenhouseWorld } from "./GreenhouseWorld";

type Props = {
  latest: TelemetrySample | null;
};

export function GreenhouseCanvas({ latest }: Props) {
  const sensors = latest?.sensors;
  const moisture = sensors?.soilMoisturePct ?? 45;
  const temp = sensors?.temperatureC ?? 24;
  const pumpOn = latest?.pumpOn ?? false;
  const water = sensors?.waterLevelPct ?? 60;

  return (
    <div className="stage-3d">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [2.8, 2.2, 4.2], fov: 42, near: 0.1, far: 40 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#07150f"]} />
        <fog attach="fog" args={["#07150f", 8, 22]} />
        <Suspense fallback={null}>
          <GreenhouseWorld
            moisture={moisture}
            temperature={temp}
            waterLevel={water}
            pumpOn={pumpOn}
          />
        </Suspense>
      </Canvas>
      <div className="stage-vignette" aria-hidden />
    </div>
  );
}
