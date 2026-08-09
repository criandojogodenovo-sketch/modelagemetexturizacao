// Testar SkyObject (solid, gradient, hdri)
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  s.resetAll();
  // Criar cena
  const scene = s.createScene('Teste Sky');
  // Adicionar SkyObject gradient
  s.addConectToScene('SkyObject', [0, 0, 0]);
  let updated = store.getState().scenes.find(sc => sc.id === scene.id);
  let sky = updated.conects.find(c => c.type === 'SkyObject');
  s.updateConect(sky.instanceId, {
    skyType: 'gradient',
    topColor: '#ff0000',
    bottomColor: '#00ff00',
    name: 'Sky Gradient'
  });
  // Adicionar um cubo para referência
  s.addObjectToScene(s.addObject('cube', [0, 1, 0]).id, [0, 1, 0]);
  return JSON.stringify({ sceneId: scene.id, skyId: sky.instanceId, skyType: sky.skyType });
})();
