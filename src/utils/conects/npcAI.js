/**
 * npcAI.js — sistema de IA para NpcObject.
 *
 * Comportamentos:
 *  - idle: parado
 *  - patrol: move-se entre os pontos de um PathObject (usando pathfinding A*)
 *  - chase: persegue o PersonalObject quando entra no raio de deteção
 *           (A* refrescado a cada ~30 frames para seguir target em movimento)
 *  - flee: foge do PersonalObject (linha recta — fugir, não navegar)
 *
 * Eventos disparados para o FlirScript:
 *  - OnSeePlayer: quando o jogador entra no raio de deteção
 *  - OnLoseSight: quando o jogador sai do raio de perda de vista
 *
 * API:
 *  - createNPCAI(npc, helpers) → { update(delta), dispose }
 *  - helpers:
 *      getPlayerPos() → [x,y,z] | null
 *      getNpcPos()    → [x,y,z] | null   (NOVO em BUG6-FIX: lê a posição dinâmica do
 *                                        body na física — `npc.position` é a posição
 *                                        inicial estática e nunca é actualizada)
 *      getPathPoints(pathId) → [[x,y,z], ...] | null
 *      physicsMove(id, dir, speed)
 *      physicsJump(id)
 *      emitEvent(name, payload)
 *      pathfinder (Pathfinder | {current: Pathfinder|null} | null)
 *                  — instância de A* pre-populada com AABBs de StaticObjects da cena.
 *                    Pode ser um ref-like object `{ current }` para lazy binding
 *                    (o Pathfinder é populado em queueMicrotask após o AI ser criado).
 *
 * BUG6-FIX:
 *  1. npcPos agora vem de getNpcPos() (posição dinâmica do body) em vez de
 *     npc.position (posição inicial estática).
 *  2. Chase/patrol usam Pathfinder.findPath para contornar obstáculos em vez de
 *     andar em linha recta e atravessar paredes.
 *  3. Rota de chase é refrescada a cada N frames (~0.5s) para acomodar target móvel.
 *  4. Waypoints seguidos sequencialmente com arrive-tolerance.
 */
import * as THREE from 'three'

const PATH_REFRESH_FRAMES = 30 // ~0.5s a 60fps — recalcula rota de chase
const ARRIVE_TOLERANCE = 0.35  // distância (m) para considerar waypoint alcançado

export function createNPCAI(npc, helpers) {
  const {
    getPlayerPos,
    getNpcPos,
    getPathPoints,
    physicsMove,
    physicsJump,
    emitEvent,
    pathfinder,
  } = helpers

  let hasSight = false
  let patrolIndex = npc.patrolIndex || 0
  const tmpVec = new THREE.Vector3()

  // Estado de pathfinding
  let currentPath = null // [{x, z}, ...]
  let pathIndex = 0
  let frameCounter = 0

  // Resolve a instância de Pathfinder — aceita Pathfinder directo, ref-like
  // `{ current }` (lazy binding — populado em queueMicrotask), ou null.
  function getPf() {
    if (!pathfinder) return null
    if (typeof pathfinder === 'object' && 'current' in pathfinder) {
      return pathfinder.current
    }
    return pathfinder
  }

  // Posição dinâmica do NPC — fallback para npc.position se getNpcPos não existir
  function getCurrentPos() {
    if (getNpcPos) {
      const p = getNpcPos()
      if (p) return p
    }
    return npc.position
  }

  // Move na direcção de um ponto (world coords). Retorna true se chegou.
  function moveTowards(currentPos, targetX, targetZ, speed) {
    const dx = targetX - currentPos[0]
    const dz = targetZ - currentPos[2]
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < ARRIVE_TOLERANCE) return true
    const dir = [dx / dist, 0, dz / dist]
    physicsMove?.(npc.instanceId, dir, speed)
    return false
  }

  // Segue o currentPath: avança pathIndex à medida que cada waypoint é alcançado.
  // Retorna true quando o último waypoint foi alcançado.
  function followPath(currentPos, speed) {
    if (!currentPath || currentPath.length === 0) return true
    while (pathIndex < currentPath.length) {
      const wp = currentPath[pathIndex]
      const arrived = moveTowards(currentPos, wp.x, wp.z, speed)
      if (!arrived) return false
      pathIndex++
    }
    currentPath = null
    return true
  }

  // Pede uma rota ao Pathfinder. Retorna true se obteve uma rota válida.
  function requestPath(startX, startZ, goalX, goalZ) {
    const pf = getPf()
    if (!pf) return false
    const path = pf.findPath(startX, startZ, goalX, goalZ)
    if (path && path.length > 0) {
      currentPath = path
      pathIndex = 0
      return true
    }
    currentPath = null
    pathIndex = 0
    return false
  }

  // Fallback: movimento em linha recta (quando pathfinder não está disponível ou
  // findPath falhou). Retorna true se chegou.
  function moveDirect(currentPos, targetX, targetZ, speed) {
    return moveTowards(currentPos, targetX, targetZ, speed)
  }

  function update(delta) {
    if (!npc || npc.type !== 'NpcObject') return
    frameCounter++

    const playerPos = getPlayerPos()
    const npcPos = getCurrentPos()

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
      // Forçar recálculo de rota ao detectar jogador (mudança de contexto)
      currentPath = null
    } else if (hasSight && distanceToPlayer > loseR) {
      hasSight = false
      emitEvent?.('OnLoseSight', {})
      // Reset de rota — volta a patrulhar / fica parado conforme behavior
      currentPath = null
    }

    const speed = npc.moveSpeed || 3
    // S17 fix (P0-08): aceitar `behavior` OU `aiMode` — os demos (flirQuestShowcase,
    // flirQuestArena) definem apenas `aiMode`, pelo que a IA ficava em idle mesmo com
    // aiMode='patrol'/'chase'. Agora qualquer um dos campos controla a IA.
    const behavior = npc.behavior || npc.aiMode || 'idle'

    if (behavior === 'idle') {
      // Não se move
      return
    }

    if (behavior === 'patrol') {
      // S18 fix: aceitar waypoints INLINE (npc.patrolPoints = [[x,y,z],...])
      // além de PathObject via npc.patrolPath. Os demos (flirQuestShowcase)
      // definem patrolPoints diretamente no NPC — antes o IA só lia o
      // PathObject e, sem patrolPath, fazia return imediato → NPC congelado.
      const pathPoints = getPathPoints?.(npc.patrolPath) || npc.patrolPoints
      if (!pathPoints || pathPoints.length === 0) return
      const target = pathPoints[patrolIndex % pathPoints.length]
      // Se perdeu vista do jogador e está em patrol, continua a patrulhar normalmente
      const pf = getPf()
      if (pf) {
        // Recalcular rota quando não há rota, ou quando chegamos ao fim
        if (!currentPath || pathIndex >= currentPath.length) {
          if (!requestPath(npcPos[0], npcPos[2], target[0], target[2])) {
            // findPath falhou (sem rota?) — fallback linha recta
            const arrived = moveDirect(npcPos, target[0], target[2], speed)
            if (arrived) patrolIndex = (patrolIndex + 1) % pathPoints.length
            return
          }
        }
        const arrived = followPath(npcPos, speed)
        if (arrived) {
          patrolIndex = (patrolIndex + 1) % pathPoints.length
          currentPath = null
        }
      } else {
        // Sem pathfinder — linha recta (comportamento original pré-BUG6-FIX)
        const arrived = moveDirect(npcPos, target[0], target[2], speed)
        if (arrived) patrolIndex = (patrolIndex + 1) % pathPoints.length
      }
      return
    }

    if (behavior === 'chase') {
      // S17: chasePlayer() via FlirCode força a perseguição mesmo sem linha de vista
      const chaseOverride = (typeof window !== 'undefined' && window._flirGameContext)
        ? window._flirGameContext.getVar('_chase_' + npc.instanceId) : false
      if ((!hasSight || !playerPos) && !chaseOverride) return
      const pf = getPf()
      if (pf) {
        // Refrescar rota a cada PATH_REFRESH_FRAMES frames, ou se não há rota
        const needRecompute =
          !currentPath ||
          pathIndex >= currentPath.length ||
          (frameCounter % PATH_REFRESH_FRAMES === 0)
        if (needRecompute) {
          requestPath(npcPos[0], npcPos[2], playerPos[0], playerPos[2])
        }
        if (currentPath && currentPath.length > 0) {
          followPath(npcPos, speed)
        } else {
          // Pathfinder não encontrou rota — fallback linha recta
          moveDirect(npcPos, playerPos[0], playerPos[2], speed)
        }
      } else {
        // Sem pathfinder — comportamento original (linha recta)
        moveDirect(npcPos, playerPos[0], playerPos[2], speed)
      }
      return
    }

    if (behavior === 'flee') {
      if (!hasSight || !playerPos) return
      // Fuga em linha recta oposta ao jogador (não precisa de pathfinding — fugir
      // tende a afastar-se do perigo, não a navegar para um goal)
      const dx = npcPos[0] - playerPos[0]
      const dz = npcPos[2] - playerPos[2]
      const dist = Math.sqrt(dx * dx + dz * dz) || 1
      const dir = [dx / dist, 0, dz / dist]
      physicsMove?.(npc.instanceId, dir, speed)
      return
    }
  }

  function dispose() {
    // Reset de estado interno (sem referências externas para limpar)
    currentPath = null
    pathIndex = 0
    frameCounter = 0
  }

  return { update, dispose }
}
