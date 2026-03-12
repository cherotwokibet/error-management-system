const router = require('express').Router();
const ExcelJS = require('exceljs');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const buildQuery = (query) => {
  const { search, channel, category, resolution, dateFrom, dateTo } = query;
  const conditions = [];
  const params = [];

  if (search)     { params.push(search);     conditions.push(`e.search_vector @@ plainto_tsquery('english', $${params.length})`); }
  if (channel)    { params.push(channel);    conditions.push(`e.channel = $${params.length}`); }
  if (category)   { params.push(category);   conditions.push(`e.category = $${params.length}`); }
  if (resolution) { params.push(resolution); conditions.push(`e.resolution = $${params.length}`); }
  if (dateFrom)   { params.push(dateFrom);   conditions.push(`e.created_at >= $${params.length}`); }
  if (dateTo)     { params.push(dateTo);     conditions.push(`e.created_at <= $${params.length}`); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  return { where, params };
};

// GET /api/export/errors.csv
router.get('/errors.csv', authenticate, async (req, res) => {
  const { where, params } = buildQuery(req.query);
  const { rows } = await pool.query(
    `SELECT e.id, e.error_details, e.channel, e.category, e.resolution, e.ticket,
            u.username AS created_by, a.username AS assigned_to,
            e.created_at, e.updated_at,
            (SELECT COUNT(*) FROM comments c WHERE c.error_id = e.id) AS comment_count
     FROM errors e
     LEFT JOIN users u ON u.id = e.created_by
     LEFT JOIN users a ON a.id = e.assigned_to
     ${where} ORDER BY e.created_at DESC`,
    params
  );

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="errors_${Date.now()}.csv"`);

  const headers = ['ID','Error Details','Channel','Category','Resolution','Ticket','Created By','Assigned To','Created At','Updated At','Comments'];
  const csvRows = [
    headers.join(','),
    ...rows.map(r => [
      r.id,
      `"${(r.error_details||'').replace(/"/g,'""')}"`,
      r.channel,
      r.category,
      r.resolution,
      r.ticket || '',
      r.created_by || '',
      r.assigned_to || '',
      r.created_at?.toISOString() || '',
      r.updated_at?.toISOString() || '',
      r.comment_count,
    ].join(','))
  ];

  res.send(csvRows.join('\n'));
});

// GET /api/export/errors.xlsx
router.get('/errors.xlsx', authenticate, async (req, res) => {
  const { where, params } = buildQuery(req.query);
  const { rows } = await pool.query(
    `SELECT e.id, e.error_details, e.channel, e.category, e.resolution, e.ticket,
            u.username AS created_by, a.username AS assigned_to,
            e.created_at, e.updated_at,
            (SELECT COUNT(*) FROM comments c WHERE c.error_id = e.id) AS comment_count
     FROM errors e
     LEFT JOIN users u ON u.id = e.created_by
     LEFT JOIN users a ON a.id = e.assigned_to
     ${where} ORDER BY e.created_at DESC`,
    params
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Errors');

  sheet.columns = [
    { header: 'ID',            key: 'id',            width: 38 },
    { header: 'Error Details', key: 'error_details', width: 60 },
    { header: 'Channel',       key: 'channel',       width: 12 },
    { header: 'Category',      key: 'category',      width: 15 },
    { header: 'Resolution',    key: 'resolution',    width: 14 },
    { header: 'Ticket',        key: 'ticket',        width: 20 },
    { header: 'Created By',    key: 'created_by',    width: 18 },
    { header: 'Assigned To',   key: 'assigned_to',   width: 18 },
    { header: 'Created At',    key: 'created_at',    width: 22 },
    { header: 'Updated At',    key: 'updated_at',    width: 22 },
    { header: 'Comments',      key: 'comment_count', width: 10 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1f2e' } };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  const statusColors = { 'Open': 'FFEF4444', 'In Progress': 'FFF59E0B', 'Resolved': 'FF10B981', 'Closed': 'FF6B7280' };

  rows.forEach(row => {
    const r = sheet.addRow(row);
    const resCell = r.getCell('resolution');
    resCell.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: statusColors[row.resolution] || 'FFFFFFFF' }
    };
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="errors_${Date.now()}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;
