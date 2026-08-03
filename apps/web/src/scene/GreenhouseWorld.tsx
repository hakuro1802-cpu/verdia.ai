import { Float, ContactShadows, OrbitControls, Sparkles, Environment } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { LivingPlant } from "./LivingPlant";
import { WaterAura } from "./WaterAura";

type Props = {
  moisture: number;
  temperature: number;
  waterLevel: number;
  pumpOn: boolean;
};

export function GreenhouseWorld({ moisture, temperature, waterLevel, pumpOn }: Props) {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const warmth = THREE.MathUtils.clamp((temperature - 18) / 16, 0, 1);

  useFrame(({ clock }) => {
    if (!sunRef.current) return;
    const t = clock.getElapsedTime();
    sunRef.current.position.x = Math.sin(t * 0.12) * 4;
    sunRef.current.intensity = 1.35 + Math.sin(t * 0.4) * 0.12;
  });

  const soilColor = useMemo(() => {
    const dry = new THREE.Color("#6b4a2e");
    const wet = new THREE.Color("#2a1a10");
    return dry.clone().lerp(wet, THREE.MathUtils.clamp(moisture / 100, 0, 1));
  }, [moisture]);

  return (
    <>
      <ambientLight intensity={0.35} color="#9fd6b4" />
      <directionalLight
        ref={sunRef}
        castShadow
        position={[3, 6, 2]}
        intensity={1.4}
        color={new THREE.Color("#fff1cf").lerp(new THREE.Color("#ffd0a8"), warmth)}
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-2.5, 1.5, -1]} intensity={0.55} color="#5fd08a" />
      <pointLight position={[1.5, 0.4, 2]} intensity={0.35} color="#c9a35a" />

      <Environment preset="park" environmentIntensity={0.28} />

      {/* Greenhouse floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[7, 64]} />
        <meshStandardMaterial color="#0c1f16" roughness={0.95} metalness={0.05} />
      </mesh>

      {/* Soft moss ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[1.35, 2.4, 64]} />
        <meshStandardMaterial color="#1d4a32" roughness={1} transparent opacity={0.55} />
      </mesh>

      <Float speed={1.1} rotationIntensity={0.08} floatIntensity={0.18}>
        <group position={[0, 0, 0]}>
          {/* Pot */}
          <mesh position={[0, 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.72, 0.55, 0.7, 48]} />
            <meshStandardMaterial color="#7a3f2a" roughness={0.55} metalness={0.08} />
          </mesh>
          <mesh position={[0, 0.72, 0]}>
            <torusGeometry args={[0.74, 0.05, 12, 48]} />
            <meshStandardMaterial color="#5c2e1d" roughness={0.4} metalness={0.15} />
          </mesh>
          {/* Soil */}
          <mesh position={[0, 0.68, 0]} castShadow>
            <cylinderGeometry args={[0.68, 0.68, 0.12, 48]} />
            <meshStandardMaterial color={soilColor} roughness={0.95} />
          </mesh>

          <LivingPlant moisture={moisture} />
        </group>
      </Float>

      <WaterAura active={pumpOn} waterLevel={waterLevel} />

      <Sparkles
        count={55}
        scale={[6, 4, 6]}
        size={2.5}
        speed={0.35}
        opacity={0.45}
        color="#b7f0c8"
        position={[0, 1.6, 0]}
      />

      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.55}
        scale={10}
        blur={2.6}
        far={4}
        color="#03100a"
      />

      <OrbitControls
        enablePan={false}
        minPolarAngle={0.6}
        maxPolarAngle={1.35}
        minDistance={2.6}
        maxDistance={7}
        autoRotate
        autoRotateSpeed={0.45}
        target={[0, 0.95, 0]}
      />
    </>
  );
}
