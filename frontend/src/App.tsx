import { useState } from 'react';
import { Scene } from './components/Scene';
import { Sidebar } from './components/Sidebar';
import { type PresetModel } from './constants/presets';
import { CONFIG } from './config';
import './App.css';

function App() {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('Ready to build your 3D body');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // 處理檔案上傳
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus('AI is reconstructing your body... (may take 30s)');
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

  const handleSelectPreset = (preset: PresetModel) => {
    if (loading) return;
    setModelUrl(preset.objUrl);
    setSelectedPreset(preset.id);
    setStatus(`Loaded preset: ${preset.name}`);
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

      <div className="main-content">
        <Sidebar 
          onSelectPreset={handleSelectPreset} 
          selectedPresetId={selectedPreset} 
          loading={loading} 
        />
        <Scene modelUrl={modelUrl} />
      </div>
    </div>
  );
}

export default App;
