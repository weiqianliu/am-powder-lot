import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiRequestError, importRecords } from '../api';
import type { ImportLineError, ImportResult } from '../types';

const FORMAT_HINT = `CSV 格式（首行表头可省略）：
batch_no,event_type,weight_grams,device_no,event_time
事件类型：称重/weighing、筛分/sieving；时间：YYYY-MM-DD HH:MM[:SS]`;

/** 导入称重 / 筛分记录 */
export default function ImportRecords() {
  const [filename, setFilename] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<{ message: string; details: ImportLineError[] } | null>(
    null,
  );

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => setContent(String(reader.result ?? ''));
    reader.readAsText(file);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setResult(null);
    setError(null);
    setSubmitting(true);
    try {
      const res = await importRecords({
        filename: filename || undefined,
        content,
      });
      setResult(res);
      setContent('');
      setFilename('');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError({
          message: err.body.message,
          details: err.body.details ?? [],
        });
      } else {
        setError({ message: '网络错误，请确认后端已启动', details: [] });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h2>导入称重 / 筛分记录</h2>
      <p className="hint">
        原始文件内容将<b>原样入库留存</b>，导入后不可改写；任何一行有问题则整批拒绝。
      </p>
      <form onSubmit={onSubmit} className="form">
        <label>
          选择 CSV 文件
          <input type="file" accept=".csv,text/csv,text/plain" onChange={onFileChange} />
        </label>
        <label>
          记录内容（可直接粘贴）
          <textarea
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={FORMAT_HINT}
            required
          />
        </label>
        <button type="submit" disabled={submitting || !content.trim()}>
          {submitting ? '导入中…' : '导入'}
        </button>
      </form>

      {result && (
        <div className="msg ok" role="status">
          导入成功：批次 #{result.import_id}
          {result.filename ? `（${result.filename}）` : ''}，共 {result.record_count} 条记录
        </div>
      )}

      {error && (
        <div className="msg err" role="alert">
          <p>{error.message}</p>
          {error.details.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>行号</th>
                  <th>原始行</th>
                  <th>问题</th>
                </tr>
              </thead>
              <tbody>
                {error.details.map((d) => (
                  <tr key={d.lineNo}>
                    <td>{d.lineNo}</td>
                    <td>
                      <code>{d.rawLine}</code>
                    </td>
                    <td>{d.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
