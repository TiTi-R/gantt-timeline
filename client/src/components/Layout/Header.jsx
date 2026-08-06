import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function Header() {
  const { t } = useTranslation();
  const navigate = useNavigate();

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
    </header>
  );
}
