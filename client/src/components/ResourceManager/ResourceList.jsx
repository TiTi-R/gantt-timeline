import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getResources, createResource, updateResource, deleteResource } from '../../services/api.js';

export default function ResourceList() {
  const { t } = useTranslation();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ role: '', tagInput: '', tags: [], color: '#4A90D9' });
  const [editingId, setEditingId] = useState(null);
  const [editTags, setEditTags] = useState([]);
  const [editTagInput, setEditTagInput] = useState('');

  useEffect(() => { loadResources(); }, []);

  const loadResources = async () => {
    try { setLoading(true); setResources(await getResources()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const pushTag = () => {
    const name = form.tagInput.trim();
    if (!name || form.tags.includes(name)) return;
    setForm({ ...form, tags: [...form.tags, name], tagInput: '' });
  };

  const removeTag = (name) => {
    setForm({ ...form, tags: form.tags.filter(t => t !== name) });
  };

  const pushEditTag = () => {
    const name = editTagInput.trim();
    if (!name || editTags.includes(name)) return;
    setEditTags([...editTags, name]);
    setEditTagInput('');
  };

  const removeEditTag = (name) => {
    setEditTags(editTags.filter(t => t !== name));
  };

  const handleCreate = async () => {
    if (!form.role.trim() || form.tags.length === 0) return;
    try {
      await createResource({
        name: form.tags[0],
        role: form.role.trim(),
        color: form.color,
        members: form.tags.length > 1 ? form.tags.slice(1) : [],
      });
      setShowNew(false);
      setForm({ role: '', tagInput: '', tags: [], color: '#4A90D9' });
      loadResources();
    } catch (e) { alert('Failed: ' + e.message); }
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setEditTags(r.members?.length ? [r.name, ...r.members] : [r.name]);
    setEditTagInput('');
  };

  const saveEdit = async (r) => {
    if (editTags.length === 0) return;
    try {
      await updateResource(r.id, {
        name: editTags[0],
        members: editTags.length > 1 ? editTags.slice(1) : [],
      });
      setEditingId(null);
      loadResources();
    } catch (e) { alert(e.response?.data?.error || e.message); }
  };

  const handleDelete = async (id) => {
    try { await deleteResource(id); loadResources(); }
    catch (e) { alert(e.response?.data?.error || e.message); }
  };

  const allNames = (r) => {
    const names = [r.name];
    if (r.members?.length) names.push(...r.members);
    return names;
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

      {/* Add Form */}
      {showNew && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">角色 *</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" autoFocus
                value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                placeholder="如: 临床监查员" onKeyDown={e => { if (e.key === 'Enter') pushTag(); }} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">颜色</label>
              <input type="color" className="rounded-lg px-1 py-1 h-9 w-16 border" value={form.color}
                onChange={e => setForm({ ...form, color: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">负责人 *</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {form.tags.map(name => (
                <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {name}
                  <button className="hover:text-red-500 text-blue-400 font-bold" onClick={() => removeTag(name)}>×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="flex-1 border rounded-lg px-3 py-2 text-sm" value={form.tagInput}
                onChange={e => setForm({ ...form, tagInput: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); pushTag(); } }}
                placeholder="输入姓名后按 + 添加" />
              <button onClick={pushTag} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 font-bold">+</button>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!form.role.trim() || form.tags.length === 0}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">{t('create')}</button>
            <button onClick={() => { setShowNew(false); setForm({ role: '', tagInput: '', tags: [], color: '#4A90D9' }); }}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">{t('cancel')}</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-48">角色</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">负责人</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 w-20">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {resources.map(r => {
              const names = allNames(r);
              const isEditing = editingId === r.id;
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full inline-block shrink-0" style={{ backgroundColor: r.color || '#ccc' }} />
                      <span className="font-medium text-gray-800">{r.role || '-'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div>
                        <div className="flex gap-1.5 mb-2 flex-wrap">
                          {editTags.map(name => (
                            <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              {name}
                              <button className="hover:text-red-500 text-blue-400 font-bold" onClick={() => removeEditTag(name)}>×</button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <input className="flex-1 border rounded px-2 py-1 text-xs" value={editTagInput}
                            onChange={e => setEditTagInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); pushEditTag(); } }}
                            placeholder="添加负责人..." />
                          <button onClick={pushEditTag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200">+</button>
                          <button onClick={() => saveEdit(r)} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">保存</button>
                          <button onClick={() => setEditingId(null)} className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded hover:bg-gray-300">×</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-1.5 flex-wrap">
                        {names.map(name => (
                          <span key={name} className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
                            onDoubleClick={() => startEdit(r)} title="双击编辑负责人">{name}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700 text-xs">{t('delete')}</button>
                  </td>
                </tr>
              );
            })}
            {resources.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-12 text-center text-gray-400">{t('noData')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
