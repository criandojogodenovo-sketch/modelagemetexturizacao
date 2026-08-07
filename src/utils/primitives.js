/**
 * Definições das formas primitivas suportadas.
 * Cada entrada descreve os parâmetros geométricos para construção via THREE.BufferGeometry.
 */

export const PRIMITIVES = {
  cube: {
    label: 'Cubo',
    icon: 'cube',
    defaultArgs: { size: 1 },
    build: (THREE, args) => new THREE.BoxGeometry(args.size, args.size, args.size),
  },
  sphere: {
    label: 'Esfera',
    icon: 'sphere',
    defaultArgs: { radius: 0.6, segments: 32 },
    build: (THREE, args) =>
      new THREE.SphereGeometry(Math.max(0.01, args.radius), args.segments, Math.max(8, args.segments / 2)),
  },
  cylinder: {
    label: 'Cilindro',
    icon: 'cylinder',
    defaultArgs: { radius: 0.5, height: 1.2, segments: 32 },
    build: (THREE, args) =>
      new THREE.CylinderGeometry(args.radius, args.radius, args.height, args.segments),
  },
  cone: {
    label: 'Cone',
    icon: 'cone',
    defaultArgs: { radius: 0.6, height: 1.2, segments: 32 },
    build: (THREE, args) =>
      new THREE.ConeGeometry(args.radius, args.height, args.segments),
  },
  plane: {
    label: 'Plano',
    icon: 'plane',
    defaultArgs: { width: 1.5, height: 1.5 },
    build: (THREE, args) => new THREE.PlaneGeometry(args.width, args.height),
  },
  torus: {
    label: 'Torus',
    icon: 'torus',
    defaultArgs: { radius: 0.6, tube: 0.2, radialSegments: 16, tubularSegments: 64 },
    build: (THREE, args) =>
      new THREE.TorusGeometry(args.radius, args.tube, args.radialSegments, args.tubularSegments),
  },
}

export const PRIMITIVE_LIST = Object.entries(PRIMITIVES).map(([key, def]) => ({
  key,
  ...def,
}))

// Material padrão usado ao criar novos objetos
export function defaultMaterial() {
  return {
    color: '#cccccc',
    roughness: 0.7,
    metalness: 0.0,
    map: null,           // dataURL da textura difusa, ou null
    normalMap: null,     // dataURL da textura normal, ou null
    repeat: [1, 1],      // tiling UV
    offset: [0, 0],      // offset UV
    opacity: 1,
    transparent: false,
    wireframe: false,
    flatShading: false,
  }
}

// Cria um novo objeto de cena com valores padrão
export function createSceneObject(type, position = [0, 0.5, 0]) {
  const def = PRIMITIVES[type]
  if (!def) throw new Error(`Primitiva desconhecida: ${type}`)
  return {
    id: `obj_${Math.random().toString(36).slice(2, 10)}`,
    type,
    name: `${def.label}`,
    position: [...position],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    args: { ...def.defaultArgs },
    material: defaultMaterial(),
    visible: true,
    // Indica se o objeto foi importado (não é uma primitiva paramétrica)
    imported: false,
  }
}
