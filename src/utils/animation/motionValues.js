/**
 * motionValues.js — motion values persistentes e assináveis com spring physics.
 *
 * Sessão 20 / Parte D3 (padrão "motion values" — persistent & assignable,
 * inspirado em Rive/Tailwind+spring, GSAP-like sem dependências).
 *
 * CONCEITO:
 *  - Um MotionValue é um número (ou vec3) ANIMÁVEL persistente: tem valor,
 *    velocidade e destino. Animar = atribuir um novo destino
 *    (`mv.to(100)`), não mutar o valor.
 *  - SPRING PHYSICS: o valor persegue o destino com mola amortecida
 *    (stiffness/damping) → interrupções NATURAIS: mudar o destino a meio
 *    não faz snap — a velocidade é preservada e a curva continua suave.
 *  - ASSINÁVEL: subscribe(cb) — o callback recebe (value, velocity) a cada
 *    atualização. Ideal para ligar UI ↔ 3D (opacidade, escala, cor, posição).
 *  - Snapshots/labels + seek: getValue(), getVelocity(), near(target).
 *
 * API:
 *   const mv = motionValue(0, { stiffness: 120, damping: 14, mass: 1 })
 *   mv.to(10)                 // anima para 10 com spring
 *   mv.subscribe(v => ...)    // notificado a cada frame
 *   mv.update(dt)             // integrar (chamar no loop)
 *   const v3 = motionVec3([0,0,0], {...})
 */

export function motionValue(initial = 0, opts = {}) {
  let value = initial
  let velocity = 0
  let target = initial
  let stiffness = opts.stiffness ?? 120
  let damping = opts.damping ?? 14
  let mass = opts.mass ?? 1
  const subscribers = new Set()
  const listeners = { complete: new Set() }

  function subscribe(cb) {
    subscribers.add(cb)
    cb(value, velocity)
    return () => subscribers.delete(cb)
  }
  function onComplete(cb) { listeners.complete.add(cb); return () => listeners.complete.delete(cb) }
  function notify() { for (const cb of subscribers) cb(value, velocity) }

  function to(newTarget, springOpts = {}) {
    target = newTarget
    if (springOpts.stiffness != null) stiffness = springOpts.stiffness
    if (springOpts.damping != null) damping = springOpts.damping
  }
  function jump(v) { value = v; target = v; velocity = 0; notify() }
  function setVelocity(v) { velocity = v }

  function update(dt) {
    // Integração semi-implícita de Euler (estável para springs)
    const step = Math.min(dt, 1 / 30)
    const force = -stiffness * (value - target)
    const accel = (force - damping * velocity) / mass
    velocity += accel * step
    value += velocity * step
    notify()
    // completa?
    if (Math.abs(value - target) < 1e-4 && Math.abs(velocity) < 1e-3) {
      if (value !== target) { value = target; notify() }
      for (const cb of listeners.complete) cb(value)
    }
    return value
  }

  return {
    to, jump, setVelocity, update, subscribe, onComplete,
    get value() { return value },
    get target() { return target },
    get velocity() { return velocity },
    isSettled() { return Math.abs(value - target) < 1e-4 && Math.abs(velocity) < 1e-3 },
    near(t, eps = 0.01) { return Math.abs(value - t) < eps },
    configure(o = {}) {
      if (o.stiffness != null) stiffness = o.stiffness
      if (o.damping != null) damping = o.damping
      if (o.mass != null) mass = o.mass
    },
  }
}

/** MotionValue 3D (vetorial) — mesmo padrão, com componentes x/y/z */
export function motionVec3(initial = [0, 0, 0], opts = {}) {
  const x = motionValue(initial[0], opts)
  const y = motionValue(initial[1], opts)
  const z = motionValue(initial[2], opts)
  return {
    to: (t, so) => { x.to(t[0], so); y.to(t[1], so); z.to(t[2], so) },
    jump: (t) => { x.jump(t[0]); y.jump(t[1]); z.jump(t[2]) },
    update: (dt) => { x.update(dt); y.update(dt); z.update(dt) },
    subscribe: (cb) => {
      const unsubs = [x.subscribe(() => cb([x.value, y.value, z.value])), y.subscribe(() => {}), z.subscribe(() => {})]
      return () => unsubs.forEach((u) => u())
    },
    get value() { return [x.value, y.value, z.value] },
    get velocity() { return [x.velocity, y.velocity, z.velocity] },
    isSettled() { return x.isSettled() && y.isSettled() && z.isSettled() },
  }
}
