import { render } from '@testing-library/react';
import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, expect, it } from 'vitest';
import Page from './page';
describe('(fa) seller dashboard', () => {
  it('renders IRR currency and Jalali date in Persian digits', () => {
    const { getByLabelText } = render(_jsx(Page, {}));
    expect(getByLabelText('current-date').textContent).toMatch(/^[^0-9]+[۰-۹\-]+$/);
    expect(getByLabelText('total-sales').textContent).toMatch(/(﷼|ریال)/);
  });
});
//# sourceMappingURL=page.test.js.map
