import { describe, expect, it } from 'vitest';
import { toPersianDigits } from './persian-date-picker';
describe('toPersianDigits', () => {
  it('converts all western digits to Persian', () => {
    const western = '0123456789-2024';
    const converted = toPersianDigits(western);
    expect(converted).toContain('۰');
    expect(converted).toContain('۹');
    expect(converted).toContain(
      '۲۰۲۴'.replace(
        /[0-9]/g,
        (d) =>
          ({ 0: '۰', 1: '۱', 2: '۲', 3: '۳', 4: '۴', 5: '۵', 6: '۶', 7: '۷', 8: '۸', 9: '۹' })[d]
      )
    );
  });
});
//# sourceMappingURL=persian-date-utils.test.js.map
