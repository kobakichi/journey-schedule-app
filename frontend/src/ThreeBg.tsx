import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Edges } from '@react-three/drei';
import { useRef } from 'react';
import type { Mesh } from 'three';

function Blob({ color, position, scale = 1, speed = 0.5 }: { color: string; position: [number, number, number]; scale?: number; speed?: number }) {
  const ref = useRef<Mesh>(null!);
  useFrame((state) => {
    const t = state.clock.getElapsedTime() * speed;
    if (ref.current) {
      ref.current.rotation.x = t * 0.2;
      ref.current.rotation.y = t * 0.3;
    }
  });
  return (
    <Float speed={0.6} rotationIntensity={0.6} floatIntensity={0.8}>
      <mesh ref={ref} position={position} scale={scale}>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} metalness={0.45} roughness={0.5} transparent opacity={0.9} />
        {/* 輪郭線（Edges）を重ねて輪郭を強調 */}
        <Edges scale={1.02} threshold={8} color="#cbd5e1" />
      </mesh>
    </Float>
  );
}

export default function ThreeBg() {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 8], fov: 55 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 2]} intensity={1.5} />
      <spotLight position={[-6, -3, 8]} intensity={0.9} angle={0.3} penumbra={0.5} />

      <Blob color="#7dd3fc" position={[-3, 1.2, -2]} scale={2.2} speed={0.3} />
      <Blob color="#93c5fd" position={[2.5, -1.0, -1.5]} scale={1.8} speed={0.45} />
      <Blob color="#bfdbfe" position={[0.5, 2.0, -3]} scale={1.6} speed={0.35} />
    </Canvas>
  );
}
