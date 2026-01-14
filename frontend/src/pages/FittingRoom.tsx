import { useState, useEffect, useRef } from 'react';
import { Scene } from '../components/Scene';
import { Sidebar } from '../components/Sidebar';
import { type PresetModel } from '../constants/presets';
import { CONFIG } from '../config';
import { gsap } from 'gsap';
import '../App.css';

export function FittingRoom() {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('準備建立您的 3D 身體模型');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
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

  // 處理檔案上傳
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus('AI 正在重建您的身體模型... (可能需要 30 秒)');
    setModelUrl(null);
    setSelectedPreset(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/upload/body`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.status === 'success' && data.models.length > 0) {
        const fullUrl = `${CONFIG.API_BASE_URL}${data.models[0]}`;
        setModelUrl(fullUrl);
        setStatus('成功！您的 3D 身體模型已準備就緒。');
        
        // Animate success
        gsap.to(headerRef.current, {
          scale: 1.02,
          duration: 0.3,
          yoyo: true,
          repeat: 1,
          ease: 'power2.inOut'
        });
      } else {
        setStatus('生成 3D 模型失敗。');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setStatus('伺服器連接錯誤。');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = (preset: PresetModel) => {
    if (loading) return;
    setModelUrl(preset.objUrl);
    setSelectedPreset(preset.id);
    setStatus(`已載入預設模型: ${preset.name}`);
  };

  return (
    <div className="app-container">
      <header className="app-header" ref={headerRef}>
        <h1 className="display" ref={titleRef}>3D 虛擬試衣間</h1>
        <div className="controls">
          <label className={`upload-btn ${loading ? 'disabled' : ''}`}>
            {loading ? '處理中...' : '上傳照片'}
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

      <div className="main-content">
        <Sidebar 
          onSelectPreset={handleSelectPreset} 
          selectedPresetId={selectedPreset} 
          loading={loading} 
        />
        <div className="scene-container">
          <Scene modelUrl={modelUrl} />
        </div>
      </div>
    </div>
  );
}
