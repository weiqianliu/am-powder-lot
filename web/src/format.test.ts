import { describe, expect, it } from 'vitest';
import {
  datetimeLocalToApi,
  eventSource,
  eventTypeLabel,
  formatWeight,
  nowForDatetimeLocal,
} from './format';

describe('eventTypeLabel', () => {
  it('映射为中文标签', () => {
    expect(eventTypeLabel('arrival')).toBe('新粉到货');
    expect(eventTypeLabel('weighing')).toBe('称重');
    expect(eventTypeLabel('sieving')).toBe('筛分');
  });
});

describe('formatWeight', () => {
  it('去掉尾零并带单位', () => {
    expect(formatWeight(4950)).toBe('4950 g');
    expect(formatWeight(4820.1)).toBe('4820.1 g');
    expect(formatWeight(100.125)).toBe('100.125 g');
  });
});

describe('eventSource', () => {
  it('区分登记事件与导入事件', () => {
    expect(eventSource({ import_id: null, line_no: null })).toBe('批次登记');
    expect(eventSource({ import_id: 7, line_no: 12 })).toBe('导入 #7 · 第 12 行');
  });
});

describe('时间输入转换', () => {
  it('datetime-local 值转后端格式', () => {
    expect(datetimeLocalToApi('2026-09-15T08:30')).toBe('2026-09-15 08:30');
  });

  it('默认时间值是合法的 datetime-local 格式', () => {
    expect(nowForDatetimeLocal()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
