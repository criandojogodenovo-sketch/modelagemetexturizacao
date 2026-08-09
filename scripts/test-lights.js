// Testar LuminousObject (point, directional, spot)
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  s.resetAll();
  const scene = s.createScene('Teste Luzes');
  // Point light
  s.addConectToScene('LuminousObject', [3, 3, 0]);
  let updated = store.getState().scenes.find(sc => sc.id === scene.id);
  let point = updated.conects.find(c => c.type === 'LuminousObject');
  s.updateConect(point.instanceId, { lightType: 'point', color: '#ff0000', intensity: 2, name: 'Point Red' });
  // Directional light
  s.addConectToScene('LuminousObject', [-3, 3, 0]);
  updated = store.getState().scenes.find(sc => sc.id === scene.id);
  let dir = updated.conects[updated.conects.length - 1];
  s.updateConect(dir.instanceId, { lightType: 'directional', color: '#00ff00', intensity: 1.5, name: 'Dir Green' });
  // Spot light
  s.addConectToScene('LuminousObject', [0, 5, 3]);
  updated = store.getState().scenes.find(sc => sc.id === scene.id);
  let spot = updated.conects[updated.conects.length - 1];
  s.updateConect(spot.instanceId, { lightType: 'spot', color: '#0000ff', intensity: 3, name: 'Spot Blue' });
  // Cubo para referência
  s.addObjectToScene(s.addObject('cube', [0, 1, 0]).id, [0, 1, 0]);
  return JSON.stringify({ pointId: point.instanceId, dirId: dir.instanceId, spotId: spot.instanceId });
})();
