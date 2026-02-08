import { jsx as _jsx } from 'react/jsx-runtime';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OfflineClient } from './offline-client';
describe('OfflineClient', () => {
  it('renders nothing and does not throw when browser APIs absent', () => {
    const { container } = render(_jsx(OfflineClient, {}));
    expect(container.firstChild).toBeNull();
  });
  it('registers service worker and opens indexedDB when available', () => {
    // @ts-ignore
    global.navigator = { serviceWorker: { register: vi.fn().mockResolvedValue({}) } };
    // minimal IDB mock
    const openMock = vi.fn().mockReturnValue({
      result: { objectStoreNames: { contains: () => true } },
      onupgradeneeded: null,
    });
    // @ts-ignore
    global.indexedDB = { open: openMock };
    const { container } = render(_jsx(OfflineClient, {}));
    expect(container.firstChild).toBeNull();
    expect(navigator.serviceWorker.register).toHaveBeenCalled();
    expect(openMock).toHaveBeenCalledWith('nextgen-seller', 1);
  });
});
//# sourceMappingURL=offline-client.test.js.map
