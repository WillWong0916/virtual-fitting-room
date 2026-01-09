import { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import './App.css';

function RotatingCube() {
  const meshRef = useRef<THREE.Mesh>(null!);
  
  // Rotate the cube on every frame
  useFrame((_, delta) => {
    meshRef.current.rotation.x += delta;
    meshRef.current.rotation.y += delta * 0.5;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="royalblue" />
    </mesh>
  );
}

function App() {
  const [message, setMessage] = useState<string>('Loading...');

  useEffect(() => {
    fetch('http://localhost:8000/')
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch((err) => {
        console.error('Error fetching data:', err);
        setMessage('Failed to fetch message from backend.');
      });
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '20px', textAlign: 'center', backgroundColor: '#282c34', color: 'white' }}>
        <h1>3D Fitting Room</h1>
        <p>{message}</p>
      </header>
      
      <div style={{ flex: 1, backgroundColor: '#111' }}>
        <Canvas camera={{ position: [0, 0, 5] }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          <RotatingCube />
          <OrbitControls />
        </Canvas>
      </div>
      </div>
  );
}

export default App;
