import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Props = {
  active: boolean;
  waterLevel: number;
};

export function WaterAura({ active, waterLevel }: Props) {
  const drops = useRef<THREE.Points>(null);
  const count = 120;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 1.2;
      arr[i * 3 + 1] = 1.5 + Math.random() * 1.8;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (!drops.current) return;
    drops.current.visible = active;
    if (!active) return;
    const attr = drops.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      let y = attr.getY(i) - delta * (1.8 + (i % 5) * 0.25);
      if (y < 0.75) {
        y = 2.8 + Math.random() * 0.6;
        attr.setX(i, (Math.random() - 0.5) * 1.1);
        attr.setZ(i, (Math.random() - 0.5) * 1.1);
      }
      attr.setY(i, y);
    }
    attr.needsUpdate = true;
  });

  const ringScale = 0.4 + THREE.MathUtils.clamp(waterLevel / 100, 0, 1) * 0.7;

  return (
    <group>
      <points ref={drops}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#9be7ff"
          size={0.045}
          transparent
          opacity={0.85}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      {/* Tank level ring in the moss */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={ringScale}>
        <ringGeometry args={[1.05, 1.18, 64]} />
        <meshStandardMaterial
          color={active ? "#6fd6ff" : "#3d8f6a"}
          emissive={active ? "#1a6f8a" : "#0a2a1a"}
          emissiveIntensity={active ? 0.8 : 0.2}
          transparent
          opacity={0.65}
        />
      </mesh>
    </group>
  );
}
