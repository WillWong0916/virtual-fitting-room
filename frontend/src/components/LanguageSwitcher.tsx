import { useTranslation, type Locale } from '../contexts/I18nContext';
import '../App.css';

const languages: { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'zh-CN', label: '简体中文' },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="language-switcher">
      {languages.map((lang) => (
        <button
          key={lang.code}
          className={`lang-btn ${locale === lang.code ? 'active' : ''}`}
          onClick={() => setLocale(lang.code)}
          title={lang.label}
        >
          <span className="lang-label">{lang.label}</span>
        </button>
      ))}
    </div>
  );
}
