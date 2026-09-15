import type { EventType } from './types';

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  arrival: '新粉到货',
  weighing: '称重',
  sieving: '筛分',
};

export function eventTypeLabel(t: EventType): string {
  return EVENT_TYPE_LABELS[t] ?? t;
}

/** 重量显示：克，去掉多余的尾零 */
export function formatWeight(grams: number): string {
  return `${Number(grams.toFixed(3))} g`;
}

/** 事件来源描述：批次登记 / 某次导入的第几行 */
export function eventSource(e: { import_id: number | null; line_no: number | null }): string {
  if (e.import_id == null) return '批次登记';
  return `导入 #${e.import_id} · 第 ${e.line_no ?? '?'} 行`;
}

/** datetime-local 输入框的值 (YYYY-MM-DDTHH:mm) → 后端接受的格式 */
export function datetimeLocalToApi(value: string): string {
  return value.replace('T', ' ');
}

/** 当前时间的 datetime-local 输入框默认值 */
export function nowForDatetimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
