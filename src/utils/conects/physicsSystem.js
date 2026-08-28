/**
 * PhysicsSystem — motor de física integrado com cannon-es.
 *
 * Responsabilidades:
 *  - Criar um mundo CANNON.World com gravidade configurável por cena
 *  - Sincronizar Conects de física (RigidObject, StaticObject, StopObject,
 *    PersonalObject) com corpos CANNON
 *  - Atualizar o mundo a cada frame e sincronizar transforms de volta ao Three.js
 *  - Detetar colisões e disparar eventos (onCollision) para o FlirScript
 *  - Triggers: TriggerObject cria corpos sensor que disparam onEnterZone/onExitZone
 *  - Limite de objetos com física ativa (avisa se exceder para telemóveis fracos)
 *
 * API:
 *  - createPhysicsSystem(options) — cria instância
 *  - physics.addConect(conectInstance, mesh) — regista um conect
 *  - physics.removeConect(instanceId)
 *  - physics.update(deltaTime) — step + sync
 *  - physics.setGravity([x, y, z])
 *  - physics.applyForce(instanceId, force)
 *  - physics.movePersonal(instanceId, direction, speed)
 *  - physics.jumpPersonal(instanceId)
 *  - physics.dispose()
 */
import * as CANNON from 'cannon-es'
import * as THREE from 'three'
import { findConectDefinition } from './taxonomy'
import { SpatialPartitionSystem } from '../spatialPartitionSystem'

const MAX_PHYSICS_OBJECTS = 50 // limite para performance em mobile

export function createPhysicsSystem(options = {}) {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, options.gravity ?? -9.82, 0),
  })
  world.broadphase = new CANNON.SAPBroadphase(world)
  // A1 fix: allowSleep=true faz bodies adormecerem e ignorar velocity changes.
  // Mesmo com wakeUp(), o body volta a adormecer rapidamente se estiver parado.
  // Para personagens (player + NPCs), desativamos sleep individualmente.
  // Para o world, mantemos allowSleep=true para otimizar objetos estáticos.
  world.allowSleep = true
  world.defaultContactMaterial.friction = 0.4
  world.defaultContactMaterial.restitution = 0.2

  // Objectos reutilizáveis para raycast (evita allocations por frame)
  const _rayFrom = new CANNON.Vec3()
  const _rayTo = new CANNON.Vec3()
  const _rayResult = new CANNON.RaycastResult()
  // Set reutilizável para triggers (evita new Set() por trigger por frame)
  const _triggerContacts = new Set()

  // Materiais para diferentes tipos de interação
  const materials = {
    default: new CANNON.Material('default'),
    ground: new CANNON.Material('ground'),
    player: new CANNON.Material('player'),
  }
  // S20/A1 fix: fricção do material dos personagens = 0.
  // cannon-es: se AMBOS os materiais em contacto têm friction >= 0, usa
  // friction = matA.friction * matB.friction; e se friction resolve para 0,
  // NENHUMA equação de fricção é criada (createFrictionEquationsFromContact
  // só cria equações quando friction > 0) → personagens deslizam livremente,
  // sem serem "colados" ao chão pelo integrador.
  materials.player.friction = 0
  materials.player.restitution = 0
  world.addContactMaterial(new CANNON.ContactMaterial(materials.ground, materials.default, {
    friction: 0.6, restitution: 0.1,
  }))
  // S20/A1 fix: personagem-chão com friction=0. Personagens movidos por
  // velocity por código (movePersonal) precisam de fricção ZERO contra o
  // chão — fricção elevada "cola" o body ao solo e o torna imóvel
  // (bug confirmado no export S19; agora corrigido também no editor).
  world.addContactMaterial(new CANNON.ContactMaterial(materials.player, materials.ground, {
    friction: 0, restitution: 0,
  }))
  // S20/A1 fix: personagem-default (paredes, objetos) com friction=0
  world.addContactMaterial(new CANNON.ContactMaterial(materials.player, materials.default, {
    friction: 0, restitution: 0,
  }))

  // Mapa instanceId → { body, mesh, conect, type, grounded, isTrigger }
  const bodies = new Map()
  // S17 fix (P3-29): reverse lookup body.uuid → instanceId — evita [...bodies.entries()].find()
  // O(N) com spread allocation por cada evento de colisão
  const bodyIdToInstance = new Map()
  // Lista de triggers ativos para verificação
  const triggers = []
  // Estado de tracking de colisões para evitar duplicar eventos
  const collisionPairs = new Set()
  // Callbacks de eventos
  const eventListeners = {
    onCollision: [],
    onTriggerEnter: [],
    onTriggerExit: [],
  }

  function on(eventName, callback) {
    eventListeners[eventName]?.push(callback)
  }
  function emit(eventName, payload) {
    eventListeners[eventName]?.forEach((cb) => cb(payload))
  }

  // Cria shape CANNON baseado no tipo de geometria do conect
  // Sistema 1: suporta colisor independente do modelo visual
  function createShape(conect, mesh) {
    const shape = conect.colliderShape || 'model'

    // Modo "model" — usar bounding box do mesh (comportamento original)
    if (shape === 'model' || !shape) {
      let size = [1, 1, 1]
      if (mesh) {
        mesh.geometry?.computeBoundingBox?.()
        const bb = mesh.geometry?.boundingBox
        if (bb) {
          size = [
            Math.max(0.1, (bb.max.x - bb.min.x) / 2),
            Math.max(0.1, (bb.max.y - bb.min.y) / 2),
            Math.max(0.1, (bb.max.z - bb.min.z) / 2),
          ]
        }
      }
      // Override para triggers
      if (conect.type === 'TriggerObject' && conect.size) {
        size = [conect.size[0] / 2, conect.size[1] / 2, conect.size[2] / 2]
      }
      return new CANNON.Box(new CANNON.Vec3(size[0], size[1], size[2]))
    }

    // Colisor independente — usar propriedades personalizadas
    const cs = conect.colliderSize || [1, 1, 1]
    const radius = Math.max(0.05, conect.colliderRadius || 0.5)
    const height = Math.max(0.1, conect.colliderHeight || 1.5)

    if (shape === 'box') {
      return new CANNON.Box(new CANNON.Vec3(cs[0] / 2, cs[1] / 2, cs[2] / 2))
    }
    if (shape === 'sphere') {
      return new CANNON.Sphere(radius)
    }
    if (shape === 'capsule') {
      // cannon-es não tem Capsule nativa; usar Cylinder como aproximação
      // (visualmente mostramos cápsula no gizmo, mas a física usa cylinder)
      const r = Math.max(0.05, radius)
      const h = Math.max(0.1, height)
      try {
        return new CANNON.Cylinder(r, r, h, 8)
      } catch (e) {
        return new CANNON.Sphere(r)
      }
    }

    // Fallback
    return new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5))
  }

  // Sistema 1: retorna offset do colisor (para posicionar body separado do mesh)
  function getColliderOffset(conect) {
    if (conect.colliderShape && conect.colliderShape !== 'model') {
      return conect.colliderOffset || [0, 0, 0]
    }
    return [0, 0, 0]
  }

  // Adiciona um conect ao sistema de física
  function addConect(conect, mesh) {
    if (bodies.size >= MAX_PHYSICS_OBJECTS) {
      console.warn(`[Physics] Limite de ${MAX_PHYSICS_OBJECTS} objetos atingido — conexões adicionais podem ser lentas`)
    }

    const def = findConectDefinition(conect.type)
    if (!def?.hasPhysics) return null

    // TriggerObject = sensor, sem colisão física
    const isTrigger = conect.isTrigger || conect.type === 'TriggerObject'

    // TerrainObject: criar um PLANO de chão infinito em vez de uma box
    if (conect.type === 'TerrainObject') {
      const planeShape = new CANNON.Plane()
      const planeBody = new CANNON.Body({
        mass: 0,
        shape: planeShape,
        position: new CANNON.Vec3(
          conect.position?.[0] || 0,
          conect.position?.[1] || 0,
          conect.position?.[2] || 0
        ),
        // S20/A1 fix: material GROUND no plano — antes era null e os contactos
        // personagem-terreno caíam no defaultContactMaterial (friction 0.4) que
        // "colava" os personagens ao chão. Com materials.ground, o par
        // player→ground usa o ContactMaterial friction=0 (personagens deslizam
        // livremente; rigid objects mantêm ground→default 0.6).
        material: materials.ground,
      })
      // O plano aponta para +Z por defeito — rodar para apontar para +Y (chão)
      planeBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
      world.addBody(planeBody)
      // S17 fix (P0-05): registar `type` na entry — antes ficava undefined, o que tornava
      // o guard `entry.type !== 'TerrainObject'` (SceneLevel3D) ineficaz e deixava o
      // quaternion -PI/2 do body ser copiado para o mesh cuja geometria já tem rotateX(-PI/2)
      // baked → terreno vertical (parede gigante) em Play Mode.
      bodies.set(conect.instanceId, { body: planeBody, conect, mesh, type: conect.type })
      bodyIdToInstance.set(planeBody.id, conect.instanceId)
      return planeBody
    }

    const shape = createShape(conect, mesh)
    // Sistema 1: aplicar offset do colisor à posição do body
    const offset = getColliderOffset(conect)
    const bodyPos = new CANNON.Vec3(
      conect.position[0] + offset[0],
      conect.position[1] + offset[1],
      conect.position[2] + offset[2]
    )
    // CRITICAL: cannon-es sets body.type = STATIC when mass <= 0 (see cannon-es Body constructor).
    // PersonalObject and NpcObject MUST have mass > 0 or they become immovable static bodies
    // and movePersonal()/velocity changes are silently ignored by the integrator.
    // Use taxonomy defaults (mass=1, fixedRotation=true) when the conect doesn't specify them.
    const isCharacter = conect.type === 'PersonalObject' || conect.type === 'NpcObject'
    const defaultMass = isCharacter ? 1 : 0
    const body = new CANNON.Body({
      mass: isTrigger ? 0 : (conect.mass ?? defaultMass),
      shape,
      position: bodyPos,
      material: isCharacter ? materials.player : materials.default,
    })
    // A1 fix: characters NUNCA adormecem (allowSleep=false individual)
    // Isto garante que velocity changes em movePersonal/jumpPersonal são sempre aplicadas
    body.allowSleep = isCharacter ? false : true
    // A1 fix: linearDamping moderado para characters — suficiente para parar mas não abrupto
    body.linearDamping = conect.linearDamping ?? (isCharacter ? 0.2 : 0.01)
    // A1 fix: angularDamping alto para characters (impede rotação residual)
    body.angularDamping = conect.angularDamping ?? (isCharacter ? 0.9 : 0.01)
    // A1 fix: fixedRotation SEMPRE true para characters (impede cair/rolar)
    // S20/A1 fix (CRÍTICO): updateMassProperties() é chamado no construtor do
    // Body ANTES desta linha — fixedRotation=true pós-construção sem
    // updateMassProperties() deixa invInertia != 0, permitindo que impulsos
    // de contacto/gravidade rodem o body → NPCs "tombam" ao mover-se.
    // Chamando updateMassProperties() agora, invInertia fica a zeros e a
    // rotação fica realmente bloqueada.
    if (isCharacter || conect.fixedRotation) {
      body.fixedRotation = true
      body.updateMassProperties()
      body.angularVelocity.set(0, 0, 0)
    } else {
      body.fixedRotation = conect.fixedRotation ?? false
    }

    // Tipos especiais
    if (conect.type === 'StaticObject') {
      body.type = CANNON.Body.STATIC
      body.mass = 0
    } else if (conect.type === 'StopObject') {
      // Kinematic: movido por código, não por física
      body.type = CANNON.Body.KINEMATIC
      body.mass = 0
    } else if (isTrigger) {
      body.collisionResponse = false // não gera colisão física
      body.isTrigger = true
    }

    // Aplicar rotação inicial
    if (conect.rotation) {
      body.quaternion.setFromEuler(...conect.rotation)
    }

    // S20/A1 fix (CRÍTICO — igual ao export S19): clamp de spawn para
    // personagens. Um spawn com o colisor a atravessar o chão (ex.: y=0.05
    // com meio-colisor 0.8) gera penetração profunda; o cannon-es resolve
    // com um impulso gigante e lança o corpo ao ar (player ia a y=12+ e
    // nunca aterrava; NPCs bobavam entre y=3-4). Clampear o spawn para o
    // topo do colisor elimina o lançamento.
    if (isCharacter) {
      let halfH = 0.8
      if (shape.halfExtents) halfH = shape.halfExtents.y
      else if (shape.radius && !shape.height) halfH = shape.radius
      else if (shape.height) halfH = shape.height / 2
      if (body.position.y < halfH + 0.02) body.position.y = halfH + 0.02
    }

    world.addBody(body)
    bodyIdToInstance.set(body.id, conect.instanceId)
    bodies.set(conect.instanceId, {
      body,
      mesh,
      conect,
      type: conect.type,
      grounded: false,
      isTrigger,
      previousContacts: new Set(),
    })

    // Performance Core 3.6 — Registar no SpatialPartitionSystem
    // (apenas corpos não-trigger, para query de triggers os encontrarem)
    if (!isTrigger) {
      SpatialPartitionSystem.insert(
        conect.instanceId,
        body.position.x,
        body.position.y,
        body.position.z,
        conect.type
      )
    }

    if (isTrigger) {
      triggers.push(conect.instanceId)
    }

    // Eventos de colisão do cannon
    const collideHandler = (e) => {
      // S17 fix (P3-29): reverse lookup O(1) em vez de [...bodies.entries()].find() O(N)
      const otherId = bodyIdToInstance.get(e.body?.id)
      if (!otherId) return
      const pairKey = `${conect.instanceId}:${otherId}`
      if (collisionPairs.has(pairKey)) return
      collisionPairs.add(pairKey)
      setTimeout(() => collisionPairs.delete(pairKey), 100)

      emit('onCollision', {
        instanceId: conect.instanceId,
        otherInstanceId: otherId,
      })
    }
    body.addEventListener('collide', collideHandler)
    // Guardar referência para cleanup no dispose
    // BUG6-FIX: ler a entry acabada de criar (referência directa em vez de variável inexistente)
    const createdEntry = bodies.get(conect.instanceId)
    if (createdEntry) createdEntry._collideHandler = collideHandler

    return body
  }

  function removeConect(instanceId) {
    const entry = bodies.get(instanceId)
    if (!entry) return
    world.removeBody(entry.body)
    bodyIdToInstance.delete(entry.body.id)
    bodies.delete(instanceId)
    // Performance Core 3.6 — Remover do SpatialPartitionSystem
    SpatialPartitionSystem.remove(instanceId)
    const tIdx = triggers.indexOf(instanceId)
    if (tIdx >= 0) triggers.splice(tIdx, 1)
  }

  function setGravity(gravity) {
    world.gravity.set(gravity[0], gravity[1], gravity[2])
  }

  function applyForce(instanceId, force) {
    const entry = bodies.get(instanceId)
    if (!entry) return
    entry.body.applyForce(new CANNON.Vec3(force[0], force[1], force[2]), entry.body.position)
  }

  // Helper interno: tipos de corpo "character" (PersonalObject + NpcObject).
  // BUG6-FIX: NPC AI usa o mesmo pipeline de movimento que o jogador — o guard
  // anterior (`entry.type !== 'PersonalObject'`) fazia movePersonal retornar early
  // silenciosamente para todos os NpcObject, paralisando-os no mundo.
  function isCharacterType(type) {
    return type === 'PersonalObject' || type === 'NpcObject'
  }

  function movePersonal(instanceId, direction, speed) {
    const entry = bodies.get(instanceId)
    // BUG6-FIX: aceitar NpcObject em paralelo com PersonalObject
    if (!entry || !isCharacterType(entry.type)) return
    // A fix: acordar o body se estiver a dormir (cannon-es allowSleep=true
    // faz bodies adormecerem após inatividade, ignorando velocity changes)
    if (entry.body.wakeUp) entry.body.wakeUp()
    // Aplicar velocidade horizontal diretamente
    entry.body.velocity.x = direction[0] * speed
    entry.body.velocity.z = direction[2] * speed
    // Manter Y (gravidade/salto)
  }

  // BUG6-FIX: alias explícito para NPCs — semântica idêntica a movePersonal,
  // mas aceita apenas NpcObject. Permite chamar moveNpc(id, dir, speed) sem
  // ambiguidade (mantém movePersonal para retrocompatibilidade com o jogador).
  function moveNpc(instanceId, direction, speed) {
    const entry = bodies.get(instanceId)
    if (!entry || entry.type !== 'NpcObject') return
    if (entry.body.wakeUp) entry.body.wakeUp()
    entry.body.velocity.x = direction[0] * speed
    entry.body.velocity.z = direction[2] * speed
  }

  function jumpPersonal(instanceId) {
    const entry = bodies.get(instanceId)
    // BUG6-FIX: aceitar NpcObject
    if (!entry || !isCharacterType(entry.type)) return
    if (entry.body.wakeUp) entry.body.wakeUp()
    // FASE 9: Coyote time + salto duplo configurável
    const coyoteTime = entry.conect.coyoteTime ?? 0.15
    const maxJumps = entry.conect.maxJumps ?? 1
    // Inicializar estado de saltos se não existir
    if (entry._jumpsUsed === undefined) entry._jumpsUsed = 0
    if (entry._coyoteTimer === undefined) entry._coyoteTimer = 0
    // Verificar se pode saltar
    const canJumpNow = entry.grounded || (entry._coyoteTimer > 0) || (entry._jumpsUsed < maxJumps)
    if (!canJumpNow) return
    const jumpForce = entry.conect.jumpForce ?? 8
    entry.body.velocity.y = jumpForce
    // Se estava grounded ou em coyote time, é o 1º salto
    if (entry.grounded || entry._coyoteTimer > 0) {
      entry._jumpsUsed = 1
    } else {
      entry._jumpsUsed += 1
    }
    entry.grounded = false
    entry._coyoteTimer = 0
  }

  // FASE 9: Atualizar coyote timer — chamado a cada frame
  function updatePersonalState(instanceId, deltaTime) {
    const entry = bodies.get(instanceId)
    // BUG6-FIX: aceitar NpcObject
    if (!entry || !isCharacterType(entry.type)) return
    if (entry._coyoteTimer === undefined) entry._coyoteTimer = 0
    if (entry._jumpsUsed === undefined) entry._jumpsUsed = 0
    // Reset jumps quando toca o chão
    if (entry.grounded) {
      entry._jumpsUsed = 0
      entry._coyoteTimer = entry.conect.coyoteTime ?? 0.15
    } else {
      // Decrementar coyote timer
      if (entry._coyoteTimer > 0) {
        entry._coyoteTimer = Math.max(0, entry._coyoteTimer - deltaTime)
      }
    }
  }

  // Atualiza o mundo e sincroniza transforms
  function update(deltaTime) {
    // Step do mundo físico (fixed timestep)
    // S20/A1: maxSubSteps 10 (igual ao export S19) — em dispositivos lentos
    // (software WebGL ~6fps) a simulação avançava só 0.05s por 0.15s real
    // (câmara lenta). Com 10 substeps a física mantém-se próxima do tempo real.
    world.step(1 / 60, deltaTime, 10)

    // Sincronizar transforms dos corpos para os meshes
    for (const [instanceId, entry] of bodies) {
      const { body, mesh, type, isTrigger } = entry
      if (type === 'StaticObject') continue // estáticos não se movem
      // S17 fix (P0-05): TerrainObject NUNCA sincroniza transform com o body — a
      // geometria já tem a rotação baked e o CANNON.Plane nunca se move. Copiar o
      // quaternion (-PI/2) do body duplicava a rotação → terreno vertical.
      if (type === 'TerrainObject') continue
      if (mesh) {
        mesh.position.set(body.position.x, body.position.y, body.position.z)
        mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w)
      }

      // Performance Core 3.6 — Atualizar posição no SpatialPartitionSystem
      // (apenas corpos não-trigger, para query de triggers os encontrarem)
      if (!isTrigger) {
        SpatialPartitionSystem.update(instanceId, body.position.x, body.position.y, body.position.z)
      }

      // Detetar "grounded" para PersonalObject ou NpcObject (raycast para baixo)
      // BUG6-FIX: NpcObject também precisa de detetar chão para futuras ações de salto
      if (type === 'PersonalObject' || type === 'NpcObject') {
        // Reutilizar objectos pré-alocados (evita 3 allocations por frame)
        _rayFrom.set(body.position.x, body.position.y, body.position.z)
        _rayTo.set(body.position.x, body.position.y - 1.1, body.position.z)
        _rayResult.reset()
        world.raycastClosest(_rayFrom, _rayTo, { skipBackfaces: true, collisionFilterMask: -1 }, _rayResult)
        entry.grounded = _rayResult.hasHit
        // S17 fix (P3-28): atualizar coyote timer / jump count — antes updatePersonalState
        // era exportado mas nunca chamado, deixando coyote time e salto duplo inertes
        updatePersonalState(instanceId, deltaTime)
      }
    }

    // Verificar triggers (sobreposição com outros corpos)
    // Performance Core 3.6 — Otimizado com SpatialPartitionSystem
    // Antes: O(triggers × bodies) por frame
    // Agora: O(triggers × candidates) onde candidates = bodies na vizinhança do trigger
    for (const triggerId of triggers) {
      const triggerEntry = bodies.get(triggerId)
      if (!triggerEntry) continue
      _triggerContacts.clear()
      const triggerPos = triggerEntry.body.position
      const triggerSize = triggerEntry.conect.size || [2, 2, 2]
      // Query espacial: encontrar bodies na região do trigger (max dimension)
      const maxDim = Math.max(triggerSize[0], triggerSize[1], triggerSize[2])
      const candidates = SpatialPartitionSystem.querySphere(
        triggerPos.x, triggerPos.y, triggerPos.z, maxDim
      )
      // Verificar sobreposição com cada candidato
      for (const otherId of candidates) {
        if (otherId === triggerId) continue
        const otherEntry = bodies.get(otherId)
        if (!otherEntry || otherEntry.isTrigger) continue
        const otherPos = otherEntry.body.position
        // Verificação simples AABB
        const dx = Math.abs(otherPos.x - triggerPos.x)
        const dy = Math.abs(otherPos.y - triggerPos.y)
        const dz = Math.abs(otherPos.z - triggerPos.z)
        const inside = dx < triggerSize[0] / 2 && dy < triggerSize[1] / 2 && dz < triggerSize[2] / 2
        if (inside) {
          _triggerContacts.add(otherId)
          if (!triggerEntry.previousContacts.has(otherId)) {
            emit('onTriggerEnter', { instanceId: triggerId, otherInstanceId: otherId })
          }
        }
      }
      // Sair de triggers
      for (const prevId of triggerEntry.previousContacts) {
        if (!_triggerContacts.has(prevId)) {
          emit('onTriggerExit', { instanceId: triggerId, otherInstanceId: prevId })
        }
      }
      // Copiar para previousContacts (precisa de ser um Set novo para não partilhar referência)
      triggerEntry.previousContacts.clear()
      for (const id of _triggerContacts) triggerEntry.previousContacts.add(id)
    }
  }

  function dispose() {
    for (const [, entry] of bodies) {
      if (entry._collideHandler) {
        entry.body.removeEventListener('collide', entry._collideHandler)
      }
      world.removeBody(entry.body)
    }
    bodies.clear()
    bodyIdToInstance.clear()
    triggers.length = 0
    eventListeners.onCollision.length = 0
    eventListeners.onTriggerEnter.length = 0
    eventListeners.onTriggerExit.length = 0
    // Performance Core 3.6 — Limpar SpatialPartitionSystem (Bug #4 safe)
    SpatialPartitionSystem.restore()
  }

  function getStats() {
    return {
      bodyCount: bodies.size,
      maxBodies: MAX_PHYSICS_OBJECTS,
      atLimit: bodies.size >= MAX_PHYSICS_OBJECTS,
    }
  }

  // ===== Joints (constraints) entre dois corpos =====
  function addJoint(jointConect) {
    const targetA = bodies.get(jointConect.targetA)
    const targetB = bodies.get(jointConect.targetB)
    if (!targetA || !targetB) return null
    const bodyA = targetA.body
    const bodyB = targetB.body
    let constraint
    switch (jointConect.jointType) {
      case 'hinge':
        constraint = new CANNON.HingeConstraint(bodyA, bodyB, {
          pivotA: new CANNON.Vec3(0, 0, 0),
          pivotB: new CANNON.Vec3(0, 0, 0),
          axisA: new CANNON.Vec3(0, 1, 0),
          axisB: new CANNON.Vec3(0, 1, 0),
        })
        break
      case 'ball':
        constraint = new CANNON.PointToPointConstraint(bodyA, new CANNON.Vec3(0,0,0), bodyB, new CANNON.Vec3(0,0,0))
        break
      case 'spring':
        constraint = new CANNON.DistanceConstraint(bodyA, bodyB, 2, (jointConect.stiffness || 100) / 1000)
        break
      case 'fixed':
      default:
        constraint = new CANNON.LockConstraint(bodyA, bodyB)
        break
    }
    world.addConstraint(constraint)
    return constraint
  }

  return {
    world,
    bodies,
    addConect,
    removeConect,
    setGravity,
    applyForce,
    movePersonal,
    moveNpc,
    jumpPersonal,
    updatePersonalState,
    addJoint,
    update,
    dispose,
    getStats,
    on,
  }
}
