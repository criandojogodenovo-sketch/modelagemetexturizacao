// Testar todos os tipos de luz
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  s.resetAll();
  const scene = s.createScene('Teste Luzes');
  // SunObject
  s.addConectToScene('SunObject', [0, 5, 0]);
  let updated = store.getState().scenes.find(sc => sc.id === scene.id);
  let sun = updated.conects.find(c => c.type === 'SunObject');
  s.updateConect(sun.instanceId, { intensity: 2, temperature: 6500, elevation: 45, name: 'Sun' });
  // PointObject
  s.addConectToScene('PointObject', [3, 2, 0]);
  updated = store.getState().scenes.find(sc => sc.id === scene.id);
  let point = updated.conects.find(c => c.type === 'PointObject');
  s.updateConect(point.instanceId, { color: '#ff0000', intensity: 3, name: 'Point Red' });
  // SpotObject
  s.addConectToScene('SpotObject', [-3, 4, 0]);
  updated = store.getState().scenes.find(sc => sc.id === scene.id);
  let spot = updated.conects.find(c => c.type === 'SpotObject');
  s.updateConect(spot.instanceId, { color: '#0000ff', intensity: 5, angle: 30, name: 'Spot Blue' });
  // AreaObject
  s.addConectToScene('AreaObject', [0, 5, 3]);
  updated = store.getState().scenes.find(sc => sc.id === scene.id);
  let area = updated.conects.find(c => c.type === 'AreaObject');
  s.updateConect(area.instanceId, { color: '#ffffff', intensity: 3, width: 3, height: 2, name: 'Area' });
  // AmbientObject
  s.addConectToScene('AmbientObject', [0, 0, 0]);
  updated = store.getState().scenes.find(sc => sc.id === scene.id);
  let amb = updated.conects.find(c => c.type === 'AmbientObject');
  s.updateConect(amb.instanceId, { intensity: 0.3, name: 'Ambient' });
  // Cubo
  s.addObjectToScene(s.addObject('cube', [0, 1, 0]).id, [0, 1, 0]);
  return JSON.stringify({ count: updated.conects.length });
})();
