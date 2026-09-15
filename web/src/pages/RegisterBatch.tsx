import { useState, type FormEvent } from 'react';
import { ApiRequestError, registerBatch } from '../api';
import { datetimeLocalToApi, nowForDatetimeLocal } from '../format';

/** 批次基础登记：合金牌号、粒度档、新粉到货 */
export default function RegisterBatch() {
  const [batchNo, setBatchNo] = useState('');
  const [alloyGrade, setAlloyGrade] = useState('');
  const [particleSize, setParticleSize] = useState('');
  const [weight, setWeight] = useState('');
  const [arrivalTime, setArrivalTime] = useState(nowForDatetimeLocal());
  const [deviceNo, setDeviceNo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      await registerBatch({
        batch_no: batchNo.trim(),
        alloy_grade: alloyGrade.trim(),
        particle_size: particleSize.trim(),
        arrival_weight_grams: Number(weight),
        arrival_time: datetimeLocalToApi(arrivalTime),
        device_no: deviceNo.trim() || undefined,
      });
      setMessage({ ok: true, text: `批次 ${batchNo.trim()} 登记成功，已记录新粉到货事件` });
      setBatchNo('');
      setAlloyGrade('');
      setParticleSize('');
      setWeight('');
      setDeviceNo('');
    } catch (err) {
      const text =
        err instanceof ApiRequestError ? err.body.message : '网络错误，请确认后端已启动';
      setMessage({ ok: false, text });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h2>批次基础登记</h2>
      <p className="hint">登记新批次并记录「新粉到货」事件。批次号登记后不可重复。</p>
      <form onSubmit={onSubmit} className="form">
        <label>
          批次号 *
          <input
            value={batchNo}
            onChange={(e) => setBatchNo(e.target.value)}
            placeholder="如 P-2026-001"
            required
          />
        </label>
        <label>
          合金牌号 *
          <input
            value={alloyGrade}
            onChange={(e) => setAlloyGrade(e.target.value)}
            placeholder="如 TC4 / 316L / AlSi10Mg"
            required
          />
        </label>
        <label>
          粒度档 *
          <input
            value={particleSize}
            onChange={(e) => setParticleSize(e.target.value)}
            placeholder="如 15-53μm"
            required
          />
        </label>
        <label>
          到货重量（g）*
          <input
            type="number"
            step="any"
            min="0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="如 5000"
            required
          />
        </label>
        <label>
          到货时间 *
          <input
            type="datetime-local"
            value={arrivalTime}
            onChange={(e) => setArrivalTime(e.target.value)}
            required
          />
        </label>
        <label>
          设备号（可选）
          <input
            value={deviceNo}
            onChange={(e) => setDeviceNo(e.target.value)}
            placeholder="如 SCALE-01"
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? '提交中…' : '登记'}
        </button>
      </form>
      {message && (
        <p className={message.ok ? 'msg ok' : 'msg err'} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}
