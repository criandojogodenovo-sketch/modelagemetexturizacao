// Teste: cubo com subdivision + Vertex AO
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  s.resetAll();
  const obj = s.addObject('cube', [0, 1, 0]);
  s.updateObject(obj.id, {
    material: { color: '#cccccc', roughness: 0.8, metalness: 0.0 }
  });
  // Adicionar subdivision para ter densidade
  s.addModifier(obj.id, 'subdivision');
  const updated = store.getState().objects.find(o => o.id === obj.id);
  const subMod = updated.modifiers.find(m => m.type === 'subdivision');
  s.updateModifier(obj.id, subMod.id, { params: { levels: 2 } });
  // Ativar Vertex AO
  s.setRenderSettings({ vertexAO: true });
  return 'cubo com subdivision + vertexAO ON';
})();
