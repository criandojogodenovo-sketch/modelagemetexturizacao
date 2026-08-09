// Teste: esfera com Vertex AO (comparar com/sem)
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  s.resetAll();
  // Criar esfera
  const obj = s.addObject('sphere', [0, 1, 0]);
  s.updateObject(obj.id, {
    material: { color: '#cccccc', roughness: 0.8, metalness: 0.0 }
  });
  // Adicionar subdivision para ter mais vértices
  s.addModifier(obj.id, 'subdivision');
  const updated = store.getState().objects.find(o => o.id === obj.id);
  const subMod = updated.modifiers.find(m => m.type === 'subdivision');
  s.updateModifier(obj.id, subMod.id, { params: { levels: 2 } });
  // NÃO ativar AO ainda
  s.setRenderSettings({ vertexAO: false });
  return 'esfera com subdivision, AO OFF';
})();
