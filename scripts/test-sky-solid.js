// Testar SkyObject solid
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  s.resetAll();
  const scene = s.createScene('Teste Sky Solid');
  s.addConectToScene('SkyObject', [0, 0, 0]);
  const updated = store.getState().scenes.find(sc => sc.id === scene.id);
  const sky = updated.conects.find(c => c.type === 'SkyObject');
  s.updateConect(sky.instanceId, {
    skyType: 'solid',
    solidColor: '#ff6600',
    name: 'Sky Solid'
  });
  s.addObjectToScene(s.addObject('cube', [0, 1, 0]).id, [0, 1, 0]);
  return JSON.stringify({ skyId: sky.instanceId, skyType: 'solid', color: '#ff6600' });
})();
