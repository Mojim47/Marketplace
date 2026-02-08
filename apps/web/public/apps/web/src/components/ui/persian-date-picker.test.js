import { jsx as _jsx } from 'react/jsx-runtime';
import { fireEvent, render } from '@testing-library/react';
import { format } from 'date-fns-jalali';
import { describe, expect, it } from 'vitest';
import { PersianDatePicker, toPersianDigits } from './persian-date-picker';
function pick(input, val) {
  fireEvent.change(input, { target: { value: val } });
}
describe('PersianDatePicker', () => {
  it('formats selected date in Persian digits', () => {
    const { getByLabelText, getByText } = render(_jsx(PersianDatePicker, { inputType: 'text' }));
    const input = getByLabelText('انتخاب تاریخ');
    pick(input, '2024-03-19');
    const expected = toPersianDigits(format(new Date('2024-03-19'), 'yyyy-MM-dd'));
    expect(getByText(expected)).toBeTruthy();
  });
});
//# sourceMappingURL=persian-date-picker.test.js.map
