(() => {
  const removedDeckModernEndpoints = new Set([
    '/api/deck/battle-goals',
  ]);

  const nativeFetch = window.fetch?.bind(window);
  if (!nativeFetch) return;

  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url;
    if (removedDeckModernEndpoints.has(url)) {
      return Promise.resolve(new Response(JSON.stringify({ battleGoals: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    }
    return nativeFetch(input, init);
  };
})();
