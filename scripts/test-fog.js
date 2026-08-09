// Testar FogObject
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  s.resetAll();
  const scene = s.createScene('Teste Fog');
  s.addConectToScene('FogObject', [0, 0, 0]);
  const updated = store.getState().scenes.find(sc => sc.id === scene.id);
  const fog = updated.conects.find(c => c.type === 'FogObject');
  s.updateConect(fog.instanceId, {
    fogType: 'linear',
    color: '#ff00ff',
    near: 2,
    far: 15,
    name: 'Fog Test'
  });
  // Adicionar vários cubos para ver o efeito da névoa
  for (let i = 0; i < 5; i++) {
    s.addObjectToScene(s.addObject('cube', [i * 3, 1, 0]).id, [i * 3, 1, 0]);
  }
  return JSON.stringify({ fogId: fog.instanceId });
})();
