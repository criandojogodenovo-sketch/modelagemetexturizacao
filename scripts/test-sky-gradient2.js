// Testar SkyObject gradient
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  s.resetAll();
  const scene = s.createScene('Teste Sky Gradient');
  s.addConectToScene('SkyObject', [0, 0, 0]);
  const updated = store.getState().scenes.find(sc => sc.id === scene.id);
  const sky = updated.conects.find(c => c.type === 'SkyObject');
  s.updateConect(sky.instanceId, {
    skyType: 'gradient',
    topColor: '#ff0000',
    bottomColor: '#00ff00',
    name: 'Sky Gradient'
  });
  s.addObjectToScene(s.addObject('cube', [0, 1, 0]).id, [0, 1, 0]);
  return JSON.stringify({ skyId: sky.instanceId, skyType: 'gradient' });
})();
