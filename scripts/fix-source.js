// Corrigir sourceObjectId do PersonalObject
(function() {
  const s = window.__flirStore?.getState?.();
  if (!s) return 'no store';
  const scene = s.scenes.find(sc => sc.id === s.activeSceneId);
  if (!scene) return 'no scene';
  const personal = scene.conects?.find(c => c.type === 'PersonalObject');
  if (!personal) return 'no personal';
  // Corrigir sourceObjectId para apontar para o catálogo
  s.updateConect(personal.instanceId, { sourceObjectId: 'obj_a0epm4bm' });
  return 'fixed: ' + personal.instanceId + ' now points to obj_a0epm4bm';
})();
