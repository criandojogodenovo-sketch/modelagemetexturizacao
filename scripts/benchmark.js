/**
 * benchmark.js — Script de benchmark para medir FPS com N NPCs.
 * 
 * Usado via browser console:
 *   benchmark(100) // adiciona 100 NPCs, corre jogo, mede FPS
 */

function addNPCs(count) {
  var data = JSON.parse(localStorage.getItem('me3d.project.v1'))
  var scene = data.state.scenes[0]
  if (!scene) { console.error('No active scene'); return false }
  if (!scene.conects) scene.conects = []
  
  // Limpar NPCs anteriores
  scene.conects = scene.conects.filter(function(c) { return !c.instanceId.startsWith('npc_bench_') })
  
  for (var i = 0; i < count; i++) {
    var x = (Math.random() - 0.5) * 50
    var z = (Math.random() - 0.5) * 50
    scene.conects.push({
      instanceId: 'npc_bench_' + i,
      type: 'NpcObject',
      name: 'NPC ' + i,
      position: [x, 0.5, z],
      rotation: [0, Math.random() * Math.PI * 2, 0],
      scale: [1, 1, 1],
      visible: true,
      mass: 1,
      friction: 0.4,
      restitution: 0.2,
      moveSpeed: 3,
      behavior: 'patrol',
      detectionRadius: 8,
      loseSightRadius: 12,
      health: 100,
      fixedRotation: true,
      colliderShape: 'box',
      colliderSize: [1, 2, 1],
      colliderOffset: [0, 0, 0],
      colliderRadius: 0.5,
      colliderHeight: 1.5,
      flirScript: null,
    })
  }
  
  data.state.scenes[0] = scene
  localStorage.setItem('me3d.project.v1', JSON.stringify(data))
  console.log('Added ' + count + ' NPCs. Total conects: ' + scene.conects.length)
  return true
}

function measureFPS(duration) {
  duration = duration || 5000
  return new Promise(function(resolve) {
    var frames = 0
    var start = performance.now()
    function tick() {
      frames++
      if (performance.now() - start < duration) {
        requestAnimationFrame(tick)
      } else {
        var fps = Math.round(frames * 1000 / (performance.now() - start))
        console.log('FPS: ' + fps + ' (frames: ' + frames + ', duration: ' + (duration/1000) + 's)')
        resolve(fps)
      }
    }
    requestAnimationFrame(tick)
  })
}

window.benchmark = async function(count) {
  console.log('=== BENCHMARK: ' + count + ' NPCs ===')
  
  // Reload to get fresh state
  // Add NPCs
  if (!addNPCs(count)) return
  
  // Reload to apply
  location.reload()
  
  // After reload, we need to manually run the game and measure
  // This is called after reload via window._benchmarkPending
  localStorage.setItem('flir_benchmark_pending', count)
}

// Auto-run after reload if benchmark is pending
window.addEventListener('load', function() {
  var pending = localStorage.getItem('flir_benchmark_pending')
  if (pending) {
    localStorage.removeItem('flir_benchmark_pending')
    var count = parseInt(pending)
    console.log('Resuming benchmark for ' + count + ' NPCs...')
    
    setTimeout(async function() {
      // Dismiss home
      var btn = [].slice.call(document.querySelectorAll('button')).find(function(x) { return x.textContent.includes('Criar agora') || x.textContent.includes('+ Novo Projeto') })
      if (btn) btn.click()
      
      await new Promise(function(r) { setTimeout(r, 1000) })
      
      // Switch to scene
      var tab = [].slice.call(document.querySelectorAll('[role=tab]')).find(function(x) { return x.textContent.trim() === 'Cena' })
      if (tab) tab.click()
      
      await new Promise(function(r) { setTimeout(r, 500) })
      
      // Open drawer
      var drawerBtn = [].slice.call(document.querySelectorAll('button')).find(function(x) { return x.title === 'Ferramentas' })
      if (drawerBtn) drawerBtn.click()
      
      await new Promise(function(r) { setTimeout(r, 500) })
      
      // Run game
      var runBtn = [].slice.call(document.querySelectorAll('button')).find(function(x) { return x.textContent.includes('Executar') })
      if (runBtn) runBtn.click()
      
      // Wait for game to start
      await new Promise(function(r) { setTimeout(r, 3000) })
      
      // Measure FPS
      var fps = await measureFPS(5000)
      
      // Store result
      var results = JSON.parse(localStorage.getItem('flir_benchmark_results') || '[]')
      results.push({ count: count, fps: fps, timestamp: Date.now() })
      localStorage.setItem('flir_benchmark_results', JSON.stringify(results))
      
      console.log('=== RESULT: ' + count + ' NPCs = ' + fps + ' FPS ===')
      
      // Stop game
      var stopBtn = document.querySelector('.preview-exit-btn')
      if (stopBtn) stopBtn.click()
    }, 2000)
  }
})
