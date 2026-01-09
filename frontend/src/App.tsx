import { useState, useRef, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars, Stage, Center } from '@react-three/drei';
import { OBJLoader } from 'three-stdlib';
import * as THREE from 'three';
import './App.css';

// 3D 人體模型元件
function BodyModel({ url }: { url: string }) {
  // 載入 OBJ 檔案
  const obj = useLoader(OBJLoader, url);
  const meshRef = useRef<THREE.Group>(null!);

  // 讓模型慢慢旋轉 (基於修正後的基礎旋轉進行微調)
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (meshRef.current) {
      // 這裡維持原本的水平擺動效果
      meshRef.current.rotation.y = Math.sin(t / 4) / 4;
    }
  });

  return (
    <Center>
      <primitive 
        ref={meshRef} 
        object={obj} 
        scale={1.5} 
        /* 
           修正「頭下腳上」：
           1. 繞 X 軸旋轉 PI (180度) 將模型翻正
           2. 繞 Y 軸旋轉 PI (180度) 讓模型面向相機 (如果原本是背對的話)
        */
        rotation={[Math.PI, Math.PI, 0]} 
      />
    </Center>
  );
}

// 載入中的佔位符
function Loader() {
  return (
    <mesh>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial color="gray" wireframe />
    </mesh>
  );
}

function App() {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('Ready to build your 3D body');

  // 處理檔案上傳
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus('AI is reconstructing your body... (may take 30s)');
    setModelUrl(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/upload/body', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.status === 'success' && data.models.length > 0) {
        // 後端回傳的是 "/outputs/filename.obj"
        // 我們需要補上後端的主機網址
        const fullUrl = `http://localhost:8000${data.models[0]}`;
        setModelUrl(fullUrl);
        setStatus('Success! Your 3D body is ready.');
      } else {
        setStatus('Failed to generate 3D model.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setStatus('Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>3D Fitting Room</h1>
        <div className="controls">
          <label className={`upload-btn ${loading ? 'disabled' : ''}`}>
            {loading ? 'Processing...' : 'Upload Photo'}
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleUpload} 
              disabled={loading}
              hidden 
            />
          </label>
          <p className="status-text">{status}</p>
        </div>
      </header>

      <main className="canvas-container">
        <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
          <color attach="background" args={['#111']} />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} />
          
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          
          <Suspense fallback={<Loader />}>
            {modelUrl ? (
              <Stage environment="city" intensity={0.6}>
                <BodyModel url={modelUrl} />
              </Stage>
            ) : (
              <Center>
                <mesh>
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial color="#333" />
                </mesh>
                <gridHelper args={[10, 10, '#444', '#222']} position={[0, -1, 0]} />
              </Center>
            )}
          </Suspense>
          
          <OrbitControls makeDefault />
        </Canvas>
      </main>
    </div>
  );
}

export default App;
