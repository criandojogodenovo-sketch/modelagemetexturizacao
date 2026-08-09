// Teste: 100 cubos com 1024 (sem culling)
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  s.resetAll();
  s.setRenderSettings({ shadowOptimizations: false, shadowMapSize: 1024 });
  for (let x = 0; x < 10; x++) {
    for (let z = 0; z < 10; z++) {
      const obj = s.addObject('cube', [x * 1.5 - 7, 0.5, z * 1.5 - 7]);
      const hue = (x * 10 + z) / 100;
      const color = '#' + Math.floor(hue * 16777215).toString(16).padStart(6, '0');
      s.updateObject(obj.id, { material: { color, roughness: 0.6, metalness: 0.2 } });
    }
  }
  return '100 cubos, 1024, sem culling';
})();
