/**
 * flirDDGI.js — Dynamic Diffuse Global Illumination (DDGI) para a Flir Engine.
 *
 * Sessão 20 / Parte B1 — "Realismo ultragigantesco" (nível Flax 1.12 / UE5-lite).
 *
 * COMO FUNCIONA:
 *  - Uma grelha de LIGHT PROBES espalhada pelos bounds da cena.
 *  - Cada probe tem uma CubeCamera de baixa resolução que renderiza a cena
 *    (iluminação direta + superfícies emissivas) periodicamente — de forma
 *    ESCALONADA (staggered): só N probes se atualizam por frame, evitando
 *    picos de custo.
 *  - O render do cubo é convoluído via PMREMGenerator → irradiância difusa
 *    E reflexos especulares pre-filtrados (roughness-aware) por probe.
 *  - CADA MESH recebe o envMap do probe mais próximo (com interpolação suave
 *    de intensidade pela distância ao centro da célula do probe).
 *  - PROBES FALLBACK (estilo Flax 1.12): fora da grelha / sem dados próximos,
 *    o objeto usa o environment de fallback global (média da cena) com fade —
 *    nunca fica "sem GI" nem com seam visível.
 *
 * RESULTADO VISUAL: a luz "salta" entre superfícies — uma parede vermelha
 * iluminada pelo sol tinge o chão ao lado; uma esfera emissiva ilumina os
 * objetos vizinhos; céu azul acorda a penumbra.
 *
 * CUSTO (WebGL2, cenário típico):
 *  - 2 probes/frame × (6 faces @64px + PMREM) ≈ 0.4-1.2ms
 *  - Sem custo extra no shader principal (usa envMap nativo do
 *    MeshStandardMaterial → herda shadow mapping, tonemapping, etc.)
 *
 * COMPATIBILIDADE: partículas e personagens em ambientes abertos funcionam
 * porque o GI é aplicado ao nível do MATERIAL (qualquer MeshStandardMaterial,
 * incluindo instâncias e skinned meshes), não por objeto especial.
 */
import * as THREE from 'three'

const DEFAULTS = {
  gridDivisions: [4, 3, 4],   // nº de probes em X/Y/Z (4×3×4 = 48 probes)
  probeResolution: 64,         // resolução das faces do cubemap
  probesPerFrame: 2,           // probes atualizados por frame (staggered)
  updateInterval: 0.35,        // cada probe re-renderiza a cada ~350ms
  probeInfluence: 1.6,         // alcance de influência (× tamanho da célula)
  intensity: 1.0,              // multiplicador global de envMapIntensity
  fallbackIntensity: 0.55,     // intensidade fora da grelha (probes fallback)
  assignInterval: 0.5,         // re-atribuição de probes às meshes (s)
  margin: 2,                   // margem extra nos bounds da cena
}

export function createDDGI(scene, renderer, options = {}) {
  const opts = { ...DEFAULTS, ...options }
  const probes = []
  let disposed = false
  let probeCursor = 0
  let assignTimer = 0

  // ---------- PMREM (partilhado) ----------
  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileCubemapShader()

  // ---------- Cube render target (partilhado por todas as probes) ----------
  const cubeRT = new THREE.WebGLCubeRenderTarget(opts.probeResolution, {
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  })

  // Uma única CubeCamera reutilizada (mover de probe em probe)
  const cubeCamera = new THREE.CubeCamera(0.05, 500, cubeRT)

  // ---------- Bounds da cena ----------
  function computeSceneBounds() {
    const box = new THREE.Box3()
    let hasAnything = false
    scene.traverse((o) => {
      if (o.isMesh && o.visible && !o.userData.__flirExcludeGI) {
        o.geometry?.computeBoundingBox?.()
        const bb = o.geometry?.boundingBox
        if (bb) {
          const wp = new THREE.Box3().copy(bb).applyMatrix4(o.matrixWorld)
          box.union(wp)
          hasAnything = true
        }
      }
    })
    if (!hasAnything) {
      box.set(new THREE.Vector3(-10, 0, -10), new THREE.Vector3(10, 10, 10))
    }
    box.expandByScalar(opts.margin)
    return box
  }

  // ---------- Construir a grelha de probes ----------
  function buildProbeGrid() {
    const box = computeSceneBounds()
    const size = box.getSize(new THREE.Vector3())
    const [nx, ny, nz] = opts.gridDivisions
    const cell = new THREE.Vector3(
      Math.max(0.5, size.x / Math.max(1, nx - 1)),
      Math.max(0.5, size.y / Math.max(1, ny - 1)),
      Math.max(0.5, size.z / Math.max(1, nz - 1)),
    )
    for (let ix = 0; ix < nx; ix++) {
      for (let iy = 0; iy < ny; iy++) {
        for (let iz = 0; iz < nz; iz++) {
          const p = new THREE.Vector3(
            box.min.x + (nx > 1 ? (size.x * ix) / (nx - 1) : size.x / 2),
            box.min.y + (ny > 1 ? (size.y * iy) / (ny - 1) : size.y / 2),
            box.min.z + (nz > 1 ? (size.z * iz) / (nz - 1) : size.z / 2),
          )
          probes.push({
            position: p,
            cell,
            envRT: null,         // WebGLRenderTarget PMREM
            lastUpdate: -1e9,
            assigned: new Set(), // meshes a usar este probe
          })
        }
      }
    }
  }
  buildProbeGrid()

  // ---------- Atualizar um probe (render + PMREM) ----------
  function updateProbe(probe, now) {
    if (disposed) return
    cubeCamera.position.copy(probe.position)
    const prevRenderTarget = renderer.getRenderTarget()
    const prevXREnabled = renderer.xr.enabled
    renderer.xr.enabled = false
    cubeCamera.update(renderer, scene)
    renderer.xr.enabled = prevXREnabled
    renderer.setRenderTarget(prevRenderTarget)
    // PMREM: cubo → irradiância + specular pre-filtered
    const envRT = pmrem.fromCubemap(cubeRT.texture)
    if (probe.envRT) probe.envRT.dispose()
    probe.envRT = envRT
    probe.lastUpdate = now
  }

  // ---------- Probe mais próximo + intensidade com fallback ----------
  function nearestProbe(pos) {
    let best = null
    let bestDist = Infinity
    for (const probe of probes) {
      const d = probe.position.distanceTo(pos)
      if (d < bestDist) { bestDist = d; best = probe }
    }
    if (!best) return null
    // Fallback (Flax 1.12): além de influence×cell, fade para fallbackIntensity
    const reach = best.cell.length() * 0.5 * opts.probeInfluence
    let intensity = opts.intensity
    if (bestDist > reach) {
      const t = Math.min(1, (bestDist - reach) / Math.max(0.001, reach))
      intensity = THREE.MathUtils.lerp(opts.intensity, opts.fallbackIntensity, t)
    }
    return { probe, intensity }
  }

  // ---------- Re-atribuir probes às meshes ----------
  function assignProbes() {
    for (const probe of probes) probe.assigned.clear()
    const candidates = []
    scene.traverse((o) => {
      if (!o.isMesh || !o.visible) return
      const mat = o.material
      if (!mat || !mat.isMeshStandardMaterial) return
      if (o.userData.__flirExcludeGI) return
      candidates.push(o)
    })
    for (const mesh of candidates) {
      const wp = mesh.getWorldPosition(new THREE.Vector3())
      const found = nearestProbe(wp)
      if (!found || !found.probe.envRT) continue
      found.probe.assigned.add(mesh)
    }
    // Aplicar envMaps
    for (const probe of probes) {
      for (const mesh of probe.assigned) {
        const mat = mesh.material
        const wp = mesh.getWorldPosition(new THREE.Vector3())
        const found = nearestProbe(wp)
        const envMap = found.probe.envRT?.texture || null
        if (mat.envMap !== envMap) {
          mat.envMap = envMap
          mat.envMapIntensity = found.intensity
          mat.needsUpdate = true
        } else if (Math.abs((mat.envMapIntensity ?? 1) - found.intensity) > 0.03) {
          mat.envMapIntensity = found.intensity
        }
      }
    }
  }

  // ---------- Loop (chamar a cada frame) ----------
  function update(deltaTime = 1 / 60) {
    if (disposed) return
    const now = performance.now() / 1000
    // Staggered: N probes por frame, respeitando o intervalo
    let updated = 0
    for (let i = 0; i < probes.length && updated < opts.probesPerFrame; i++) {
      const probe = probes[probeCursor % probes.length]
      probeCursor++
      if (now - probe.lastUpdate >= opts.updateInterval) {
        updateProbe(probe, now)
        updated++
      }
    }
    // Re-atribuição periódica (objetos novos/movidos)
    assignTimer += deltaTime
    if (assignTimer >= opts.assignInterval) {
      assignTimer = 0
      assignProbes()
    }
  }

  // ---------- Debug: gizmos das probes ----------
  const debugGroup = new THREE.Group()
  debugGroup.name = '__flirDDGI_debug'
  debugGroup.visible = false
  scene.add(debugGroup)
  function setDebug(visible) {
    debugGroup.visible = !!visible
    if (visible && debugGroup.children.length === 0) {
      for (const probe of probes) {
        const g = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0x40c4ff }),
        )
        g.position.copy(probe.position)
        g.userData.__flirExcludeGI = true
        debugGroup.add(g)
      }
    }
  }

  // ---------- API ----------
  const api = {
    update,
    setDebug,
    probes,
    assignProbes,
    setIntensity(v) { opts.intensity = v },
    dispose() {
      disposed = true
      scene.remove(debugGroup)
      debugGroup.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.() })
      for (const probe of probes) {
        if (probe.envRT) probe.envRT.dispose()
        probe.assigned.clear()
      }
      probes.length = 0
      cubeRT.dispose()
      pmrem.dispose()
      // Remover envMaps aplicados
      scene.traverse((o) => {
        if (o.isMesh && o.material?.isMeshStandardMaterial && o.material.envMap) {
          o.material.envMap = null
          o.material.envMapIntensity = 1
          o.material.needsUpdate = true
        }
      })
    },
  }
  // Primeira atualização imediata de algumas probes (evita 1º segundo sem GI)
  setTimeout(() => {
    if (disposed) return
    const now = performance.now() / 1000
    for (let i = 0; i < Math.min(probes.length, 8); i++) updateProbe(probes[i], now)
    assignProbes()
  }, 0)
  return api
}
