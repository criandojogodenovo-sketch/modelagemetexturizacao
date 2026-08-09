// Testar SkyObject procedural - meio-dia
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  s.resetAll();
  const scene = s.createScene('Teste Sky');
  s.addConectToScene('SkyObject', [0, 0, 0]);
  const updated = store.getState().scenes.find(sc => sc.id === scene.id);
  const sky = updated.conects.find(c => c.type === 'SkyObject');
  s.updateConect(sky.instanceId, {
    skyType: 'procedural',
    sunElevation: 60,
    sunAzimuth: 180,
    rayleigh: 1,
    turbidity: 10,
    mieCoefficient: 0.005,
    starsEnabled: false,
    name: 'Sky Procedural'
  });
  s.addObjectToScene(s.addObject('cube', [0, 1, 0]).id, [0, 1, 0]);
  return JSON.stringify({ skyId: sky.instanceId, elev: 60 });
})();
