// Testar Ver Filhos + Substituir modelo (sem resetAll)
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  // Criar um cubo no catálogo
  const cube = s.addObject('cube', [0, 0, 0]);
  s.updateObject(cube.id, { name: 'Cubo Texturizado', material: { color: '#ff6600', roughness: 0.5 } });
  // Criar cena
  const scene = s.createScene('Teste');
  // Adicionar NpcObject
  s.addConectToScene('NpcObject', [0, 1, 0]);
  let updated = store.getState().scenes.find(sc => sc.id === scene.id);
  let npc = updated.conects.find(c => c.type === 'NpcObject');
  s.updateConect(npc.instanceId, { name: 'NPC Teste' });
  return JSON.stringify({ cubeId: cube.id, npcId: npc.instanceId });
})();
