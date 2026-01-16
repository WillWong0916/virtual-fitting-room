import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, PerspectiveCamera } from '@react-three/drei';
import { OBJLoader } from 'three-stdlib';
import { useLoader } from '@react-three/fiber';

interface Props {
  modelUrl: string | null;
  /** 用於強制重新加載模型的 key，例如時間戳 */
  cacheKey?: string | number;
}

function Model({ url, cacheKey }: { url: string; cacheKey?: string | number }) {
  const isObj = url.toLowerCase().endsWith('.obj');
  const isGltf = url.toLowerCase().endsWith('.gltf') || url.toLowerCase().endsWith('.glb');

  // 當 cacheKey 改變時，手動清除快取
  useEffect(() => {
    if (isGltf) {
      useGLTF.clear(url);
    }
  }, [url, cacheKey, isGltf]);

  // 根據後綴使用不同的加載器
  if (isObj) {
    const obj = useLoader(OBJLoader, url);
    return <primitive object={obj} />;
  }
  
  if (isGltf) {
    // 這裡傳入原始 url，不帶查詢參數，避免加載器識別錯誤
    const { scene } = useGLTF(url);
    
    // 遍歷 scene 設置材質
    scene.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // 如果有頂點顏色，確保材質開啟 vertexColors
        if (child.geometry.attributes.color) {
          child.material.vertexColors = true;
        }
      }
    });
    return <primitive object={scene} />;
  }

  return null;
}

export function ClothViewer({ modelUrl, cacheKey }: Props) {
  if (!modelUrl) return <div className="no-model">No model to preview</div>;

  // 目前如果是 .ply，Three.js 原生支援較慢，我們暫時提示
  if (modelUrl.toLowerCase().endsWith('.ply')) {
    return (
      <div style={{ color: '#aaa', padding: '20px', textAlign: 'center', backgroundColor: '#222', borderRadius: '8px' }}>
        <p>3D Gaussian Splat (.ply) detected.</p>
        <p style={{ fontSize: '0.8em' }}>Splat rendering is coming soon. Please download to view in external player.</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '300px', backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden' }}>
      <Canvas shadows dpr={[1, 2]}>
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.5} contactShadow={true} shadowBias={-0.0015}>
            {/* 使用 key 強制重新掛載 Model 組件 */}
            <Model key={cacheKey} url={modelUrl} cacheKey={cacheKey} />
          </Stage>
        </Suspense>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        <OrbitControls autoRotate />
      </Canvas>
    </div>
  );
}
