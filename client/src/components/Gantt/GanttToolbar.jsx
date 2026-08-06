import { useTranslation } from 'react-i18next';

export default function GanttToolbar({ onAddTask, onDelete, onRefresh, onSaveTemplate, onImportTemplate, onMoveUp, onMoveDown, onExportPdf, onExportExcel }) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shrink-0">
      <div className="flex items-center gap-1.5">
        <button onClick={onAddTask}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 font-medium">
          + 新建
        </button>
        <button onClick={onMoveUp}
          className="px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md"
          title="选中行上移">▲</button>
        <button onClick={onMoveDown}
          className="px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md"
          title="选中行下移">▼</button>
        <button onClick={onDelete}
          className="px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md"
          title="删除选中任务 (Del)">🗑</button>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <button onClick={() => { const g = window.__ganttInstance; if (g) g.showDate(new Date()); }}
          className="px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md">{t('gantt:today')}</button>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onExportPdf}
          className="px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md" title="导出 PDF">📄 PDF</button>
        <button onClick={onExportExcel}
          className="px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md" title="导出 Excel">📊 Excel</button>
        <div className="w-px h-5 bg-gray-200" />
        <button onClick={onRefresh}
          className="px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-md" title="刷新">↻</button>
        <button onClick={onImportTemplate}
          className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-md hover:bg-indigo-700">
          📥 {t('template.import')}
        </button>
        <button onClick={onSaveTemplate}
          className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-md hover:bg-green-700">
          💾 {t('template.save')}
        </button>
      </div>
    </div>
  );
}
