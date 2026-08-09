// Testar SkyObject procedural
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  s.resetAll();
  const scene = s.createScene('Teste Sky Procedural');
  s.addConectToScene('SkyObject', [0, 0, 0]);
  const updated = store.getState().scenes.find(sc => sc.id === scene.id);
  const sky = updated.conects.find(c => c.type === 'SkyObject');
  s.updateConect(sky.instanceId, {
    skyType: 'procedural',
    sunElevation: 25,
    sunAzimuth: 180,
    rayleigh: 1,
    turbidity: 10,
    mieCoefficient: 0.005,
    name: 'Sky Procedural'
  });
  // Adicionar cubo
  s.addObjectToScene(s.addObject('cube', [0, 1, 0]).id, [0, 1, 0]);
  return JSON.stringify({ skyId: sky.instanceId, skyType: 'procedural' });
})();
