// Script de teste para adicionar keyframes e verificar animação
(function() {
  const s = window.__flirStore?.getState?.();
  if (!s) return 'no store';
  const sel = s.objects.find(o => o.id === s.selectedId);
  if (!sel) return 'no selected';
  const bones = sel.skeleton?.bones || [];
  if (bones.length === 0) return 'no bones';

  // Adicionar keyframe no tempo 5 para o osso "head" com posição alterada
  const headBone = bones.find(b => b.name === 'head') || bones[4];
  if (!headBone) return 'no head bone';

  const origPos = headBone.position;
  s.addKeyframe(sel.id, 'idle', headBone.id, 5, {
    position: [origPos[0], origPos[1] + 1, origPos[2]],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  });

  const anims = sel.animations || {};
  const idleKfs = anims.idle || [];
  return JSON.stringify({
    headBoneName: headBone.name,
    headBoneId: headBone.id,
    origPos,
    idleKeyframes: idleKfs.length,
    keyframeTimes: idleKfs.map(k => k.time),
  }, null, 2);
})();
