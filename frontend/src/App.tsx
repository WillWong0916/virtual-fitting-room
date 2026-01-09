import { useState, Suspense, useRef, useEffect } from 'react';
import { Canvas, useLoader, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Center, Environment } from '@react-three/drei';
import { OBJLoader } from 'three-stdlib';
import * as THREE from 'three';
import './App.css';

// 後端基礎網址
const API_BASE_URL = 'http://localhost:8000';

function ModelViewer({ url }: { url: string }) {
  const obj = useLoader(OBJLoader, `${API_BASE_URL}${url}`);
  const meshRef = useRef<THREE.Group>(null!);

  // 讓模型自動緩慢旋轉
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
        position={[0, -1, 0]}
      />
    </Center>
  );
}

function App() {
  const [message, setMessage] = useState<string>('Ready to Reconstruct Body');
  const [loading, setLoading] = useState<boolean>(false);
  const [modelUrl, setModelUrl] = useState<string | null>(null);

  // 初始化檢查後端狀態
  useEffect(() => {
    fetch(`${API_BASE_URL}/`)
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage('Backend disconnected'));
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage('Processing body reconstruction... (approx 30s)');
    setModelUrl(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/upload/body`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Generation failed');

      const data = await response.json();
      if (data.models && data.models.length > 0) {
        setModelUrl(data.models[0]);
        setMessage('3D Body Reconstruction Successful!');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('Error generating 3D model.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>3D Fitting Room</h1>
        <p className={`status-msg ${loading ? 'loading' : ''}`}>{message}</p>
        
        <div className="upload-section">
          <label className="upload-btn">
            {loading ? 'Processing...' : 'Upload Photo for 3D Body'}
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileUpload} 
              disabled={loading} 
              hidden 
            />
          </label>
        </div>
      </header>

      <main className="canvas-container">
        <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
          <Suspense fallback={null}>
            <ambientLight intensity={0.7} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} />
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
            
            {modelUrl ? (
              <ModelViewer url={modelUrl} />
            ) : (
              <mesh>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="royalblue" wireframe />
              </mesh>
            )}
            
            <OrbitControls makeDefault />
            <Environment preset="city" />
          </Suspense>
        </Canvas>
        
        {loading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p>AI is thinking... Generating your 3D avatar</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
