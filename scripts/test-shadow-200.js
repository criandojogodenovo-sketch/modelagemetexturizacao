// Teste: 200 cubos (grid 20x10) com culling ON
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  s.resetAll();
  s.setRenderSettings({ shadowOptimizations: true, shadowDistance: 15, shadowMapSize: 1024 });
  for (let x = 0; x < 20; x++) {
    for (let z = 0; z < 10; z++) {
      const obj = s.addObject('cube', [x * 1.5 - 14, 0.5, z * 1.5 - 7]);
      const hue = (x * 10 + z) / 200;
      const color = '#' + Math.floor(hue * 16777215).toString(16).padStart(6, '0');
      s.updateObject(obj.id, { material: { color, roughness: 0.6, metalness: 0.2 } });
    }
  }
  return '200 cubos, culling ON, dist=15, 1024';
})();
