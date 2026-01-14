import { PRESET_MODELS, type PresetModel } from '../constants/presets';
import { useTranslation } from '../contexts/I18nContext';

interface SidebarProps {
  onSelectPreset: (preset: PresetModel) => void;
  selectedPresetId: string | null;
  loading: boolean;
}

export function Sidebar({ onSelectPreset, selectedPresetId, loading }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="presets-panel">
      <h3>{t('fittingRoom.presets')}</h3>
      <div className="presets-list">
        {PRESET_MODELS.map((preset) => (
          <div 
            key={preset.id} 
            className={`preset-item ${selectedPresetId === preset.id ? 'active' : ''}`}
            onClick={() => onSelectPreset(preset)}
            style={{ opacity: loading ? 0.5 : 1 }}
          >
            <div className="thumbnail-wrapper">
              <img src={preset.thumbnail} alt={preset.name} />
            </div>
            <span>{preset.name}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
