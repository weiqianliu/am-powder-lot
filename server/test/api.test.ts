import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDatabase, type DB } from '../src/db.js';
import { buildApp } from '../src/app.js';

let db: DB;
let app: FastifyInstance;

beforeEach(async () => {
  db = openDatabase(':memory:');
  app = buildApp(db);
  await app.ready();
});

afterEach(async () => {
  await app.close();
  db.close();
});

async function registerBatch(batchNo = 'P-2026-001') {
  return app.inject({
    method: 'POST',
    url: '/api/batches',
    payload: {
      batch_no: batchNo,
      alloy_grade: 'TC4',
      particle_size: '15-53μm',
      arrival_weight_grams: 5000,
      arrival_time: '2026-09-01 09:00:00',
    },
  });
}

describe('批次登记', () => {
  it('登记批次并自动生成新粉到货事件', async () => {
    const res = await registerBatch();
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.batch_no).toBe('P-2026-001');
    expect(body.arrival).toMatchObject({
      event_type: 'arrival',
      weight_grams: 5000,
      event_time: '2026-09-01 09:00:00',
    });

    const timeline = await app.inject({ url: '/api/batches/P-2026-001/events' });
    expect(timeline.statusCode).toBe(200);
    expect(timeline.json().events).toHaveLength(1);
    expect(timeline.json().events[0].event_type).toBe('arrival');
  });

  it('重复批次号返回 409', async () => {
    await registerBatch();
    const res = await registerBatch();
    expect(res.statusCode).toBe(409);
  });

  it('缺少必填字段返回 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/batches',
      payload: { batch_no: 'X' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('导入称重/筛分记录', () => {
  it('导入成功后可按导入 id 原样取回文件内容', async () => {
    await registerBatch();
    const content = [
      'batch_no,event_type,weight_grams,device_no,event_time',
      'P-2026-001,称重,4987.2,SCALE-01,2026-09-05 14:20:00',
      'P-2026-001,筛分,4950.0,SIEVE-02,2026-09-03 10:05:00',
    ].join('\n');

    const res = await app.inject({
      method: 'POST',
      url: '/api/imports',
      payload: { filename: 'records.csv', content },
    });
    expect(res.statusCode).toBe(201);
    const { import_id, record_count } = res.json();
    expect(record_count).toBe(2);

    const raw = await app.inject({ url: `/api/imports/${import_id}/raw` });
    expect(raw.statusCode).toBe(200);
    expect(raw.body).toBe(content); // 一字不改
  });

  it('未登记的批次整批拒绝，并给出行号明细', async () => {
    const content = 'P-UNKNOWN,称重,100,SCALE-01,2026-09-05 14:20:00';
    const res = await app.inject({
      method: 'POST',
      url: '/api/imports',
      payload: { content },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.details).toHaveLength(1);
    expect(body.details[0].lineNo).toBe(1);
    expect(body.details[0].message).toContain('尚未登记');
    // 什么都没入库
    const count = db.prepare('SELECT COUNT(*) AS n FROM powder_events').get() as {
      n: number;
    };
    expect(count.n).toBe(0);
  });

  it('任何一行有错则整批回滚', async () => {
    await registerBatch();
    const content = [
      'P-2026-001,称重,100,SCALE-01,2026-09-05 14:20:00',
      'P-2026-001,称重,坏数据,SCALE-01,2026-09-05 14:21:00',
    ].join('\n');
    const res = await app.inject({
      method: 'POST',
      url: '/api/imports',
      payload: { content },
    });
    expect(res.statusCode).toBe(400);
    const events = db.prepare('SELECT COUNT(*) AS n FROM powder_events').get() as {
      n: number;
    };
    expect(events.n).toBe(1); // 只剩登记时的到货事件
  });

  it('重复导入同一文件被拒绝', async () => {
    await registerBatch();
    const content = 'P-2026-001,称重,100,SCALE-01,2026-09-05 14:20:00';
    const first = await app.inject({
      method: 'POST',
      url: '/api/imports',
      payload: { content },
    });
    expect(first.statusCode).toBe(201);
    const second = await app.inject({
      method: 'POST',
      url: '/api/imports',
      payload: { content },
    });
    expect(second.statusCode).toBe(400);
    expect(second.json().details[0].message).toContain('重复');
  });
});

describe('批次事件时间轴', () => {
  it('按事件时间排序，而不是文件行序', async () => {
    await registerBatch(); // 到货事件 2026-09-01 09:00:00
    // 故意让文件行序与时间顺序相反
    const content = [
      'batch_no,event_type,weight_grams,device_no,event_time',
      'P-2026-001,称重,4820.1,SCALE-03,2026-09-12 16:40:00',
      'P-2026-001,筛分,4905.6,SIEVE-02,2026-09-08 09:15:00',
      'P-2026-001,称重,4987.2,SCALE-01,2026-09-05 14:20:00',
      'P-2026-001,筛分,4950.0,SIEVE-02,2026-09-03 10:05:00',
    ].join('\n');
    const imp = await app.inject({
      method: 'POST',
      url: '/api/imports',
      payload: { content },
    });
    expect(imp.statusCode).toBe(201);

    const res = await app.inject({ url: '/api/batches/P-2026-001/events' });
    expect(res.statusCode).toBe(200);
    const { events } = res.json();
    expect(events).toHaveLength(5);
    const times = events.map((e: { event_time: string }) => e.event_time);
    expect(times).toEqual([
      '2026-09-01 09:00:00', // 新粉到货
      '2026-09-03 10:05:00',
      '2026-09-05 14:20:00',
      '2026-09-08 09:15:00',
      '2026-09-12 16:40:00',
    ]);
    // 原始行原样保留
    expect(events[1].raw_line).toBe('P-2026-001,筛分,4950.0,SIEVE-02,2026-09-03 10:05:00');
    // 文件行号也保留用于溯源
    expect(events[1].line_no).toBe(5);
  });

  it('查询不存在的批次返回 404', async () => {
    const res = await app.inject({ url: '/api/batches/NOPE/events' });
    expect(res.statusCode).toBe(404);
  });
});
