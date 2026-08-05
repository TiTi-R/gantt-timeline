import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getResources, createResource, deleteResource } from '../../services/api.js';

export default function ResourceList() {
  const { t } = useTranslation();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', department: '', color: '#4A90D9' });

  useEffect(() => { loadResources(); }, []);

  const loadResources = async () => {
    try { setLoading(true); setResources(await getResources()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    try {
      await createResource(form);
      setShowNew(false);
      setForm({ name: '', role: '', department: '', color: '#4A90D9' });
      loadResources();
    } catch (e) { alert('Failed: ' + e.message); }
  };

  const handleDelete = async (id) => {
    try { await deleteResource(id); loadResources(); }
    catch (e) { alert(e.response?.data?.error || e.message); }
  };

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400 animate-pulse">{t('loading')}</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">{t('resources')}</h2>
        <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          + {t('resource.new')}
        </button>
      </div>

      {showNew && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <input className="border rounded-lg px-3 py-2 text-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder={t('name') + ' *'} />
            <input className="border rounded-lg px-3 py-2 text-sm" value={form.role} onChange={e => setForm({...form, role: e.target.value})} placeholder={t('resource.role')} />
            <input className="border rounded-lg px-3 py-2 text-sm" value={form.department} onChange={e => setForm({...form, department: e.target.value})} placeholder={t('resource.department')} />
            <input type="color" className="border rounded-lg px-2 py-1 h-9" value={form.color} onChange={e => setForm({...form, color: e.target.value})} />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreate} disabled={!form.name} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">{t('create')}</button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">{t('cancel')}</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t('name')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t('resource.role')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t('resource.department')}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {resources.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: r.color || '#ccc' }} />
                    <span className="font-medium text-gray-800">{r.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{r.role || '-'}</td>
                <td className="px-4 py-3 text-gray-500">{r.department || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700 text-xs">{t('delete')}</button>
                </td>
              </tr>
            ))}
            {resources.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">{t('noData')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
