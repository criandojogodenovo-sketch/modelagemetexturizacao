// Teste end-to-end do blending idle→walk (versão simplificada)
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  const toast = s.toast;

  // 1. Limpar objetos existentes (não usar resetAll porque apaga cenas)
  // Vamos apenas limpar o catálogo de objetos
  toast('A configurar teste...', 'info');

  // 2. Criar cubo (objeto do catálogo) via addObject
  const cubeObj = s.addObject('cube', [0, 1, 0]);
  const cubeId = cubeObj.id;
  // Renomear
  s.updateObject(cubeId, { name: 'Personagem Teste' });

  // 3. Adicionar esqueleto humanoide
  s.selectObject(cubeId);
  // Usar o preset humanoide via addBone repetido
  const bones = [
    { name: 'root',     position: [0, 0, 0],     parentId: null },
    { name: 'spine',    position: [0, 0.5, 0],   parentId: 'root' },
    { name: 'head',     position: [0, 0.8, 0],   parentId: 'spine' },
    { name: 'thigh.L',  position: [0.15, 0, 0],  parentId: 'root' },
    { name: 'calf.L',   position: [0, -0.4, 0],  parentId: 'thigh.L' },
    { name: 'thigh.R',  position: [-0.15, 0, 0], parentId: 'root' },
    { name: 'calf.R',   position: [0, -0.4, 0],  parentId: 'thigh.R' },
  ];
  const boneIdMap = {};
  for (const def of bones) {
    s.addBone(cubeId, def.position);
    const currentBones = store.getState().objects.find(o => o.id === cubeId)?.skeleton?.bones || [];
    const newBone = currentBones[currentBones.length - 1];
    if (newBone) {
      boneIdMap[def.name] = newBone.id;
      s.updateBone(cubeId, newBone.id, {
        name: def.name,
        parentId: def.parentId ? boneIdMap[def.parentId] : null,
      });
    }
  }

  // 4. Criar keyframes para clip "idle" (respiração subtil)
  const currentObj = store.getState().objects.find(o => o.id === cubeId);
  const allBones = currentObj.skeleton.bones;
  const idleKeyframes = [];
  for (const bone of allBones) {
    idleKeyframes.push({
      id: 'kf_idle_' + bone.id + '_0',
      time: 0,
      boneId: bone.id,
      position: [...bone.position],
      rotation: [...bone.rotation],
      scale: [...bone.scale],
      interpolation: 'ease',
    });
  }
  // Keyframe no tempo 2: spine ligeiramente mais alto
  const spineBone = allBones.find(b => b.name === 'spine');
  if (spineBone) {
    idleKeyframes.push({
      id: 'kf_idle_spine_2',
      time: 2,
      boneId: spineBone.id,
      position: [spineBone.position[0], spineBone.position[1] + 0.03, spineBone.position[2]],
      rotation: [...spineBone.rotation],
      scale: [...spineBone.scale],
      interpolation: 'ease',
    });
  }
  // Tempo 4: voltar ao início (loop)
  for (const bone of allBones) {
    idleKeyframes.push({
      id: 'kf_idle_' + bone.id + '_4',
      time: 4,
      boneId: bone.id,
      position: [...bone.position],
      rotation: [...bone.rotation],
      scale: [...bone.scale],
      interpolation: 'ease',
    });
  }

  // 5. Criar keyframes para clip "walk" (pernas a mexer)
  const walkKeyframes = [];
  const thighL = allBones.find(b => b.name === 'thigh.L');
  const thighR = allBones.find(b => b.name === 'thigh.R');
  const calfL = allBones.find(b => b.name === 'calf.L');
  const calfR = allBones.find(b => b.name === 'calf.R');

  // Tempo 0: neutro
  for (const bone of allBones) {
    walkKeyframes.push({
      id: 'kf_walk_' + bone.id + '_0',
      time: 0,
      boneId: bone.id,
      position: [...bone.position],
      rotation: [...bone.rotation],
      scale: [...bone.scale],
      interpolation: 'ease',
    });
  }
  // Tempo 0.5: perna esquerda para a frente, direita para trás
  if (thighL) walkKeyframes.push({ id: 'kf_walk_tL_05', time: 0.5, boneId: thighL.id, position: [...thighL.position], rotation: [0.5, 0, 0], scale: [1,1,1], interpolation: 'ease' });
  if (thighR) walkKeyframes.push({ id: 'kf_walk_tR_05', time: 0.5, boneId: thighR.id, position: [...thighR.position], rotation: [-0.5, 0, 0], scale: [1,1,1], interpolation: 'ease' });
  if (calfL) walkKeyframes.push({ id: 'kf_walk_cL_05', time: 0.5, boneId: calfL.id, position: [...calfL.position], rotation: [-0.3, 0, 0], scale: [1,1,1], interpolation: 'ease' });
  if (calfR) walkKeyframes.push({ id: 'kf_walk_cR_05', time: 0.5, boneId: calfR.id, position: [...calfR.position], rotation: [0.3, 0, 0], scale: [1,1,1], interpolation: 'ease' });

  // Tempo 1.0: neutro
  for (const bone of allBones) {
    walkKeyframes.push({
      id: 'kf_walk_' + bone.id + '_10',
      time: 1.0,
      boneId: bone.id,
      position: [...bone.position],
      rotation: [...bone.rotation],
      scale: [...bone.scale],
      interpolation: 'ease',
    });
  }
  // Tempo 1.5: perna direita para a frente, esquerda para trás
  if (thighL) walkKeyframes.push({ id: 'kf_walk_tL_15', time: 1.5, boneId: thighL.id, position: [...thighL.position], rotation: [-0.5, 0, 0], scale: [1,1,1], interpolation: 'ease' });
  if (thighR) walkKeyframes.push({ id: 'kf_walk_tR_15', time: 1.5, boneId: thighR.id, position: [...thighR.position], rotation: [0.5, 0, 0], scale: [1,1,1], interpolation: 'ease' });
  if (calfL) walkKeyframes.push({ id: 'kf_walk_cL_15', time: 1.5, boneId: calfL.id, position: [...calfL.position], rotation: [0.3, 0, 0], scale: [1,1,1], interpolation: 'ease' });
  if (calfR) walkKeyframes.push({ id: 'kf_walk_cR_15', time: 1.5, boneId: calfR.id, position: [...calfR.position], rotation: [-0.3, 0, 0], scale: [1,1,1], interpolation: 'ease' });

  // Tempo 2.0: neutro (loop)
  for (const bone of allBones) {
    walkKeyframes.push({
      id: 'kf_walk_' + bone.id + '_20',
      time: 2.0,
      boneId: bone.id,
      position: [...bone.position],
      rotation: [...bone.rotation],
      scale: [...bone.scale],
      interpolation: 'ease',
    });
  }

  // 6. Atualizar cubo com animações
  s.updateObject(cubeId, {
    animations: {
      idle: idleKeyframes,
      walk: walkKeyframes,
    },
  });

  // 7. Auto-peso simples
  const skinWeights = {};
  for (let v = 0; v < 24; v++) {
    skinWeights[v] = {};
    if (v < 8) {
      skinWeights[v][boneIdMap['thigh.L']] = 0.3;
      skinWeights[v][boneIdMap['thigh.R']] = 0.3;
      skinWeights[v][boneIdMap['root']] = 0.4;
    } else if (v < 16) {
      skinWeights[v][boneIdMap['root']] = 0.5;
      skinWeights[v][boneIdMap['spine']] = 0.5;
    } else {
      skinWeights[v][boneIdMap['spine']] = 0.5;
      skinWeights[v][boneIdMap['head']] = 0.5;
    }
  }
  s.updateObject(cubeId, { skinWeights });

  // 8. Criar cena
  const scene = s.createScene('Teste Blending');
  const sceneId = scene.id;

  // 9. Adicionar cubo à cena
  s.addObjectToScene(cubeId, [0, 1, 0]);

  // 10. Adicionar PersonalObject com sourceObjectId = cubo
  s.addConectToScene('PersonalObject', [0, 1, 0]);
  const updatedScene = store.getState().scenes.find(sc => sc.id === sceneId);
  const personalConect = updatedScene.conects.find(c => c.type === 'PersonalObject');
  s.updateConect(personalConect.instanceId, {
    sourceObjectId: cubeId,
    moveSpeed: 3,
    name: 'Jogador',
  });

  // 11. Adicionar AnimationBoostObject
  s.addConectToScene('AnimationBoostObject', [0, 0, 0]);
  const updatedScene2 = store.getState().scenes.find(sc => sc.id === sceneId);
  const boostConect = updatedScene2.conects.find(c => c.type === 'AnimationBoostObject');
  s.updateConect(boostConect.instanceId, { blendTime: 0.3 });

  // 12. Adicionar ViewObject (third-person)
  s.addConectToScene('ViewObject', [0, 3, 5]);
  const updatedScene3 = store.getState().scenes.find(sc => sc.id === sceneId);
  const viewConect = updatedScene3.conects.find(c => c.type === 'ViewObject');
  s.updateConect(viewConect.instanceId, {
    followMode: 'third',
    followDistance: 5,
    followHeight: 3,
    cameraRole: 'player',
  });

  // 13. Adicionar chão (StaticObject) para referência visual
  s.addConectToScene('StaticObject', [0, 0, 0]);
  const updatedScene4 = store.getState().scenes.find(sc => sc.id === sceneId);
  const floorConect = updatedScene4.conects.find(c => c.type === 'StaticObject' && !c.sourceObjectId);
  if (floorConect) {
    s.updateConect(floorConect.instanceId, {
      name: 'Chão',
      scale: [20, 0.1, 20],
    });
  }

  toast('Teste configurado! Vai ao tab CENA e executa o jogo', 'success');
  return JSON.stringify({
    cubeId,
    sceneId,
    personalObjectId: personalConect.instanceId,
    boostId: boostConect.instanceId,
    viewId: viewConect.instanceId,
    idleKeyframes: idleKeyframes.length,
    walkKeyframes: walkKeyframes.length,
    boneCount: allBones.length,
  }, null, 2);
})();
