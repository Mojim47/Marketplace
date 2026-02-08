import { jsx as _jsx } from 'react/jsx-runtime';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Page from './page';
describe('admin/tax-reports page (fa)', () => {
  it('renders tax reports page in Farsi', () => {
    const { getByText, getAllByText } = render(_jsx(Page, {}));
    expect(getByText(/گزارش‌های مالیاتی/)).toBeTruthy();
    expect(getAllByText(/دوره/).length).toBeGreaterThan(0);
  });
});
//# sourceMappingURL=page.test.js.map
