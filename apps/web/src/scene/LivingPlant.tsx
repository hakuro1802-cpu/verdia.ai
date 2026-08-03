import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Props = {
  moisture: number;
};

type LeafSpec = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  phase: number;
};

export function LivingPlant({ moisture }: Props) {
  const group = useRef<THREE.Group>(null);
  const m = THREE.MathUtils.clamp(moisture / 100, 0, 1);
  const wilt = 1 - m; // 0 healthy upright, 1 droopy
  const leafColor = useMemo(() => {
    const lush = new THREE.Color("#3fbf6a");
    const dry = new THREE.Color("#8a7a3a");
    return lush.clone().lerp(dry, wilt * 0.75);
  }, [wilt]);

  const leaves = useMemo<LeafSpec[]>(() => {
    const specs: LeafSpec[] = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const tier = i % 3;
      const y = 0.95 + tier * 0.38 + (i % 2) * 0.08;
      const r = 0.35 + tier * 0.12;
      specs.push({
        position: [Math.cos(a) * r, y, Math.sin(a) * r],
        rotation: [
          -0.35 - wilt * 0.9,
          a + Math.PI / 2,
          Math.sin(i) * 0.2,
        ],
        scale: 0.75 + (i % 4) * 0.08,
        phase: i * 0.7,
      });
    }
    // crown leaves
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      specs.push({
        position: [Math.cos(a) * 0.12, 1.95, Math.sin(a) * 0.12],
        rotation: [-0.15 - wilt * 0.5, a, 0.1],
        scale: 0.55,
        phase: i * 1.3,
      });
    }
    return specs;
  }, [wilt]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    group.current.rotation.y = Math.sin(t * 0.15) * 0.05;
    group.current.children.forEach((child, idx) => {
      if (idx === 0) return; // stem
      const phase = leaves[idx - 1]?.phase ?? idx;
      child.rotation.z = Math.sin(t * 1.4 + phase) * (0.04 + wilt * 0.03);
    });
  });

  return (
    <group ref={group} position={[0, 0.7, 0]}>
      {/* Stem */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.07, 1.15, 12]} />
        <meshStandardMaterial color="#2f6b3d" roughness={0.7} />
      </mesh>

      {leaves.map((leaf, i) => (
        <mesh
          key={i}
          position={leaf.position}
          rotation={leaf.rotation}
          scale={leaf.scale}
          castShadow
        >
          <sphereGeometry args={[0.28, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial
            color={leafColor}
            roughness={0.45}
            metalness={0.05}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
