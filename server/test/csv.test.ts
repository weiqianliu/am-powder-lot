import { describe, expect, it } from 'vitest';
import {
  normalizeEventTime,
  normalizeEventType,
  parseCsvLine,
  parseImportText,
} from '../src/csv.js';

describe('normalizeEventType', () => {
  it('接受中英文事件类型', () => {
    expect(normalizeEventType('称重')).toBe('weighing');
    expect(normalizeEventType('Weighing')).toBe('weighing');
    expect(normalizeEventType(' 筛分 ')).toBe('sieving');
    expect(normalizeEventType('SIEVING')).toBe('sieving');
    expect(normalizeEventType('熔炼')).toBeNull();
  });
});

describe('normalizeEventTime', () => {
  it('归一化合法时间', () => {
    expect(normalizeEventTime('2026-09-10 08:30:00')).toBe('2026-09-10 08:30:00');
    expect(normalizeEventTime('2026-09-10 08:30')).toBe('2026-09-10 08:30:00');
    expect(normalizeEventTime('2026-09-10T08:30:05')).toBe('2026-09-10 08:30:05');
  });

  it('拒绝不存在或格式非法的时间', () => {
    expect(normalizeEventTime('2026-02-30 08:30:00')).toBeNull();
    expect(normalizeEventTime('2026-13-01 08:30:00')).toBeNull();
    expect(normalizeEventTime('2026-09-10 25:30:00')).toBeNull();
    expect(normalizeEventTime('10/09/2026 08:30')).toBeNull();
    expect(normalizeEventTime('')).toBeNull();
  });
});

describe('parseCsvLine', () => {
  it('处理普通行与带引号的行', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
    expect(parseCsvLine('"a,b",c,"d""e"')).toEqual(['a,b', 'c', 'd"e']);
  });
});

describe('parseImportText', () => {
  it('解析带表头的合法文件', () => {
    const text = [
      'batch_no,event_type,weight_grams,device_no,event_time',
      'P-001,称重,1250.5,SCALE-01,2026-09-10 08:30:00',
      'P-001,筛分,1240.0,SIEVE-02,2026-09-10T09:00',
    ].join('\n');
    const { records, errors } = parseImportText(text);
    expect(errors).toEqual([]);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      lineNo: 2,
      rawLine: 'P-001,称重,1250.5,SCALE-01,2026-09-10 08:30:00',
      batchNo: 'P-001',
      eventType: 'weighing',
      weightGrams: 1250.5,
      deviceNo: 'SCALE-01',
      eventTime: '2026-09-10 08:30:00',
    });
    expect(records[1]!.eventTime).toBe('2026-09-10 09:00:00');
  });

  it('也接受无表头的文件', () => {
    const { records, errors } = parseImportText(
      'P-001,称重,100,SCALE-01,2026-09-10 08:30:00',
    );
    expect(errors).toEqual([]);
    expect(records).toHaveLength(1);
    expect(records[0]!.lineNo).toBe(1);
  });

  it('逐行报错并带上行号，不中断解析', () => {
    const text = [
      'batch_no,event_type,weight_grams,device_no,event_time',
      'P-001,称重,100,SCALE-01,2026-09-10 08:30:00',
      'P-001,熔炼,100,SCALE-01,2026-09-10 08:30:00',
      'P-001,称重,-5,SCALE-01,2026-09-10 08:30:00',
      'P-001,称重,100,SCALE-01,不是时间',
      'P-001,称重,100',
    ].join('\n');
    const { records, errors } = parseImportText(text);
    expect(records).toHaveLength(1);
    expect(errors.map((e) => e.lineNo)).toEqual([3, 4, 5, 6]);
    expect(errors.every((e) => e.rawLine.length > 0 && e.message.length > 0)).toBe(true);
  });
});
