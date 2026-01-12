import { useState, useEffect } from 'react';
import { CONFIG } from '../config';
import { ClothViewer } from '../components/ClothViewer';
import '../App.css';

interface ClothModel {
  name: string;
  url: string;
  format: string;
  thumbnail?: string;
}

export function ClothingFactory() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('Upload a clothing photo to generate 3D model');
  const [clothes, setClothes] = useState<ClothModel[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
    setStatus('AI is generating 3D clothing model... (this may take a few minutes)');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/clothes/upload/cloth`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        setStatus('Success! 3D clothing model generated.');
        fetchClothes(); // 刷新列表
      } else {
        setStatus(`Failed: ${data.message || 'Unknown error'}`);
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
        <h1>Clothing Factory (Admin)</h1>
        <div className="controls">
          <label className={`upload-btn ${loading ? 'disabled' : ''}`}>
            {loading ? 'Processing...' : 'Upload Clothing Photo'}
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

      <div className="main-content" style={{ padding: '20px', display: 'block', overflowY: 'auto' }}>
        <h2>Generated 3D Clothes</h2>
        <div className="clothes-grid">
          {clothes.length === 0 && <p>No clothes generated yet.</p>}
          {clothes.map((cloth, index) => (
            <div key={index} className="cloth-card">
              <div className="cloth-thumbnail">
                {previewUrl === `${CONFIG.API_BASE_URL}${cloth.url}` ? (
                  <ClothViewer modelUrl={previewUrl} />
                ) : (
                  <div 
                    onClick={() => setPreviewUrl(`${CONFIG.API_BASE_URL}${cloth.url}`)}
                    style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
                  >
                    <span style={{ fontSize: '3rem' }}>👕</span>
                    <span>Click to Preview 3D</span>
                  </div>
                )}
              </div>
              <p className="cloth-name">{cloth.name} ({cloth.format})</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <a href={`${CONFIG.API_BASE_URL}${cloth.url}`} target="_blank" rel="noreferrer" className="cloth-link">
                  Download {cloth.format.toUpperCase()}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
