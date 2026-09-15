import Fastify, { type FastifyInstance } from 'fastify';
import type { DB } from './db.js';
import { normalizeEventTime, parseImportText, type LineError } from './csv.js';

interface BatchRow {
  id: number;
  batch_no: string;
  alloy_grade: string;
  particle_size: string;
  created_at: string;
}

interface EventRow {
  id: number;
  batch_no: string;
  event_type: 'arrival' | 'weighing' | 'sieving';
  weight_grams: number;
  device_no: string | null;
  event_time: string;
  import_id: number | null;
  line_no: number | null;
  raw_line: string;
  created_at: string;
}

const registerBodySchema = {
  type: 'object',
  required: ['batch_no', 'alloy_grade', 'particle_size', 'arrival_weight_grams', 'arrival_time'],
  additionalProperties: false,
  properties: {
    batch_no: { type: 'string', minLength: 1, maxLength: 100 },
    alloy_grade: { type: 'string', minLength: 1, maxLength: 100 },
    particle_size: { type: 'string', minLength: 1, maxLength: 100 },
    arrival_weight_grams: { type: 'number', exclusiveMinimum: 0 },
    arrival_time: { type: 'string', minLength: 1 },
    device_no: { type: 'string', maxLength: 100 },
  },
} as const;

const importBodySchema = {
  type: 'object',
  required: ['content'],
  additionalProperties: false,
  properties: {
    filename: { type: 'string', maxLength: 255 },
    content: { type: 'string', minLength: 1 },
  },
} as const;

export function buildApp(db: DB): FastifyInstance {
  const app = Fastify({ logger: false });

  // 同源部署（nginx / vite 代理）下用不到 CORS，这里放开仅方便直连调试
  app.addHook('onSend', async (_req, reply) => {
    reply.header('access-control-allow-origin', '*');
  });

  app.get('/api/health', async () => ({ ok: true }));

  // ---------- 批次基础登记（含新粉到货事件） ----------
  app.post('/api/batches', { schema: { body: registerBodySchema } }, async (req, reply) => {
    const body = req.body as {
      batch_no: string;
      alloy_grade: string;
      particle_size: string;
      arrival_weight_grams: number;
      arrival_time: string;
      device_no?: string;
    };

    const arrivalTime = normalizeEventTime(body.arrival_time);
    if (!arrivalTime) {
      return reply.code(400).send({
        error: 'invalid_arrival_time',
        message: `到货时间「${body.arrival_time}」格式非法，应为 YYYY-MM-DD HH:MM[:SS]`,
      });
    }

    const existing = db
      .prepare('SELECT id FROM batches WHERE batch_no = ?')
      .get(body.batch_no.trim());
    if (existing) {
      return reply
        .code(409)
        .send({ error: 'batch_exists', message: `批次 ${body.batch_no} 已登记` });
    }

    const deviceNo = body.device_no?.trim() || null;
    const rawLine = JSON.stringify({
      source: 'registration',
      batch_no: body.batch_no.trim(),
      alloy_grade: body.alloy_grade.trim(),
      particle_size: body.particle_size.trim(),
      arrival_weight_grams: body.arrival_weight_grams,
      arrival_time: arrivalTime,
      device_no: deviceNo,
    });

    const tx = db.transaction(() => {
      db.prepare(
        'INSERT INTO batches (batch_no, alloy_grade, particle_size) VALUES (?, ?, ?)',
      ).run(body.batch_no.trim(), body.alloy_grade.trim(), body.particle_size.trim());
      db.prepare(
        `INSERT INTO powder_events
           (batch_no, event_type, weight_grams, device_no, event_time, import_id, line_no, raw_line)
         VALUES (?, 'arrival', ?, ?, ?, NULL, NULL, ?)`,
      ).run(body.batch_no.trim(), body.arrival_weight_grams, deviceNo, arrivalTime, rawLine);
    });
    tx();

    return reply.code(201).send({
      batch_no: body.batch_no.trim(),
      alloy_grade: body.alloy_grade.trim(),
      particle_size: body.particle_size.trim(),
      arrival: {
        event_type: 'arrival',
        weight_grams: body.arrival_weight_grams,
        device_no: deviceNo,
        event_time: arrivalTime,
      },
    });
  });

  app.get('/api/batches', async () => {
    const rows = db
      .prepare('SELECT * FROM batches ORDER BY batch_no ASC')
      .all() as BatchRow[];
    return { batches: rows };
  });

  // ---------- 导入称重 / 筛分记录 ----------
  app.post('/api/imports', { schema: { body: importBodySchema } }, async (req, reply) => {
    const body = req.body as { filename?: string; content: string };
    const { records, errors } = parseImportText(body.content);

    if (records.length === 0 && errors.length === 0) {
      return reply
        .code(400)
        .send({ error: 'empty_import', message: '文件中没有可导入的记录' });
    }

    // 语义校验：批次必须已登记、不能与历史记录或文件内部重复
    const semanticErrors: LineError[] = [];
    const seenInFile = new Set<string>();
    const findBatch = db.prepare('SELECT id FROM batches WHERE batch_no = ?');
    const findDup = db.prepare(
      `SELECT id FROM powder_events
       WHERE batch_no = ? AND event_type = ? AND weight_grams = ?
         AND ifnull(device_no, '') = ? AND event_time = ?`,
    );
    for (const r of records) {
      if (!findBatch.get(r.batchNo)) {
        semanticErrors.push({
          lineNo: r.lineNo,
          rawLine: r.rawLine,
          message: `批次 ${r.batchNo} 尚未登记，请先在「批次登记」页建档`,
        });
        continue;
      }
      const key = `${r.batchNo}|${r.eventType}|${r.weightGrams}|${r.deviceNo}|${r.eventTime}`;
      if (seenInFile.has(key)) {
        semanticErrors.push({
          lineNo: r.lineNo,
          rawLine: r.rawLine,
          message: '与本文件内前面的行重复',
        });
        continue;
      }
      seenInFile.add(key);
      if (findDup.get(r.batchNo, r.eventType, r.weightGrams, r.deviceNo, r.eventTime)) {
        semanticErrors.push({
          lineNo: r.lineNo,
          rawLine: r.rawLine,
          message: '与已入库的历史记录完全一致（疑似重复导入）',
        });
      }
    }

    const allErrors = [...errors, ...semanticErrors];
    if (allErrors.length > 0) {
      // 全部或部分有错：整批拒绝，不入库任何一行
      return reply.code(400).send({
        error: 'import_rejected',
        message: `共 ${allErrors.length} 行存在问题，整批未导入`,
        details: allErrors.sort((a, b) => a.lineNo - b.lineNo),
      });
    }

    const tx = db.transaction(() => {
      const info = db
        .prepare('INSERT INTO imports (filename, raw_content, record_count) VALUES (?, ?, ?)')
        .run(body.filename ?? null, body.content, records.length);
      const importId = Number(info.lastInsertRowid);
      const insertEvent = db.prepare(
        `INSERT INTO powder_events
           (batch_no, event_type, weight_grams, device_no, event_time, import_id, line_no, raw_line)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const r of records) {
        insertEvent.run(
          r.batchNo,
          r.eventType,
          r.weightGrams,
          r.deviceNo,
          r.eventTime,
          importId,
          r.lineNo,
          r.rawLine,
        );
      }
      return importId;
    });
    const importId = tx();

    return reply.code(201).send({
      import_id: importId,
      filename: body.filename ?? null,
      record_count: records.length,
    });
  });

  // 原始文件内容原样取回（证明未改写）
  app.get('/api/imports/:id/raw', async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = db
      .prepare('SELECT raw_content FROM imports WHERE id = ?')
      .get(Number(id)) as { raw_content: string } | undefined;
    if (!row) {
      return reply.code(404).send({ error: 'not_found', message: '导入批次不存在' });
    }
    return reply.type('text/plain; charset=utf-8').send(row.raw_content);
  });

  // ---------- 批次事件时间轴（按事件时间排序，不是文件行序） ----------
  app.get('/api/batches/:batchNo/events', async (req, reply) => {
    const { batchNo } = req.params as { batchNo: string };
    const batch = db
      .prepare('SELECT * FROM batches WHERE batch_no = ?')
      .get(batchNo) as BatchRow | undefined;
    if (!batch) {
      return reply
        .code(404)
        .send({ error: 'not_found', message: `批次 ${batchNo} 不存在` });
    }
    const events = db
      .prepare(
        `SELECT * FROM powder_events
         WHERE batch_no = ?
         ORDER BY event_time ASC, id ASC`,
      )
      .all(batchNo) as EventRow[];
    return { batch, events };
  });

  return app;
}
