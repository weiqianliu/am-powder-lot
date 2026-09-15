/**
 * 称重 / 筛分记录的 CSV 解析与校验。
 * 文件格式（首行表头可有可无）：
 *   batch_no,event_type,weight_grams,device_no,event_time
 * 事件类型接受：称重 / weighing，筛分 / sieving（大小写不敏感）。
 * 时间接受：YYYY-MM-DD HH:MM[:SS] 或 YYYY-MM-DDTHH:MM[:SS]。
 */

export type ImportedEventType = 'weighing' | 'sieving';

export interface ParsedRecord {
  lineNo: number; // 原始文件中的物理行号（从 1 开始，含表头）
  rawLine: string; // 原始行内容，原样保存
  batchNo: string;
  eventType: ImportedEventType;
  weightGrams: number;
  deviceNo: string;
  eventTime: string; // 归一化 'YYYY-MM-DD HH:MM:SS'
}

export interface LineError {
  lineNo: number;
  rawLine: string;
  message: string;
}

const EVENT_TYPE_ALIASES: Record<string, ImportedEventType> = {
  称重: 'weighing',
  weighing: 'weighing',
  weigh: 'weighing',
  筛分: 'sieving',
  sieving: 'sieving',
  sieve: 'sieving',
};

export function normalizeEventType(raw: string): ImportedEventType | null {
  return EVENT_TYPE_ALIASES[raw.trim().toLowerCase()] ?? null;
}

const TIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

/** 归一化时间为 'YYYY-MM-DD HH:MM:SS'；非法返回 null。 */
export function normalizeEventTime(raw: string): string | null {
  const m = TIME_RE.exec(raw.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s ?? '0');
  // 用 Date 校验是否真实存在（如 2 月 30 日）
  const dt = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day ||
    dt.getUTCHours() !== hour ||
    dt.getUTCMinutes() !== minute ||
    dt.getUTCSeconds() !== second
  ) {
    return null;
  }
  return `${y}-${mo}-${d} ${h}:${mi}:${(s ?? '00').padStart(2, '0')}`;
}

/** 按 RFC 4180 风格解析一行 CSV（支持双引号包裹与转义）。 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function isHeaderRow(fields: string[]): boolean {
  return fields[0]?.trim().toLowerCase() === 'batch_no';
}

export interface ParseResult {
  records: ParsedRecord[];
  errors: LineError[];
}

/** 解析整个导入文本；任何一行有问题都会出现在 errors 里（不会因首错而中断）。 */
export function parseImportText(content: string): ParseResult {
  const records: ParsedRecord[] = [];
  const errors: LineError[] = [];
  const lines = content.split(/\r\n|\r|\n/);

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const rawLine = line;
    if (line.trim() === '') return; // 跳过空行

    const fields = parseCsvLine(line).map((f) => f.trim());
    if (lineNo === 1 && isHeaderRow(fields)) return; // 跳过表头

    if (fields.length !== 5) {
      errors.push({
        lineNo,
        rawLine,
        message: `应为 5 列（batch_no,event_type,weight_grams,device_no,event_time），实际 ${fields.length} 列`,
      });
      return;
    }

    const [batchNo, eventTypeRaw, weightRaw, deviceNo, eventTimeRaw] = fields as [
      string,
      string,
      string,
      string,
      string,
    ];

    if (!batchNo) {
      errors.push({ lineNo, rawLine, message: '批次号为空' });
      return;
    }
    const eventType = normalizeEventType(eventTypeRaw);
    if (!eventType) {
      errors.push({
        lineNo,
        rawLine,
        message: `未知事件类型「${eventTypeRaw}」，应为 称重/weighing 或 筛分/sieving`,
      });
      return;
    }
    const weightGrams = Number(weightRaw);
    if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
      errors.push({ lineNo, rawLine, message: `重量「${weightRaw}」不是正数` });
      return;
    }
    if (!deviceNo) {
      errors.push({ lineNo, rawLine, message: '设备号为空' });
      return;
    }
    const eventTime = normalizeEventTime(eventTimeRaw);
    if (!eventTime) {
      errors.push({
        lineNo,
        rawLine,
        message: `事件时间「${eventTimeRaw}」格式非法，应为 YYYY-MM-DD HH:MM[:SS]`,
      });
      return;
    }

    records.push({ lineNo, rawLine, batchNo, eventType, weightGrams, deviceNo, eventTime });
  });

  return { records, errors };
}
