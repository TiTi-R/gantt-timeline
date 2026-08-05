import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const languages = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'English' },
];

export default function Header() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const switchLanguage = (code) => {
    i18n.changeLanguage(code);
    try { localStorage.setItem('gantt-lang', code); } catch {}
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          ← {t('projects')}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => switchLanguage(lang.code)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                i18n.language === lang.code
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
