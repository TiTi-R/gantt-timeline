import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getTemplates, getTemplate, createTemplate, deleteTemplate, updateTemplate, getProjects,
  addTemplateTask, updateTemplateTask, deleteTemplateTask, reorderTemplateTasks, publishTemplate,
} from '../../services/api.js';

// ──────────────────────────────────────────────────────────────
export default function TemplateLibrary() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', source_id: '' });
  const [creating, setCreating] = useState(false);

  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editorForm, setEditorForm] = useState({ name: '', duration_days: 0, parent_id: '', taskType: 'task' });
  const [addingTask, setAddingTask] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editingTaskNameId, setEditingTaskNameId] = useState(null);
  const [editTaskNameValue, setEditTaskNameValue] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try { setLoading(true); const [a,b] = await Promise.all([getTemplates(),getProjects()]); setTemplates(a||[]); setProjects(b||[]); }
    catch(e){console.error(e);} finally{setLoading(false);}
  };
  const refreshTemplate = async (id, updateDesc=true) => { try{const t=await getTemplate(id);setEditingTemplate(t);if(updateDesc)setEditDesc(t.description||'');}catch{} };
  const openTemplate = async (id) => { const t=await getTemplate(id);setEditingTemplate(t);setEditDesc(t.description||''); };

  const handleCreate = async (e) => {
    if(e)e.preventDefault(); if(!createForm.name.trim())return; setCreating(true);
    try{await createTemplate({name:createForm.name.trim(),description:createForm.description.trim()||null,source_id:createForm.source_id?Number(createForm.source_id):undefined});setCreateModal(false);setCreateForm({name:'',description:'',source_id:''});loadData();}
    catch(e){alert(e.response?.data?.error||e.message);} finally{setCreating(false);}
  };
  const handleDelete = async(id)=>{if(!confirm('确定删除?')||!id)return;try{await deleteTemplate(id);if(editingTemplate?.id===id)setEditingTemplate(null);loadData();}catch(e){alert(e.message)}};

  const handleAddTask = async () => {
    if(!editorForm.name.trim()||!editingTemplate)return; setAddingTask(true);
    try{
      const dur = Number(editorForm.duration_days)||0;
      const isMs = editorForm.taskType==='milestone';
      await addTemplateTask(editingTemplate.id,{name:editorForm.name.trim(),parent_id:editorForm.parent_id?Number(editorForm.parent_id):null,relative_start:0,duration_days:isMs?Math.max(0,dur):Math.max(1,dur||1),relative_end:0,is_milestone:isMs,task_type:isMs?'milestone':'task'});
      setEditorForm({name:'',duration_days:0,parent_id:editorForm.parent_id,taskType:editorForm.taskType});
      refreshTemplate(editingTemplate.id);
    }catch(e){alert(e.response?.data?.error||e.message);}finally{setAddingTask(false);}
  };
  const handleDeleteTask = async (tid) => { if(!editingTemplate)return; try{await deleteTemplateTask(editingTemplate.id,tid);refreshTemplate(editingTemplate.id);}catch(e){alert(e.message)} };
  const handleRestructure = async (task, action, payload) => {
    if(!editingTemplate)return;
    try{
      if(action==='convert'){const toMs=task.task_type!=='milestone';await updateTemplateTask(editingTemplate.id,task.id,{task_type:toMs?'milestone':'task',is_milestone:toMs,parent_id:null,duration_days:Math.max(1,task.duration_days||5),relative_end:task.relative_start+Math.max(1,task.duration_days||5)-1});}
      else if(action==='move'){await updateTemplateTask(editingTemplate.id,task.id,{parent_id:payload||null});}
      refreshTemplate(editingTemplate.id);
    }catch(e){alert(e.message)}
  };

  const handleTaskNameSave = async (task) => {
    if (!editingTemplate || !task) return;
    const newName = editTaskNameValue.trim();
    if (!newName) { setEditingTaskNameId(null); return; }
    try {
      await updateTemplateTask(editingTemplate.id, task.id, { name: newName });
      await refreshTemplate(editingTemplate.id, false);
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setEditingTaskNameId(null);
    }
  };

  // Swap two tasks — recompute group from latest state each time
  const swapUp = async (task) => {
    if(!editingTemplate)return;
    const tasks = editingTemplate.tasks||[];
    let group;
    if(task.task_type==='milestone') group = tasks.filter(t=>t.task_type==='milestone'&&!t.parent_id).sort((a,b)=>a.sort_order-b.sort_order);
    else if(task.parent_id) group = tasks.filter(t=>t.parent_id===task.parent_id).sort((a,b)=>a.sort_order-b.sort_order);
    else group = tasks.filter(t=>t.task_type!=='milestone'&&!t.parent_id).sort((a,b)=>a.sort_order-b.sort_order);
    const idx = group.findIndex(t=>t.id===task.id);
    if(idx<=0)return;
    const r = [...group]; [r[idx-1],r[idx]] = [r[idx],r[idx-1]];
    await reorderTemplateTasks(editingTemplate.id, r.map(t=>t.id));
    refreshTemplate(editingTemplate.id);
  };
  const swapDown = async (task) => {
    if(!editingTemplate)return;
    const tasks = editingTemplate.tasks||[];
    let group;
    if(task.task_type==='milestone') group = tasks.filter(t=>t.task_type==='milestone'&&!t.parent_id).sort((a,b)=>a.sort_order-b.sort_order);
    else if(task.parent_id) group = tasks.filter(t=>t.parent_id===task.parent_id).sort((a,b)=>a.sort_order-b.sort_order);
    else group = tasks.filter(t=>t.task_type!=='milestone'&&!t.parent_id).sort((a,b)=>a.sort_order-b.sort_order);
    const idx = group.findIndex(t=>t.id===task.id);
    if(idx<0||idx>=group.length-1)return;
    const r = [...group]; [r[idx],r[idx+1]] = [r[idx+1],r[idx]];
    await reorderTemplateTasks(editingTemplate.id, r.map(t=>t.id));
    refreshTemplate(editingTemplate.id);
  };

  const buildTree = (tasks) => {
    const milestones = tasks.filter(t=>t.task_type==='milestone'&&!t.parent_id).sort((a,b)=>a.sort_order-b.sort_order);
    const orphans = tasks.filter(t=>t.task_type!=='milestone'&&!t.parent_id).sort((a,b)=>a.sort_order-b.sort_order);
    const getChildren = (pid)=>tasks.filter(t=>t.parent_id===pid).sort((a,b)=>a.sort_order-b.sort_order);
    return {milestones,orphans,getChildren};
  };

  // ── EDITOR ─────────────────────────────────────────────────
  if(editingTemplate){
    const tasks = editingTemplate.tasks||[];
    const {milestones,orphans,getChildren} = buildTree(tasks);
    const maxRel = tasks.reduce((m,t)=>Math.max(m,t.relative_end||t.relative_start||0),0);
    const msOptions = milestones;

    return (
      <div className="flex flex-col h-full">
        <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={()=>{setEditingTemplate(null);loadData();}} className="text-sm text-blue-600 hover:text-blue-800 shrink-0">← {t('back')}</button>
            {editingName?(
              <input className="border-b-2 border-blue-500 px-1 py-0.5 text-sm font-semibold text-gray-800 outline-none bg-transparent" value={editNameValue}
                onChange={e=>setEditNameValue(e.target.value)}
                onBlur={async()=>{if(editNameValue.trim()&&editNameValue!==editingTemplate.name){try{await updateTemplate(editingTemplate.id,{name:editNameValue.trim()});editingTemplate.name=editNameValue.trim();}catch{}}setEditingName(false);}}
                onKeyDown={e=>{if(e.key==='Enter')e.target.blur();if(e.key==='Escape')setEditingName(false);}} autoFocus/>
            ):(
              <span className="font-semibold text-gray-800 cursor-pointer hover:text-blue-600 border-b border-dashed border-transparent hover:border-blue-400"
                onClick={()=>{setEditNameValue(editingTemplate.name);setEditingName(true);}} title="点击编辑名称">{editingTemplate.name}</span>
            )}
            <span className="text-xs text-gray-400">
              {milestones.length} 里程碑 · {tasks.filter(t=>t.task_type!=='milestone'&&t.parent_id).length + orphans.length} 子任务
            </span>
          </div>
          <button onClick={()=>handleDelete(editingTemplate.id)} className="px-3 py-1.5 text-red-500 text-xs rounded-md hover:bg-red-50">{t('delete')}</button>
        </div>

        {/* Notes/备注行 */}
        <div className="px-6 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-500 shrink-0">备注:</span>
          <input
            className="flex-1 text-xs text-gray-600 bg-transparent border-none outline-none placeholder-gray-300"
            value={editDesc}
            onChange={e=>setEditDesc(e.target.value)}
            onBlur={async()=>{
              if(editDesc!==(editingTemplate.description||'')){
                try{await updateTemplate(editingTemplate.id,{description:editDesc||null});editingTemplate.description=editDesc;}catch{}
              }
            }}
            onKeyDown={e=>{if(e.key==='Enter')e.target.blur();}}
            placeholder="添加模板备注说明..."
          />
        </div>

        <div className="flex-1 overflow-auto p-6">
          {/* Add form */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <h4 className="font-medium text-gray-800 text-sm mb-3">{editorForm.taskType==='milestone'?'添加阶段里程碑':'添加任务'}</h4>
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-2">
                <div className="flex bg-white border rounded-lg overflow-hidden">
                  <button type="button" onClick={()=>setEditorForm({...editorForm,taskType:'milestone',parent_id:'',duration_days:0})}
                    className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${editorForm.taskType==='milestone'?'bg-amber-500 text-white':'text-gray-500 hover:bg-gray-50'}`}>里程碑</button>
                  <button type="button" onClick={()=>setEditorForm({...editorForm,taskType:'task',duration_days:0})}
                    className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${editorForm.taskType==='task'?'bg-blue-500 text-white':'text-gray-500 hover:bg-gray-50'}`}>任务</button>
                </div>
              </div>
              {editorForm.taskType==='task'&&msOptions.length>0&&(
                <div className="col-span-3"><select className="w-full border rounded-lg px-2 py-1.5 text-xs" value={editorForm.parent_id} onChange={e=>setEditorForm({...editorForm,parent_id:e.target.value})}>
                  <option value="">无归属（独立任务）</option>
                  {msOptions.map(m=><option key={m.id} value={m.id}>◆ {m.name}</option>)}
                </select></div>
              )}
              <div className={msOptions.length>0&&editorForm.taskType==='task'?'col-span-4':'col-span-5'}>
                <input className="w-full border rounded-lg px-3 py-1.5 text-sm" value={editorForm.name} onChange={e=>setEditorForm({...editorForm,name:e.target.value})}
                  placeholder={editorForm.taskType==='milestone'?'阶段名称':'任务名称'} onKeyDown={e=>{if(e.key==='Enter')handleAddTask();}}/>
              </div>
              <div className="col-span-2">
                <input type="number" min={0} className="w-full border rounded-lg px-2 py-1.5 text-sm" value={editorForm.duration_days}
                  onChange={e=>setEditorForm({...editorForm,duration_days:e.target.value})}/>
              </div>
              <div className="col-span-1">
                <button onClick={handleAddTask} disabled={addingTask||!editorForm.name.trim()}
                  className="w-full px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 font-bold">+</button>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">添加后将自动排程：里程碑并行，子任务累积</p>
          </div>

          {/* Timeline preview */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-700 text-sm mb-3">时间线预览</h4>
            <div className="bg-white border rounded-xl p-4 overflow-x-auto">
              <div style={{minWidth:Math.max((maxRel+1)*32+240,600)}}>
                <div className="flex pb-1 mb-2" style={{borderBottom:'1px solid #e5e7eb'}}>
                  {/* Left spacer to align with labels below */}
                  <div className="shrink-0" style={{width:208}}/>
                  <div className="flex">
                    {Array.from({length:Math.max(maxRel+1,20)},(_,i)=>(
                      <div key={i} className={`text-xs ${i%5===0?'text-gray-400 font-medium':'text-gray-300'}`} style={{width:32,minWidth:32}}>{i%5===0||i===0?(i+1):''}</div>
                    ))}
                  </div>
                </div>
                {milestones.map(m=>{
                  const children = getChildren(m.id);
                  const msLeft=(m.relative_start||0)*32, msDur=m.duration_days||0, msWidth=msDur>0?Math.max(32,msDur*32):0;
                  return (<div key={m.id} className="mb-3"><div className="flex items-center mb-0.5 py-0.5">
                    <span className="text-xs font-bold text-amber-700 shrink-0 w-52 pl-1 truncate">
                      {editingTaskNameId===m.id?(
                        <input className="w-full text-xs font-bold outline-none bg-white border border-amber-300 rounded px-1"
                          value={editTaskNameValue} onChange={e=>setEditTaskNameValue(e.target.value)}
                          onBlur={()=>handleTaskNameSave(m)} onKeyDown={e=>{if(e.key==='Enter')e.target.blur();if(e.key==='Escape')setEditingTaskNameId(null);}}
                          autoFocus onClick={e=>e.stopPropagation()}/>
                      ):(
                        <span className="cursor-pointer hover:text-blue-600"
                          onDoubleClick={e=>{e.stopPropagation();setEditingTaskNameId(m.id);setEditTaskNameValue(m.name);}} title="双击编辑名称">◆ {m.name}</span>
                      )}
                    </span>
                    <div className="flex-1 relative h-6">
                      {msDur>0&&(<div className="absolute rounded-md h-5 flex items-center px-2 text-xs text-white font-medium truncate" style={{left:msLeft,width:msWidth,background:'linear-gradient(90deg,#f59e0b,#fbbf24)'}}>{msDur}d</div>)}
                      {msDur===0&&(<div className="absolute top-0.5" style={{left:msLeft}}><span className="text-amber-500 text-sm">◆</span></div>)}
                    </div>
                  </div>
                  {children.map(child=>{const l=(child.relative_start||0)*32,w=Math.max(32,(child.duration_days||1)*32);return(<div key={child.id} className="flex items-center mb-0.5 py-0.5"><div className="w-52 text-xs text-gray-600 truncate pr-2 shrink-0 pl-3">
                        {editingTaskNameId===child.id?(
                          <input className="w-full text-xs outline-none bg-white border border-blue-300 rounded px-1"
                            value={editTaskNameValue} onChange={e=>setEditTaskNameValue(e.target.value)}
                            onBlur={()=>handleTaskNameSave(child)} onKeyDown={e=>{if(e.key==='Enter')e.target.blur();if(e.key==='Escape')setEditingTaskNameId(null);}}
                            autoFocus onClick={e=>e.stopPropagation()}/>
                        ):(
                          <span className="cursor-pointer hover:text-blue-600"
                            onDoubleClick={e=>{e.stopPropagation();setEditingTaskNameId(child.id);setEditTaskNameValue(child.name);}} title="双击编辑名称">↳ {child.name}</span>
                        )}
                      </div><div className="flex-1 relative h-5"><div className="absolute rounded-full h-5 flex items-center px-2 text-xs text-white truncate" style={{left:l,width:w,background:child.color||'#4472C4'}}>{child.duration_days}d</div></div></div>)})}
                  </div>);
                })}
                {orphans.length>0&&orphans.map(task=>{const l=(task.relative_start||0)*32,w=Math.max(32,(task.duration_days||1)*32);return(<div key={task.id} className="flex items-center mb-0.5 py-0.5"><div className="w-52 text-xs text-gray-700 truncate pr-2 shrink-0">
                        {editingTaskNameId===task.id?(
                          <input className="w-full text-xs outline-none bg-white border border-purple-300 rounded px-1"
                            value={editTaskNameValue} onChange={e=>setEditTaskNameValue(e.target.value)}
                            onBlur={()=>handleTaskNameSave(task)} onKeyDown={e=>{if(e.key==='Enter')e.target.blur();if(e.key==='Escape')setEditingTaskNameId(null);}}
                            autoFocus onClick={e=>e.stopPropagation()}/>
                        ):(
                          <span className="cursor-pointer hover:text-blue-600"
                            onDoubleClick={e=>{e.stopPropagation();setEditingTaskNameId(task.id);setEditTaskNameValue(task.name);}} title="双击编辑名称">{task.name}</span>
                        )}
                      </div><div className="flex-1 relative h-5"><div className="absolute rounded-full h-5 flex items-center px-2 text-xs text-white truncate" style={{left:l,width:w,background:task.color||'#8b5cf6'}}>{task.duration_days}d</div></div></div>)})}
                {tasks.length===0&&<p className="text-sm text-gray-400 text-center py-8">暂无任务</p>}
              </div>
            </div>
          </div>

          {/* Task list with ↑↓ reorder */}
          <div>
            <h4 className="font-medium text-gray-700 text-sm mb-3">任务清单 ({tasks.length}) — ↑↓ 排序 · 转换 · 移动</h4>
            <div className="bg-white border rounded-xl overflow-hidden">
              {tasks.length===0&&<div className="text-sm text-gray-400 text-center py-12">暂无任务</div>}

              {/* MILESTONES */}
              {milestones.map(m=>{
                const children = getChildren(m.id);
                return (
                  <div key={`ms-${m.id}`} className="border-b border-gray-100 last:border-0">
                    {/* Milestone row */}
                    <div className="flex items-center px-4 py-2 bg-amber-50/50 group select-none">
                      {/* ↑↓ buttons */}
                      <OrderButtons task={m} onUp={swapUp} onDown={swapDown}/>
                      <span className="text-amber-500 font-bold text-sm shrink-0 mr-2">◆</span>
                      {editingTaskNameId===m.id?(
                        <input className="flex-1 text-sm font-medium outline-none bg-white border border-amber-300 rounded px-1.5"
                          value={editTaskNameValue} onChange={e=>setEditTaskNameValue(e.target.value)}
                          onBlur={()=>handleTaskNameSave(m)} onKeyDown={e=>{if(e.key==='Enter')e.target.blur();if(e.key==='Escape')setEditingTaskNameId(null);}}
                          autoFocus onClick={e=>e.stopPropagation()}/>
                      ):(
                        <span className="flex-1 text-sm font-medium text-amber-800 truncate cursor-pointer hover:text-blue-600"
                          onDoubleClick={e=>{e.stopPropagation();setEditingTaskNameId(m.id);setEditTaskNameValue(m.name);}} title="双击编辑名称">{m.name}</span>
                      )}
                      {children.length>0&&<span className="text-xs text-amber-400 mr-3">· {children.length} 子任务</span>}
                      <span className="text-xs bg-amber-100 text-amber-600 px-1.5 rounded mr-2">里程碑</span>
                      <button className="text-xs text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 mr-1" onClick={e=>{e.stopPropagation();handleRestructure(m,'convert');}}>🔄</button>
                      <button className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100" onClick={e=>{e.stopPropagation();handleDeleteTask(m.id);}}>✕</button>
                    </div>
                    {/* Children */}
                    {children.map(child=>(
                        <div key={`slot-${child.id}`} className="flex items-center px-4 py-2 pl-10 group hover:bg-blue-50/50 border-t border-gray-50 select-none">
                          <OrderButtons task={child} onUp={swapUp} onDown={swapDown}/>
                          {editingTaskNameId===child.id?(
                            <input className="flex-1 text-sm outline-none bg-white border border-blue-300 rounded px-1.5"
                              value={editTaskNameValue} onChange={e=>setEditTaskNameValue(e.target.value)}
                              onBlur={()=>handleTaskNameSave(child)} onKeyDown={e=>{if(e.key==='Enter')e.target.blur();if(e.key==='Escape')setEditingTaskNameId(null);}}
                              autoFocus onClick={e=>e.stopPropagation()}/>
                          ):(
                            <span className="flex-1 text-sm text-gray-700 truncate cursor-pointer hover:text-blue-600"
                              onDoubleClick={e=>{e.stopPropagation();setEditingTaskNameId(child.id);setEditTaskNameValue(child.name);}} title="双击编辑名称">↳ {child.name}</span>
                          )}
                          <span className="text-xs text-gray-400 w-24 text-right mr-3">Day {(child.relative_start||0)+1} ~ {(child.relative_end||0)+1}</span>
                          <select value={child.parent_id||''} onClick={e=>e.stopPropagation()} onChange={e=>handleRestructure(child,'move',e.target.value?Number(e.target.value):null)}
                            className="text-xs border rounded px-1 py-0.5 mr-1 opacity-0 group-hover:opacity-100 bg-white">
                            <option value="">无归属</option>
                            {msOptions.filter(m2=>m2.id!==child.id).map(m2=><option key={m2.id} value={m2.id}>◆ {m2.name}</option>)}
                          </select>
                          <button className="text-xs text-gray-400 hover:text-amber-600 opacity-0 group-hover:opacity-100 mr-1" onClick={e=>{e.stopPropagation();handleRestructure(child,'convert');}}>🔄</button>
                          <button className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100" onClick={e=>{e.stopPropagation();handleDeleteTask(child.id);}}>✕</button>
                        </div>
                      ))}
                    {children.length===0&&<div className="text-xs text-gray-300 pl-10 py-2">暂未添加任务</div>}
                  </div>
                );
              })}

              {/* ORPHANS */}
              {orphans.length>0&&(
                <div className="border-t-2 border-dashed border-gray-200">
                  <div className="px-4 py-1 bg-gray-50 text-xs text-gray-400 font-medium">无归属 — 通过下拉菜单归入里程碑</div>
                  {orphans.map(task=>(
                    <div key={`slot-${task.id}`} className="flex items-center px-4 py-2 group hover:bg-purple-50/50 border-t border-gray-50 select-none">
                      <OrderButtons task={task} onUp={swapUp} onDown={swapDown}/>
                      {editingTaskNameId===task.id?(
                        <input className="flex-1 text-sm outline-none bg-white border border-purple-300 rounded px-1.5"
                          value={editTaskNameValue} onChange={e=>setEditTaskNameValue(e.target.value)}
                          onBlur={()=>handleTaskNameSave(task)} onKeyDown={e=>{if(e.key==='Enter')e.target.blur();if(e.key==='Escape')setEditingTaskNameId(null);}}
                          autoFocus onClick={e=>e.stopPropagation()}/>
                      ):(
                        <span className="flex-1 text-sm text-gray-700 truncate cursor-pointer hover:text-blue-600"
                          onDoubleClick={e=>{e.stopPropagation();setEditingTaskNameId(task.id);setEditTaskNameValue(task.name);}} title="双击编辑名称">{task.name}</span>
                      )}
                      <span className="text-xs text-gray-400 w-24 text-right mr-3">Day {(task.relative_start||0)+1} ~ {(task.relative_end||0)+1}</span>
                      {msOptions.length>0&&(
                        <select value={task.parent_id||''} onClick={e=>e.stopPropagation()} onChange={e=>handleRestructure(task,'move',e.target.value?Number(e.target.value):null)}
                          className="text-xs border rounded px-1 py-0.5 mr-1 opacity-0 group-hover:opacity-100 bg-white">
                          <option value="">无归属</option>
                          {msOptions.map(m2=><option key={m2.id} value={m2.id}>◆ {m2.name}</option>)}
                        </select>
                      )}
                      <button className="text-xs text-gray-400 hover:text-amber-600 opacity-0 group-hover:opacity-100 mr-1" onClick={e=>{e.stopPropagation();handleRestructure(task,'convert');}}>🔄</button>
                      <button className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100" onClick={e=>{e.stopPropagation();handleDeleteTask(task.id);}}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Save bar */}
          <div className="px-6 py-3 bg-white border-t border-gray-200 flex items-center justify-between shrink-0">
            <span className="text-xs text-gray-400">
              状态: {editingTemplate?.status === 'published' ? '✅ 已保存' : '📝 草稿'}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setEditingTemplate(null)}
                className="px-4 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">取消</button>
              <button onClick={async () => {
                try { await publishTemplate(editingTemplate.id, 'draft'); setEditingTemplate({...editingTemplate, status:'draft'}); }
                catch(e) { alert(e.response?.data?.error || e.message); }
              }}
                className={`px-4 py-1.5 text-sm rounded-lg ${editingTemplate?.status === 'draft' ? 'bg-gray-300 text-gray-500' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>保存为草稿</button>
              <button onClick={async () => {
                try { await publishTemplate(editingTemplate.id, 'published'); setEditingTemplate({...editingTemplate, status:'published'}); }
                catch(e) { alert(e.response?.data?.error || e.message); }
              }}
                className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">保存</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN LIST ──────────────────────────────────────────────
  if(loading) return <div className="flex items-center justify-center h-full text-gray-400 animate-pulse">{t('loading')}</div>;
  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">模板库</h2>
        <button onClick={()=>{setCreateForm({name:'',description:'',source_id:''});setCreateModal(true);}}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">+ 创建模板</button>
      </div>
      {createModal&&(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={()=>setCreateModal(false)}>
          <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e=>e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 text-lg mb-4">创建模板</h3>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-600 mb-1">{t('name')} *</label><input className="w-full border rounded-lg px-3 py-2 text-sm" required autoFocus value={createForm.name} onChange={e=>setCreateForm({...createForm,name:e.target.value})} placeholder="如: IMM2510-003 标准模板"/></div>
              <div><label className="block text-sm font-medium text-gray-600 mb-1">从项目导入 (可选)</label><select className="w-full border rounded-lg px-3 py-2 text-sm" value={createForm.source_id} onChange={e=>setCreateForm({...createForm,source_id:e.target.value})}><option value="">-- 空白模板（手动编辑） --</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-600 mb-1">{t('description')}</label><textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" value={createForm.description} onChange={e=>setCreateForm({...createForm,description:e.target.value})} placeholder="描述此模板的用途..."/></div>
            </div>
            <div className="flex gap-2 mt-5"><button type="submit" disabled={creating||!createForm.name.trim()} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">{creating?t('loading'):t('create')}</button><button type="button" onClick={()=>setCreateModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">{t('cancel')}</button></div>
          </form>
        </div>
      )}
      {templates.length===0?(
        <div className="text-center py-20 text-gray-400"><p className="text-4xl mb-3">📋</p><p className="text-lg font-medium">暂无模板</p><button onClick={()=>setCreateModal(true)} className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">+ 创建模板</button></div>
      ):(
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(tmpl=>(
            <div key={tmpl.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-gray-800 mb-1">{tmpl.name} <span className={`text-xs font-normal ${tmpl.status==='published'?'text-green-600':'text-amber-600'}`}>· {tmpl.status==='published'?'✅ 已保存':'📝 草稿'}</span></h3>{tmpl.description&&<p className="text-sm text-gray-500 mb-3">{tmpl.description}</p>}
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-4"><span>📌 {tmpl.milestone_count||0} 里程碑 · {tmpl.task_count-(tmpl.milestone_count||0)} 子任务</span>{tmpl.total_duration>0&&<span>📅 {tmpl.total_duration} 天</span>}</div>
              <div className="flex gap-2">
                <button onClick={async()=>{await openTemplate(tmpl.id).catch(()=>{});}} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-md hover:bg-gray-200 font-medium">✏️ 编辑</button>
                <button onClick={()=>handleDelete(tmpl.id)} className="px-3 py-1.5 text-red-500 text-xs rounded-md hover:bg-red-50">{t('delete')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
//  ↑↓ Order buttons (replaces drag-and-drop)
// ──────────────────────────────────────────────────────────────
function OrderButtons({ task, onUp, onDown }) {
  return (
    <span className="flex flex-col shrink-0 mr-1 leading-none">
      <button className="text-xs leading-none px-0.5 py-0 hover:text-blue-600"
        onClick={e=>{e.stopPropagation();onUp(task);}} title="上移">▲</button>
      <button className="text-xs leading-none px-0.5 py-0 hover:text-blue-600"
        onClick={e=>{e.stopPropagation();onDown(task);}} title="下移">▼</button>
    </span>
  );
}
