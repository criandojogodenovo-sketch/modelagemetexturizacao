// Teste do Curve Deform com Catmull-Rom
// Cria: cilindro + PathObject em S + modificador Curva
(function() {
  const store = window.__flirStore;
  const s = store.getState();

  // 1. Criar cilindro
  const cylObj = s.addObject('cylinder', [0, 1, 0]);
  const cylId = cylObj.id;
  s.updateObject(cylId, { name: 'Cilindro Curvo' });

  // 2. Criar cena e PathObject em forma de S
  const scene = s.createScene('Teste Curve Deform');
  const sceneId = scene.id;

  s.addConectToScene('PathObject', [0, 0.5, 0]);
  const updatedScene = store.getState().scenes.find(sc => sc.id === sceneId);
  const pathConect = updatedScene.conects.find(c => c.type === 'PathObject');

  // Path em forma de S (mais pontos para suavizar)
  const sPoints = [
    [0, 0.5, 0],
    [0.5, 0.5, 0.8],
    [1, 0.5, -0.5],
    [1.5, 0.5, 0.8],
    [2, 0.5, -0.5],
    [2.5, 0.5, 0.8],
    [3, 0.5, 0],
  ];
  s.updateConect(pathConect.instanceId, { points: sPoints, name: 'Path S' });

  // 3. Adicionar modificador Curva ao cilindro
  s.addModifier(cylId, 'curve');
  // Obter o modificador acabado de adicionar
  const cyl = store.getState().objects.find(o => o.id === cylId);
  const curveMod = cyl.modifiers.find(m => m.type === 'curve');
  s.updateModifier(cylId, curveMod.id, {
    params: { pathId: pathConect.instanceId, twist: 0, stretch: 1 }
  });

  // 4. Selecionar o cilindro para visualizar
  s.selectObject(cylId);

  return JSON.stringify({
    cylId,
    sceneId,
    pathId: pathConect.instanceId,
    pathPoints: sPoints.length,
    modifierAdded: !!curveMod,
  }, null, 2);
})();
