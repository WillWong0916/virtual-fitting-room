import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGLTF } from '@react-three/drei';
import { CONFIG } from '../config';
import { ClothViewer } from '../components/ClothViewer';
import { Toast } from '../components/Toast';
import { useTranslation } from '../contexts/I18nContext';
import { createTextAnimation } from '../utils/textAnimation';
import { validateImageFile, MAX_FILE_SIZE_MB } from '../utils/fileValidation';
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
  const [fetchingClothes, setFetchingClothes] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadThumbnail, setUploadThumbnail] = useState<string | null>(null);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>(t('clothingFactory.uploadToGenerate'));
  const [clothes, setClothes] = useState<ClothModel[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewCacheKey, setPreviewCacheKey] = useState<number>(Date.now());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
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
  const fetchClothes = async (preserveOnError = false) => {
    // 如果正在上傳處理中，不要更新列表（避免清空現有列表）
    if (loading) {
      console.log('Skipping fetchClothes: upload in progress');
      return;
    }
    
    setFetchingClothes(true);
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/clothes`);
      const data = await response.json();
      if (data.status === 'success') {
        setClothes(data.clothes || []); // 確保總是設置為數組
      } else {
        console.error('Failed to fetch clothes:', data.message);
        // 如果 preserveOnError 為 true，保持現有列表
        if (!preserveOnError) {
          setClothes([]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch clothes:', error);
      // 如果 preserveOnError 為 true，保持現有列表
      if (!preserveOnError) {
        setClothes([]);
      }
    } finally {
      setFetchingClothes(false);
    }
  };

  useEffect(() => {
    fetchClothes();
    // 進入頁面時清空 GLTF 快取，確保看到的是最新修改
    return () => {
      useGLTF.clear(); 
    };
  }, []);

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
    setProgress(0);
    setStatus(t('clothingFactory.aiGenerating'));
    
    // 創建本地縮圖預覽
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadThumbnail(e.target?.result as string);
    };
    reader.readAsDataURL(file!);

    const formData = new FormData();
    formData.append('file', file!);

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/clothes/upload/cloth/stream`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              setProgress(data.progress || 0);
              setStatus(data.message || t('clothingFactory.aiGenerating'));
              
              // 更新縮圖 URL（如果後端提供了）
              if (data.thumbnail_url) {
                setUploadThumbnail(`${CONFIG.API_BASE_URL}${data.thumbnail_url}`);
              }
              
              // 處理完成 - 跳轉到旋轉調整頁面
              if (data.stage === 'complete' && data.model_url) {
                setStatus(t('clothingFactory.successGenerated'));
                setProgress(100);
                
                // 從 model_url 提取檔案名
                const filename = data.model_url.split('/').pop();
                
                // Animate success
                gsap.to(headerRef.current, {
                  scale: 1.02,
                  duration: 0.3,
                  yoyo: true,
                  repeat: 1,
                  ease: 'power2.inOut'
                });
                
                // 延遲一點再跳轉到旋轉調整頁面
                setTimeout(() => {
                  setUploadThumbnail(null);
                  setLoading(false);
                  navigate(`/admin/rotate?model=${encodeURIComponent(data.model_url)}&filename=${encodeURIComponent(filename)}`);
                }, 1000);
                return; // 提前返回，不要執行 finally 中的 setLoading(false)
              }
              
              // 處理錯誤
              if (data.stage === 'error') {
                setStatus(t('clothingFactory.failedWithMessage', { 
                  message: data.message || t('clothingFactory.unknownError') 
                }));
                setUploadThumbnail(null);
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      setStatus(t('fittingRoom.serverError'));
      setUploadThumbnail(null);
    } finally {
      setLoading(false);
      setProgress(0);
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
          {loading && (
            <div style={{ 
              width: '100%', 
              marginTop: '0.5rem',
              background: 'rgba(18, 18, 18, 0.1)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '4px',
                background: 'var(--c-accent)',
                width: `${progress}%`,
                transition: 'width 0.3s ease',
                borderRadius: '4px'
              }} />
            </div>
          )}
        </div>
        {loading && uploadThumbnail && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'rgba(18, 18, 18, 0.05)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <img 
              src={uploadThumbnail} 
              alt="Upload preview" 
              style={{
                width: '80px',
                height: '80px',
                objectFit: 'cover',
                borderRadius: '4px',
                border: '1px solid rgba(18, 18, 18, 0.1)'
              }}
            />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                {t('clothingFactory.aiGenerating')}
              </p>
              <div style={{ 
                width: '100%', 
                background: 'rgba(18, 18, 18, 0.1)',
                borderRadius: '4px',
                overflow: 'hidden',
                height: '6px'
              }}>
                <div style={{
                  height: '100%',
                  background: 'var(--c-accent)',
                  width: `${progress}%`,
                  transition: 'width 0.3s ease',
                  borderRadius: '4px'
                }} />
              </div>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'rgba(18, 18, 18, 0.6)' }}>
                {progress.toFixed(0)}%
              </p>
            </div>
          </div>
        )}
      </header>

      <div className="main-content" style={{ padding: '2rem', display: 'block', overflowY: 'auto' }}>
        <h2 className="display" style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 600 }}>
          {t('clothingFactory.generatedClothes')}
        </h2>
        <div className="clothes-grid">
          {/* 只有在沒有衣物且不在加載時才顯示 "No clothes yet" */}
          {!loading && !fetchingClothes && clothes.length === 0 && (
            <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'rgba(18, 18, 18, 0.5)', padding: '2rem' }}>
              {t('clothingFactory.noClothesYet')}
            </p>
          )}
          {/* 在加載期間，如果有衣物就顯示，如果沒有就顯示加載提示 */}
          {loading && clothes.length === 0 && (
            <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'rgba(18, 18, 18, 0.5)', padding: '2rem' }}>
              {t('clothingFactory.aiGenerating')}...
            </p>
          )}
          {/* 在獲取衣物列表時顯示加載提示 */}
          {fetchingClothes && clothes.length === 0 && !loading && (
            <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'rgba(18, 18, 18, 0.5)', padding: '2rem' }}>
              {t('common.loading')}...
            </p>
          )}
          {clothes.map((cloth, index) => (
            <div key={index} className="cloth-card">
              <div className="cloth-thumbnail">
                {previewUrl === `${CONFIG.API_BASE_URL}${cloth.url}` ? (
                  <ClothViewer modelUrl={previewUrl} cacheKey={previewCacheKey} />
                ) : (
                  <div 
                    onClick={() => {
                      setPreviewCacheKey(Date.now());
                      setPreviewUrl(`${CONFIG.API_BASE_URL}${cloth.url}`);
                    }}
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
                <button 
                  className="cloth-link"
                  onClick={() => {
                    const filename = cloth.url.split('/').pop();
                    navigate(`/admin/rotate?model=${encodeURIComponent(cloth.url)}&filename=${encodeURIComponent(filename || '')}`);
                  }}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    cursor: 'pointer',
                    padding: 0,
                    font: 'inherit'
                  }}
                >
                  {t('common.edit')}
                </button>
              </div>
            </div>
          ))}
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
