import { useEffect, useCallback, useRef } from 'react';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';

export function useGantt(containerId, options = {}) {
  const initRef = useRef(false);

  const initGantt = useCallback(() => {
    if (initRef.current) return;
    const el = document.getElementById(containerId);
    if (!el) { setTimeout(() => initGantt(), 100); return; }

    initRef.current = true;
    try {
      gantt.config.date_format = '%Y-%m-%d';
      gantt.config.date_grid = '%Y-%m-%d';
      gantt.config.drag_move = true;
      gantt.config.drag_progress = false;
      gantt.config.drag_resize = false;
      gantt.config.drag_links = false;
      gantt.config.sort = false;
      gantt.config.details_on_create = false;
      gantt.config.details_on_dblclick = false;
      gantt.config.row_height = 34;
      gantt.config.scale_height = 55;
      gantt.config.min_column_width = 60;
      gantt.config.autosize = false;
      gantt.config.order_branch = true;
      gantt.config.order_branch_free = false;
      gantt.config.open_tree_initially = true;
      gantt.config.autoscroll = true;
      gantt.config.autoscroll_speed = 80;
      gantt.config.fit_tasks = true;

      gantt.templates.task_class = (start, end, task) => {
        if (task.type === 'milestone') return 'gantt-milestone-task';
        if (task.parent) return 'gantt-child-task';
        return 'gantt-orphan-task';
      };

      gantt.config.scales = [
        { unit: 'month', step: 1, format: '%Y年 %M月' },
        { unit: 'day', step: 1, format: '%d' },
      ];

      gantt.config.columns = [
        { name: 'text', label: '任务名称', tree: true, width: 360 },
        { name: 'start_date', label: '开始日期', width: 110, align: 'center' },
        { name: 'end_date', label: '结束日期', width: 110, align: 'center', template: function(task) {
          return task.real_end || '';
        }},
        { name: 'duration', label: '工期', width: 65, align: 'center', template: function(task) {
          return Math.round((task.end_date - task.start_date) / 86400000);
        }},
        { name: 'resource_role', label: '负责角色', width: 120, align: 'left', template: function(task) {
          const rn = task.resource_names || '';
          return `<span class="gantt-role-btn" data-task-id="${task.id}" onclick="window.__openRolePicker(${task.id})" title="${(rn||'').replace(/"/g,'&quot;')}" style="cursor:pointer;color:#d97706;font-weight:500;font-size:11px;display:inline-block;min-width:20px;min-height:14px;">${rn || ' '}</span>`;
        }},
      ];

      gantt.config.lightbox.sections = [];
      gantt.init(containerId);
      window.__ganttInstance = gantt;

      const style = document.createElement('style');
      style.id = 'gantt-custom-styles';
      style.textContent = `
        .gantt-milestone-task .gantt_task_content { color: #d97706 !important; font-weight: bold; }
        .gantt-child-task .gantt_task_content { color: #2563eb; }
      `;
      if (!document.getElementById('gantt-custom-styles')) document.head.appendChild(style);

      if (options.onGanttReady) options.onGanttReady(gantt);
      if (options.onTaskClick) gantt.attachEvent('onTaskClick', options.onTaskClick);
      if (options.onTaskDblClick) gantt.attachEvent('onTaskDblClick', options.onTaskDblClick);
      if (options.onAfterTaskUpdate) gantt.attachEvent('onAfterTaskUpdate', options.onAfterTaskUpdate);
      if (options.onAfterTaskAdd) gantt.attachEvent('onAfterTaskAdd', options.onAfterTaskAdd);
      if (options.onBeforeTaskDelete) gantt.attachEvent('onBeforeTaskDelete', options.onBeforeTaskDelete);
      if (options.onAfterLinkAdd) gantt.attachEvent('onAfterLinkAdd', options.onAfterLinkAdd);
      if (options.onAfterLinkDelete) gantt.attachEvent('onAfterLinkDelete', options.onAfterLinkDelete);
    } catch (e) { console.error('Failed to init dhtmlx-gantt:', e); initRef.current = false; }
  }, [containerId]);

  const loadData = useCallback((data) => {
    const d = { data: data.data || [], links: data.links || [] };
    if (!initRef.current) { initGantt(); setTimeout(() => { try { gantt.clearAll(); gantt.parse(d); } catch {} }, 100); return; }
    gantt.clearAll();
    gantt.parse(d);
  }, [initGantt]);

  const getGantt = useCallback(() => gantt, []);

  useEffect(() => { const t = setTimeout(() => initGantt(), 100); return () => clearTimeout(t); }, []);

  return { loadData, getGantt, initGantt };
}
