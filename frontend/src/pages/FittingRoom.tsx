import { useState, useEffect, useRef } from 'react';
import { Scene } from '../components/Scene';
import { Sidebar } from '../components/Sidebar';
import { Toast } from '../components/Toast';
import { CONFIG } from '../config';
import { useTranslation } from '../contexts/I18nContext';
import { createTextAnimation } from '../utils/textAnimation';
import { validateImageFile, MAX_FILE_SIZE_MB } from '../utils/fileValidation';
import { gsap } from 'gsap';
import '../App.css';

interface BodyModel {
  name: string;
  url: string;
  format: string;
  thumbnail?: string;
  is_preset?: boolean;
}

export function FittingRoom() {
  const [bodies, setBodies] = useState<BodyModel[]>([]);
  const [clothes, setClothes] = useState<BodyModel[]>([]);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { t, locale } = useTranslation();
  const [status, setStatus] = useState<string>(t('fittingRoom.readyToBuild'));
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedCloth, setSelectedCloth] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // 當語言改變時更新 status
  useEffect(() => {
    if (!loading) {
      setStatus(t('fittingRoom.readyToBuild'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  // 獲取 body 模型列表
  const fetchBodies = async () => {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/bodies`);
      const data = await response.json();
      if (data.status === 'success') {
        setBodies(data.bodies || []);
        // 如果有預設模型，使用第一個預設模型
        const firstPreset = data.bodies?.find((b: BodyModel) => b.is_preset) || data.bodies?.[0];
        if (firstPreset) {
          setModelUrl(`${CONFIG.API_BASE_URL}${firstPreset.url}`);
          setSelectedPreset(firstPreset.name);
        }
      }
    } catch (error) {
      console.error('Failed to fetch bodies:', error);
    }
  };

  // 獲取衣物列表
  const fetchClothes = async () => {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/clothes/`);
      const data = await response.json();
      if (data.status === 'success') {
        setClothes(data.clothes || []);
      }
    } catch (error) {
      console.error('Failed to fetch clothes:', error);
    }
  };

  useEffect(() => {
    fetchBodies();
    fetchClothes();
  }, []);

  useEffect(() => {
    if (headerRef.current && titleRef.current) {
      createTextAnimation(titleRef.current, {
        delay: 0.3,
        duration: 1.2,
        ease: 'power4.out',
        blur: true,
        scale: true,
      });
    }
  }, []);

  // 處理檔案上傳
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    // 驗證檔案
    const validation = validateImageFile(file);
    if (!validation.valid) {
      let errorMessage = '';
      if (validation.error === 'fileRequired') {
        errorMessage = t('common.fileRequired');
      } else if (validation.error === 'invalidFileType') {
        errorMessage = t('common.invalidFileType');
      } else if (validation.error === 'fileTooLarge') {
        errorMessage = t('common.fileTooLarge', { maxSize: MAX_FILE_SIZE_MB.toString() });
      }
      setToastMessage(errorMessage);
      // 重置 input
      event.target.value = '';
      return;
    }

    setLoading(true);
    setStatus(t('fittingRoom.aiReconstructing'));
    setModelUrl(null);
    setSelectedPreset(null);

    const formData = new FormData();
    formData.append('file', file!);

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/upload/body`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.status === 'success' && data.models.length > 0) {
        const fullUrl = `${CONFIG.API_BASE_URL}${data.models[0]}`;
        setModelUrl(fullUrl);
        setStatus(t('fittingRoom.successReady'));
        
        // Animate success
        gsap.to(headerRef.current, {
          scale: 1.02,
          duration: 0.3,
          yoyo: true,
          repeat: 1,
          ease: 'power2.inOut'
        });
      } else {
        setStatus(t('fittingRoom.generateFailed'));
      }
    } catch (error) {
      console.error('Upload error:', error);
      setStatus(t('fittingRoom.serverError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = (preset: BodyModel) => {
    if (loading) return;
    setModelUrl(`${CONFIG.API_BASE_URL}${preset.url}`);
    setSelectedPreset(preset.name);
    setStatus(t('fittingRoom.presetLoaded', { name: preset.name }));
  };

  const handleSelectCloth = (_cloth: BodyModel) => {
    if (loading) return;
    // 試衣功能未實裝，顯示 Toast 提示
    setToastMessage(t('fittingRoom.fittingNotAvailable'));
    
    // 清除之前的選中狀態
    setSelectedCloth(null);
  };

  return (
    <div className="app-container">
      <header className="app-header" ref={headerRef}>
        <h1 className="display" ref={titleRef}>{t('fittingRoom.title')}</h1>
        <div className="controls">
          <label className={`upload-btn ${loading ? 'disabled' : ''}`}>
            {loading ? t('common.processing') : t('fittingRoom.uploadPhoto')}
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
          bodies={bodies}
          clothes={clothes}
          onSelectCloth={handleSelectCloth}
          selectedClothId={selectedCloth}
        />
        <div className="scene-container">
          <Scene modelUrl={modelUrl} />
        </div>
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
