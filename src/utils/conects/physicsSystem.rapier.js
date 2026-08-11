/**
 * physicsSystem.js — Sistema de física usando Rapier (WASM).
 *
 * Migração de cannon-es para Rapier (@dimforge/rapier3d-compat).
 * Rapier é compilado em WASM, significativamente mais rápido que JS puro,
 * especialmente para muitos corpos em simultâneo (200+).
 *
 * Mantém a mesma interface externa que o cannon-es:
 *  - createPhysicsSystem({ gravity })
 *  - addConect(conect, mesh) → regista um conect
 *  - update(deltaTime) → step da simulação
 *  - on(event, callback) → eventos de colisão
 *  - movePersonal, jumpPersonal, applyForce, addJoint, etc.
 *
 * Os Conects (RigidObject, StaticObject, etc.) não precisam de mudanças.
 */

import { debugLog } from '../debug/debugStore'

const MAX_PHYSICS_OBJECTS = 200

export async function createPhysicsSystem(options = {}) {
  // Inicializar Rapier (async — WASM)
  const RAPIER = await import('@dimforge/rapier3d-compat')
  await RAPIER.init()

  const gravityY = options.gravity ?? -9.82
  const world = new RAPIER.World({ x: 0, y: gravityY, z: 0 })
  world.timestep = 1 / 60

  // Event channel para Rapier
  const eventQueue = new RAPIER.EventQueue(true)

  // Map: instanceId → { body, collider, mesh, conect, type, isTrigger, grounded }
  const bodies = new Map()
  const triggers = []
  const eventListeners = {
    onCollision: [],
    onTriggerEnter: [],
    onTriggerExit: [],
  }
  const collisionPairs = new Set()
  const previousContacts = new Map() // instanceId → Set de outros IDs em contacto

  function on(eventName, callback) {
    eventListeners[eventName]?.push(callback)
  }
  function emit(eventName, payload) {
    eventListeners[eventName]?.forEach((cb) => cb(payload))
  }

  // Criar collider description baseado nas propriedades do conect
  function createColliderDesc(conect) {
    const shape = conect.colliderShape || 'model'
    const offset = conect.colliderOffset || [0, 0, 0]

    if (shape === 'box') {
      const cs = conect.colliderSize || [1, 1, 1]
      return RAPIER.ColliderDesc.cuboid(cs[0] / 2, cs[1] / 2, cs[2] / 2)
        .setTranslation(offset[0], offset[1], offset[2])
    }
    if (shape === 'sphere') {
      const r = Math.max(0.05, conect.colliderRadius || 0.5)
      return RAPIER.ColliderDesc.ball(r)
        .setTranslation(offset[0], offset[1], offset[2])
    }
    if (shape === 'capsule') {
      const r = Math.max(0.05, conect.colliderRadius || 0.5)
      const h = Math.max(0.1, conect.colliderHeight || 1.5)
      return RAPIER.ColliderDesc.capsule(h / 2, r)
        .setTranslation(offset[0], offset[1], offset[2])
    }

    // 'model' — usar bounding box do mesh (fallback para cuboid)
    // O tamanho é inferido pelo caller (passar via conect)
    const cs = conect._inferredSize || [1, 1, 1]
    return RAPIER.ColliderDesc.cuboid(cs[0] / 2, cs[1] / 2, cs[2] / 2)
      .setTranslation(offset[0], offset[1], offset[2])
  }

  // Adiciona um conect ao sistema de física
  function addConect(conect, mesh) {
    if (bodies.size >= MAX_PHYSICS_OBJECTS) {
      console.warn(`[Physics/Rapier] Limite de ${MAX_PHYSICS_OBJECTS} objetos atingido`)
      return null
    }

    // Inferir tamanho do mesh se necessário
    if (mesh && mesh.geometry) {
      mesh.geometry.computeBoundingBox?.()
      const bb = mesh.geometry.boundingBox
      if (bb && (!conect.colliderShape || conect.colliderShape === 'model')) {
        conect._inferredSize = [
          Math.max(0.1, bb.max.x - bb.min.x),
          Math.max(0.1, bb.max.y - bb.min.y),
          Math.max(0.1, bb.max.z - bb.min.z),
        ]
      }
    }

    const isTrigger = conect.isTrigger || conect.type === 'TriggerObject'
    const offset = (conect.colliderShape && conect.colliderShape !== 'model')
      ? (conect.colliderOffset || [0, 0, 0])
      : [0, 0, 0]

    let bodyDesc
    let bodyType

    if (conect.type === 'StaticObject') {
      bodyDesc = RAPIER.RigidBodyDesc.fixed()
      bodyType = 'fixed'
    } else if (conect.type === 'StopObject') {
      bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      bodyType = 'kinematic'
    } else if (isTrigger) {
      bodyDesc = RAPIER.RigidBodyDesc.fixed()
      bodyType = 'sensor'
    } else {
      bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      bodyType = 'dynamic'
    }

    // Posição inicial (com offset do colisor)
    bodyDesc.setTranslation(
      conect.position[0] + offset[0],
      conect.position[1] + offset[1],
      conect.position[2] + offset[2]
    )

    // Rotação inicial
    if (conect.rotation && conect.rotation.length >= 3) {
      bodyDesc.setRotation({ x: conect.rotation[0], y: conect.rotation[1], z: conect.rotation[2], w: 1 })
      // Rapier usa quaternion — converter de Euler
      const [rx, ry, rz] = conect.rotation
      const cx = Math.cos(rx / 2), sx = Math.sin(rx / 2)
      const cy = Math.cos(ry / 2), sy = Math.sin(ry / 2)
      const cz = Math.cos(rz / 2), sz = Math.sin(rz / 2)
      bodyDesc.setRotation({
        x: sx * cy * cz + cx * sy * sz,
        y: cx * sy * cz - sx * cy * sz,
        z: cx * cy * sz + sx * sy * cz,
        w: cx * cy * cz - sx * sy * sz,
      })
    }

    const body = world.createRigidBody(bodyDesc)

    // Criar collider
    const colliderDesc = createColliderDesc(conect)
    if (isTrigger) {
      colliderDesc.setSensor(true)
    }
    // Friction e restitution
    colliderDesc.setFriction(conect.friction ?? 0.3)
    colliderDesc.setRestitution(conect.restitution ?? 0.4)

    const collider = world.createCollider(colliderDesc, body)

    bodies.set(conect.instanceId, {
      body,
      collider,
      mesh,
      conect,
      type: conect.type,
      bodyType,
      grounded: false,
      isTrigger,
      previousContacts: new Set(),
    })

    if (isTrigger) {
      triggers.push(conect.instanceId)
    }

    return body
  }

  function removeConect(instanceId) {
    const entry = bodies.get(instanceId)
    if (!entry) return
    world.removeRigidBody(entry.body)
    bodies.delete(instanceId)
    const tIdx = triggers.indexOf(instanceId)
    if (tIdx >= 0) triggers.splice(tIdx, 1)
  }

  function setGravity(g) {
    world.gravity = { x: 0, y: g, z: 0 }
  }

  function applyForce(instanceId, force) {
    const entry = bodies.get(instanceId)
    if (!entry) return
    entry.body.applyImpulse({ x: force[0], y: force[1], z: force[2] }, true)
  }

  function movePersonal(instanceId, direction, speed) {
    const entry = bodies.get(instanceId)
    if (!entry || entry.bodyType !== 'dynamic') return
    // Kinematic movement: set linear velocity
    const vel = entry.body.linvel()
    entry.body.setLinvel({
      x: direction[0] * speed,
      y: vel.y, // manter velocidade vertical (gravidade)
      z: direction[2] * speed,
    }, true)
  }

  function jumpPersonal(instanceId) {
    const entry = bodies.get(instanceId)
    if (!entry || entry.bodyType !== 'dynamic') return
    // Aplicar impulso para cima
    entry.body.applyImpulse({ x: 0, y: 8, z: 0 }, true)
  }

  function update(deltaTime) {
    // Step da simulação Rapier
    world.step(eventQueue)

    // Processar eventos de colisão
    eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      // Encontrar instanceIds pelos collider handles
      let id1 = null, id2 = null
      for (const [id, entry] of bodies) {
        if (entry.collider.handle === handle1) id1 = id
        if (entry.collider.handle === handle2) id2 = id
      }
      if (!id1 || !id2) return

      const pairKey = `${id1}:${id2}`
      if (started && !collisionPairs.has(pairKey)) {
        collisionPairs.add(pairKey)
        emit('onCollision', { instanceId: id1, otherInstanceId: id2 })
        setTimeout(() => collisionPairs.delete(pairKey), 100)
      }
    })

    // Processar eventos de trigger
    eventQueue.drainContactForceEvents((handle1, handle2, totalForce) => {
      // Similar ao collision
    })

    // Sincronizar meshes com bodies
    for (const [id, entry] of bodies) {
      if (entry.mesh && entry.bodyType !== 'fixed') {
        const pos = entry.body.translation()
        const rot = entry.body.rotation()
        entry.mesh.position.set(pos.x, pos.y, pos.z)
        entry.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w)
      }
    }
  }

  function addJoint(jointConect) {
    // TODO: implementar juntas com Rapier
    // Rapier tem: ImpulseJoint, FixedJoint, RevoluteJoint, SphericalJoint
    debugLog('Juntas Rapier: ainda não implementado', 'warning', 'Physics')
  }

  function dispose() {
    bodies.clear()
    triggers.length = 0
    // Rapier world é limpo automaticamente quando não há referências
  }

  function getStats() {
    return {
      bodyCount: bodies.size,
      engine: 'rapier',
    }
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
