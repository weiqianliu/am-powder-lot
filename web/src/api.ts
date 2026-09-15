import type {
  ApiError,
  Batch,
  ImportResult,
  TimelineResponse,
} from './types';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError,
  ) {
    super(body.message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  const body = (await res.json()) as unknown;
  if (!res.ok) {
    throw new ApiRequestError(res.status, body as ApiError);
  }
  return body as T;
}

export function listBatches(): Promise<{ batches: Batch[] }> {
  return request('/api/batches');
}

export function registerBatch(input: {
  batch_no: string;
  alloy_grade: string;
  particle_size: string;
  arrival_weight_grams: number;
  arrival_time: string;
  device_no?: string;
}): Promise<unknown> {
  return request('/api/batches', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function importRecords(input: {
  filename?: string;
  content: string;
}): Promise<ImportResult> {
  return request('/api/imports', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getTimeline(batchNo: string): Promise<TimelineResponse> {
  return request(`/api/batches/${encodeURIComponent(batchNo)}/events`);
}
