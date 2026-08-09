// Criar um cubo simples no catálogo para testar se o viewport funciona
(function() {
  const store = window.__flirStore;
  const s = store.getState();
  const obj = s.addObject('cube', [0, 1, 0]);
  s.selectObject(obj.id);
  return JSON.stringify({ id: obj.id, name: obj.name, type: obj.type });
})();
