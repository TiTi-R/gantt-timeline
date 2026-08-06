import { Router } from 'express';
import { getDb } from '../db/connection.js';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

const router = Router();

// ── Helpers ────────────────────────────────────────────────────

const treeSort = (tasks) => {
  const map = {};
  tasks.forEach(t => (map[t.id] = { ...t, children: [] }));
  const roots = [];
  tasks.forEach(t => {
    if (t.parent_id && map[t.parent_id]) {
      map[t.parent_id].children.push(map[t.id]);
    } else {
      roots.push(map[t.id]);
    }
  });
  const out = [];
  const walk = (nodes, depth) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    nodes.forEach(n => {
      out.push({ ...n, _depth: depth });
      walk(n.children, depth + 1);
    });
  };
  walk(roots, 0);
  return out;
};

const fmtDate = (d) => {
  if (!d) return '';
  const parts = String(d).split('T')[0].split('-');
  return parts[0] + '-' + parts[1] + '-' + parts[2];
};

const calcSummary = (tasks) => {
  const withDates = tasks.filter(t => t.start_date && t.end_date);
  if (!withDates.length) return { start: '', end: '', total: 0 };
  const starts = withDates.map(t => t.start_date).sort();
  const ends   = withDates.map(t => t.end_date).sort();
  const s = starts[0];
  const e = ends[ends.length - 1];
  const days = Math.round((new Date(e + 'T00:00:00') - new Date(s + 'T00:00:00')) / 86400000) + 1;
  return { start: fmtDate(s), end: fmtDate(e), total: days };
};

// ── PDF Export ─────────────────────────────────────────────────

router.get('/projects/:id/export/pdf', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order').all(req.params.id);
  const sorted = treeSort(tasks);

  // Determine if person column can be skipped
  const hasPersons = sorted.some(t => t.resource_person_names && t.resource_person_names.trim());

  const cols = [
    { key: 'name', title: '任务名称', width: 260 },
    { key: 'start_date', title: '开始日期', width: 80 },
    { key: 'end_date', title: '结束日期', width: 80 },
    { key: 'duration', title: '工期', width: 50, align: 'center' },
    { key: 'role', title: '负责角色', width: 140 },
  ];
  if (hasPersons) {
    cols.push({ key: 'person', title: '负责人', width: 140 });
  }

  const doc = new PDFDocument({ size: 'A4', margin: 30, layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(project.name)}.pdf"`);
  doc.pipe(res);

  // Title
  doc.fontSize(14).font('Helvetica-Bold').text(project.name || 'Project', { align: 'left' });
  doc.fontSize(9).font('Helvetica').fillColor('#666').text(`导出时间: ${new Date().toISOString().split('T')[0]}`, { align: 'left' });
  doc.moveDown(0.5);

  const tableTop = doc.y;
  const rowH = 18;
  const headerH = 22;

  // Header background
  doc.rect(30, tableTop, cols.reduce((s, c) => s + c.width, 0), headerH).fill('#4472C4');
  doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');

  let x = 30;
  cols.forEach(c => {
    doc.text(c.title, x + 4, tableTop + 5, { width: c.width - 8, align: c.align || 'left' });
    x += c.width;
  });

  // Rows
  let y = tableTop + headerH;
  doc.fillColor('#333').font('Helvetica').fontSize(8);

  // ── Summary row (总工期) ──
  const summary = calcSummary(sorted);
  doc.rect(30, y, cols.reduce((s, c) => s + c.width, 0), rowH).fill('#eef2ff');
  doc.fillColor('#1e3a5f').font('Helvetica-Bold').fontSize(8);
  x = 30;
  cols.forEach(c => {
    let val = '';
    switch (c.key) {
      case 'name': val = '总工期'; break;
      case 'start_date': val = summary.start; break;
      case 'end_date': val = summary.end; break;
      case 'duration': val = String(summary.total); break;
      case 'role':
      case 'person': val = ''; break;
    }
    doc.text(val, x + 4, y + 4, { width: c.width - 8, align: c.align || 'left' });
    x += c.width;
  });
  y += rowH;

  // ── Task rows ──
  sorted.forEach((t, i) => {
    if (y + rowH > doc.page.height - 40) {
      doc.addPage();
      y = 30;
    }
    // Alternate row color
    if (i % 2 === 0) {
      doc.rect(30, y, cols.reduce((s, c) => s + c.width, 0), rowH).fill('#f7f8fa');
    }
    doc.fillColor('#333').font('Helvetica').fontSize(8);

    let prefix = '';
    if (t.is_milestone) prefix = '◆ ';
    else if (t.parent_id) prefix = '  ↳ ';
    const name = prefix + (t.name || '');

    x = 30;
    cols.forEach(c => {
      let val = '';
      switch (c.key) {
        case 'name':
          val = name; break;
        case 'start_date':
          val = fmtDate(t.start_date); break;
        case 'end_date':
          val = fmtDate(t.end_date); break;
        case 'duration':
          val = String(t.duration_days || 0); break;
        case 'role':
          val = t.resource_names || ''; break;
        case 'person':
          val = t.resource_person_names || ''; break;
      }
      const opts = { width: c.width - 8, align: c.align || 'left' };
      if (t.is_milestone) doc.font('Helvetica-Bold');
      else doc.font('Helvetica');
      doc.text(val, x + 4, y + 4, opts);
      x += c.width;
    });

    y += rowH;
  });

  doc.end();
});

// ── Excel Export ────────────────────────────────────────────────

router.get('/projects/:id/export/xlsx', async (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order').all(req.params.id);
  const sorted = treeSort(tasks);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('项目任务');

  // Title row
  ws.mergeCells('A1:G1');
  ws.getCell('A1').value = project.name || '项目任务';
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A1').alignment = { horizontal: 'left' };

  // Header
  const headers = ['任务名称', '开始日期', '结束日期', '工期', '负责角色', '负责人', '备注'];
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };
  });
  headerRow.height = 20;

  // ── Summary row (总工期) ──
  const summary = calcSummary(sorted);
  const summaryRow = ws.addRow(['总工期', summary.start, summary.end, summary.total, '', '', '']);
  summaryRow.eachCell((cell, colNum) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FF1e3a5f' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFeef2ff' } };
    cell.alignment = { horizontal: colNum === 1 ? 'left' : (colNum >= 4 ? 'left' : 'center'), vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };
  });
  summaryRow.height = 20;

  // Data rows
  sorted.forEach(t => {
    let name = t.name || '';
    if (t.is_milestone) name = '◆ ' + name;

    const row = ws.addRow([
      name,
      fmtDate(t.start_date),
      fmtDate(t.end_date),
      (t.duration_days || 0),
      t.resource_names || '',
      t.resource_person_names || '',
      t.notes || '',
    ]);

    row.height = 20;
    const indent = t._depth > 0 ? t._depth : 0;
    row.eachCell((cell, colNum) => {
      cell.font = { size: 10, bold: t.is_milestone };
      cell.alignment = { horizontal: colNum === 1 ? 'left' : (colNum >= 4 ? 'left' : 'center'), vertical: 'middle', wrapText: true, indent: colNum === 1 ? indent : 0 };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
    });
  });

  // Column widths
  ws.getColumn(1).width = 52;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 8;
  ws.getColumn(5).width = 24;
  ws.getColumn(6).width = 24;
  ws.getColumn(7).width = 28;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(project.name)}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

export default router;
