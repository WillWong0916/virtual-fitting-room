import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Stage, Environment, ContactShadows, Center } from '@react-three/drei';
import { BodyModel, Loader } from './BodyModel';
import { CONFIG } from '../config';

interface SceneProps {
  modelUrl: string | null;
}

export function Scene({ modelUrl }: SceneProps) {
  return (
    <main className="canvas-container">
      <Canvas camera={{ position: [0, 0, 4], fov: 50 }} shadows>
        <Environment preset={CONFIG.DEFAULT_ENV as any} background blur={0.5} />
        
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} castShadow />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        <Suspense fallback={<Loader />}>
          {modelUrl ? (
            <group>
              <Stage environment="city" intensity={0.6} shadows={false}>
                <BodyModel url={modelUrl} />
              </Stage>
              <ContactShadows 
                position={[0, -1.45, 0]} 
                opacity={0.4} 
                scale={10} 
                blur={2.5} 
                far={4.5} 
              />
            </group>
          ) : (
            <Center>
              <mesh>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="#333" />
              </mesh>
              <gridHelper args={[10, 10, '#444', '#222']} position={[0, -0.5, 0]} />
            </Center>
          )}
        </Suspense>
        
        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.75} />
      </Canvas>
    </main>
  );
}

