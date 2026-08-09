// Gerar edifício diretamente no catálogo (sem mudar de tab)
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  // Importar dinamicamente o buildingGenerator
  return import('/src/utils/buildingGenerator.js').then(mod => {
    const obj = mod.createBuildingObject({ floors: 2, roofType: 'pitched', width: 6, depth: 4, floorHeight: 3, wallColor: '#cccccc' });
    store.getState().addImportedObject(obj);
    store.getState().selectObject(obj.id);
    return JSON.stringify({ id: obj.id, name: obj.name, posCount: obj.customGeometry.positions.length });
  });
})();
