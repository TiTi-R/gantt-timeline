import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout.jsx';
import GanttContainer from './components/Gantt/GanttContainer.jsx';
import TaskTable from './components/TableView/TaskTable.jsx';
import TemplateLibrary from './components/TemplateLibrary/TemplateLibrary.jsx';
import ResourceList from './components/ResourceManager/ResourceList.jsx';
import ProjectList from './components/Layout/ProjectList.jsx';

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<ProjectList />} />
        <Route path="/project/:id/gantt" element={<GanttContainer />} />
        <Route path="/project/:id/table" element={<TaskTable />} />
        <Route path="/templates" element={<TemplateLibrary />} />
        <Route path="/resources" element={<ResourceList />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
