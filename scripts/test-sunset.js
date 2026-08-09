// Testar pôr do sol
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  const scene = s.scenes.find(sc => sc.id === s.activeSceneId);
  const sky = scene.conects.find(c => c.type === 'SkyObject');
  s.updateConect(sky.instanceId, {
    sunElevation: 5,
    sunAzimuth: 180,
    rayleigh: 3,
    turbidity: 10,
    mieCoefficient: 0.005
  });
  return 'sol a 5 graus (pôr do sol)';
})();
