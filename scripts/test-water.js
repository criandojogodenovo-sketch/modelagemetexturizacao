// Testar WaterObject
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  s.resetAll();
  const scene = s.createScene('Teste Water');
  s.addConectToScene('WaterObject', [0, 0, 0]);
  const updated = store.getState().scenes.find(sc => sc.id === scene.id);
  const water = updated.conects.find(c => c.type === 'WaterObject');
  s.updateConect(water.instanceId, {
    color: '#2f81f7',
    opacity: 0.6,
    waveHeight: 0.3,
    waveSpeed: 1.0,
    name: 'Water Test'
  });
  // Adicionar cubo para referência
  s.addObjectToScene(s.addObject('cube', [0, 1, 0]).id, [0, 1, 0]);
  return JSON.stringify({ waterId: water.instanceId });
})();
