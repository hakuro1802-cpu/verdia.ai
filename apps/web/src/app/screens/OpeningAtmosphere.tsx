import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { CinematicPhase } from "./OpeningScreen";

type Props = {
  phase: CinematicPhase;
  reduced: boolean;
};

export function OpeningAtmosphere({ phase, reduced }: Props) {
  return (
    <div className="opening-atmosphere" aria-hidden>
      <Canvas
        dpr={reduced ? [1, 1.25] : [1, 1.75]}
        camera={{ position: [0, 0.15, 5.2], fov: 42, near: 0.1, far: 40 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#020805"]} />
        <fog attach="fog" args={["#020805", 6, 16]} />
        <CinematicWorld phase={phase} reduced={reduced} />
      </Canvas>
    </div>
  );
}

function CinematicWorld({ phase, reduced }: Props) {
  const group = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const phaseIndex =
    phase === "dark"
      ? 0
      : phase === "awaken"
        ? 1
        : phase === "ecosystem"
          ? 2
          : phase === "intelligence"
            ? 3
            : 4;

  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    const drift = reduced ? 0 : 0.04;
    camera.position.x = Math.sin(t * 0.15) * drift;
    camera.position.y = 0.15 + Math.cos(t * 0.12) * drift * 0.6;

    const targetZ = phaseIndex >= 4 ? 3.55 : 5.2;
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 1.2, 0.016);
    camera.lookAt(0, 0.1, 0);

    if (light.current) {
      const target = phaseIndex === 0 ? 0.15 : phaseIndex === 1 ? 0.7 : 1.35;
      light.current.intensity = THREE.MathUtils.damp(light.current.intensity, target, 1.5, 0.016);
    }

    if (group.current) {
      const s = phaseIndex >= 4 ? 1.12 : 1;
      const next = THREE.MathUtils.damp(group.current.scale.x, s, 1.4, 0.016);
      group.current.scale.setScalar(next);
    }
  });

  return (
    <>
      <ambientLight intensity={0.12} color="#8fb9a0" />
      <pointLight ref={light} position={[0, 0.4, 2.2]} intensity={0.15} color="#6fbf7a" distance={12} />
      <pointLight position={[-2.5, 1.2, 1]} intensity={0.25} color="#9ec9ff" distance={10} />
      <directionalLight position={[3, 4, 2]} intensity={0.35} color="#e8f2ea" />

      <group ref={group}>
        <PollenField visible={phaseIndex >= 1} dense={phaseIndex >= 2} />
        <RootNetwork visible={phaseIndex >= 2} neural={phaseIndex >= 3} />
        <LeafCrown visible={phaseIndex >= 2} intelligence={phaseIndex >= 3} />
        <MistPlane visible={phaseIndex >= 2} />
        <LogoCore visible={phaseIndex >= 1} breathe={phaseIndex >= 2} />
      </group>
    </>
  );
}

function LogoCore({ visible, breathe }: { visible: boolean; breathe: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.opacity = THREE.MathUtils.damp(mat.opacity, visible ? 1 : 0, 1.8, 0.016);
    const pulse = breathe ? 1 + Math.sin(t * 1.1) * 0.035 : 1;
    ref.current.scale.setScalar(pulse);
    ref.current.rotation.y = t * 0.08;
  });

  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[0.55, 1]} />
      <meshStandardMaterial
        color="#1d4a32"
        emissive="#3f9a55"
        emissiveIntensity={0.45}
        roughness={0.28}
        metalness={0.35}
        transparent
        opacity={0}
      />
    </mesh>
  );
}

function PollenField({ visible, dense }: { visible: boolean; dense: boolean }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(140 * 3);
    for (let i = 0; i < 140; i++) {
      const r = 0.3 + Math.random() * 2.4;
      const a = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 2.2;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = Math.sin(a) * r * 0.7;
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!points.current) return;
    const mat = points.current.material as THREE.PointsMaterial;
    mat.opacity = THREE.MathUtils.damp(mat.opacity, visible ? 0.55 : 0, 1.6, 0.016);
    mat.size = dense ? 0.028 : 0.022;
    points.current.rotation.y = clock.getElapsedTime() * 0.04;
    points.current.scale.setScalar(
      THREE.MathUtils.damp(points.current.scale.x, visible ? 0.85 : 1.2, 1.2, 0.016),
    );
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#d8f0c8"
        size={0.022}
        transparent
        opacity={0}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function RootNetwork({ visible, neural }: { visible: boolean; neural: boolean }) {
  const roots = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const pts: THREE.Vector3[] = [];
      const a = (i / 12) * Math.PI * 2;
      let x = Math.cos(a) * 0.2;
      let y = -0.1;
      let z = Math.sin(a) * 0.2;
      pts.push(new THREE.Vector3(x, y, z));
      for (let s = 0; s < 6; s++) {
        x += Math.cos(a + s * 0.3) * 0.18;
        y -= 0.12 + (s % 3) * 0.02;
        z += Math.sin(a + s * 0.3) * 0.18;
        pts.push(new THREE.Vector3(x, y, z));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      return new THREE.TubeGeometry(curve, 32, 0.008, 5, false);
    });
  }, []);

  return (
    <group>
      {roots.map((geo, i) => (
        <RootTube key={i} geometry={geo} visible={visible} neural={neural} delay={i * 0.05} />
      ))}
    </group>
  );
}

function RootTube({
  geometry,
  visible,
  neural,
  delay,
}: {
  geometry: THREE.TubeGeometry;
  visible: boolean;
  neural: boolean;
  delay: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    const t = clock.getElapsedTime();
    mat.opacity = THREE.MathUtils.damp(mat.opacity, visible ? (neural ? 0.7 : 0.35) : 0, 1.4, 0.016);
    mat.emissiveIntensity = neural ? 0.4 + Math.sin(t * 2.2 + delay) * 0.15 : 0.05;
  });

  return (
    <mesh ref={ref} geometry={geometry}>
      <meshStandardMaterial
        color="#3d6b4f"
        emissive="#5fd08a"
        emissiveIntensity={0.05}
        transparent
        opacity={0}
        roughness={0.4}
        metalness={0.2}
      />
    </mesh>
  );
}

function LeafCrown({ visible, intelligence }: { visible: boolean; intelligence: boolean }) {
  const group = useRef<THREE.Group>(null);
  const leaves = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return {
          position: [Math.cos(a) * 0.85, 0.55, Math.sin(a) * 0.85] as [number, number, number],
          rotation: [-0.6, a, 0.2] as [number, number, number],
          phase: i * 0.4,
        };
      }),
    [],
  );

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.scale.setScalar(
      THREE.MathUtils.damp(group.current.scale.x, visible ? 1 : 0.01, 1.5, 0.016),
    );
    group.current.children.forEach((child, i) => {
      child.rotation.z = Math.sin(clock.getElapsedTime() * 0.9 + leaves[i]!.phase) * 0.06;
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = intelligence
        ? 0.25 + Math.sin(clock.getElapsedTime() * 3 + i) * 0.08
        : 0.05;
    });
  });

  return (
    <group ref={group} scale={0.01}>
      {leaves.map((leaf, i) => (
        <mesh key={i} position={leaf.position} rotation={leaf.rotation}>
          <sphereGeometry args={[0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial
            color="#2f7a4a"
            emissive={intelligence ? "#5fd08a" : "#1a3d28"}
            emissiveIntensity={0.05}
            roughness={0.45}
            metalness={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function MistPlane({ visible }: { visible: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = THREE.MathUtils.damp(mat.opacity, visible ? 0.12 : 0, 1.2, 0.016);
    ref.current.position.x = Math.sin(clock.getElapsedTime() * 0.1) * 0.15;
  });
  return (
    <mesh ref={ref} position={[0, -0.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[2.8, 48]} />
      <meshBasicMaterial color="#9ec9ff" transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
