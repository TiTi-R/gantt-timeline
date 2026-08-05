import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getProjects, createProject, deleteProject } from '../../services/api.js';

export default function ProjectList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', study_id: '', indication: '',
    start_date: new Date().toISOString().split('T')[0],
    description: ''
  });

  useEffect(() => { loadProjects(); }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProjects();
      setProjects(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load projects:', e);
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    if (e) e.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    try {
      const project = await createProject({
        name: form.name.trim(),
        study_id: form.study_id.trim() || null,
        indication: form.indication.trim() || null,
        start_date: new Date().toISOString().split('T')[0],
        description: form.description.trim() || null,
      });
      setShowNew(false);
      setForm({
        name: '', study_id: '', indication: '',
        start_date: new Date().toISOString().split('T')[0],
        description: ''
      });
      navigate(`/project/${project.id}/gantt`);
    } catch (e) {
      alert(t('error') + ': ' + (e.response?.data?.error || e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('project.deleteConfirm'))) return;
    try {
      await deleteProject(id);
      loadProjects();
    } catch (e) {
      alert('Failed to delete: ' + e.message);
    }
  };

  const statusColors = {
    draft: 'bg-gray-100 text-gray-600',
    active: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
    archived: 'bg-gray-100 text-gray-400'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 animate-pulse">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">{t('projects')}</h2>
        <button
          onClick={() => setShowNew(!showNew)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showNew ? '✕ ' + t('close') : '+ ' + t('project.new')}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
          <button onClick={loadProjects} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* New Project Form */}
      {showNew && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">{t('project.new')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">{t('name')} *</label>
              <input required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="如: IMM2510-003 TNBC 项目"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">{t('studyId')}</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-300 outline-none"
                value={form.study_id}
                onChange={e => setForm({ ...form, study_id: e.target.value })}
                placeholder="如: IMM2510-003"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">{t('indication')}</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-300 outline-none"
                value={form.indication}
                onChange={e => setForm({ ...form, indication: e.target.value })}
                placeholder="如: TNBC (三阴乳腺癌)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">日期</label>
              <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50">
                创建后由任务自动计算
              </div>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-600 mb-1">{t('description')}</label>
            <textarea rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-300 outline-none"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="项目描述..."
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving || !form.name.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? t('loading') : t('create')}
            </button>
            <button type="button" onClick={() => setShowNew(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
              {t('cancel')}
            </button>
          </div>
        </form>
      )}

      {/* Project List */}
      {projects.length === 0 && !showNew ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-lg font-medium">{t('project.noProjects')}</p>
          <button onClick={() => setShowNew(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            + {t('project.new')}
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('name')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('studyId')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('indication')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('status')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('startDate')}</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projects.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/project/${p.id}/gantt`)}>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.study_id || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{p.indication || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status] || ''}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.task_count > 0 ? p.start_date : 'NA'}</td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">
                      {t('delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
