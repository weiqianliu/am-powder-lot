import { useEffect, useState, type FormEvent } from 'react';
import { ApiRequestError, getTimeline, listBatches } from '../api';
import { eventSource, eventTypeLabel, formatWeight } from '../format';
import type { TimelineResponse } from '../types';

/** 按批次查询事件时间轴（后端按事件时间排序返回） */
export default function Timeline() {
  const [batchNos, setBatchNos] = useState<string[]>([]);
  const [batchNo, setBatchNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBatches()
      .then((res) => setBatchNos(res.batches.map((b) => b.batch_no)))
      .catch(() => setBatchNos([]));
  }, []);

  async function onQuery(e: FormEvent) {
    e.preventDefault();
    const no = batchNo.trim();
    if (!no) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      setData(await getTimeline(no));
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.body.message : '网络错误，请确认后端已启动',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>批次事件时间轴</h2>
      <form onSubmit={onQuery} className="form inline">
        <label>
          批次号
          <input
            list="batch-nos"
            value={batchNo}
            onChange={(e) => setBatchNo(e.target.value)}
            placeholder="输入或选择批次号"
            required
          />
          <datalist id="batch-nos">
            {batchNos.map((no) => (
              <option key={no} value={no} />
            ))}
          </datalist>
        </label>
        <button type="submit" disabled={loading}>
          {loading ? '查询中…' : '查询'}
        </button>
      </form>

      {error && (
        <p className="msg err" role="alert">
          {error}
        </p>
      )}

      {data && (
        <>
          <div className="batch-card">
            <div>
              <span className="label">批次号</span>
              <b>{data.batch.batch_no}</b>
            </div>
            <div>
              <span className="label">合金牌号</span>
              <b>{data.batch.alloy_grade}</b>
            </div>
            <div>
              <span className="label">粒度档</span>
              <b>{data.batch.particle_size}</b>
            </div>
            <div>
              <span className="label">事件数</span>
              <b>{data.events.length}</b>
            </div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>事件时间</th>
                <th>事件类型</th>
                <th>重量</th>
                <th>设备号</th>
                <th>来源</th>
                <th>原始记录</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((ev, i) => (
                <tr key={ev.id}>
                  <td>{i + 1}</td>
                  <td>{ev.event_time}</td>
                  <td>
                    <span className={`tag tag-${ev.event_type}`}>
                      {eventTypeLabel(ev.event_type)}
                    </span>
                  </td>
                  <td className="num">{formatWeight(ev.weight_grams)}</td>
                  <td>{ev.device_no ?? '—'}</td>
                  <td>{eventSource(ev)}</td>
                  <td>
                    <code className="raw">{ev.raw_line}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
