(function() {
  const store = window.__flirStore;
  const s = store.getState();
  const sel = s.objects.find(o => o.id === s.selectedId);
  if (!sel) return 'no selected';
  // Limpar keyframes
  s.updateObject(sel.id, { animations: {} });
  // Reset head position
  const head = sel.skeleton?.bones?.find(b => b.name === 'head');
  if (head) s.updateBone(sel.id, head.id, { position: [0, 1.2, 0] });
  // Reset time
  s.setAnimation({ currentTime: 0 });
  // Clear bone selection
  s.clearBoneSelection();
  return 'cleared';
})();
