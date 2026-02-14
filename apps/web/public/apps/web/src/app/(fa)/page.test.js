import { render } from '@testing-library/react';
import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, expect, it } from 'vitest';
import Page from './page';
describe('fa home page', () => {
  it('renders Farsi title and welcome text', () => {
    const { getByText } = render(_jsx(Page, {}));
    expect(getByText('بازار نسل بعد')).toBeTruthy();
    expect(getByText('به سامانهٔ فروشندگان خوش آمدید.')).toBeTruthy();
  });
});
//# sourceMappingURL=page.test.js.map
