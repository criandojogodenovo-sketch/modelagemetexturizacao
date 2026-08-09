// Testar SkyObject procedural - noite com estrelas
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  const scene = s.scenes.find(sc => sc.id === s.activeSceneId);
  const sky = scene.conects.find(c => c.type === 'SkyObject');
  s.updateConect(sky.instanceId, {
    sunElevation: -10,
    sunAzimuth: 180,
    rayleigh: 1,
    turbidity: 5,
    mieCoefficient: 0.005,
    starsEnabled: true
  });
  return 'night: elevation=-10, stars=true';
})();
