// Teste: esfera com Vertex AO
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  s.resetAll();
  // Criar esfera (tem geometria densa)
  const obj = s.addObject('sphere', [0, 1, 0]);
  s.updateObject(obj.id, {
    material: { color: '#cccccc', roughness: 0.8, metalness: 0.0 }
  });
  // Ativar Vertex AO
  s.setRenderSettings({ vertexAO: true });
  return 'esfera criada, vertexAO ON';
})();
