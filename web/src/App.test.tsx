import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('渲染三个功能页签，默认进入批次登记', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: '批次登记' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '记录导入' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '批次时间轴' })).toBeInTheDocument();
    // 默认页：批次登记表单
    expect(screen.getByText('批次号 *')).toBeInTheDocument();
    expect(screen.getByText('合金牌号 *')).toBeInTheDocument();
    expect(screen.getByText('粒度档 *')).toBeInTheDocument();
  });
});
