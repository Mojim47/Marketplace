import { jsx as _jsx } from 'react/jsx-runtime';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Page from './page';
describe('admin/sena page (fa)', () => {
  it('renders SENA sync page in Farsi', () => {
    const { getByText } = render(_jsx(Page, {}));
    expect(getByText(/سامانهٔ سنا/)).toBeTruthy();
    expect(getByText(/ارسال فاکتورهای صادرشده/)).toBeTruthy();
  });
});
//# sourceMappingURL=page.test.js.map
