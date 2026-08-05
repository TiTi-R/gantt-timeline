import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor for error handling
api.interceptors.response.use(
  res => res,
  err => {
    const message = err.response?.data?.error || err.message || 'Unknown error';
    console.error('[API Error]', message);
    return Promise.reject(err);
  }
);

// ============================================================
// Projects
// ============================================================
export const getProjects = (params) => api.get('/projects', { params }).then(r => r.data);
export const getProject = (id) => api.get(`/projects/${id}`).then(r => r.data);
export const createProject = (data) => api.post('/projects', data).then(r => r.data);
export const updateProject = (id, data) => api.patch(`/projects/${id}`, data).then(r => r.data);
export const deleteProject = (id) => api.delete(`/projects/${id}`).then(r => r.data);
export const getGanttData = (id) => api.get(`/projects/${id}/gantt-data`).then(r => r.data);

// ============================================================
// Tasks
// ============================================================
export const getTasks = (projectId) => api.get(`/projects/${projectId}/tasks`).then(r => r.data);
export const createTask = (projectId, data) => api.post(`/projects/${projectId}/tasks`, data).then(r => r.data);
export const updateTask = (taskId, data) => api.patch(`/tasks/${taskId}`, data).then(r => r.data);
export const deleteTask = (taskId) => api.delete(`/tasks/${taskId}`).then(r => r.data);
export const batchUpdateTasks = (projectId, tasks) => api.post(`/projects/${projectId}/tasks/batch`, { tasks }).then(r => r.data);
export const reorderTasks = (projectId, taskIds) => api.post(`/projects/${projectId}/tasks/reorder`, { task_ids: taskIds }).then(r => r.data);

// ============================================================
// Phases
// ============================================================
export const getPhases = (projectId) => api.get(`/projects/${projectId}/phases`).then(r => r.data);
export const createPhase = (projectId, data) => api.post(`/projects/${projectId}/phases`, data).then(r => r.data);
export const updatePhase = (phaseId, data) => api.patch(`/phases/${phaseId}`, data).then(r => r.data);
export const deletePhase = (phaseId) => api.delete(`/phases/${phaseId}`).then(r => r.data);

// ============================================================
// Dependencies
// ============================================================
export const getDependencies = (taskId) => api.get(`/tasks/${taskId}/dependencies`).then(r => r.data);
export const createDependency = (projectId, data) => api.post(`/projects/${projectId}/dependencies`, data).then(r => r.data);
export const updateDependency = (depId, data) => api.patch(`/dependencies/${depId}`, data).then(r => r.data);
export const deleteDependency = (depId) => api.delete(`/dependencies/${depId}`).then(r => r.data);

// ============================================================
// Resources
// ============================================================
export const getResources = (params) => api.get('/resources', { params }).then(r => r.data);
export const createResource = (data) => api.post('/resources', data).then(r => r.data);
export const updateResource = (id, data) => api.patch(`/resources/${id}`, data).then(r => r.data);
export const deleteResource = (id) => api.delete(`/resources/${id}`).then(r => r.data);

// ============================================================
// Templates
// ============================================================
export const getTemplates = (params) => api.get('/templates', { params }).then(r => r.data);
export const getPublishedTemplates = () => api.get('/templates', { params: { published: 'true' } }).then(r => r.data);
export const getTemplate = (id) => api.get(`/templates/${id}`).then(r => r.data);
export const createTemplate = (data) => api.post('/templates', data).then(r => r.data);
export const updateTemplate = (id, data) => api.patch(`/templates/${id}`, data).then(r => r.data);
export const deleteTemplate = (id) => api.delete(`/templates/${id}`).then(r => r.data);
export const importTemplate = (id, data) => api.post(`/templates/${id}/import`, data).then(r => r.data);

// Template tasks (for editing blank templates)
export const addTemplateTask = (templateId, data) => api.post(`/templates/${templateId}/tasks`, data).then(r => r.data);
export const updateTemplateTask = (templateId, taskId, data) => api.patch(`/templates/${templateId}/tasks/${taskId}`, data).then(r => r.data);
export const deleteTemplateTask = (templateId, taskId) => api.delete(`/templates/${templateId}/tasks/${taskId}`).then(r => r.data);
export const reorderTemplateTasks = (templateId, taskIds) => api.post(`/templates/${templateId}/tasks/reorder`, { task_ids: taskIds }).then(r => r.data);
export const publishTemplate = (templateId, status) => api.patch(`/templates/${templateId}/status`, { status }).then(r => r.data);
export const autoScheduleTemplate = (templateId) => api.post(`/templates/${templateId}/autoschedule`).then(r => r.data);

// ============================================================
// Export
// ============================================================
export const getExportPdfUrl = (projectId, params) => {
  const qs = new URLSearchParams(params).toString();
  return `/api/projects/${projectId}/export/pdf?${qs}`;
};
export const getExportXlsxUrl = (projectId, params) => {
  const qs = new URLSearchParams(params).toString();
  return `/api/projects/${projectId}/export/xlsx?${qs}`;
};

// ============================================================
// Files
// ============================================================
export const getProjectFiles = (projectId) => api.get(`/projects/${projectId}/files`).then(r => r.data);
export const uploadProjectFile = (projectId, data) => api.post(`/projects/${projectId}/files`, data).then(r => r.data);
export const deleteProjectFile = (fileId) => api.delete(`/files/${fileId}`).then(r => r.data);

// ============================================================
// Settings
// ============================================================
export const getSettings = () => api.get('/settings').then(r => r.data);
export const saveSetting = (key, value) => api.post('/settings', { key, value }).then(r => r.data);

export default api;
