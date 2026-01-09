import { useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Center } from '@react-three/drei';
import { OBJLoader } from 'three-stdlib';
import * as THREE from 'three';

interface BodyModelProps {
  url: string;
}

export function BodyModel({ url }: BodyModelProps) {
  const obj = useLoader(OBJLoader, url);
  const meshRef = useRef<THREE.Group>(null!);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(t / 4) / 4;
    }
  });

  return (
    <Center>
      <primitive 
        ref={meshRef} 
        object={obj} 
        scale={1.5} 
        rotation={[Math.PI, Math.PI, 0]} 
      />
    </Center>
  );
}

export function Loader() {
  return (
    <mesh>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial color="gray" wireframe />
    </mesh>
  );
}

