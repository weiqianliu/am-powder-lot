import { useState } from 'react';
import RegisterBatch from './pages/RegisterBatch';
import ImportRecords from './pages/ImportRecords';
import Timeline from './pages/Timeline';

type Tab = 'register' | 'import' | 'timeline';

const TABS: { key: Tab; label: string }[] = [
  { key: 'register', label: '批次登记' },
  { key: 'import', label: '记录导入' },
  { key: 'timeline', label: '批次时间轴' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('register');

  return (
    <div className="app">
      <header className="app-header">
        <h1>增材粉末批次复用追溯台</h1>
        <nav>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={tab === t.key ? 'tab active' : 'tab'}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'register' && <RegisterBatch />}
        {tab === 'import' && <ImportRecords />}
        {tab === 'timeline' && <Timeline />}
      </main>
    </div>
  );
}
