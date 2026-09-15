/** 与后端共享的类型定义 */

export interface Batch {
  id: number;
  batch_no: string;
  alloy_grade: string;
  particle_size: string;
  created_at: string;
}

export type EventType = 'arrival' | 'weighing' | 'sieving';

export interface PowderEvent {
  id: number;
  batch_no: string;
  event_type: EventType;
  weight_grams: number;
  device_no: string | null;
  event_time: string;
  import_id: number | null;
  line_no: number | null;
  raw_line: string;
  created_at: string;
}

export interface TimelineResponse {
  batch: Batch;
  events: PowderEvent[];
}

export interface ImportLineError {
  lineNo: number;
  rawLine: string;
  message: string;
}

export interface ImportResult {
  import_id: number;
  filename: string | null;
  record_count: number;
}

export interface ApiError {
  error: string;
  message: string;
  details?: ImportLineError[];
}
