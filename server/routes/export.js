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

const deriveMilestoneDates = (tasks) => {
  const childrenByParent = {};
  tasks.forEach(t => {
    if (t.parent_id) {
      if (!childrenByParent[t.parent_id]) childrenByParent[t.parent_id] = [];
      childrenByParent[t.parent_id].push(t);
    }
  });
  tasks.forEach(t => {
    if (t.is_milestone) {
      const children = childrenByParent[t.id];
      if (children && children.length > 0) {
        const starts = children.map(c => c.start_date).filter(Boolean).sort();
        const ends = children.map(c => c.end_date).filter(Boolean).sort();
        if (starts.length > 0) t.start_date = starts[0];
        if (ends.length > 0) t.end_date = ends[ends.length - 1];
      }
    }
  });

  // Compute display duration for ALL tasks (inclusive, matching gantt)
  tasks.forEach(t => {
    if (t.start_date && t.end_date) {
      t.duration_days = daysBetweenGap(t.start_date, t.end_date) + 1;
    }
  });
};

const dayOfYear = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.floor((d - yearStart) / 86400000) + 1;
};

const daysBetweenGap = (a, b) => {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
};

const ganttBarColor = (t) => {
  if (t.is_milestone) return '#f59e0b';
  if (t.parent_id) return '#4472C4';
  return '#8b5cf6';
};

// ── PDF Export ─────────────────────────────────────────────────

router.get('/projects/:id/export/pdf', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order').all(req.params.id);
  deriveMilestoneDates(tasks);
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

  const withGantt = req.query.gantt === '1';
  // A4 portrait: 595pt - 60pt margins = 535pt usable; landscape: 842 - 60 = 782pt
  const maxTableWidth = withGantt ? 782 : 535;
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);
  if (tableWidth > maxTableWidth) {
    const scale = maxTableWidth / tableWidth;
    cols.forEach(c => { c.width = Math.floor(c.width * scale); });
  }

  const doc = new PDFDocument({ size: 'A4', margin: 30, layout: withGantt ? 'landscape' : 'portrait' });

  // Register Chinese font to avoid garbled text
  try { doc.registerFont('SimHei', 'C:/Windows/Fonts/simhei.ttf'); } catch {}
  const f = 'SimHei';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(project.name)}.pdf"`);
  doc.pipe(res);

  // Title
  doc.fontSize(14).font(f).text(project.name || 'Project', { align: 'left' });
  doc.fontSize(9).fillColor('#666').text(`导出时间: ${new Date().toISOString().split('T')[0]}`, { align: 'left' });
  doc.moveDown(0.5);

  const tableTop = doc.y;
  const rowH = 18;
  const headerH = 22;

  // Header background
  doc.rect(30, tableTop, cols.reduce((s, c) => s + c.width, 0), headerH).fill('#4472C4');
  doc.fillColor('#fff').fontSize(9);

  let x = 30;
  cols.forEach(c => {
    doc.font(f).text(c.title, x + 4, tableTop + 5, { width: c.width - 8, align: c.align || 'left' });
    x += c.width;
  });

  // Rows
  let y = tableTop + headerH;
  doc.fillColor('#333').fontSize(8);

  // ── Summary row (总工期) ──
  const label = req.query.label || '总工期';
  const summary = calcSummary(sorted);
  doc.font(f).fontSize(8);
  const labelH = doc.heightOfString(label, { width: cols[0].width - 8 });
  const summaryH = Math.max(rowH, labelH + 2);

  doc.rect(30, y, cols.reduce((s, c) => s + c.width, 0), summaryH).fill('#eef2ff');
  doc.fillColor('#1e3a5f').fontSize(8);
  x = 30;
  cols.forEach(c => {
    let val = '';
    switch (c.key) {
      case 'name': val = label; break;
      case 'start_date': val = summary.start; break;
      case 'end_date': val = summary.end; break;
      case 'duration': val = String(summary.total); break;
      case 'role':
      case 'person': val = ''; break;
    }
    doc.font(f).text(val, x + 4, y + 2, { width: c.width - 8, align: c.align || 'left' });
    x += c.width;
  });
  y += summaryH;

  // ── Task rows ──
  sorted.forEach((t, i) => {
    // Compute column values and measure name height for wrapping
    let prefix = '';
    if (t.is_milestone) prefix = '◆ ';
    else if (t.parent_id) prefix = '    ';
    const nameText = prefix + (t.name || '');
    const nameColWidth = cols[0].width - 8;
    doc.font(f).fontSize(8);
    const measuredH = doc.heightOfString(nameText, { width: nameColWidth });
    const actualH = Math.max(rowH, measuredH + 2); // +2 padding

    if (y + actualH > doc.page.height - (withGantt ? 250 : 40)) {
      doc.addPage();
      y = 30;
    }
    // Alternate row color
    if (i % 2 === 0) {
      doc.rect(30, y, cols.reduce((s, c) => s + c.width, 0), actualH).fill('#f7f8fa');
    }
    doc.fillColor('#333').fontSize(8);

    x = 30;
    cols.forEach(c => {
      let val = '';
      switch (c.key) {
        case 'name': val = nameText; break;
        case 'start_date': val = fmtDate(t.start_date); break;
        case 'end_date': val = fmtDate(t.end_date); break;
        case 'duration': val = String(Math.max(0, t.duration_days || 0)); break;
        case 'role': val = t.resource_names || ''; break;
        case 'person': val = t.resource_person_names || ''; break;
      }
      const opts = { width: c.width - 8, align: c.align || 'left' };
      doc.font(f).text(val, x + 4, y + 2, opts);
      x += c.width;
    });

    y += actualH;
  });

  // ── Gantt chart (optional) ───────────────────────────────────
  if (req.query.gantt === '1') {
    y += 12;
    doc.fillColor('#333').fontSize(11).font(f).text('甘特图', 30, y);
    y += 20;

    // Date range for chart (use all tasks including milestones)
    const allWithDates = sorted.filter(t => t.start_date && t.end_date);
    if (allWithDates.length === 0) {
      doc.fillColor('#999').fontSize(9).text('暂无数据', 30, y);
    } else {
      const chartStart = allWithDates.reduce((min, t) => t.start_date < min ? t.start_date : min, allWithDates[0].start_date);
      const chartEnd = allWithDates.reduce((max, t) => t.end_date > max ? t.end_date : max, allWithDates[0].end_date);
      const chartDays = daysBetweenGap(chartStart, chartEnd) + 1;
      const nameWidth = 200;
      const chartLeft = 30 + nameWidth;
      const chartAreaWidth = cols.reduce((s, c) => s + c.width, 0) - nameWidth;
      const dayW = chartAreaWidth / chartDays; // can be <1 for long timelines
      const totalChartWidth = chartAreaWidth; // always fits within available width
      const ganttRowH = 16;

      // Month headers
      doc.fontSize(7).fillColor('#666');
      let monthX = chartLeft;
      let prevMonth = '';
      const sDate = new Date(chartStart + 'T00:00:00');
      for (let d = 0; d < chartDays; d++) {
        const cur = new Date(sDate);
        cur.setDate(cur.getDate() + d);
        const monthLabel = (cur.getMonth() + 1) + '月';
        if (monthLabel !== prevMonth) {
          doc.text(monthLabel, monthX, y, { width: dayW * (chartDays - d), align: 'left' });
          prevMonth = monthLabel;
        }
        monthX += dayW;
      }
      y += 12;

      // Day ticks (every 5th day)
      doc.fontSize(6).fillColor('#999');
      for (let d = 0; d < chartDays; d += 5) {
        const cur = new Date(sDate);
        cur.setDate(cur.getDate() + d);
        doc.text(String(cur.getDate()), chartLeft + d * dayW, y, { width: dayW * 5, align: 'center' });
      }
      y += 8;

      // Task bars
      sorted.forEach(t => {
        if (!t.start_date || !t.end_date) return;
        if (y + ganttRowH > doc.page.height - 30) { doc.addPage(); y = 30; }

        const offset = daysBetweenGap(chartStart, t.start_date);
        const dur = daysBetweenGap(t.start_date, t.end_date);
        const barW = Math.max(1, dur * dayW);
        const barX = chartLeft + offset * dayW;
        const color = ganttBarColor(t);

        // Task name (left side)
        let taskLabel = t.name || '';
        if (t.is_milestone) taskLabel = '◆ ' + taskLabel;
        else if (t.parent_id) taskLabel = '    ' + taskLabel;
        doc.fillColor('#333').fontSize(7).font(f);
        doc.text(taskLabel, 30, y + 2, { width: nameWidth - 6, height: ganttRowH, ellipsis: true });

        // Bar
        doc.rect(barX, y + 2, Math.max(barW, 5), ganttRowH - 4).fill(color);
        // Duration label inside bar
        if (barW > 20) {
          doc.fillColor('#fff').fontSize(6).font(f);
          doc.text(String(Math.max(0, t.duration_days || dur)) + 'd', barX + 2, y + 3, { width: barW - 4, align: 'center' });
        }

        y += ganttRowH;
      });
    }
  }

  doc.end();
});

// ── Excel Export ────────────────────────────────────────────────

router.get('/projects/:id/export/xlsx', async (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order').all(req.params.id);
  deriveMilestoneDates(tasks);
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
  const label = req.query.label || '总工期';
  const summary = calcSummary(sorted);
  const summaryRow = ws.addRow([label, summary.start, summary.end, summary.total, '', '', '']);
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
      Math.max(0, t.duration_days || 0),
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

  // ── Gantt chart sheet (optional) ──────────────────────────────
  if (req.query.gantt === '1') {
    const gs = wb.addWorksheet('甘特图');

    const allWithDates = sorted.filter(t => t.start_date && t.end_date);
    if (allWithDates.length > 0) {
      const chartStart = allWithDates.reduce((min, t) => t.start_date < min ? t.start_date : min, allWithDates[0].start_date);
      const chartEnd = allWithDates.reduce((max, t) => t.end_date > max ? t.end_date : max, allWithDates[0].end_date);
      const chartDays = daysBetweenGap(chartStart, chartEnd) + 1;
      const sDate = new Date(chartStart + 'T00:00:00');

      // Row 1: Month headers
      const monthRow = gs.addRow([]);
      monthRow.getCell(1).value = '';
      gs.getColumn(1).width = 44;
      let colIdx = 2;
      let prevMonth = '';
      for (let d = 0; d < chartDays; d++) {
        const cur = new Date(sDate);
        cur.setDate(cur.getDate() + d);
        const monthLabel = (cur.getMonth() + 1) + '月';
        const cell = monthRow.getCell(colIdx);
        if (monthLabel !== prevMonth) {
          cell.value = monthLabel;
          cell.font = { size: 8, color: { argb: 'FF666666' } };
          prevMonth = monthLabel;
        } else {
          cell.value = null;
        }
        colIdx++;
      }

      // Row 2: Day numbers
      const dayRow = gs.addRow([]);
      dayRow.getCell(1).value = '';
      colIdx = 2;
      for (let d = 0; d < chartDays; d++) {
        const cur = new Date(sDate);
        cur.setDate(cur.getDate() + d);
        const cell = dayRow.getCell(colIdx);
        if (d % 5 === 0) {
          cell.value = cur.getDate();
          cell.font = { size: 7, color: { argb: 'FF999999' } };
        }
        cell.alignment = { horizontal: 'center' };
        gs.getColumn(colIdx).width = 3;
        colIdx++;
      }

      // Task rows
      sorted.forEach(t => {
        if (!t.start_date || !t.end_date) return;
        const offset = daysBetweenGap(chartStart, t.start_date);
        const dur = daysBetweenGap(t.start_date, t.end_date);
        const color = ganttBarColor(t);
        const argbColor = color.replace('#', 'FF').toUpperCase();

        const row = gs.addRow([]);
        row.height = 16;

        // Task name
        let taskLabel = t.name || '';
        if (t.is_milestone) taskLabel = '◆ ' + taskLabel;
        else if (t.parent_id) taskLabel = '    ' + taskLabel;
        row.getCell(1).value = taskLabel;
        row.getCell(1).font = { size: 9, bold: !!t.is_milestone };
        row.getCell(1).alignment = { vertical: 'middle', wrapText: true, indent: t._depth };

        // Fill bars
        for (let d = 0; d < dur; d++) {
          const cell = row.getCell(2 + offset + d);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argbColor } };
        }
      });
    }
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(project.name)}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

export default router;
