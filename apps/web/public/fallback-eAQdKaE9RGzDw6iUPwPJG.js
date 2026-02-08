(() => {
  'use strict';
  self.fallback = async (e) => {
    switch (e.destination) {
      case 'document':
        return caches.match('/offline', { ignoreSearch: !0 });
      case 'image':
        return caches.match('/icons/offline-image.png', { ignoreSearch: !0 });
      default:
        return Response.error();
    }
  };
})();
