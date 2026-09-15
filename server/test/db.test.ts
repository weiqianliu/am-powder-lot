import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DB } from '../src/db.js';

let db: DB;

beforeEach(() => {
  db = openDatabase(':memory:');
  db.prepare(
    "INSERT INTO batches (batch_no, alloy_grade, particle_size) VALUES ('P-1', 'TC4', '15-53μm')",
  ).run();
  db.prepare(
    `INSERT INTO powder_events (batch_no, event_type, weight_grams, device_no, event_time, raw_line)
     VALUES ('P-1', 'weighing', 100, 'SCALE-01', '2026-09-10 08:30:00', 'P-1,称重,100,SCALE-01,2026-09-10 08:30:00')`,
  ).run();
  db.prepare("INSERT INTO imports (filename, raw_content, record_count) VALUES ('a.csv', 'x', 1)").run();
});

afterEach(() => {
  db.close();
});

describe('原始记录只增不改（数据库触发器兜底）', () => {
  it('禁止 UPDATE powder_events', () => {
    expect(() =>
      db.prepare("UPDATE powder_events SET weight_grams = 999").run(),
    ).toThrow(/只增不改/);
  });

  it('禁止 DELETE powder_events', () => {
    expect(() => db.prepare('DELETE FROM powder_events').run()).toThrow(/只增不改/);
  });

  it('禁止 UPDATE / DELETE imports', () => {
    expect(() => db.prepare("UPDATE imports SET raw_content = '篡改'").run()).toThrow(
      /只增不改/,
    );
    expect(() => db.prepare('DELETE FROM imports').run()).toThrow(/只增不改/);
  });

  it('正常 INSERT 不受影响', () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO powder_events (batch_no, event_type, weight_grams, device_no, event_time, raw_line)
           VALUES ('P-1', 'sieving', 95, 'SIEVE-01', '2026-09-11 08:30:00', 'raw')`,
        )
        .run(),
    ).not.toThrow();
  });
});
