// Adicionar keyframe para o osso "spine" (que tem pesos)
(function() {
  const s = window.__flirStore?.getState?.();
  if (!s) return 'no store';
  const sel = s.objects.find(o => o.id === s.selectedId);
  if (!sel) return 'no selected';
  const bones = sel.skeleton?.bones || [];
  const spineBone = bones.find(b => b.name === 'spine');
  if (!spineBone) return 'no spine bone';

  const origPos = spineBone.position;
  // Adicionar keyframe no tempo 5 com posição alterada (mover 2 unidades em X)
  s.addKeyframe(sel.id, 'idle', spineBone.id, 5, {
    position: [origPos[0] + 2, origPos[1], origPos[2]],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  });

  const anims = sel.animations || {};
  const idleKfs = anims.idle || [];
  return JSON.stringify({
    spineBoneName: spineBone.name,
    spineBoneId: spineBone.id,
    origPos,
    totalIdleKeyframes: idleKfs.length,
    spineKeyframes: idleKfs.filter(k => k.boneId === spineBone.id).map(k => ({ time: k.time, pos: k.position })),
  }, null, 2);
})();
