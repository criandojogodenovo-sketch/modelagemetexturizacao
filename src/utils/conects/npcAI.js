/**
 * npcAI.js — sistema de IA para NpcObject.
 *
 * Comportamentos:
 *  - idle: parado
 *  - patrol: move-se entre os pontos de um PathObject
 *  - chase: persegue o PersonalObject quando entra no raio de deteção
 *  - flee: foge do PersonalObject
 *
 * Eventos disparados para o FlirScript:
 *  - OnSeePlayer: quando o jogador entra no raio de deteção
 *  - OnLoseSight: quando o jogador sai do raio de perda de vista
 *
 * API:
 *  - createNPCAI(npc, getPlayerPos, getPathPoints) → { update(delta), dispose }
 *  - update aplica movimento via physicsRef.movePersonal
 */
import * as THREE from 'three'

export function createNPCAI(npc, helpers) {
  const { getPlayerPos, getPathPoints, physicsMove, physicsJump, emitEvent } = helpers
  let currentState = npc.behavior || 'idle'
  let hasSight = false
  let patrolIndex = npc.patrolIndex || 0
  const tmpVec = new THREE.Vector3()

  function update(delta) {
    if (!npc || npc.type !== 'NpcObject') return
    const playerPos = getPlayerPos()
    const npcPos = npc.position
    let distanceToPlayer = Infinity
    if (playerPos) {
      tmpVec.set(playerPos[0] - npcPos[0], playerPos[1] - npcPos[1], playerPos[2] - npcPos[2])
      distanceToPlayer = tmpVec.length()
    }

    // Detetar jogador
    const detectR = npc.detectionRadius || 8
    const loseR = npc.loseSightRadius || 12
    if (!hasSight && distanceToPlayer < detectR) {
      hasSight = true
      emitEvent?.('OnSeePlayer', { player: playerPos })
    } else if (hasSight && distanceToPlayer > loseR) {
      hasSight = false
      emitEvent?.('OnLoseSight', {})
    }

    // Decidir comportamento efetivo
    let effectiveBehavior = npc.behavior || 'idle'
    if (hasSight) {
      if (effectiveBehavior === 'chase' || effectiveBehavior === 'flee') {
        // ativar
      } else if (effectiveBehavior === 'patrol') {
        // continua a patrulhar mas poderia mudar
      }
    }

    // Executar movimento
    const speed = npc.moveSpeed || 3
    if (effectiveBehavior === 'idle') {
      // não se move
    } else if (effectiveBehavior === 'patrol') {
      const pathPoints = getPathPoints?.(npc.patrolPath)
      if (pathPoints && pathPoints.length > 0) {
        const target = pathPoints[patrolIndex % pathPoints.length]
        const dx = target[0] - npcPos[0]
        const dz = target[2] - npcPos[2]
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist < 0.5) {
          patrolIndex = (patrolIndex + 1) % pathPoints.length
        } else {
          const dir = [dx / dist, 0, dz / dist]
          physicsMove?.(npc.instanceId, dir, speed)
        }
      }
    } else if (effectiveBehavior === 'chase' && hasSight && playerPos) {
      const dx = playerPos[0] - npcPos[0]
      const dz = playerPos[2] - npcPos[2]
      const dist = Math.sqrt(dx * dx + dz * dz) || 1
      const dir = [dx / dist, 0, dz / dist]
      physicsMove?.(npc.instanceId, dir, speed)
    } else if (effectiveBehavior === 'flee' && hasSight && playerPos) {
      const dx = npcPos[0] - playerPos[0]
      const dz = npcPos[2] - playerPos[2]
      const dist = Math.sqrt(dx * dx + dz * dz) || 1
      const dir = [dx / dist, 0, dz / dist]
      physicsMove?.(npc.instanceId, dir, speed)
    }
  }

  function dispose() {
    // nada a limpar
  }

  return { update, dispose }
}
