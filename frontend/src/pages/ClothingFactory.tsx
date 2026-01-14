import { useState, useEffect, useRef } from 'react';
import { CONFIG } from '../config';
import { ClothViewer } from '../components/ClothViewer';
import { gsap } from 'gsap';
import '../App.css';

interface ClothModel {
  name: string;
  url: string;
  format: string;
  thumbnail?: string;
}

export function ClothingFactory() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('上傳服裝照片以生成 3D 模型');
  const [clothes, setClothes] = useState<ClothModel[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (headerRef.current && titleRef.current) {
      gsap.from(titleRef.current, {
        y: 50,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        delay: 0.2
      });
    }
  }, []);

  // 獲取已有的衣物列表
  const fetchClothes = async () => {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/clothes`);
      const data = await response.json();
      if (data.status === 'success') {
        setClothes(data.clothes);
      }
    } catch (error) {
      console.error('Failed to fetch clothes:', error);
    }
  };

  useEffect(() => {
    fetchClothes();
  }, []);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus('AI 正在生成 3D 服裝模型... (這可能需要幾分鐘)');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/clothes/upload/cloth`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        setStatus('成功！3D 服裝模型已生成。');
        fetchClothes(); // 刷新列表
        
        // Animate success
        gsap.to(headerRef.current, {
          scale: 1.02,
          duration: 0.3,
          yoyo: true,
          repeat: 1,
          ease: 'power2.inOut'
        });
      } else {
        setStatus(`失敗: ${data.message || '未知錯誤'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setStatus('伺服器連接錯誤。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header" ref={headerRef}>
        <h1 className="display" ref={titleRef}>服裝工廠 (管理員)</h1>
        <div className="controls">
          <label className={`upload-btn ${loading ? 'disabled' : ''}`}>
            {loading ? '處理中...' : '上傳服裝照片'}
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

      <div className="main-content" style={{ padding: '2rem', display: 'block', overflowY: 'auto' }}>
        <h2 className="display" style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 600 }}>
          已生成的 3D 服裝
        </h2>
        <div className="clothes-grid">
          {clothes.length === 0 && (
            <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'rgba(18, 18, 18, 0.5)', padding: '2rem' }}>
              尚未生成任何服裝模型。
            </p>
          )}
          {clothes.map((cloth, index) => (
            <div key={index} className="cloth-card">
              <div className="cloth-thumbnail">
                {previewUrl === `${CONFIG.API_BASE_URL}${cloth.url}` ? (
                  <ClothViewer modelUrl={previewUrl} />
                ) : (
                  <div 
                    onClick={() => setPreviewUrl(`${CONFIG.API_BASE_URL}${cloth.url}`)}
                    style={{ cursor: 'pointer', position: 'relative', width: '100%', height: '100%' }}
                  >
                    {cloth.thumbnail ? (
                      <img 
                        src={`${CONFIG.API_BASE_URL}${cloth.thumbnail}`} 
                        alt={cloth.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                      />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <span style={{ fontSize: '3rem' }}>👕</span>
                        <span style={{ color: 'rgba(18, 18, 18, 0.4)', fontSize: '0.875rem' }}>無預覽</span>
                      </div>
                    )}
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'rgba(18, 18, 18, 0.8)',
                      color: 'var(--c-bg)',
                      padding: '0.75rem',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      textAlign: 'center'
                    }}>
                      點擊查看 3D 模型
                    </div>
                  </div>
                )}
              </div>
              <p className="cloth-name">{cloth.name} ({cloth.format})</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <span className="cloth-link" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                  下載已停用
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
