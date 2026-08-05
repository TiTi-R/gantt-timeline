import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createTask, updateTask } from '../../services/api.js';

export default function TaskEditModal({ projectId, task, onClose, onSaved }) {
  const { t } = useTranslation();
  const isNew = !task?.id;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: task?.text || task?.name || '',
    start_date: task?.start_date || new Date().toISOString().split('T')[0],
    end_date: task?.end_date || new Date().toISOString().split('T')[0],
    duration_days: task?.duration || 1,
    notes: task?.notes || '',
    task_type: task?.type === 'milestone' ? 'milestone' : 'task',
  });

  const modalRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });

  const onMouseDown = (e) => {
    if (['BUTTON','INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
    setDragging(true);
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  const fmtStr = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
  };

  useEffect(() => {
    if (task) {
      setForm({
        name: task.text || task.name || '',
        start_date: fmtStr(task.start_date),
        end_date: fmtStr(task.end_date),
        duration_days: task.duration || 1,
        notes: task.notes || '',
        task_type: task.type === 'milestone' ? 'milestone' : 'task',
      });
    }
  }, [task?.id]);

  const dateFmt = (d) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');

  const handleChange = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if ((field === 'start_date' || field === 'end_date') && next.start_date && next.end_date) {
        const s = new Date(next.start_date + 'T00:00:00');
        const e = new Date(next.end_date + 'T00:00:00');
        next.duration_days = Math.max(1, Math.round((e - s) / 86400000) + 1);
      }
      if (field === 'duration_days' && next.start_date) {
        const d = new Date(next.start_date + 'T00:00:00');
        d.setDate(d.getDate() + Number(value) - 1);
        next.end_date = dateFmt(d);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const data = {
        name: form.name,
        start_date: form.start_date,
        end_date: form.end_date,
        duration_days: form.duration_days,
        notes: form.notes,
        task_type: form.task_type,
        is_milestone: form.task_type === 'milestone',
      };
      if (isNew) { if (task?.parent) data.parent_id = task.parent; await createTask(projectId, data); }
      else { await updateTask(task.id, data); }
      onSaved();
    } catch (e) { alert('Failed: ' + (e.response?.data?.error || e.message)); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onMouseDown={onClose}>
      <div ref={modalRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, transition: dragging ? 'none' : 'transform 0.1s' }}
        onMouseDown={e => e.stopPropagation()}>

        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between cursor-grab active:cursor-grabbing select-none"
          onMouseDown={onMouseDown}>
          <h3 className="font-semibold text-gray-800 text-lg pointer-events-none">
            {isNew ? '新建任务' : '编辑任务'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-auto">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">名称 *</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={form.name} onChange={e => handleChange('name', e.target.value)} autoFocus />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">类型</label>
            <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 bg-gray-50">
              {form.task_type === 'milestone' ? '◆ 里程碑' : '任务'}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">开始日期</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.start_date} onChange={e => handleChange('start_date', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">结束日期</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.end_date} onChange={e => handleChange('end_date', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">工期</label>
              <input type="number" min="1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.duration_days} onChange={e => handleChange('duration_days', Number(e.target.value))} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">备注</label>
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2}
              value={form.notes} onChange={e => handleChange('notes', e.target.value)} />
          </div>
        </div>

        <div className="px-6 py-3 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg">取消</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? '...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
