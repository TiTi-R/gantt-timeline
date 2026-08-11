import { useNavigate } from 'react-router-dom';

export default function Header() {
  const navigate = useNavigate();

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          ← 项目
        </button>
      </div>
    </header>
  );
}
