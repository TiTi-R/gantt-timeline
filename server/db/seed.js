import { initDb, getDb, closeDb } from './connection.js';

const db = await initDb();

// Clear existing seed data
db.exec('DELETE FROM template_dependencies');
db.exec('DELETE FROM template_tasks');
db.exec('DELETE FROM templates');
db.exec('DELETE FROM task_resources');
db.exec('DELETE FROM dependencies');
db.exec('DELETE FROM tasks');
db.exec('DELETE FROM phases');
db.exec('DELETE FROM resources');
db.exec('DELETE FROM projects');

// ============================================================
// Resources
// ============================================================
const resources = [
  { name: '张伟 (统计师)', role: 'Statistician', department: 'Biostatistics', color: '#4A90D9' },
  { name: '李明 (主任统计师)', role: 'Lead Statistician', department: 'Biostatistics', color: '#E67E22' },
  { name: '王芳 (SAS 程序员)', role: 'SAS Programmer', department: 'Statistical Programming', color: '#2ECC71' },
  { name: '赵强 (QC 程序员)', role: 'QC Programmer', department: 'Statistical Programming', color: '#9B59B6' },
  { name: '陈静 (数据管理员)', role: 'Data Manager', department: 'Data Management', color: '#1ABC9C' },
  { name: '刘洋 (医学写作)', role: 'Medical Writer', department: 'Medical Writing', color: '#E74C3C' },
  { name: '孙磊 (SDTM 程序员)', role: 'SDTM Programmer', department: 'Statistical Programming', color: '#3498DB' },
  { name: '周晓 (ADaM 程序员)', role: 'ADaM Programmer', department: 'Statistical Programming', color: '#F39C12' },
];

const insertRes = db.prepare('INSERT INTO resources (name, role, department, color) VALUES (?, ?, ?, ?)');
const resourceIds = resources.map(r => insertRes.run(r.name, r.role, r.department, r.color).lastInsertRowid);

// ============================================================
// Project
// ============================================================
const projectResult = db.prepare(
  `INSERT INTO projects (name, description, study_id, indication, start_date, end_date, status)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
).run(
  'IMM2510-003 TNBC 项目',
  'IMM2510-003 三阴乳腺癌临床研究 - 统计与统计编程时间表',
  'IMM2510-003',
  'TNBC (三阴乳腺癌)',
  '2025-07-23',
  '2026-10-29',
  'active'
);
const projectId = projectResult.lastInsertRowid;

// ============================================================
// Phases and Tasks
// ============================================================
const phaseColors = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5'];

const phases = [
  {
    name: 'SAP Development',
    tasks: [
      { name: 'SAP Text and TOC - Client Review and Revise', start: '2025-07-23', end: '2026-07-06', resources: [0, 1] },
      { name: 'SAP Development', start: '2026-07-07', end: '2026-07-10', resources: [0, 1] },
      { name: 'SAP Text and TOC 初版', start: '2026-07-13', end: '2026-07-20', resources: [0] },
      { name: 'Client Review (第一轮)', start: '2026-07-13', end: '2026-07-13', resources: [1, 5] },
      { name: 'Comments Resolution Meeting (CRM)', start: '2026-07-14', end: '2026-07-14', resources: [0, 1] },
      { name: 'Revise per 1st Round Client Comments', start: '2026-07-15', end: '2026-07-17', resources: [0] },
      { name: '2nd Round Client Review', start: '2026-07-17', end: '2026-07-20', resources: [1, 5] },
      { name: 'Revise per 2nd Round Client Comments', start: '2026-07-21', end: '2026-07-23', resources: [0] },
      { name: 'SAP Text and TOC Stable Version', start: '2026-08-13', end: '2026-08-13', resources: [1] },
    ]
  },
  {
    name: 'Dry Run',
    tasks: [
      { name: 'Data Snapshot for Dry Run', start: '2026-07-13', end: '2026-07-13', resources: [4] },
      { name: 'Dry Run (IB TLFs, SDTM, ADaM datasets)', start: '2026-07-14', end: '2026-07-17', resources: [2, 6, 7] },
      { name: 'Dry Run Rerun', start: '2026-07-17', end: '2026-07-20', resources: [2, 6, 7] },
      { name: 'Dry Run - Client Review', start: '2026-07-21', end: '2026-07-21', resources: [1, 5] },
      { name: 'Dry Run TLFs - Revise per Client Comments', start: '2026-07-22', end: '2026-07-23', resources: [2] },
    ]
  },
  {
    name: 'TLFs Shell',
    tasks: [
      { name: 'TLFs Shell Generation', start: '2026-07-13', end: '2026-07-24', resources: [2, 0] },
      { name: 'TLFs Shell - Client Review', start: '2026-07-27', end: '2026-07-31', resources: [1, 5] },
      { name: 'TLFs Shell - CRM', start: '2026-08-03', end: '2026-08-03', resources: [1, 2, 0] },
      { name: 'TLFs Shell - Revise per Client Comments', start: '2026-08-04', end: '2026-08-10', resources: [2, 0] },
      { name: 'TLFs Shell v1.0 - Client Approve', start: '2026-08-11', end: '2026-08-13', resources: [1, 5] },
    ]
  },
  {
    name: 'SDTM & ADaM Programming',
    tasks: [
      { name: 'SDTM Data Program Development', start: '2026-08-12', end: '2026-08-25', resources: [6] },
      { name: 'SDTM Internal Review', start: '2026-08-26', end: '2026-08-28', resources: [0, 3] },
      { name: 'SDTM Internal Revise', start: '2026-08-31', end: '2026-09-03', resources: [6] },
      { name: 'ADaM Data Program Development', start: '2026-09-04', end: '2026-09-17', resources: [7] },
      { name: 'ADaM Internal Review', start: '2026-09-18', end: '2026-09-20', resources: [0, 3] },
      { name: 'ADaM Internal Revise', start: '2026-09-21', end: '2026-09-23', resources: [7] },
    ]
  },
  {
    name: 'Final Run',
    tasks: [
      { name: 'Final Run (TLFs, ADaM datasets) TLF Development', start: '2026-09-24', end: '2026-10-14', resources: [2, 7] },
      { name: 'TLF Development - Internal Review', start: '2026-10-15', end: '2026-10-16', resources: [0, 3] },
      { name: 'TLF Development - Internal Revise', start: '2026-10-19', end: '2026-10-21', resources: [2, 7] },
      { name: 'Final Run - 1st Round Client Review', start: '2026-10-22', end: '2026-10-23', resources: [1, 5] },
      { name: 'Final Run TLFs - Revise per 1st Round Comments', start: '2026-10-26', end: '2026-10-28', resources: [2, 7] },
      { name: 'Final Run - 2nd Round Client Review', start: '2026-10-27', end: '2026-10-28', resources: [1, 5] },
      { name: 'Final Run TLFs - Revise per 2nd Round Comments', start: '2026-10-29', end: '2026-10-29', resources: [2, 7] },
    ]
  },
];

const insertPhase = db.prepare('INSERT INTO phases (project_id, name, sort_order, color) VALUES (?, ?, ?, ?)');
const insertTask = db.prepare(
  'INSERT INTO tasks (project_id, phase_id, name, start_date, end_date, duration_days, task_type, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
const insertTR = db.prepare('INSERT INTO task_resources (task_id, resource_id) VALUES (?, ?)');

let taskCount = 0;
const allTaskIds = [];

const daysBetween = (start, end) => {
  return Math.round((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1;
};

phases.forEach((phase, phaseIdx) => {
  const phResult = insertPhase.run(projectId, phase.name, phaseIdx, phaseColors[phaseIdx]);
  const phaseId = phResult.lastInsertRowid;

  phase.tasks.forEach((task, taskIdx) => {
    const duration = daysBetween(task.start, task.end);
    const tResult = insertTask.run(
      projectId, phaseId, task.name, task.start, task.end, duration,
      duration === 1 ? 'milestone' : 'task', taskIdx
    );
    const taskId = tResult.lastInsertRowid;
    allTaskIds.push(taskId);

    task.resources.forEach(ri => {
      insertTR.run(taskId, resourceIds[ri]);
    });

    taskCount++;
  });
});

// ============================================================
// Dependencies
// ============================================================
const dependencyPairs = [
  [4, 5],    // CRM -> Revise 1st round
  [5, 6],    // Revise 1st -> 2nd review
  [10, 12],  // Dry Run -> Dry Run Client Review
  [17, 18],  // Shell CRM -> Shell Revise
  [22, 23],  // SDTM Dev -> SDTM Review
  [23, 24],  // SDTM Review -> SDTM Revise
  [24, 25],  // SDTM done -> ADaM Dev
  [25, 26],  // ADaM Dev -> ADaM Review
  [27, 28],  // Final Dev -> Internal Review
  [28, 29],  // Internal Review -> Internal Revise
  [29, 30],  // Internal Revise -> 1st Client Review
  [30, 31],  // 1st Client Review -> Revise
];

const insertDep = db.prepare(
  'INSERT INTO dependencies (project_id, predecessor_id, successor_id, dependency_type) VALUES (?, ?, ?, ?)'
);
dependencyPairs.forEach(([pre, suc]) => {
  insertDep.run(projectId, allTaskIds[pre], allTaskIds[suc], 'FS');
});

// ============================================================
// Template
// ============================================================
const templateResult = db.prepare(
  'INSERT INTO templates (name, description, template_type, task_count, total_duration) VALUES (?, ?, ?, ?, ?)'
).run('IMM2510-003 TNBC 标准模版', '包含 SAP Development, Dry Run, TLFs Shell, SDTM & ADaM Programming, Final Run 五个阶段', 'project', taskCount, 315);

const templateId = templateResult.lastInsertRowid;
const projectStartDate = new Date('2025-07-23');

const insertTplTask = db.prepare(
  'INSERT INTO template_tasks (template_id, name, relative_start, relative_end, duration_days, sort_order, resource_names) VALUES (?, ?, ?, ?, ?, ?, ?)'
);

phases.forEach((phase) => {
  phase.tasks.forEach((task, idx) => {
    const relStart = Math.round((new Date(task.start) - projectStartDate) / (1000 * 60 * 60 * 24));
    const relEnd = Math.round((new Date(task.end) - projectStartDate) / (1000 * 60 * 60 * 24));
    const resourceNames = JSON.stringify(task.resources.map(ri => resources[ri].role));
    insertTplTask.run(templateId, task.name, relStart, relEnd, daysBetween(task.start, task.end), idx, resourceNames);
  });
});

db.saveToDisk();
closeDb();

console.log(`✅ Seed complete: ${taskCount} tasks across ${phases.length} phases`);
console.log(`   Project ID: ${projectId}, Template ID: ${templateId}`);
console.log(`   Resources: ${resources.length}`);
