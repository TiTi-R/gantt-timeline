import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getProject, getPhases } from '../../services/api.js';

export default function TaskTable() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [project, setProject] = useState(null);
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('all');

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [p, ph] = await Promise.all([
        getProject(id),
        getPhases(id),
      ]);
      setProject(p);
      setPhases(ph);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const tasks = project?.tasks || [];

  const filtered = tasks.filter(t => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (phaseFilter !== 'all' && t.phase_id !== Number(phaseFilter)) return false;
    return true;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-full text-gray-400 animate-pulse">{t('loading')}</div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/project/${id}/gantt`)}
            className="text-sm text-blue-600 hover:text-blue-800">
            ← Gantt View
          </button>
          <input className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56" placeholder={t('search')}
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)}>
            <option value="all">All Phases</option>
            {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <span className="text-xs text-gray-400">{filtered.length} tasks</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr className="border-b border-gray-200">
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">WBS</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">{t('name')}</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">{t('task.phase')}</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">{t('startDate')}</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">{t('endDate')}</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-600">{t('duration')}</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-600">{t('task.progress')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(task => {
              const phase = phases.find(p => p.id === task.phase_id);
              return (
                <tr key={task.id} className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/project/${id}/gantt`)}
                  style={task.parent_id ? { paddingLeft: '24px' } : {}}>
                  <td className="px-4 py-2 text-gray-400 text-xs">{task.wbs_code || task.id}</td>
                  <td className="px-4 py-2">
                    <span className={task.parent_id ? 'text-gray-500' : 'font-medium text-gray-800'}>
                      {task.parent_id ? '  ↳ ' : ''}{task.name}
                    </span>
                    {task.is_milestone && <span className="ml-1 text-yellow-500">◆</span>}
                  </td>
                  <td className="px-4 py-2">
                    {phase && (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: phase.color || '#ccc' }} />
                        <span className="text-gray-500">{phase.name}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{task.start_date}</td>
                  <td className="px-4 py-2 text-gray-500">{task.end_date}</td>
                  <td className="px-4 py-2 text-center text-gray-500">{task.duration_days}d</td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(task.progress || 0) * 100}%` }} />
                      </div>
                      <span className="text-xs text-gray-400">{Math.round((task.progress || 0) * 100)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-400">{t('noData')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
