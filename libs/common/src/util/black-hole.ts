export const createUniversalMock = (name: string = 'BlackHole') => {
  const handler: ProxyHandler<any> = {
    get: (_target, prop) => {
      if (prop === 'toString' || prop === Symbol.toStringTag) return () => `[Mock: ${name}]`;
      if (prop === 'then') return undefined; // prevent promise confusion
      return createUniversalMock(`${name}.${String(prop)}`);
    },
    apply: (_target, _thisArg, args) => {
      console.warn(`🕳️ [BLACK HOLE] Swallowed call: ${name}(${args.length} args)`);
      return Promise.resolve({ success: true, mocked: true, id: 'MOCK_ID_' + Date.now() });
    },
  };
  return new Proxy(() => {}, handler);
};
