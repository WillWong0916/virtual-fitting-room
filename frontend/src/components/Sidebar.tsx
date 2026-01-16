import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../contexts/I18nContext';
import { CONFIG } from '../config';

interface BodyModel {
  name: string;
  url: string;
  format: string;
  thumbnail?: string;
  is_preset?: boolean;
}

interface SidebarProps {
  onSelectPreset: (preset: BodyModel) => void;
  selectedPresetId: string | null;
  loading: boolean;
  bodies: BodyModel[];
  clothes: BodyModel[];
  onSelectCloth: (cloth: BodyModel) => void;
  selectedClothId: string | null;
}

type TabType = 'bodies' | 'clothes';

export function Sidebar({ 
  onSelectPreset, 
  selectedPresetId, 
  loading, 
  bodies,
  clothes,
  onSelectCloth,
  selectedClothId
}: SidebarProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('bodies');
  const panelRef = useRef<HTMLElement>(null);

  // 確保滾動事件能正確處理
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const handleWheel = (e: WheelEvent) => {
      // 檢查是否可以滾動
      const canScroll = panel.scrollHeight > panel.clientHeight;
      if (!canScroll) return;

      // 檢查是否在邊界
      const isAtTop = panel.scrollTop <= 0;
      const isAtBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1;
      
      // 如果不在邊界，或者滾動方向允許繼續，則執行滾動
      if (!((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0))) {
        panel.scrollTop += e.deltaY;
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // 使用 capture 階段確保事件被正確處理
    panel.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    
    return () => {
      panel.removeEventListener('wheel', handleWheel, { capture: true } as any);
    };
  }, []);

  // 優先顯示預設模型，然後是動態生成的
  const sortedBodies = [...bodies].sort((a, b) => {
    if (a.is_preset && !b.is_preset) return -1;
    if (!a.is_preset && b.is_preset) return 1;
    return 0;
  });

  const sortedClothes = [...clothes].sort((a, b) => {
    if (a.is_preset && !b.is_preset) return -1;
    if (!a.is_preset && b.is_preset) return 1;
    return 0;
  });

  return (
    <aside className="presets-panel" ref={panelRef}>
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activeTab === 'bodies' ? 'active' : ''}`}
          onClick={() => setActiveTab('bodies')}
        >
          {t('fittingRoom.tabBodies')}
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'clothes' ? 'active' : ''}`}
          onClick={() => setActiveTab('clothes')}
        >
          {t('fittingRoom.tabClothes')}
        </button>
      </div>

      {activeTab === 'bodies' && (
        <>
          <h3>{t('fittingRoom.presets')}</h3>
          <div className="presets-list">
            {sortedBodies.length === 0 ? (
              <p style={{ padding: '1rem', textAlign: 'center', color: 'rgba(18, 18, 18, 0.5)' }}>
                {t('common.loading')}...
              </p>
            ) : (
              sortedBodies.map((preset) => (
                <div 
                  key={preset.name} 
                  className={`preset-item ${selectedPresetId === preset.name ? 'active' : ''}`}
                  onClick={() => onSelectPreset(preset)}
                  style={{ opacity: loading ? 0.5 : 1 }}
                >
                  <div className="thumbnail-wrapper">
                    {preset.thumbnail ? (
                      <img src={`${CONFIG.API_BASE_URL}${preset.thumbnail}`} alt={preset.name} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'rgba(18, 18, 18, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '1.5rem' }}>👤</span>
                      </div>
                    )}
                  </div>
                  <span>{preset.name}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {activeTab === 'clothes' && (
        <>
          <h3>{t('fittingRoom.selectCloth')}</h3>
          <div className="presets-list">
            {sortedClothes.length === 0 ? (
              <p style={{ padding: '1rem', textAlign: 'center', color: 'rgba(18, 18, 18, 0.5)' }}>
                {t('fittingRoom.noClothesAvailable')}
              </p>
            ) : (
              sortedClothes.map((cloth) => (
                <div 
                  key={cloth.name} 
                  className={`preset-item ${selectedClothId === cloth.name ? 'active' : ''}`}
                  onClick={() => onSelectCloth(cloth)}
                  style={{ opacity: loading ? 0.5 : 1 }}
                >
                  <div className="thumbnail-wrapper">
                    {cloth.thumbnail ? (
                      <img src={`${CONFIG.API_BASE_URL}${cloth.thumbnail}`} alt={cloth.name} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'rgba(18, 18, 18, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '1.5rem' }}>👕</span>
                      </div>
                    )}
                  </div>
                  <span>{cloth.name}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </aside>
  );
}
