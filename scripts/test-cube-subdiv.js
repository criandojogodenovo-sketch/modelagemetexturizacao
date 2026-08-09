// Criar cubo com subdivision e testar AO
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  // Desativar AO inicialmente
  s.setRenderSettings({ vertexAO: false });
  // Criar cubo
  const obj = s.addObject('cube', [0, 1, 0]);
  // Adicionar subdivision levels=2
  s.addModifier(obj.id, 'subdivision');
  let updated = store.getState().objects.find(o => o.id === obj.id);
  const subMod = updated.modifiers.find(m => m.type === 'subdivision');
  s.updateModifier(obj.id, subMod.id, { params: { levels: 2 } });
  return 'cubo com subdivision levels=2, AO OFF';
})();
