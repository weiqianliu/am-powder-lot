import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type DB = Database.Database;

/**
 * 打开（必要时创建）数据库并执行迁移。
 * 传 ':memory:' 可得到独立的内存库，供测试使用。
 */
export function openDatabase(path: string): DB {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: DB): void {
  db.exec(`
    -- 批次基础登记
    CREATE TABLE IF NOT EXISTS batches (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no      TEXT NOT NULL UNIQUE,          -- 批次号
      alloy_grade   TEXT NOT NULL,                 -- 合金牌号
      particle_size TEXT NOT NULL,                 -- 粒度档
      created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 导入批次：原始文件内容原样留存
    CREATE TABLE IF NOT EXISTS imports (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      filename     TEXT,
      raw_content  TEXT NOT NULL,                  -- 原始文件内容，一字不改
      record_count INTEGER NOT NULL,
      imported_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 粉末事件（称重 / 筛分 / 新粉到货），只允许追加
    CREATE TABLE IF NOT EXISTS powder_events (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no     TEXT NOT NULL REFERENCES batches(batch_no),
      event_type   TEXT NOT NULL CHECK (event_type IN ('arrival', 'weighing', 'sieving')),
      weight_grams REAL NOT NULL CHECK (weight_grams > 0),
      device_no    TEXT,                           -- 到货登记时可为空
      event_time   TEXT NOT NULL,                  -- 归一化为 'YYYY-MM-DD HH:MM:SS'
      import_id    INTEGER REFERENCES imports(id),
      line_no      INTEGER,                        -- 原始文件中的行号（仅溯源用，不作排序依据）
      raw_line     TEXT NOT NULL,                  -- 原始记录行，原样保存
      created_at   TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 防止同一记录被重复导入
    CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedup
      ON powder_events (batch_no, event_type, weight_grams, ifnull(device_no, ''), event_time);

    CREATE INDEX IF NOT EXISTS idx_events_batch_time
      ON powder_events (batch_no, event_time);

    -- 原始记录不许改写：数据库层面禁止 UPDATE / DELETE
    CREATE TRIGGER IF NOT EXISTS trg_events_no_update
      BEFORE UPDATE ON powder_events
      BEGIN SELECT RAISE(ABORT, 'powder_events 为只增不改表，禁止 UPDATE'); END;

    CREATE TRIGGER IF NOT EXISTS trg_events_no_delete
      BEFORE DELETE ON powder_events
      BEGIN SELECT RAISE(ABORT, 'powder_events 为只增不改表，禁止 DELETE'); END;

    CREATE TRIGGER IF NOT EXISTS trg_imports_no_update
      BEFORE UPDATE ON imports
      BEGIN SELECT RAISE(ABORT, 'imports 为只增不改表，禁止 UPDATE'); END;

    CREATE TRIGGER IF NOT EXISTS trg_imports_no_delete
      BEFORE DELETE ON imports
      BEGIN SELECT RAISE(ABORT, 'imports 为只增不改表，禁止 DELETE'); END;
  `);
}
