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

const MAX_PHYSICS_OBJECTS = 50 // limite para performance em mobile

export function createPhysicsSystem(options = {}) {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, options.gravity ?? -9.82, 0),
  })
  world.broadphase = new CANNON.SAPBroadphase(world)
  world.allowSleep = true
  world.defaultContactMaterial.friction = 0.3
  world.defaultContactMaterial.restitution = 0.3

  // Materiais para diferentes tipos de interação
  const materials = {
    default: new CANNON.Material('default'),
    ground: new CANNON.Material('ground'),
    player: new CANNON.Material('player'),
  }
  world.addContactMaterial(new CANNON.ContactMaterial(materials.ground, materials.default, {
    friction: 0.6, restitution: 0.1,
  }))
  world.addContactMaterial(new CANNON.ContactMaterial(materials.player, materials.ground, {
    friction: 0.4, restitution: 0,
  }))

  // Mapa instanceId → { body, mesh, conect, type, grounded, isTrigger }
  const bodies = new Map()
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
  function createShape(conect, mesh) {
    // Tentar inferir tamanho a partir do bounding box do mesh
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

  // Adiciona um conect ao sistema de física
  function addConect(conect, mesh) {
    if (bodies.size >= MAX_PHYSICS_OBJECTS) {
      console.warn(`[Physics] Limite de ${MAX_PHYSICS_OBJECTS} objetos atingido — conexões adicionais podem ser lentas`)
    }

    const def = findConectDefinition(conect.type)
    if (!def?.hasPhysics) return null

    // TriggerObject = sensor, sem colisão física
    const isTrigger = conect.isTrigger || conect.type === 'TriggerObject'

    const shape = createShape(conect, mesh)
    const body = new CANNON.Body({
      mass: isTrigger ? 0 : (conect.mass ?? 0),
      shape,
      position: new CANNON.Vec3(...conect.position),
      material: conect.type === 'PersonalObject' ? materials.player : materials.default,
    })
    body.linearDamping = conect.linearDamping ?? 0.01
    body.angularDamping = conect.angularDamping ?? 0.01
    body.fixedRotation = conect.fixedRotation ?? false

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

    world.addBody(body)
    bodies.set(conect.instanceId, {
      body,
      mesh,
      conect,
      type: conect.type,
      grounded: false,
      isTrigger,
      previousContacts: new Set(),
    })

    if (isTrigger) {
      triggers.push(conect.instanceId)
    }

    // Eventos de colisão do cannon
    body.addEventListener('collide', (e) => {
      const otherBody = e.body
      // Encontrar o instanceId do outro corpo
      const otherEntry = [...bodies.entries()].find(([, v]) => v.body === otherBody)
      if (!otherEntry) return
      const [otherId] = otherEntry
      const pairKey = `${conect.instanceId}:${otherId}`
      if (collisionPairs.has(pairKey)) return
      collisionPairs.add(pairKey)
      // Limpar a chave após um tempo curto para permitir nova emissão
      setTimeout(() => collisionPairs.delete(pairKey), 100)

      emit('onCollision', {
        instanceId: conect.instanceId,
        otherInstanceId: otherId,
      })
    })

    return body
  }

  function removeConect(instanceId) {
    const entry = bodies.get(instanceId)
    if (!entry) return
    world.removeBody(entry.body)
    bodies.delete(instanceId)
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

  function movePersonal(instanceId, direction, speed) {
    const entry = bodies.get(instanceId)
    if (!entry || entry.type !== 'PersonalObject') return
    // Aplicar velocidade horizontal diretamente
    const vel = entry.body.velocity
    entry.body.velocity.x = direction[0] * speed
    entry.body.velocity.z = direction[2] * speed
    // Manter Y (gravidade/salto)
  }

  function jumpPersonal(instanceId) {
    const entry = bodies.get(instanceId)
    if (!entry || entry.type !== 'PersonalObject') return
    if (!entry.grounded) return
    const jumpForce = entry.conect.jumpForce ?? 8
    entry.body.velocity.y = jumpForce
    entry.grounded = false
  }

  // Atualiza o mundo e sincroniza transforms
  function update(deltaTime) {
    // Step do mundo físico (fixed timestep)
    world.step(1 / 60, deltaTime, 3)

    // Sincronizar transforms dos corpos para os meshes
    for (const [instanceId, entry] of bodies) {
      const { body, mesh, type, isTrigger } = entry
      if (type === 'StaticObject') continue // estáticos não se movem
      if (mesh) {
        mesh.position.set(body.position.x, body.position.y, body.position.z)
        mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w)
      }

      // Detetar "grounded" para PersonalObject (raycast para baixo)
      if (type === 'PersonalObject') {
        const from = new CANNON.Vec3(body.position.x, body.position.y, body.position.z)
        const to = new CANNON.Vec3(body.position.x, body.position.y - 1.1, body.position.z)
        const result = new CANNON.RaycastResult()
        world.raycastClosest(from, to, { skipBackfaces: true, collisionFilterMask: -1 }, result)
        const wasGrounded = entry.grounded
        entry.grounded = result.hasHit
      }
    }

    // Verificar triggers (sobreposição com outros corpos)
    for (const triggerId of triggers) {
      const triggerEntry = bodies.get(triggerId)
      if (!triggerEntry) continue
      const currentContacts = new Set()
      const triggerPos = triggerEntry.body.position
      const triggerSize = triggerEntry.conect.size || [2, 2, 2]
      // Verificar sobreposição com cada corpo
      for (const [otherId, otherEntry] of bodies) {
        if (otherId === triggerId) continue
        if (otherEntry.isTrigger) continue
        const otherPos = otherEntry.body.position
        // Verificação simples AABB
        const dx = Math.abs(otherPos.x - triggerPos.x)
        const dy = Math.abs(otherPos.y - triggerPos.y)
        const dz = Math.abs(otherPos.z - triggerPos.z)
        const inside = dx < triggerSize[0] / 2 && dy < triggerSize[1] / 2 && dz < triggerSize[2] / 2
        if (inside) {
          currentContacts.add(otherId)
          if (!triggerEntry.previousContacts.has(otherId)) {
            emit('onTriggerEnter', { instanceId: triggerId, otherInstanceId: otherId })
          }
        }
      }
      // Sair de triggers
      for (const prevId of triggerEntry.previousContacts) {
        if (!currentContacts.has(prevId)) {
          emit('onTriggerExit', { instanceId: triggerId, otherInstanceId: prevId })
        }
      }
      triggerEntry.previousContacts = currentContacts
    }
  }

  function dispose() {
    for (const [, entry] of bodies) {
      world.removeBody(entry.body)
    }
    bodies.clear()
    triggers.length = 0
    eventListeners.onCollision.length = 0
    eventListeners.onTriggerEnter.length = 0
    eventListeners.onTriggerExit.length = 0
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
    jumpPersonal,
    addJoint,
    update,
    dispose,
    getStats,
    on,
  }
}
