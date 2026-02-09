'use client';
import { embedText, loadModel } from '@nextgen/ai';
import { useEffect, useState } from 'react';
import { jsx as _jsx } from 'react/jsx-runtime';
export function CopilotButton() {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    loadModel()
      .then(() => {
        if (active) {
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setReady(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  const handleClick = async () => {
    const query = window.prompt('چه سوالی دارید؟');
    if (!query) {
      return;
    }
    setLoading(true);
    try {
      const vector = await embedText(query);
      window.dispatchEvent(new CustomEvent('semantic-search-ready', { detail: { vector } }));
      window.alert('جستجوی معنایی آماده است — نیازی به اتصال خارجی نیست.');
    } finally {
      setLoading(false);
    }
  };
  return _jsx('button', {
    onClick: handleClick,
    disabled: !ready || loading,
    className:
      'mt-4 px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed',
    children: loading
      ? 'در حال پردازش...'
      : ready
        ? 'پرسش به کمیار هوشمند'
        : 'در حال آماده‌سازی مدل',
  });
}
//# sourceMappingURL=CopilotButton.js.map
