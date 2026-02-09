import { fireEvent, render } from '@testing-library/react';
import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@nextgen/ai/src/core/ai.service', () => ({
  AIService: class {
    async predict() {
      return { localizedText: 'پیش‌بینی آماده است' };
    }
  },
}));
vi.mock('@nextgen/ai/src/iran/demand-prediction.strategy', () => ({
  IranDemandPredictionStrategy: class {},
}));
import Page from './page';
describe('(seller)/ai page (fa)', () => {
  it('runs prediction and shows localized result', async () => {
    const { getByText, getByRole, findByText } = render(_jsx(Page, {}));
    const btn = getByText('محاسبه');
    fireEvent.click(btn);
    expect(await findByText('پیش‌بینی آماده است')).toBeTruthy();
    // ensure inputs exist for accessibility
    const input = getByRole('textbox');
    expect(input.value.length).toBeGreaterThan(0);
  });
});
//# sourceMappingURL=page.test.js.map
