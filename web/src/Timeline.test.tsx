import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Timeline from './pages/Timeline';
import type { TimelineResponse } from './types';

const TIMELINE: TimelineResponse = {
  batch: {
    id: 1,
    batch_no: 'P-2026-001',
    alloy_grade: 'TC4',
    particle_size: '15-53μm',
    created_at: '2026-09-01 08:00:00',
  },
  // 后端已按事件时间排好序；注意 line_no 顺序与时间顺序相反
  events: [
    {
      id: 1,
      batch_no: 'P-2026-001',
      event_type: 'arrival',
      weight_grams: 5000,
      device_no: null,
      event_time: '2026-09-01 09:00:00',
      import_id: null,
      line_no: null,
      raw_line: '{"source":"registration"}',
      created_at: '2026-09-01 08:00:00',
    },
    {
      id: 3,
      batch_no: 'P-2026-001',
      event_type: 'sieving',
      weight_grams: 4950,
      device_no: 'SIEVE-02',
      event_time: '2026-09-03 10:05:00',
      import_id: 1,
      line_no: 5,
      raw_line: 'P-2026-001,筛分,4950.0,SIEVE-02,2026-09-03 10:05:00',
      created_at: '2026-09-03 12:00:00',
    },
    {
      id: 2,
      batch_no: 'P-2026-001',
      event_type: 'weighing',
      weight_grams: 4987.2,
      device_no: 'SCALE-01',
      event_time: '2026-09-05 14:20:00',
      import_id: 1,
      line_no: 2,
      raw_line: 'P-2026-001,称重,4987.2,SCALE-01,2026-09-05 14:20:00',
      created_at: '2026-09-03 12:00:00',
    },
  ],
};

describe('Timeline 页面', () => {
  beforeEach(() => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/batches') {
        return {
          ok: true,
          json: async () => ({ batches: [TIMELINE.batch] }),
        } as Response;
      }
      if (url === '/api/batches/P-2026-001/events') {
        return { ok: true, json: async () => TIMELINE } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('按接口返回的事件时间顺序渲染，并展示原始记录行', async () => {
    render(<Timeline />);

    fireEvent.change(screen.getByPlaceholderText('输入或选择批次号'), {
      target: { value: 'P-2026-001' },
    });
    fireEvent.click(screen.getByRole('button', { name: '查询' }));

    await waitFor(() =>
      expect(screen.getByText('2026-09-05 14:20:00')).toBeInTheDocument(),
    );

    // 表格数据行（跳过表头）按事件时间升序渲染
    const rows = screen.getAllByRole('row').slice(1);
    const times = rows.map((r) => r.textContent ?? '');
    expect(times[0]).toContain('2026-09-01 09:00:00');
    expect(times[1]).toContain('2026-09-03 10:05:00');
    expect(times[2]).toContain('2026-09-05 14:20:00');

    // 原始记录行原样展示
    expect(
      screen.getByText('P-2026-001,筛分,4950.0,SIEVE-02,2026-09-03 10:05:00'),
    ).toBeInTheDocument();
    // 批次信息
    expect(screen.getByText('TC4')).toBeInTheDocument();
    expect(screen.getByText('15-53μm')).toBeInTheDocument();
  });
});
