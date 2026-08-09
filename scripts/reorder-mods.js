// Reordenar modificadores: subdivision PRIMEIRO, curve DEPOIS
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  const cyl = store.getState().objects.find(o => o.id === 'obj_r7x5dwq3');
  if (!cyl) return 'cylinder not found';
  // Remover todos os modificadores
  for (const mod of cyl.modifiers) {
    s.removeModifier(cyl.id, mod.id);
  }
  // Adicionar subdivision primeiro
  s.addModifier(cyl.id, 'subdivision');
  let updated = store.getState().objects.find(o => o.id === cyl.id);
  const subMod = updated.modifiers.find(m => m.type === 'subdivision');
  s.updateModifier(cyl.id, subMod.id, { params: { levels: 3 } });
  // Adicionar curve depois
  s.addModifier(cyl.id, 'curve');
  updated = store.getState().objects.find(o => o.id === cyl.id);
  const curveMod = updated.modifiers.find(m => m.type === 'curve');
  // Obter pathId da cena
  const scene = store.getState().scenes.find(sc => sc.id === store.getState().activeSceneId);
  const pathConect = scene.conects.find(c => c.type === 'PathObject');
  s.updateModifier(cyl.id, curveMod.id, {
    params: { pathId: pathConect.instanceId, twist: 0, stretch: 1 }
  });
  return JSON.stringify({ modifiers: store.getState().objects.find(o => o.id === cyl.id).modifiers.map(m => m.type) });
})();
