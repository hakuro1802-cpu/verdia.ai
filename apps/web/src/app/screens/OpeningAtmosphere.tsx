import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/** Soft ambient field behind the opening — presence, not a dashboard. */
export function OpeningAtmosphere() {
  return (
    <div className="opening-atmosphere" aria-hidden>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#08140f"]} />
        <ambientLight intensity={0.4} />
        <pointLight position={[2, 2, 3]} intensity={1.2} color="#9BE07D" />
        <pointLight position={[-3, -1, 2]} intensity={0.6} color="#E8C572" />
        <BreathingOrb />
        <DriftMotes />
      </Canvas>
    </div>
  );
}

function BreathingOrb() {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.getElapsedTime();
    const s = 1.15 + Math.sin(t * 0.7) * 0.06;
    mesh.current.scale.setScalar(s);
    mesh.current.rotation.y = t * 0.12;
    mesh.current.rotation.z = Math.sin(t * 0.25) * 0.15;
  });

  return (
    <mesh ref={mesh} position={[0, 0.2, 0]}>
      <icosahedronGeometry args={[1.35, 2]} />
      <meshStandardMaterial
        color="#1f5a3a"
        emissive="#4f9a55"
        emissiveIntensity={0.35}
        roughness={0.35}
        metalness={0.15}
        wireframe
      />
    </mesh>
  );
}

function DriftMotes() {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const n = 80;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 6;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!points.current) return;
    points.current.rotation.y = clock.getElapsedTime() * 0.03;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#c8f0b8" size={0.035} transparent opacity={0.65} sizeAttenuation />
    </points>
  );
}
