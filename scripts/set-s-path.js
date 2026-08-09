// Modificar PathObject para forma de S
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  const scene = s.scenes.find(sc => sc.id === s.activeSceneId);
  if (!scene) return 'no scene';
  const path = scene.conects?.find(c => c.type === 'PathObject');
  if (!path) return 'no path';
  // Forma de S: pontos que fazem um S
  const sPoints = [
    [0, 0.5, 0],
    [1, 0.5, 0.5],
    [2, 0.5, -0.5],
    [3, 0.5, 0.5],
    [4, 0.5, -0.5],
    [5, 0.5, 0],
  ];
  s.updateConect(path.instanceId, { points: sPoints });
  return 'path updated to S shape with ' + sPoints.length + ' points';
})();
