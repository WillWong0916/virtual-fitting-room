import { useState, useEffect, useRef, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, PerspectiveCamera } from '@react-three/drei';
import { CONFIG } from '../config';
import { useTranslation } from '../contexts/I18nContext';
import { Toast } from '../components/Toast';
import { gsap } from 'gsap';
import * as THREE from 'three';
import '../App.css';

// 可旋轉的 3D 模型組件
function RotatableModel({ url, rotationX, rotationY, rotationZ }: { 
  url: string; 
  rotationX: number; 
  rotationY: number; 
  rotationZ: number;
}) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  
  // 應用旋轉（以 90° 為單位）
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.rotation.x = rotationX * (Math.PI / 2);
      groupRef.current.rotation.y = rotationY * (Math.PI / 2);
      groupRef.current.rotation.z = rotationZ * (Math.PI / 2);
    }
  }, [rotationX, rotationY, rotationZ]);
  
  // 設置材質
  useEffect(() => {
    scene.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.geometry.attributes.color) {
          child.material.vertexColors = true;
        }
      }
    });
  }, [scene]);
  
  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

export function RotateCloth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const modelUrl = searchParams.get('model');
  const filename = searchParams.get('filename');
  
  const [rotationX, setRotationX] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [rotationZ, setRotationZ] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const headerRef = useRef<HTMLElement>(null);
  
  useEffect(() => {
    // 如果沒有 model URL，返回上一頁
    if (!modelUrl || !filename) {
      navigate('/admin');
    }
  }, [modelUrl, filename, navigate]);
  
  const handleReset = () => {
    setRotationX(0);
    setRotationY(0);
    setRotationZ(0);
  };
  
  const handleSave = async () => {
    if (!filename) return;
    
    setSaving(true);
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/clothes/rotate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: filename,
          rotation_x: rotationX,
          rotation_y: rotationY,
          rotation_z: rotationZ,
        }),
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setToastMessage(t('rotateCloth.saveSuccess'));
        
        // 動畫效果
        if (headerRef.current) {
          gsap.to(headerRef.current, {
            scale: 1.02,
            duration: 0.3,
            yoyo: true,
            repeat: 1,
            ease: 'power2.inOut'
          });
        }
        
        // 延遲跳轉回衣物庫
        setTimeout(() => {
          navigate('/admin');
        }, 1500);
      } else {
        throw new Error(data.detail || data.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Save error:', error);
      setToastMessage(t('rotateCloth.saveFailed'));
    } finally {
      setSaving(false);
    }
  };
  
  if (!modelUrl || !filename) {
    return null;
  }
  
  const fullModelUrl = `${CONFIG.API_BASE_URL}${modelUrl}?t=${Date.now()}`;
  
  return (
    <div className="app-container">
      <header className="app-header" ref={headerRef}>
        <h1 className="display">{t('rotateCloth.title')}</h1>
        <p className="status-text" style={{ marginTop: '0.5rem', opacity: 0.7 }}>
          {t('rotateCloth.subtitle')}
        </p>
      </header>
      
      <div className="main-content" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* 3D 預覽 */}
        <div style={{ 
          width: '100%', 
          height: '400px', 
          backgroundColor: '#1a1a1a', 
          borderRadius: '12px', 
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}>
          <Canvas shadows dpr={[1, 2]}>
            <Suspense fallback={null}>
              <Stage environment="city" intensity={0.5} contactShadow={true} shadowBias={-0.0015}>
                <RotatableModel 
                  url={fullModelUrl} 
                  rotationX={rotationX} 
                  rotationY={rotationY} 
                  rotationZ={rotationZ} 
                />
              </Stage>
            </Suspense>
            <PerspectiveCamera makeDefault position={[0, 0, 5]} />
            <OrbitControls autoRotate={false} />
          </Canvas>
        </div>
        
        {/* 旋轉控制 */}
        <div style={{
          background: 'rgba(18, 18, 18, 0.05)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          {/* X 軸 */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 600, color: '#e74c3c' }}>X {t('rotateCloth.axis')}</span>
              <span style={{ fontSize: '0.875rem', color: 'rgba(18, 18, 18, 0.6)' }}>{rotationX * 90}°</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button 
                onClick={() => setRotationX(r => r - 1)} 
                className="rotate-btn"
                disabled={saving}
              >
                -90°
              </button>
              <button 
                onClick={() => setRotationX(r => r + 1)} 
                className="rotate-btn"
                disabled={saving}
              >
                +90°
              </button>
            </div>
          </div>
          
          {/* Y 軸 */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 600, color: '#27ae60' }}>Y {t('rotateCloth.axis')}</span>
              <span style={{ fontSize: '0.875rem', color: 'rgba(18, 18, 18, 0.6)' }}>{rotationY * 90}°</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button 
                onClick={() => setRotationY(r => r - 1)} 
                className="rotate-btn"
                disabled={saving}
              >
                -90°
              </button>
              <button 
                onClick={() => setRotationY(r => r + 1)} 
                className="rotate-btn"
                disabled={saving}
              >
                +90°
              </button>
            </div>
          </div>
          
          {/* Z 軸 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 600, color: '#3498db' }}>Z {t('rotateCloth.axis')}</span>
              <span style={{ fontSize: '0.875rem', color: 'rgba(18, 18, 18, 0.6)' }}>{rotationZ * 90}°</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button 
                onClick={() => setRotationZ(r => r - 1)} 
                className="rotate-btn"
                disabled={saving}
              >
                -90°
              </button>
              <button 
                onClick={() => setRotationZ(r => r + 1)} 
                className="rotate-btn"
                disabled={saving}
              >
                +90°
              </button>
            </div>
          </div>
          
          {/* 操作按鈕 */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button 
              onClick={handleReset}
              disabled={saving}
              className="upload-btn"
              style={{ 
                background: 'transparent', 
                border: '1px solid rgba(18, 18, 18, 0.2)',
                color: 'var(--c-text)'
              }}
            >
              {t('rotateCloth.reset')}
            </button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="upload-btn"
              style={{ minWidth: '150px' }}
            >
              {saving ? t('common.processing') : t('rotateCloth.saveAndFinish')}
            </button>
          </div>
        </div>
        
        {/* 提示文字 */}
        <p style={{ 
          textAlign: 'center', 
          fontSize: '0.875rem', 
          color: 'rgba(18, 18, 18, 0.5)',
          margin: 0
        }}>
          {t('rotateCloth.hint')}
        </p>
      </div>
      
      {toastMessage && (
        <Toast 
          message={toastMessage} 
          onClose={() => setToastMessage(null)}
          duration={3000}
        />
      )}
    </div>
  );
}
