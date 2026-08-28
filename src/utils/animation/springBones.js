/**
 * springBones.js — física secundária (spring bones) para cabelo, caudas, tecidos.
 *
 * Sessão 20 / Parte D2 (estilo VRM/MToon spring bones, Babylon bone physics).
 *
 * COMO FUNCIONA:
 *  - Cada "spring chain" parte de um osso RAIZ e segue os ossos filhos até ao
 *    fim da cadeia (ex.: hair_01 → hair_02 → hair_03).
 *  - Cada osso da cadeia é simulado como um PÊNDULO verlet:
 *      · guarda a posição da "ponta" (tail) do frame anterior
 *      · inércia: tail' = tail + (tail - prevTail) * inertia
 *      · gravidade: tail' += gravity * dt²
 *      · vento: tail' += wind * dt² (direção + força variável com o tempo)
 *      · comprimento rígido: normaliza a distância ao "head" (pai) para
 *        boneLength — restrição de distância (stiffness mistura para a pose
 *        original: rigidez alta = menos movimento)
 *  - A ROTAÇÃO do osso é derivada do vetor head→tail simulado (o osso roda
 *    para "olhar" na direção da cauda) — integra-se com o skeleton existente
 *    sem o destruir: a pose base (animação) define o head, a física só dobra
 *    a direção.
 *
 * CONTROLOS (rigidez, peso, flexibilidade): ver SpringChain options.
 *
 * API:
 *   const sim = createSpringBoneSystem(rootObject3D)
 *   sim.addChain({ rootBoneName, gravity, stiffness, drag, windForce, windDir })
 *   sim.update(deltaTime)
 *   sim.setWind({ force, dir })
 */
import * as THREE from 'three'

export function createSpringBoneSystem(scene, options = {}) {
  const chains = []
  let windForce = options.windForce ?? 0
  const windDir = new THREE.Vector3(...(options.windDir || [1, 0, 0])).normalize()
  let time = 0
  const _v = new THREE.Vector3()
  const _v2 = new THREE.Vector3()
  const _q = new THREE.Quaternion()
  const _up = new THREE.Vector3(0, 0, 1) // direção "forward" dos ossos (local +Z... ver abaixo)

  /**
   * Adiciona uma cadeia de spring bones a partir do nome do osso raiz.
   * Percorre filhos até ao fim da cadeia (ou maxBones).
   */
  function addChain(cfg) {
    const rootName = cfg.rootBoneName || cfg.root
    if (!rootName) return null
    // Procurar o osso raiz na cena
    let root = null
    scene.traverse((o) => {
      if (!root && (o.name === rootName || o.userData?.boneId === rootName || o.userData?.boneName === rootName)) {
        root = o
      }
    })
    if (!root) return null
    // Construir a cadeia (raiz + descendentes lineares)
    const bones = [root]
    let cur = root
    for (let i = 0; i < (cfg.maxBones || 8); i++) {
      const child = cur.children.find((c) => c.isBone || c.isObject3D)
      if (!child) break
      bones.push(child)
      cur = child
    }
    const chain = {
      name: cfg.name || rootName,
      bones,
      gravity: new THREE.Vector3(...(cfg.gravity || [0, -9.82, 0])),
      gravityScale: cfg.gravityScale ?? 1,
      stiffness: cfg.stiffness ?? 0.5,        // 0 = mole, 1 = rígido
      drag: cfg.drag ?? 0.4,                  // amortecimento (0 = sem perda)
      inertia: cfg.inertia ?? 0.85,           // conservação de velocidade
      hitRadius: cfg.hitRadius ?? 0.02,
      // estado por osso: { head, tail, prevTail, length, restDirLocal }
      state: bones.map((bone, i) => {
        const head = new THREE.Vector3()
        bone.getWorldPosition(head)
        // tail inicial = posição mundial do filho (ou head + forward*len)
        let tail = new THREE.Vector3()
        const child = bones[i + 1]
        if (child) child.getWorldPosition(tail)
        else tail.copy(head).add(new THREE.Vector3(0, -0.1, 0))
        const length = head.distanceTo(tail) || 0.1
        return {
          head, tail, prevTail: tail.clone(), length,
          initialized: false,
        }
      }),
    }
    chains.push(chain)
    return chain
  }

  function removeChain(name) {
    const i = chains.findIndex((c) => c.name === name)
    if (i >= 0) chains.splice(i, 1)
  }

  function setWind({ force, dir } = {}) {
    if (force != null) windForce = force
    if (dir) windDir.set(...dir).normalize()
  }

  /**
   * Simula + aplica. Chamar a cada frame DEPOIS da animação de pose
   * (a pose define head; a física calcula tail e roda o osso).
   */
  function update(deltaTime) {
    const dt = Math.min(deltaTime, 1 / 30)
    time += dt
    // vento oscilante (golfadas suaves)
    const windPhase = Math.sin(time * 1.7) * 0.5 + Math.sin(time * 3.3) * 0.3
    const windMag = windForce * (0.6 + 0.4 * windPhase)
    for (const chain of chains) {
      for (let i = 0; i < chain.bones.length - 1; i++) {
        const bone = chain.bones[i]
        const st = chain.state[i]
        // 1. head = posição mundial ATUAL do osso (definida pela animação)
        bone.getWorldPosition(st.head)
        if (!st.initialized) {
          const child = chain.bones[i + 1]
          child.getWorldPosition(st.tail)
          st.prevTail.copy(st.tail)
          st.initialized = true
        }
        // 2. inércia (verlet)
        _v.copy(st.tail).sub(st.prevTail).multiplyScalar(chain.inertia * (1 - chain.drag * 0.5))
        st.prevTail.copy(st.tail)
        st.tail.add(_v)
        // 3. gravidade
        st.tail.addScaledVector(chain.gravity, chain.gravityScale * dt * dt * 60)
        // 4. vento (mundo)
        if (windMag > 0.001) {
          _v.copy(windDir).multiplyScalar(windMag * dt * dt * 90)
          st.tail.add(_v)
        }
        // 5. restrição: distância fixa ao head (com stiffness para a direção original)
        _v.copy(st.tail).sub(st.head)
        const dist = _v.length()
        if (dist > 1e-6) {
          _v.multiplyScalar(st.length / dist)
          st.tail.copy(st.head).add(_v)
        }
        // stiffness: puxa a tail de volta para a direção neutra (pose animada)
        // direção "descanso" = direção atual do filho ANIMADO
        const child = chain.bones[i + 1]
        child.getWorldPosition(_v2)
        if (chain.stiffness > 0.001) {
          _v2.sub(st.head).setLength(st.length)
          st.tail.lerp(_v2.add(st.head), chain.stiffness * dt * 8)
          // re-normalizar comprimento
          _v.copy(st.tail).sub(st.head)
          if (_v.length() > 1e-6) {
            _v.setLength(st.length)
            st.tail.copy(st.head).add(_v)
          }
        }
        // 6. aplicar rotação ao osso: roda o osso para que o seu +Y aponte head→tail
        //    (convenção three: bones apontam tipicamente em +Y)
        _v.copy(st.tail).sub(st.head).normalize()
        // converter para espaço LOCAL do pai
        const parent = bone.parent
        if (parent) {
          parent.updateWorldMatrix(true, false)
          _v.transformDirection(new THREE.Matrix4().copy(parent.matrixWorld).invert())
        }
        _q.setFromUnitVectors(_up.set(0, 1, 0), _v)
        bone.quaternion.copy(_q)
        // (aplicar após atualizar matrizes do próprio osso para o próximo da cadeia)
        bone.updateMatrixWorld(true)
      }
    }
  }

  function dispose() {
    chains.length = 0
  }

  return { chains, addChain, removeChain, setWind, update, dispose }
}
