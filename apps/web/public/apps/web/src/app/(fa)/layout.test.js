import { jsx as _jsx } from 'react/jsx-runtime';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RootLayout from './layout';
describe('fa layout', () => {
  it('renders RTL and Vazir font', () => {
    const { getByTestId, container } = render(
      _jsx(RootLayout, { children: _jsx('div', { children: '\u0645\u062D\u062A\u0648\u0627' }) })
    );
    const rtlRoot = getByTestId('rtl-root');
    expect(rtlRoot.style.direction).toBe('rtl');
    // font-family is applied on body in RootLayout; in jsdom the nested <body> is inside container
    const renderedBody = container.querySelector('body');
    expect(renderedBody && renderedBody.style.fontFamily).toContain('Vazir');
    expect(container.textContent).toContain('محتوا');
  });
  it('loads saved mode from localStorage on mount', () => {
    const getItem = vi.fn().mockReturnValue('dark');
    // @ts-ignore
    global.window = Object.assign(global.window || {}, {
      localStorage: { getItem, setItem: vi.fn() },
    });
    const { getAllByLabelText } = render(_jsx(RootLayout, { children: _jsx('div', {}) }));
    const buttons = getAllByLabelText('toggle-mode');
    expect(buttons.some((btn) => btn.textContent?.includes('dark'))).toBe(true);
  });
});
//# sourceMappingURL=layout.test.js.map
