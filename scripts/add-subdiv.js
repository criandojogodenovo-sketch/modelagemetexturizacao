// Adicionar subdivision ao cilindro para suavizar a curva
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  const cyl = s.objects.find(o => o.id === 'obj_r7x5dwq3');
  if (!cyl) return 'cylinder not found';
  // Adicionar modificador subdivision
  s.addModifier(cyl.id, 'subdivision');
  const updatedCyl = store.getState().objects.find(o => o.id === cyl.id);
  const subMod = updatedCyl.modifiers.find(m => m.type === 'subdivision');
  s.updateModifier(cyl.id, subMod.id, { params: { levels: 3 } });
  return 'subdivision added with levels=3, total modifiers: ' + updatedCyl.modifiers.length;
})();
