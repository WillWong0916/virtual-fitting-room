import { useState, useEffect, useRef } from 'react';
import { CONFIG } from '../config';
import { ClothViewer } from '../components/ClothViewer';
import { useTranslation } from '../contexts/I18nContext';
import { createTextAnimation } from '../utils/textAnimation';
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
  const { t } = useTranslation();
  const [status, setStatus] = useState<string>(t('clothingFactory.uploadToGenerate'));
  const [clothes, setClothes] = useState<ClothModel[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

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
    setStatus(t('clothingFactory.aiGenerating'));

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/clothes/upload/cloth`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        setStatus(t('clothingFactory.successGenerated'));
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
        setStatus(t('clothingFactory.failedWithMessage', { 
          message: data.message || t('clothingFactory.unknownError') 
        }));
      }
    } catch (error) {
      console.error('Upload error:', error);
      setStatus(t('fittingRoom.serverError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header" ref={headerRef}>
        <h1 className="display" ref={titleRef}>{t('clothingFactory.title')}</h1>
        <div className="controls">
          <label className={`upload-btn ${loading ? 'disabled' : ''}`}>
            {loading ? t('common.processing') : t('clothingFactory.uploadClothingPhoto')}
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
          {t('clothingFactory.generatedClothes')}
        </h2>
        <div className="clothes-grid">
          {clothes.length === 0 && (
            <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'rgba(18, 18, 18, 0.5)', padding: '2rem' }}>
              {t('clothingFactory.noClothesYet')}
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
                        <span style={{ color: 'rgba(18, 18, 18, 0.4)', fontSize: '0.875rem' }}>{t('common.noPreview')}</span>
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
                      {t('common.clickToView3D')}
                    </div>
                  </div>
                )}
              </div>
              <p className="cloth-name">{cloth.name} ({cloth.format})</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <span className="cloth-link" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                  {t('common.downloadDisabled')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
