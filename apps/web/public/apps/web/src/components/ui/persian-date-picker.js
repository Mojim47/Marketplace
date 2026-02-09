import { format } from 'date-fns-jalali';
import { useState } from 'react';
import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
export function toPersianDigits(str) {
  const map = { 0: '۰', 1: '۱', 2: '۲', 3: '۳', 4: '۴', 5: '۵', 6: '۶', 7: '۷', 8: '۸', 9: '۹' };
  return str.replace(/[0-9]/g, (d) => map[d] || d);
}
export function PersianDatePicker({ onChange, inputType = 'date' }) {
  const [value, setValue] = useState(new Date());
  const formatted = value ? toPersianDigits(format(value, 'yyyy-MM-dd')) : '';
  return _jsxs('div', {
    style: { display: 'flex', alignItems: 'center' },
    children: [
      _jsx('input', {
        'aria-label': '\u0627\u0646\u062A\u062E\u0627\u0628 \u062A\u0627\u0631\u06CC\u062E',
        type: inputType,
        onChange: (e) => {
          const v = e.target.value;
          if (v) {
            const d = new Date(v);
            setValue(d);
            onChange?.(d.toISOString());
          }
        },
      }),
      _jsx('span', { style: { marginInlineStart: 8 }, children: formatted }),
    ],
  });
}
//# sourceMappingURL=persian-date-picker.js.map
