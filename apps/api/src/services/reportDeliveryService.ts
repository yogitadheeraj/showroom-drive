import { randomUUID } from 'node:crypto';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { buildReportData, generateReportHTML, type ReportData } from './reportEmailService.js';
import { Profile } from '../models/Profile.js';
import { UserRole } from '../models/UserRole.js';
import { Location } from '../models/Location.js';
import { ReportDispatchConfig, type ReportDispatchFormat, type ReportDispatchRecipientRole, type ReportDispatchType } from '../models/ReportDispatchConfig.js';
import { enqueueEmail } from './emailQueueService.js';
import { ReportAuditLog } from '../models/ReportAuditLog.js';

export interface ReportAttachment {
  filename: string;
  contentType: string;
  contentBase64: string;
}

export interface DownloadableReport {
  filename: string;
  contentType: string;
  buffer: Buffer;
}

export async function logReportAudit(args: {
  action: 'download' | 'send_queued' | 'schedule_dispatch';
  status: 'success' | 'failed';
  location_id: string;
  report_type: ReportDispatchType;
  report_date: string;
  format?: 'excel' | 'pdf' | 'mixed' | null;
  recipient_email?: string | null;
  actor_user_id?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  await ReportAuditLog.create({
    id: randomUUID(),
    action: args.action,
    status: args.status,
    location_id: args.location_id,
    report_type: args.report_type,
    report_date: args.report_date,
    format: args.format ?? null,
    recipient_email: args.recipient_email ?? null,
    actor_user_id: args.actor_user_id ?? null,
    message: args.message ?? null,
    metadata: args.metadata ?? null,
    created_at: new Date().toISOString(),
  });
}

function makeFileBaseName(report: ReportData, reportType: ReportDispatchType = 'test_drive_daily') {
  const locationSlug = report.location.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const prefix = reportType === 'activity_daily' ? 'activity-report' : 'test-drive-report';
  return `${prefix}-${locationSlug || report.location.id}-${report.reportDate}`;
}

async function buildExcelBuffer(report: ReportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AutoAdvant';
  wb.created = new Date();

  const total = report.totalTestDrives;
  const pct = (n: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '0%');

  const NAVY    = 'FF1F3864';
  const BLUE    = 'FF2E75B6';
  const ALT_ROW = 'FFEEF3FA';
  const WHITE   = 'FFFFFFFF';
  const GREEN   = 'FF107C10';
  const RED     = 'FFA80000';
  const ORANGE  = 'FFED7D31';
  const PURPLE  = 'FF7030A0';
  const GREY    = 'FF595959';
  const PINK    = 'FFE91E8C';

  function hdr(cell: ExcelJS.Cell, bg = NAVY) {
    cell.font = { bold: true, color: { argb: WHITE }, size: 11, name: 'Calibri' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: WHITE } },
      bottom: { style: 'thin', color: { argb: WHITE } },
      left: { style: 'thin', color: { argb: WHITE } },
      right: { style: 'thin', color: { argb: WHITE } },
    };
  }

  function alt(row: ExcelJS.Row, cols: number) {
    for (let c = 1; c <= cols; c++) {
      row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW } };
    }
  }

  function noData(ws: ExcelJS.Worksheet, cols: number) {
    const row = ws.addRow(['No data recorded']);
    row.getCell(1).font = { italic: true, color: { argb: GREY } };
    for (let c = 1; c <= cols; c++) {
      row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    }
  }

  // ── Sheet 1: Overview ───────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet('Overview');
  ws1.columns = [
    { key: 'a', width: 30 },
    { key: 'b', width: 22 },
    { key: 'c', width: 16 },
    { key: 'd', width: 26 },
  ];

  // Title banner
  ws1.mergeCells('A1:D1');
  const title = ws1.getCell('A1');
  title.value = `Daily Test Drive Report  |  ${report.location.name}`;
  title.font = { bold: true, size: 16, color: { argb: WHITE }, name: 'Calibri' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(1).height = 40;

  // Sub-header with date
  ws1.mergeCells('A2:D2');
  const sub = ws1.getCell('A2');
  sub.value = `Report Date: ${report.reportDate}  |  Dealer: ${report.dealer.name || '-'}  |  Generated: ${new Date().toLocaleString('en-IN')}`;
  sub.font = { italic: true, color: { argb: 'FF555555' }, size: 10 };
  sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECF0F9' } };
  sub.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(2).height = 22;

  ws1.addRow([]);

  // Stats section header
  ws1.mergeCells('A4:D4');
  const statsLabel = ws1.getCell('A4');
  statsLabel.value = 'Summary Statistics';
  statsLabel.font = { bold: true, size: 13, color: { argb: WHITE } };
  statsLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
  statsLabel.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(4).height = 26;

  // Stats table header
  const statsHdrRow = ws1.addRow(['Metric', 'Count', '% of Total', 'Distribution Chart']);
  statsHdrRow.height = 22;
  ['A', 'B', 'C', 'D'].forEach((c) => hdr(ws1.getCell(`${c}${statsHdrRow.number}`)));

  const statusData: Array<{ label: string; count: number; argb: string }> = [
    { label: 'TOTAL TEST DRIVES', count: total, argb: NAVY },
    { label: 'Completed',         count: report.statusBreakdown.completed,   argb: GREEN },
    { label: 'Scheduled',         count: report.statusBreakdown.scheduled,   argb: BLUE },
    { label: 'Confirmed',         count: report.statusBreakdown.confirmed,   argb: PURPLE },
    { label: 'Show',              count: report.statusBreakdown.show,        argb: GREEN },
    { label: 'In Progress',       count: report.statusBreakdown.in_progress, argb: ORANGE },
    { label: 'No Show',           count: report.statusBreakdown.no_show,     argb: RED },
    { label: 'Cancelled',         count: report.statusBreakdown.cancelled,   argb: GREY },
    { label: 'Rescheduled',       count: report.statusBreakdown.rescheduled, argb: PINK },
  ];

  statusData.forEach((item, idx) => {
    const pctNum = total > 0 && item.count > 0 ? Math.round((item.count / total) * 100) : 0;
    const bars = Math.max(0, Math.round(pctNum / 5));
    const bar = '█'.repeat(bars) + '░'.repeat(20 - bars) + `  ${pctNum}%`;
    const row = ws1.addRow([item.label, item.count, pct(item.count), bar]);
    row.height = idx === 0 ? 26 : 22;

    if (idx === 0) {
      row.getCell(1).font = { bold: true, size: 12, color: { argb: item.argb } };
      row.getCell(2).font = { bold: true, size: 14, color: { argb: item.argb } };
      row.getCell(3).font = { bold: true, color: { argb: item.argb } };
      row.getCell(4).font = { color: { argb: item.argb } };
      for (let c = 1; c <= 4; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECF0F9' } };
        row.getCell(c).border = { bottom: { style: 'medium', color: { argb: NAVY } } };
      }
    } else {
      row.getCell(2).font = { bold: item.count > 0, color: { argb: item.argb } };
      row.getCell(4).font = { color: { argb: item.argb } };
      if (idx % 2 === 0) alt(row, 4);
    }
    row.getCell(1).alignment = { vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).alignment = { vertical: 'middle' };
  });

  // ── Sheet 2: Status Breakdown ──────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Status');
  ws2.columns = [
    { header: 'Status',     key: 'status', width: 22 },
    { header: 'Count',      key: 'count',  width: 12 },
    { header: '% of Total', key: 'pct',    width: 14 },
  ];
  ['A', 'B', 'C'].forEach((c) => hdr(ws2.getCell(`${c}1`)));
  ws2.getRow(1).height = 24;

  Object.entries(report.statusBreakdown).forEach(([status, count], idx) => {
    const row = ws2.addRow({
      status: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
      pct: pct(count),
    });
    row.height = 22;
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    if (idx % 2 === 1) alt(row, 3);
  });

  // ── Sheet 3: Sales Performance ─────────────────────────────────────────────
  const ws3 = wb.addWorksheet('Sales');
  ws3.columns = [
    { header: 'Sales Person',    key: 'name',      width: 28 },
    { header: 'Assigned',        key: 'assigned',  width: 14 },
    { header: 'Completed',       key: 'completed', width: 14 },
    { header: 'No Show',         key: 'no_show',   width: 14 },
    { header: 'Completion Rate', key: 'rate',      width: 18 },
  ];
  ['A', 'B', 'C', 'D', 'E'].forEach((c) => hdr(ws3.getCell(`${c}1`)));
  ws3.getRow(1).height = 24;

  if (report.salesPeople.length === 0) {
    noData(ws3, 5);
  } else {
    report.salesPeople.forEach((p, idx) => {
      const rate = p.assigned > 0 ? Math.round((p.completed / p.assigned) * 100) : 0;
      const row = ws3.addRow({ name: p.name, assigned: p.assigned, completed: p.completed, no_show: p.no_show, rate: `${rate}%` });
      row.height = 22;
      row.getCell(3).font = { bold: p.completed > 0, color: { argb: p.completed > 0 ? GREEN : GREY } };
      row.getCell(4).font = { bold: p.no_show > 0,   color: { argb: p.no_show > 0 ? RED : GREY } };
      ['B', 'C', 'D', 'E'].forEach((c) => { ws3.getCell(`${c}${row.number}`).alignment = { horizontal: 'center', vertical: 'middle' }; });
      if (idx % 2 === 1) alt(row, 5);
    });
  }

  // ── Sheet 4: Security Activity ─────────────────────────────────────────────
  const ws4 = wb.addWorksheet('Security');
  ws4.columns = [
    { header: 'Staff Name',   key: 'name',        width: 28 },
    { header: 'Checked In',   key: 'checked_in',  width: 16 },
    { header: 'Checked Out',  key: 'checked_out', width: 16 },
  ];
  ['A', 'B', 'C'].forEach((c) => hdr(ws4.getCell(`${c}1`)));
  ws4.getRow(1).height = 24;

  if (report.security.length === 0) {
    noData(ws4, 3);
  } else {
    report.security.forEach((p, idx) => {
      const row = ws4.addRow({ name: p.name, checked_in: p.checked_in, checked_out: p.checked_out });
      row.height = 22;
      ['B', 'C'].forEach((c) => { ws4.getCell(`${c}${row.number}`).alignment = { horizontal: 'center', vertical: 'middle' }; });
      if (idx % 2 === 1) alt(row, 3);
    });
  }

  // ── Sheet 5: GRO Activity ──────────────────────────────────────────────────
  const ws5 = wb.addWorksheet('GRO');
  ws5.columns = [
    { header: 'GRO Name',        key: 'name',      width: 28 },
    { header: 'Assigned',        key: 'assigned',  width: 14 },
    { header: 'Completed',       key: 'completed', width: 14 },
    { header: 'Completion Rate', key: 'rate',      width: 18 },
  ];
  ['A', 'B', 'C', 'D'].forEach((c) => hdr(ws5.getCell(`${c}1`)));
  ws5.getRow(1).height = 24;

  if (report.gro.length === 0) {
    noData(ws5, 4);
  } else {
    report.gro.forEach((p, idx) => {
      const rate = p.assigned > 0 ? Math.round((p.completed / p.assigned) * 100) : 0;
      const row = ws5.addRow({ name: p.name, assigned: p.assigned, completed: p.completed, rate: `${rate}%` });
      row.height = 22;
      row.getCell(3).font = { bold: p.completed > 0, color: { argb: p.completed > 0 ? GREEN : GREY } };
      ['B', 'C', 'D'].forEach((c) => { ws5.getCell(`${c}${row.number}`).alignment = { horizontal: 'center', vertical: 'middle' }; });
      if (idx % 2 === 1) alt(row, 4);
    });
  }

  // ── Sheet 6: Activity Events ───────────────────────────────────────────────
  const ws6 = wb.addWorksheet('Activity');
  ws6.columns = [
    { header: 'Event Type',    key: 'event_type', width: 36 },
    { header: 'Count',         key: 'count',      width: 12 },
    { header: '% of Events',   key: 'pct',        width: 16 },
    { header: 'Distribution',  key: 'bar',        width: 32 },
  ];
  ['A', 'B', 'C', 'D'].forEach((c) => hdr(ws6.getCell(`${c}1`)));
  ws6.getRow(1).height = 24;

  const totalEvents = report.activitySummary.totalEvents || 1;
  const sortedEvents = Object.entries(report.activitySummary.eventTypes).sort(([, a], [, b]) => b - a);

  if (sortedEvents.length === 0) {
    noData(ws6, 4);
  } else {
    sortedEvents.forEach(([event_type, count], idx) => {
      const pctNum = Math.round((count / totalEvents) * 100);
      const bars = Math.max(0, Math.round(pctNum / 5));
      const bar = '█'.repeat(bars) + '░'.repeat(20 - bars);
      const row = ws6.addRow({ event_type: event_type.replace(/_/g, ' '), count, pct: `${pctNum}%`, bar });
      row.height = 22;
      row.getCell(2).font = { bold: count > 0 };
      ['B', 'C'].forEach((c) => { ws6.getCell(`${c}${row.number}`).alignment = { horizontal: 'center', vertical: 'middle' }; });
      if (idx % 2 === 1) alt(row, 4);
    });
  }

  const raw = await wb.xlsx.writeBuffer();
  return Buffer.from(raw);
}

function buildPdfBuffer(report: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const total = report.totalTestDrives;
    const pct = (n: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : '0%';
    const bar = (n: number, w = 20) => { const f = total > 0 ? Math.round((n / total) * w) : 0; return '█'.repeat(f) + '░'.repeat(w - f); };
    const WIDTH = 499;
    const COL = [48, 270, 350, 430];

    // Header banner
    doc.rect(48, 40, WIDTH, 50).fill('#1F3864');
    doc.fillColor('white').fontSize(18).font('Helvetica-Bold').text('Daily Test Drive Report', 60, 54);
    doc.fontSize(10).font('Helvetica').text(`${report.location.name}  |  ${report.reportDate}`, 60, 76);

    // Sub info
    doc.rect(48, 94, WIDTH, 24).fill('#ECF0F9');
    doc.fillColor('#444444').fontSize(9).font('Helvetica')
      .text(`Dealer: ${report.dealer.name || '-'}   |   Generated: ${new Date().toLocaleString('en-IN')}`, 56, 102);

    // ── Summary Stats ──
    doc.moveDown(2);
    let y = 134;
    doc.rect(48, y, WIDTH, 22).fill('#2E75B6');
    doc.fillColor('white').fontSize(12).font('Helvetica-Bold').text('Summary Statistics', 56, y + 5);
    y += 28;

    // Table header row
    doc.rect(48, y, WIDTH, 18).fill('#DAEAF7');
    doc.fillColor('#1F3864').fontSize(9).font('Helvetica-Bold');
    doc.text('Status', COL[0], y + 4);
    doc.text('Count', COL[1], y + 4, { width: 70, align: 'center' });
    doc.text('% Total', COL[2], y + 4, { width: 60, align: 'center' });
    doc.text('Distribution', COL[3], y + 4);
    y += 22;

    const rows: Array<{ label: string; count: number; color: string }> = [
      { label: 'Total Test Drives', count: total,                               color: '#1F3864' },
      { label: 'Completed',         count: report.statusBreakdown.completed,    color: '#107C10' },
      { label: 'Scheduled',         count: report.statusBreakdown.scheduled,    color: '#2E75B6' },
      { label: 'Confirmed',         count: report.statusBreakdown.confirmed,    color: '#7030A0' },
      { label: 'Show',              count: report.statusBreakdown.show,         color: '#107C10' },
      { label: 'In Progress',       count: report.statusBreakdown.in_progress,  color: '#ED7D31' },
      { label: 'No Show',           count: report.statusBreakdown.no_show,      color: '#A80000' },
      { label: 'Cancelled',         count: report.statusBreakdown.cancelled,    color: '#595959' },
      { label: 'Rescheduled',       count: report.statusBreakdown.rescheduled,  color: '#E91E8C' },
    ];

    rows.forEach((r, idx) => {
      const rowH = 18;
      if (idx % 2 === 1) doc.rect(48, y, WIDTH, rowH).fill('#F5F9FF');
      doc.fillColor(r.color).fontSize(idx === 0 ? 10 : 9)
        .font(idx === 0 ? 'Helvetica-Bold' : 'Helvetica');
      doc.text(r.label, COL[0], y + 4);
      doc.text(String(r.count), COL[1], y + 4, { width: 70, align: 'center' });
      doc.text(pct(r.count), COL[2], y + 4, { width: 60, align: 'center' });
      doc.fillColor('#888888').fontSize(8).font('Helvetica').text(bar(r.count), COL[3], y + 5);
      y += rowH;
    });

    // ── Sales Performance ──
    y += 16;
    if (doc.y > y) y = doc.y + 16;
    doc.rect(48, y, WIDTH, 22).fill('#2E75B6');
    doc.fillColor('white').fontSize(12).font('Helvetica-Bold').text('Sales Performance', 56, y + 5);
    y += 28;

    if (report.salesPeople.length === 0) {
      doc.fillColor('#999').fontSize(9).font('Helvetica-Oblique').text('No sales data recorded.', 56, y);
      y += 20;
    } else {
      doc.rect(48, y, WIDTH, 18).fill('#DAEAF7');
      doc.fillColor('#1F3864').fontSize(9).font('Helvetica-Bold');
      doc.text('Sales Person', 56, y + 4);
      doc.text('Assigned', 250, y + 4, { width: 60, align: 'center' });
      doc.text('Completed', 320, y + 4, { width: 60, align: 'center' });
      doc.text('No Show', 390, y + 4, { width: 60, align: 'center' });
      doc.text('Rate', 460, y + 4, { width: 50, align: 'center' });
      y += 22;

      report.salesPeople.forEach((p, idx) => {
        const rate = p.assigned > 0 ? Math.round((p.completed / p.assigned) * 100) : 0;
        if (idx % 2 === 1) doc.rect(48, y, WIDTH, 18).fill('#F5F9FF');
        doc.fillColor('#222').fontSize(9).font('Helvetica').text(p.name, 56, y + 4);
        doc.fillColor('#1F3864').text(String(p.assigned), 250, y + 4, { width: 60, align: 'center' });
        doc.fillColor('#107C10').text(String(p.completed), 320, y + 4, { width: 60, align: 'center' });
        doc.fillColor('#A80000').text(String(p.no_show), 390, y + 4, { width: 60, align: 'center' });
        doc.fillColor(rate >= 70 ? '#107C10' : rate >= 40 ? '#ED7D31' : '#A80000')
          .text(`${rate}%`, 460, y + 4, { width: 50, align: 'center' });
        y += 18;
      });
    }

    // ── Activity Events ──
    y += 16;
    if (doc.y > y) y = doc.y + 16;
    if (y > 680) { doc.addPage(); y = 60; }
    doc.rect(48, y, WIDTH, 22).fill('#2E75B6');
    doc.fillColor('white').fontSize(12).font('Helvetica-Bold').text('Activity Events', 56, y + 5);
    y += 28;
    doc.fillColor('#444').fontSize(9).font('Helvetica').text(`Total Events: ${report.activitySummary.totalEvents}`, 56, y);
    y += 16;

    const sortedAct = Object.entries(report.activitySummary.eventTypes).sort(([, a], [, b]) => b - a);
    if (sortedAct.length === 0) {
      doc.fillColor('#999').font('Helvetica-Oblique').text('No activity recorded.', 56, y);
    } else {
      doc.rect(48, y, WIDTH, 18).fill('#DAEAF7');
      doc.fillColor('#1F3864').fontSize(9).font('Helvetica-Bold');
      doc.text('Event Type', 56, y + 4);
      doc.text('Count', 320, y + 4, { width: 60, align: 'center' });
      doc.text('%', 390, y + 4, { width: 50, align: 'center' });
      y += 22;

      const totalAct = report.activitySummary.totalEvents || 1;
      sortedAct.forEach(([ev, count], idx) => {
        if (y > 720) { doc.addPage(); y = 60; }
        if (idx % 2 === 1) doc.rect(48, y, WIDTH, 18).fill('#F5F9FF');
        doc.fillColor('#222').fontSize(9).font('Helvetica')
          .text(ev.replace(/_/g, ' '), 56, y + 4);
        doc.fillColor('#1F3864').text(String(count), 320, y + 4, { width: 60, align: 'center' });
        doc.fillColor('#555').text(`${Math.round((count / totalAct) * 100)}%`, 390, y + 4, { width: 50, align: 'center' });
        y += 18;
      });
    }

    // Footer
    const pages = (doc as any).bufferedPageRange ? (doc as any).bufferedPageRange().count : 1;
    doc.fontSize(8).fillColor('#999').font('Helvetica')
      .text(`AutoAdvant | Page 1 of ${pages} | Generated ${new Date().toISOString()}`, 48, 760, { width: WIDTH, align: 'center' });

    doc.end();
  });
}

export async function generateDownloadableReport(args: {
  locationId: string;
  reportDate: string;
  format: ReportDispatchFormat;
  reportType?: ReportDispatchType;
}): Promise<DownloadableReport> {
  const report = await buildReportData(args.locationId, args.reportDate);
  if (!report) {
    throw new Error('Location/report data not found');
  }

  const base = makeFileBaseName(report, args.reportType || 'test_drive_daily');

  if (args.format === 'excel') {
    const buffer = await buildExcelBuffer(report);
    return {
      filename: `${base}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    };
  }

  const buffer = await buildPdfBuffer(report);
  return {
    filename: `${base}.pdf`,
    contentType: 'application/pdf',
    buffer,
  };
}

async function resolveRecipients(locationId: string, roles: ReportDispatchRecipientRole[]): Promise<string[]> {
  const location = await Location.findOne({ id: locationId }, { dealer_id: 1 }).lean();
  if (!location) return [];

  const wantedRoles = new Set(roles);
  const emails = new Set<string>();

  if (wantedRoles.has('sales')) {
    const salesRoles = await UserRole.find({ role: 'sales' }, { user_id: 1 }).lean();
    const salesUserIds = salesRoles.map((r: any) => r.user_id).filter(Boolean);
    if (salesUserIds.length) {
      const salesProfiles = await Profile.find(
        {
          user_id: { $in: salesUserIds },
          location_id: locationId,
          is_active: true,
          email: { $ne: null },
        },
        { email: 1 },
      ).lean();
      for (const p of salesProfiles as any[]) {
        if (p.email) emails.add(String(p.email).toLowerCase());
      }
    }
  }

  if (wantedRoles.has('dealer_admin') && location.dealer_id) {
    const dealerAdminRoles = await UserRole.find({ role: 'dealer_admin' }, { user_id: 1 }).lean();
    const dealerAdminUserIds = dealerAdminRoles.map((r: any) => r.user_id).filter(Boolean);

    if (dealerAdminUserIds.length) {
      const dealerLocations = await Location.find({ dealer_id: location.dealer_id }, { id: 1 }).lean();
      const dealerLocationIds = dealerLocations.map((l: any) => l.id).filter(Boolean);

      if (dealerLocationIds.length) {
        const dealerAdminProfiles = await Profile.find(
          {
            user_id: { $in: dealerAdminUserIds },
            location_id: { $in: dealerLocationIds },
            is_active: true,
            email: { $ne: null },
          },
          { email: 1 },
        ).lean();

        for (const p of dealerAdminProfiles as any[]) {
          if (p.email) emails.add(String(p.email).toLowerCase());
        }
      }
    }
  }

  return Array.from(emails);
}

export async function getReportRecipientsPreview(args: {
  locationId: string;
  recipientRoles: ReportDispatchRecipientRole[];
}): Promise<string[]> {
  return resolveRecipients(args.locationId, args.recipientRoles);
}

export async function sendReportToConfiguredRecipients(args: {
  locationId: string;
  reportDate: string;
  reportType?: ReportDispatchType;
  recipientRoles: ReportDispatchRecipientRole[];
  formats: ReportDispatchFormat[];
  actorUserId?: string | null;
}): Promise<{ queued: number; recipients: string[] }> {
  const report = await buildReportData(args.locationId, args.reportDate);
  if (!report) {
    throw new Error('Location/report data not found');
  }

  const recipients = await resolveRecipients(args.locationId, args.recipientRoles);
  if (!recipients.length) {
    return { queued: 0, recipients: [] };
  }

  const attachments: ReportAttachment[] = [];
  for (const format of args.formats) {
    const generated = await generateDownloadableReport({
      locationId: args.locationId,
      reportDate: args.reportDate,
      format,
    });
    attachments.push({
      filename: generated.filename,
      contentType: generated.contentType,
      contentBase64: generated.buffer.toString('base64'),
    });
  }

  const subject = `Daily Report - ${report.location.name} - ${args.reportDate}`;
  const html = generateReportHTML(report);
  const text = `Daily report for ${report.location.name} on ${args.reportDate}. Total test drives: ${report.totalTestDrives}.`;

  for (const to of recipients) {
    await enqueueEmail('transactional_emails', {
      to,
      subject,
      html,
      text,
      label: args.reportType || 'test_drive_daily',
      message_id: randomUUID(),
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: a.contentBase64,
        contentType: a.contentType,
        encoding: 'base64',
      })),
    });

    await logReportAudit({
      action: 'send_queued',
      status: 'success',
      location_id: args.locationId,
      report_type: args.reportType || 'test_drive_daily',
      report_date: args.reportDate,
      format: args.formats.length > 1 ? 'mixed' : (args.formats[0] || 'excel'),
      recipient_email: to,
      actor_user_id: args.actorUserId ?? null,
      message: 'Report email queued',
      metadata: {
        recipient_roles: args.recipientRoles,
        formats: args.formats,
      },
    });
  }

  return { queued: recipients.length, recipients };
}

function nowUtcParts(): { date: string; hhmm: string } {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  return { date, hhmm: `${hh}:${mm}` };
}

export async function processConfiguredReportDispatchJobs(): Promise<{
  processed: number;
  skipped: number;
  failures: number;
}> {
  const { date, hhmm } = nowUtcParts();
  const configs = await ReportDispatchConfig.find({ enabled: true }).lean();

  let processed = 0;
  let skipped = 0;
  let failures = 0;

  for (const cfg of configs as any[]) {
    const sendTime = String(cfg.send_time_utc || '');
    const alreadyDispatched = cfg.last_dispatched_for_date === date;

    if (!sendTime || alreadyDispatched) {
      skipped++;
      continue;
    }

    if (hhmm < sendTime) {
      skipped++;
      continue;
    }

    try {
      const result = await sendReportToConfiguredRecipients({
        locationId: String(cfg.location_id),
        reportDate: date,
        reportType: cfg.report_type as ReportDispatchType,
        recipientRoles: (Array.isArray(cfg.recipient_roles) && cfg.recipient_roles.length
          ? cfg.recipient_roles
          : ['dealer_admin']) as ReportDispatchRecipientRole[],
        formats: (Array.isArray(cfg.formats) && cfg.formats.length ? cfg.formats : ['excel']) as ReportDispatchFormat[],
      });

      await ReportDispatchConfig.updateOne(
        { id: cfg.id },
        { $set: { last_dispatched_for_date: date, updated_at: new Date().toISOString() } },
      );

      await logReportAudit({
        action: 'schedule_dispatch',
        status: 'success',
        location_id: String(cfg.location_id),
        report_type: (cfg.report_type as ReportDispatchType) || 'test_drive_daily',
        report_date: date,
        format: Array.isArray(cfg.formats) && cfg.formats.length > 1 ? 'mixed' : ((cfg.formats?.[0] as any) || 'excel'),
        message: 'Configured report dispatch processed',
        metadata: {
          queued: result.queued,
          recipients: result.recipients,
        },
      });

      processed++;
    } catch (error) {
      await logReportAudit({
        action: 'schedule_dispatch',
        status: 'failed',
        location_id: String(cfg.location_id),
        report_type: (cfg.report_type as ReportDispatchType) || 'test_drive_daily',
        report_date: date,
        format: Array.isArray(cfg.formats) && cfg.formats.length > 1 ? 'mixed' : ((cfg.formats?.[0] as any) || 'excel'),
        message: error instanceof Error ? error.message : String(error),
      });
      failures++;
    }
  }

  return { processed, skipped, failures };
}
