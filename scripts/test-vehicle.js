// Gerar veículo diretamente no catálogo via store
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  // Criar veículo sedan
  const vehicle = {
    id: 'obj_vehicle_test',
    name: 'Carro Sedan',
    type: 'custom',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    material: { color: '#3fb950', roughness: 0.4, metalness: 0.5 },
    customGeometry: null, // será preenchido
    modifiers: [],
  };
  // Gerar geometria
  return import('/src/utils/buildingGenerator.js').then(mod => {
    const obj = mod.createVehicleObject({ bodyType: 'sedan', wheelSize: 0.4, color: '#3fb950' });
    store.getState().addImportedObject(obj);
    // Não selecionar para evitar crash do MaterialEditor
    return JSON.stringify({ id: obj.id, name: obj.name, posCount: obj.customGeometry.positions.length });
  }).catch(err => 'ERROR: ' + err.message);
})();
