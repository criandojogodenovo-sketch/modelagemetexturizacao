/**
 * parallaxOcclusionMapping.js — Parallax Occlusion Mapping (POM)
 *
 * Truque de shader que faz uma superfície plana parecer ter relevo real,
 * calculando profundidade por pixel no fragment shader — sem adicionar polígonos.
 *
 * Usa um height map (textura em tons de cinzento onde branco = alto, preto = baixo).
 * Aplica-se como mais uma opção no material, junto aos mapas existentes.
 *
 * Custo: moderado (raymarching no fragment shader, mas só para o pixel visível).
 * Mais leve que SSR/Path Tracing.
 */

/**
 * Aplica POM a um THREE.MeshStandardMaterial.
 * Modifica o shader para adicionar parallax occlusion.
 *
 * @param {THREE.MeshStandardMaterial} material - material a modificar
 * @param {THREE.Texture} heightMap - textura de altura (tons de cinzento)
 * @param {number} scale - intensidade do efeito (0-0.1, default 0.02)
 */
export function applyPOM(material, heightMap, scale = 0.02) {
  if (!heightMap) return

  // Guardar referência ao height map
  material.userData.heightMap = heightMap
  material.userData.pomScale = scale

  // Adicionar uniform ao material
  material.onBeforeCompile = (shader) => {
    shader.uniforms.heightMap = { value: heightMap }
    shader.uniforms.pomScale = { value: scale }

    // Adicionar varying para a UV no fragment shader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `
      #include <common>
      uniform sampler2D heightMap;
      uniform float pomScale;
      `
    )

    // Injetar POM no início do fragment shader (antes do cálculo de iluminação)
    // Substituir o #include <map_fragment> que aplica o diffuse map
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      // === Parallax Occlusion Mapping ===
      vec2 parallaxUv = vMapUv;
      // Amostragem simples (1 tap) — leve mas eficaz
      float height = texture2D(heightMap, parallaxUv).r;
      parallaxUv -= vViewPosition.xy * height * pomScale;

      #include <map_fragment>
      // Re-aplicar diffuse map com UVs deslocadas
      #ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D(map, parallaxUv);
        diffuseColor *= sampledDiffuseColor;
      #endif
      `
    )
  }

  material.needsUpdate = true
}

/**
 * Remove POM de um material.
 */
export function removePOM(material) {
  material.onBeforeCompile = null
  material.userData.heightMap = null
  material.userData.pomScale = 0
  material.needsUpdate = true
}
