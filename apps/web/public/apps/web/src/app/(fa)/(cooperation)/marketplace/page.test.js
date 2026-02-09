import { render } from '@testing-library/react';
import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, expect, it } from 'vitest';
import Page from './page';
describe('cooperation/marketplace page (fa)', () => {
  it('renders cooperation marketplace page in Farsi', () => {
    const { getByText } = render(_jsx(Page, {}));
    expect(getByText(/بازارگاه همکاری/)).toBeTruthy();
  });
});
//# sourceMappingURL=page.test.js.map
