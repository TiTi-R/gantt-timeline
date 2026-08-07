import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { gantt } from 'dhtmlx-gantt';
import { useGantt } from '../../hooks/useGantt.js';
import {
  getGanttData, getProject, updateProject, createTask, updateTask, deleteTask,
  createDependency, deleteDependency, createTemplate, getResources,
  getTemplates, getPublishedTemplates, importTemplate, reorderTasks,
  getProjectFiles, uploadProjectFile, deleteProjectFile,
} from '../../services/api.js';
import GanttToolbar from './GanttToolbar.jsx';
import TaskEditModal from '../TaskEditor/TaskEditModal.jsx';

export default function GanttContainer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const pid = Number(id);

  const [project, setProject] = useState(null);
  const projectRef = useRef(null);
  useEffect(() => { projectRef.current = project; }, [project]);
  // Prevent onAfterTaskUpdate from firing during loadAll
  const updatingRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editTask, setEditTask] = useState(null);

  // Save template
  const [saveTplModal, setSaveTplModal] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplDesc, setTplDesc] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);

  // Import template
  const [importModal, setImportModal] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [importId, setImportId] = useState('');
  const [importAnchor, setImportAnchor] = useState(new Date().toISOString().split('T')[0]);
  const [importing, setImporting] = useState(false);

  // Edit project
  const [editingDesc, setEditingDesc] = useState('');
  const [descChanged, setDescChanged] = useState(false);

  // Total row
  const [totalLabel, setTotalLabel] = useState(() => {
    try { return localStorage.getItem(`total-label-${pid}`) || '总工期'; }
    catch { return '总工期'; }
  });
  const [editingTotal, setEditingTotal] = useState(false);

  // Resource role/member picker
  const [resources, setResources] = useState([]);
  const [showMembers, setShowMembers] = useState(false);
  const [resourcePicker, setResourcePicker] = useState(null);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
  const [personPicker, setPersonPicker] = useState(null);
  const [personPopoverPos, setPersonPopoverPos] = useState({ x: 0, y: 0 });

  const roleNames = [...new Set(resources.filter(r => r.role).map(r => r.role))].sort();

  // Role → person names map (for filtering person picker by selected roles)
  const rolePersonMap = useMemo(() => {
    const map = {};
    resources.forEach(r => {
      if (!r.role) return;
      const persons = [r.name, ...(r.members || [])].filter(Boolean);
      if (!map[r.role]) map[r.role] = new Set();
      persons.forEach(p => map[r.role].add(p));
    });
    // Convert Sets to sorted arrays
    const out = {};
    for (const [role, set] of Object.entries(map)) {
      out[role] = [...set].sort();
    }
    return out;
  }, [resources]);

  // Get person names filtered by a task's selected roles
  const getAvailablePersons = (taskId) => {
    const pt = project?.tasks?.find(t => t.id === taskId);
    if (!pt) return [];
    const curRoles = (pt.resource_names || '').split(',').filter(Boolean);
    if (curRoles.length === 0) {
      const all = new Set();
      Object.values(rolePersonMap).forEach(arr => arr.forEach(p => all.add(p)));
      return [...all].sort();
    }
    const names = new Set();
    curRoles.forEach(role => {
      const arr = rolePersonMap[role];
      if (arr) arr.forEach(p => names.add(p));
    });
    return [...names].sort();
  };

  const saveTotalLabel = (val) => {
    setTotalLabel(val);
    try { localStorage.setItem(`total-label-${pid}`, val); } catch {}
    setEditingTotal(false);
  };

  // Compute summary from tasks, deriving milestone dates from children
  const summary = useMemo(() => {
    const tasks = project?.tasks;
    if (!tasks?.length) return { start: 'NA', end: 'NA', total: 0 };

    // Derive milestone dates from children for summary calc
    const childrenMap = {};
    tasks.forEach(t => {
      if (t.parent_id) {
        if (!childrenMap[t.parent_id]) childrenMap[t.parent_id] = [];
        childrenMap[t.parent_id].push(t);
      }
    });

    const starts = [];
    const ends = [];
    tasks.forEach(t => {
      if (t.is_milestone && childrenMap[t.id]?.length) {
        const kids = childrenMap[t.id];
        const kidStarts = kids.map(c => c.start_date).filter(Boolean).sort();
        const kidEnds = kids.map(c => c.end_date).filter(Boolean).sort();
        if (kidStarts.length > 0) starts.push(kidStarts[0]);
        if (kidEnds.length > 0) ends.push(kidEnds[kidEnds.length - 1]);
      } else {
        if (t.start_date) starts.push(t.start_date);
        if (t.end_date) ends.push(t.end_date);
      }
    });

    starts.sort();
    ends.sort();
    const s = starts[0] || '';
    const e = ends[ends.length - 1] || '';
    const days = s && e ? Math.round((new Date(e + 'T00:00:00') - new Date(s + 'T00:00:00')) / 86400000) + 1 : 0;
    return { start: s, end: e, total: days };
  }, [project?.tasks]);

  // -----------------------------------------------------------
  //  Gantt hook
  // -----------------------------------------------------------
  const { loadData, getGantt } = useGantt('gantt-chart', {
    taskLabel: t('gantt:task'),
    startLabel: t('gantt:start'),
    endLabel: t('gantt:end'),
    durationLabel: t('gantt:duration'),

    onTaskDblClick: (taskId) => {
      const g = getGantt();
      if (!g) return false;
      const task = g.getTask(taskId);
      if (!task) return false;
      const fmt = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
      };
      setEditTask({
        id: task.id, text: task.text, start_date: fmt(task.start_date),
        end_date: task.real_end || fmt(task.end_date),
        duration: task.duration,
        progress: task.progress || 0, phase_id: task.phase_id,
        type: task.type, notes: task.notes || '',
      });
      return false;
    },

    onAfterTaskUpdate: async (taskId, item) => {
      if (updatingRef.current) return; // skip during programmatic reload
      updatingRef.current = true;
      try {
        const fmt = (d) => d ? d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') : '';
        const startVal = fmt(item.start_date);
        const endDate = new Date(item.end_date);
        endDate.setDate(endDate.getDate() - 1);
        const endVal = fmt(endDate);
        const dur = Math.round((item.end_date - item.start_date) / 86400000);

        const g = getGantt();
        const ganttTask = g ? g.getTask(taskId) : null;

        // If milestone with children, shift children first, then reload
        if (ganttTask && ganttTask.type === 'milestone') {
          const allTasks = projectRef.current?.tasks;
          if (allTasks) {
            const children = allTasks.filter(t => t.parent_id === taskId);
            if (children.length > 0) {
              const childStarts = children.map(c => c.start_date).filter(Boolean).sort();
              if (childStarts.length > 0) {
                const oldMsStart = childStarts[0];
                const delta = Math.round((new Date(startVal + 'T00:00:00') - new Date(oldMsStart + 'T00:00:00')) / 86400000);
                if (delta !== 0) {
                  const fmt2 = (d) => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
                  for (const child of children) {
                    if (!child.start_date || !child.end_date) continue;
                    const cs = new Date(child.start_date + 'T00:00:00');
                    cs.setDate(cs.getDate() + delta);
                    const ce = new Date(child.end_date + 'T00:00:00');
                    ce.setDate(ce.getDate() + delta);
                    await updateTask(child.id, {
                      start_date: fmt2(cs),
                      end_date: fmt2(ce),
                      duration_days: Math.max(1, Math.round((ce - cs) / 86400000)),
                    });
                  }
                }
              }
            }
          }
          await loadAll();
          return;
        }

        // If child task with siblings, backend auto-shifts later siblings — reload
        if (ganttTask && ganttTask.parent) {
          await updateTask(taskId, { start_date: startVal, end_date: endVal, duration_days: Math.max(1, dur) });
          await loadAll();
          return;
        }

        await updateTask(taskId, { start_date: startVal, end_date: endVal, duration_days: Math.max(1, dur) });
        const gt = gantt.getTask(taskId);
        if (gt) { gt.real_end = endVal; gantt.updateTask(taskId); }
      } catch (ex) { console.error(ex); }
      finally { updatingRef.current = false; }
    },

    onBeforeTaskDelete: async (taskId) => {
      if (!confirm(t('task.deleteConfirm'))) return false;
      try { await deleteTask(taskId); return true; }
      catch (e) { alert(e.message); return false; }
    },

    onAfterLinkAdd: async (linkId, link) => {
      try { await createDependency(pid, { predecessor_id: link.source, successor_id: link.target, dependency_type: 'FS' }); }
      catch (e) { console.error(e); }
    },

    onAfterLinkDelete: async (linkId) => {
      try { await deleteDependency(linkId); }
      catch (e) { console.error(e); }
    },

    onMoveTask: async (taskId, direction) => {
      // Handled via toolbar instead
    },

    onGanttReady: (g) => {
      window.__openRolePicker = (taskId, e) => {
        // Don't stop propagation — use the event's target position
        setResourcePicker({ taskId });
        // Find the span element that was clicked
        const span = e?.target?.closest?.('.gantt-role-btn');
        if (span) {
          const rect = span.getBoundingClientRect();
          setPopoverPos({ x: rect.left, y: rect.bottom + 4 });
        }
      };
      window.__openPersonPicker = (taskId, e) => {
        setPersonPicker({ taskId });
        const span = e?.target?.closest?.('.gantt-person-btn');
        if (span) {
          const rect = span.getBoundingClientRect();
          setPersonPopoverPos({ x: rect.left, y: rect.bottom + 4 });
        }
      };
    },
  });

  // -----------------------------------------------------------
  //  Data loading
  // -----------------------------------------------------------
  const loadAll = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const [p, gd, res] = await Promise.all([getProject(pid), getGanttData(pid), getResources()]);
      setProject(p); setEditingDesc(p.description || '');
      setResources(res || []);
      updatingRef.current = true;
      loadData(gd);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      updatingRef.current = false;
      setLoading(false);
    }
  }, [pid, loadData]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // -----------------------------------------------------------
  //  New-task popup
  // -----------------------------------------------------------
  const [newTaskModal, setNewTaskModal] = useState(false);
  const [newTaskType, setNewTaskType] = useState('milestone');
  const [newTaskName, setNewTaskName] = useState('');
  const makeToday = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
  const [newTaskStart, setNewTaskStart] = useState(makeToday());
  const [newTaskEnd, setNewTaskEnd] = useState(makeToday());
  const [newTaskParent, setNewTaskParent] = useState('');
  const [addingNew, setAddingNew] = useState(false);

  // Milestones from current project (for "归到" dropdown)
  const milestoneOptions = useMemo(() => {
    if (!project?.tasks) return [];
    return project.tasks.filter(t => t.task_type === 'milestone')
      .sort((a,b) => a.sort_order - b.sort_order);
  }, [project?.tasks]);

  const handleAddTask = async () => {
    try { const p = await getProject(pid); setProject(p); } catch {}
    const now = new Date();
    const today = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    setNewTaskType('milestone'); setNewTaskName(''); setNewTaskStart(today); setNewTaskEnd(today); setNewTaskParent('');
    setNewTaskModal(true);
  };

  const handleCreateNew = async () => {
    if (!newTaskName.trim()) return;
    setAddingNew(true);
    try {
      const isMs = newTaskType === 'milestone';
      const s = String(newTaskStart).split('T')[0] || '';
      const e = String(newTaskEnd).split('T')[0] || '';
      const dur = isMs ? 0 : Math.max(1, Math.round((new Date(e) - new Date(s)) / 86400000) + 1);
      await createTask(pid, {
        name: newTaskName.trim(),
        parent_id: newTaskParent ? Number(newTaskParent) : null,
        start_date: s, end_date: isMs ? s : e,
        duration_days: dur,
        task_type: isMs ? 'milestone' : 'task',
        is_milestone: isMs,
      });
      setNewTaskModal(false); loadAll();
    } catch (e) { alert('创建失败: ' + (e.response?.data?.error || e.message)); }
    finally { setAddingNew(false); }
  };

  const handleTaskSaved = async (savedData) => {
    // If editing a milestone with children, shift children by same delta
    if (editTask && editTask.type === 'milestone' && savedData?.start_date && project?.tasks) {
      const children = project.tasks.filter(t => t.parent_id === editTask.id);
      if (children.length > 0) {
        const childStarts = children.map(c => c.start_date).filter(Boolean).sort();
        if (childStarts.length > 0) {
          const oldMsStart = childStarts[0];
          const delta = Math.round((new Date(savedData.start_date + 'T00:00:00') - new Date(oldMsStart + 'T00:00:00')) / 86400000);
          if (delta !== 0) {
            const fmt = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            for (const child of children) {
              if (!child.start_date || !child.end_date) continue;
              const cs = new Date(child.start_date + 'T00:00:00');
              cs.setDate(cs.getDate() + delta);
              const ce = new Date(child.end_date + 'T00:00:00');
              ce.setDate(ce.getDate() + delta);
              await updateTask(child.id, {
                start_date: fmt(cs),
                end_date: fmt(ce),
                duration_days: Math.max(1, Math.round((ce - cs) / 86400000)),
              });
            }
          }
        }
      }
    }
    setEditTask(null);
    loadAll();
  };

  // Resource role handling
  const handleRoleToggle = async (taskId, role) => {
    const task = project?.tasks?.find(t => t.id === taskId);
    if (!task) return;
    const cur = (task.resource_names || '').split(',').filter(Boolean);
    const next = cur.includes(role) ? cur.filter(r => r !== role) : [...cur, role];
    try {
      await updateTask(taskId, { resource_names: next.length ? next.join(',') : null });
      await loadAll();
    } catch (e) { console.error(e); }
  };

  const handlePersonToggle = async (taskId, person) => {
    const task = project?.tasks?.find(t => t.id === taskId);
    if (!task) return;
    const cur = (task.resource_person_names || '').split(',').filter(Boolean);
    const next = cur.includes(person) ? cur.filter(p => p !== person) : [...cur, person];
    try {
      await updateTask(taskId, { resource_person_names: next.length ? next.join(',') : null });
      await loadAll();
    } catch (e) { console.error(e); }
  };

  const handleDelSelected = () => {
    const g = getGantt(); if (!g) return;
    const id = g.getSelectedId();
    if (!id) return alert('请先点击选择一行任务/阶段');
    if (confirm('确定删除此任务吗？')) {
      deleteTask(Number(id)).then(loadAll).catch(e => alert('删除失败: ' + (e.response?.data?.error || e.message)));
    }
  };

  // -----------------------------------------------------------
  //  Template save/import
  // -----------------------------------------------------------
  const handleSaveTpl = async () => {
    if (!tplName.trim() || !project) return;
    setSavingTpl(true);
    try {
      await createTemplate({ source_type: 'project', source_id: project.id, name: tplName.trim(), description: tplDesc.trim() || null });
      setSaveTplModal(false); setTplName(''); setTplDesc('');
      alert('模板已保存！');
    } catch (e) { alert('保存失败: ' + (e.response?.data?.error || e.message)); }
    finally { setSavingTpl(false); }
  };

  const openImport = async () => {
    try { setTemplates(await getPublishedTemplates() || []); } catch { setTemplates([]); }
    setImportAnchor(new Date().toISOString().split('T')[0]); setImportId('');
    setImportModal(true);
  };
  const handleImport = async () => {
    if (!importId || !project) return;
    setImporting(true);
    try {
      await importTemplate(Number(importId), { target_project_id: project.id, anchor_date: importAnchor });
      setImportModal(false); loadAll();
      alert('模板导入成功！');
    } catch (e) { alert('导入失败: ' + (e.response?.data?.error || e.message)); }
    finally { setImporting(false); }
  };

  // -----------------------------------------------------------
  //  Project description editing
  // -----------------------------------------------------------
  useEffect(() => {
    if (!descChanged) return;
    const timer = setTimeout(async () => {
      if (project) await updateProject(project.id, { description: editingDesc || null }).catch(()=>{});
    }, 500);
    return () => clearTimeout(timer);
  }, [editingDesc, descChanged]);

  // -----------------------------------------------------------
  //  Sort (↑↓) - works on selected task
  // -----------------------------------------------------------
  const handleMoveSelected = async (dir) => {
    const g = getGantt();
    if (!g || !project?.tasks) return;
    const sel = g.getSelectedId();
    if (!sel) return alert('请先点击选择一行任务/阶段');
    const taskId = Number(sel);
    const task = project.tasks.find(t => t.id === taskId);
    if (!task) return;
    let group;
    if (task.task_type === 'milestone')
      group = project.tasks.filter(t => t.task_type === 'milestone').sort((a,b) => a.sort_order - b.sort_order);
    else if (task.parent_id)
      group = project.tasks.filter(t => t.parent_id === task.parent_id).sort((a,b) => a.sort_order - b.sort_order);
    else
      group = project.tasks.filter(t => t.task_type !== 'milestone' && !t.parent_id).sort((a,b) => a.sort_order - b.sort_order);
    const idx = group.findIndex(t => t.id === taskId);
    if (idx < 0) return;
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= group.length) return;
    const r = [...group];
    [r[idx], r[newIdx]] = [r[newIdx], r[idx]];
    try { await reorderTasks(pid, r.map(t => t.id)); } catch (e) { console.error(e); }
  };

  // Keyboard
  useEffect(() => {
    const h = (e) => { if (e.key === 'Delete' && !editTask) handleDelSelected(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [editTask]);

  // Export flow
  const [exportModal, setExportModal] = useState(null); // 'pdf' | 'xlsx' | null
  const [exportWithGantt, setExportWithGantt] = useState(false);

  const handleExportPdf = () => { setExportWithGantt(false); setExportModal('pdf'); };
  const handleExportExcel = () => { setExportWithGantt(false); setExportModal('xlsx'); };
  const doExport = () => {
    if (!pid) return;
    const label = encodeURIComponent(totalLabel || '总工期');
    window.open(`/api/projects/${pid}/export/${exportModal}?label=${label}&gantt=${exportWithGantt ? 1 : 0}`, '_blank');
    setExportModal(null);
  };

  // -----------------------------------------------------------
  //  Render
  // -----------------------------------------------------------
  return (
    <div className="flex flex-col h-full">
      {/* Project info bar */}
      {project && (
        <div className="px-4 py-1.5 bg-white border-b border-gray-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-gray-700">{project.name}</span>
            <span className="text-gray-400">{project.study_id}</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-400">{project.indication}</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-400">
              {summary.start === 'NA' ? 'NA' : `${summary.start} → ${summary.end}`}
            </span>
          </div>
        </div>
      )}

      {/* Total summary row */}
      <div className="px-4 py-1.5 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100 flex items-center gap-3 text-sm shrink-0">
        {editingTotal ? (
          <input
            className="border rounded px-2 py-0.5 text-sm text-gray-700 w-32 outline-none focus:ring-1 focus:ring-indigo-300"
            value={totalLabel} onChange={e => setTotalLabel(e.target.value)}
            onBlur={() => saveTotalLabel(totalLabel)}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
            autoFocus placeholder="总工期"
          />
        ) : (
          <span
            className="text-indigo-600 font-medium cursor-pointer border-b border-dashed border-indigo-300 hover:border-indigo-500"
            onClick={() => { setEditingTotal(true); }}
            title="点击编辑名称"
          >
            {totalLabel || '总工期'}
          </span>
        )}
{summary.start !== 'NA' ? (<>
        <span className="text-gray-400">从</span>
        <span className="text-indigo-800 font-semibold">{summary.start}</span>
        <span className="text-gray-400">至</span>
        <span className="text-indigo-800 font-semibold">{summary.end}</span>
        <span className="text-gray-300">|</span>
        <span className="text-indigo-800 font-bold text-base">{summary.total}</span>
        <span className="text-indigo-500 font-medium">天</span>
      </>) : (
        <span className="text-gray-400 text-sm">NA</span>
      )}
      </div>

      {/* Description bar */}
      <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2 text-xs shrink-0">
        <span className="text-gray-500 shrink-0">备注:</span>
        <input
          className="flex-1 bg-transparent border-none outline-none text-gray-600 placeholder-gray-300"
          value={editingDesc}
          onChange={e => { setEditingDesc(e.target.value); setDescChanged(true); }}
          placeholder="添加项目备注说明..."
        />
      </div>

      {/* Toolbar */}
      <GanttToolbar
        onAddTask={handleAddTask}
        onDelete={handleDelSelected}
        onMoveUp={() => handleMoveSelected('up')}
        onMoveDown={() => handleMoveSelected('down')}
        onRefresh={loadAll}
        onSaveTemplate={() => { setTplName(project?.name || ''); setTplDesc(project?.description || ''); setSaveTplModal(true); }}
        onImportTemplate={openImport}
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
      />

      {/* Gantt area */}
      <div className="flex-1 relative bg-white overflow-hidden">
        <div id="gantt-chart" className="absolute inset-0" />
        {/* Resource role picker popover */}
        {resourcePicker && (
          <div className="fixed inset-0 z-20" onClick={() => setResourcePicker(null)}>
            <div className="absolute bg-white border rounded-lg shadow-lg p-3 w-56" style={{left: popoverPos.x, top: popoverPos.y}} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">选择负责角色</span>
              </div>
              <div className="max-h-48 overflow-auto border-b border-gray-100 pb-2 mb-2">
                {roleNames.map(role => {
                  const task = project?.tasks?.find(t => t.id === resourcePicker.taskId);
                  const cur = (task?.resource_names || '').split(',').filter(Boolean);
                  return (
                    <label key={role} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-xs cursor-pointer">
                      <input type="checkbox" checked={cur.includes(role)}
                        onChange={() => handleRoleToggle(resourcePicker.taskId, role)} className="shrink-0"/>
                      <span className="truncate" title={role}>{role}</span>
                    </label>
                  );
                })}
              </div>
              {roleNames.length === 0 && <p className="text-xs text-gray-400 text-center py-2">暂无角色，请先在资源管理中添加</p>}
              <button className="w-full text-xs text-gray-400 hover:text-gray-600 text-center py-1" onClick={() => setResourcePicker(null)}>关闭</button>
            </div>
          </div>
        )}

        {/* Person picker popover */}
        {personPicker && (
          <div className="fixed inset-0 z-20" onClick={() => setPersonPicker(null)}>
            <div className="absolute bg-white border rounded-lg shadow-lg p-3 w-56" style={{left: personPopoverPos.x, top: personPopoverPos.y}} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">选择负责人</span>
              </div>
              <div className="max-h-48 overflow-auto border-b border-gray-100 pb-2 mb-2">
                {getAvailablePersons(personPicker.taskId).map(person => {
                  const task = project?.tasks?.find(t => t.id === personPicker.taskId);
                  const cur = (task?.resource_person_names || '').split(',').filter(Boolean);
                  return (
                    <label key={person} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-xs cursor-pointer">
                      <input type="checkbox" checked={cur.includes(person)}
                        onChange={() => handlePersonToggle(personPicker.taskId, person)} className="shrink-0"/>
                      <span className="truncate" title={person}>{person}</span>
                    </label>
                  );
                })}
              </div>
              {getAvailablePersons(personPicker.taskId).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">{project?.tasks?.find(t => t.id === personPicker.taskId)?.resource_names ? '所选角色暂无人员' : '请先选择负责角色'}</p>
              )}
              <button className="w-full text-xs text-gray-400 hover:text-gray-600 text-center py-1" onClick={() => setPersonPicker(null)}>关闭</button>
            </div>
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <div className="text-gray-400 animate-pulse text-lg">{t('loading')}</div>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 gap-4">
            <p className="text-red-500">❌ {error}</p>
            <div className="flex gap-2">
              <button onClick={loadAll} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">重试</button>
              <button onClick={() => navigate('/')} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">← {t('back')}</button>
            </div>
          </div>
        )}
      </div>

      {/* Task Edit Modal */}
      {editTask && (
        <TaskEditModal projectId={pid} task={editTask}
          onClose={() => setEditTask(null)} onSaved={handleTaskSaved} />
      )}

      {/* New Task/Milestone Modal */}
      {newTaskModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setNewTaskModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 text-lg mb-4">新建</h3>
            <div className="space-y-3">
              {/* Type toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">类型</label>
                <div className="flex bg-gray-100 rounded-lg overflow-hidden">
                  <button type="button"
                    onClick={() => { setNewTaskType('milestone'); setNewTaskParent(''); }}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${newTaskType==='milestone'?'bg-amber-500 text-white':'text-gray-500 hover:bg-gray-200'}`}>阶段</button>
                  <button type="button"
                    onClick={() => {
                      setNewTaskType('task');
                      if (milestoneOptions.length > 0 && !newTaskParent) setNewTaskParent(String(milestoneOptions[0].id));
                    }}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${newTaskType==='task'?'bg-blue-600 text-white':'text-gray-500 hover:bg-gray-200'}`}>任务</button>
                </div>
              </div>

              {newTaskType==='task' && milestoneOptions.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">归到阶段</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={newTaskParent}
                    onChange={e => setNewTaskParent(e.target.value)}>
                    {milestoneOptions.map(m => <option key={m.id} value={m.id}>◆ {m.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">名称 *</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" autoFocus
                  value={newTaskName} onChange={e => setNewTaskName(e.target.value)}
                  placeholder={newTaskType==='milestone'?'阶段名称（如: SAP Development）':'任务名称'}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateNew(); }} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">开始日期</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={newTaskStart} onChange={e => setNewTaskStart(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">结束日期</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={newTaskEnd} onChange={e => setNewTaskEnd(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">工期</label>
                  <input type="number" min="1" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={(()=>{const s=new Date(newTaskStart+'T00:00:00');const e=new Date(newTaskEnd+'T00:00:00');return Math.max(0,Math.round((e-s)/86400000)+1);})()}
                    onChange={e => {
                      const days = Number(e.target.value);
                      if (days > 0 && newTaskStart) {
                        const d = new Date(newTaskStart+'T00:00:00');
                        d.setDate(d.getDate() + days - 1);
                        setNewTaskEnd(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));
                      }
                    }} />
                </div>
              </div>
              <p className="text-xs text-gray-400">工期随开始/结束日期自动计算，也可手动修改</p>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={handleCreateNew}
                disabled={addingNew || !newTaskName.trim() || (newTaskType==='task' && milestoneOptions.length > 0 && !newTaskParent)}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {addingNew ? '...' : '创建'}
              </button>
              <button onClick={() => setNewTaskModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">取消</button>
            </div>
          </div>
        </div>
      )}

      {/* Save Template Modal */}
      {saveTplModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setSaveTplModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 text-lg mb-4">保存为模板</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">名称 *</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" autoFocus
                  value={tplName} onChange={e => setTplName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveTpl(); }}
                  placeholder={project?.name + ' 模板'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">备注</label>
                <textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={tplDesc} onChange={e => setTplDesc(e.target.value)}
                  placeholder="模板描述..." />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">保存后可在模板库导入到其他项目</p>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSaveTpl} disabled={savingTpl || !tplName.trim()}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
                {savingTpl ? t('loading') : t('save')}
              </button>
              <button onClick={() => setSaveTplModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Template Modal */}
      {importModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setImportModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 text-lg mb-4">导入模板 — {project?.name}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">选择模板</label>
                {templates.length === 0 ? (
                  <p className="text-sm text-gray-400">暂无模板，请先在模板库创建</p>
                ) : (
                  <div className="max-h-44 overflow-auto border rounded-lg divide-y">
                    {templates.map(tmpl => (
                      <label key={tmpl.id} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 ${importId === String(tmpl.id) ? 'bg-blue-50 ring-1 ring-blue-300' : ''}`}>
                        <input type="radio" name="tpl" value={tmpl.id}
                          checked={importId === String(tmpl.id)}
                          onChange={e => setImportId(e.target.value)} />
                        <div>
                          <div className="text-sm font-medium text-gray-800">{tmpl.name}</div>
                          <div className="text-xs text-gray-400">{tmpl.task_count} 项任务{tmpl.total_duration > 0 && ` · ${tmpl.total_duration} 天`}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">锚定日期</label>
                <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={importAnchor} onChange={e => setImportAnchor(e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">模板任务将从此日期开始按相对偏移量导入</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleImport} disabled={importing || !importId}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {importing ? t('loading') : t('import')}
              </button>
              <button onClick={() => setImportModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Export Options Modal */}
      {exportModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setExportModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 text-lg mb-4">导出{exportModal === 'pdf' ? 'PDF' : 'Excel'}</h3>
            <label className="flex items-center gap-3 cursor-pointer py-2">
              <input type="checkbox" checked={exportWithGantt}
                onChange={e => setExportWithGantt(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <div>
                <span className="text-sm font-medium text-gray-700">包含甘特图</span>
                <p className="text-xs text-gray-400">在表格下方附加甘特图条形图</p>
              </div>
            </label>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setExportModal(null)}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">取消</button>
              <button onClick={doExport}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">导出</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
