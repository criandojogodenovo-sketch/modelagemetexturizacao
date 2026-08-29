/**
 * RealismController.jsx — pipeline de realismo da Flir Engine (Sessão 20).
 *
 * Assume o render loop do R3F (useFrame com prioridade 1) quando QUALQUER
 * feature de realismo está ativa e compõe o pipeline:
 *
 *   [cena] → sceneRT (resolução interna = full × fsrScale)
 *         → SSR Hi-Z (meia res) ──┐
 *                                 ├→ composite → fog volumétrico (meia res + temporal)
 *                                 └→ FSR EASU+RCAS → ECRÃ (full res)
 *
 * Fontes de configuração (em prioridade):
 *   1. Conects na cena ativa: SSRObject / VolumetricFogObject (os seus
 *      parâmetros controlam o respetivo pass — editar o conect = editar o efeito)
 *   2. renderSettings do SettingsPanel (toggles manuais + FSR + DDGI)
 */
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useStore } from '../../store/useStore'
import { SSRHiZPass } from '../../utils/rendering/ssrHiZ'
import { VolumetricFogPass } from '../../utils/rendering/volumetricFog'
import { FSRPass } from '../../utils/rendering/fsrUpscale'
import { blitMaterial, createCopyMaterial, createSceneRT } from '../../utils/rendering/fullscreenQuad'
import { getRealismPreset } from '../../utils/rendering/realismPresets'

export default function RealismController() {
  const { gl, scene, camera } = useThree()
  const renderSettings = useStore((s) => s.renderSettings)
  const scenes = useStore((s) => s.scenes)
  const activeSceneId = useStore((s) => s.activeSceneId)

  const pipelineRef = useRef(null)
  const lightDirRef = useRef(new THREE.Vector3(0.3, 1.0, 0.2))

  // Conects de realismo na cena ativa (SSRObject / VolumetricFogObject)
  const activeScene = scenes?.find((sc) => sc.id === activeSceneId)
  const conects = activeScene?.conects || []
  const ssrConect = conects.find((c) => c.type === 'SSRObject')
  const fogConect = conects.find((c) => c.type === 'VolumetricFogObject')

  const ssrEnabled = !!(renderSettings?.ssr || ssrConect)
  const fogEnabled = !!(renderSettings?.volumetricFog || fogConect)
  const fsrScale = renderSettings?.fsr ? (renderSettings.fsrScale || 0.77) : 1.0

  // ---- Construção/destruição do pipeline ----
  useEffect(() => {
    const size = new THREE.Vector2()
    gl.getDrawingBufferSize(size)
    const internal = {
      w: Math.max(8, Math.floor(size.x * fsrScale)),
      h: Math.max(8, Math.floor(size.y * fsrScale)),
    }
    const pipeline = {
      internal,
      sceneRT: createSceneRT(internal.w, internal.h),
      compRT: createSceneRT(internal.w, internal.h, { floatColor: true }),
      copyMat: createCopyMaterial(),
      ssr: ssrEnabled ? new SSRHiZPass(gl, internal) : null,
      fog: fogEnabled ? new VolumetricFogPass(gl, internal) : null,
      fsr: new FSRPass(gl),
    }
    pipelineRef.current = pipeline
    return () => {
      pipeline.sceneRT.dispose()
      pipeline.compRT.dispose()
      pipeline.copyMat.dispose()
      pipeline.ssr?.dispose()
      pipeline.fog?.dispose()
      pipeline.fsr.dispose()
      pipelineRef.current = null
    }
  }, [gl, ssrEnabled, fogEnabled, fsrScale])

  // ---- Resize ----
  useEffect(() => {
    const onResize = () => {
      const p = pipelineRef.current
      if (!p) return
      const size = new THREE.Vector2()
      gl.getDrawingBufferSize(size)
      p.internal.w = Math.max(8, Math.floor(size.x * fsrScale))
      p.internal.h = Math.max(8, Math.floor(size.y * fsrScale))
      p.sceneRT.setSize(p.internal.w, p.internal.h)
      p.compRT.setSize(p.internal.w, p.internal.h)
      p.ssr?.setSize(p.internal.w, p.internal.h)
      p.fog?.setSize(p.internal.w, p.internal.h)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [gl, fsrScale])

  // ---- Capturar a direção da luz principal (para god rays) ----
  const _lightFrame = useRef(0)
  function updateLightDir() {
    _lightFrame.current++
    if (_lightFrame.current % 30 !== 0) return
    let best = null
    let bestIntensity = -1
    scene.traverse((o) => {
      if (o.isDirectionalLight && o.intensity > bestIntensity) {
        best = o
        bestIntensity = o.intensity
      }
    })
    if (best) {
      const target = best.target ? best.target.position : new THREE.Vector3(0, 0, 0)
      lightDirRef.current.copy(best.position).sub(target).normalize()
    }
  }

  // ---- Render loop (prioridade 1 = assume o loop do R3F) ----
  useFrame((state, delta) => {
    const p = pipelineRef.current
    if (!p) return
    updateLightDir()
    const dt = Math.min(delta || 1 / 60, 0.1)

    // 1. Render da cena para o sceneRT (resolução interna)
    const prevRT = gl.getRenderTarget()
    const prevShadow = gl.shadowMap.enabled
    gl.setRenderTarget(p.sceneRT)
    gl.clear(true, true, true)
    gl.render(scene, camera)
    gl.setRenderTarget(prevRT)
    gl.shadowMap.enabled = prevShadow

    let colorSource = p.sceneRT

    // 2. SSR (Hi-Z + temporal) + composite
    // S21: presets por dispositivo (desktop: 48 steps/50 dist · mobile: 12 steps/25 dist)
    const preset = getRealismPreset()
    if (p.ssr && ssrEnabled) {
      const params = ssrConect ? {
        intensity: ssrConect.intensity ?? 0.8,
        maxDistance: ssrConect.maxDistance ?? preset.ssr.maxDistance,
        roughnessFade: ssrConect.roughnessFade ?? 0.5,
        thickness: ssrConect.thickness ?? 0.5,
        blend: ssrConect.blend ?? 0.9,
        // maxSteps do conect >0 (manual) · 0/auto → preset do dispositivo
        maxSteps: (ssrConect.maxSteps > 0) ? ssrConect.maxSteps : preset.ssr.maxSteps,
      } : {
        intensity: renderSettings?.ssrIntensity ?? 0.8,
        maxDistance: preset.ssr.maxDistance, roughnessFade: 0.5, thickness: 0.5, blend: 0.9,
        maxSteps: preset.ssr.maxSteps,
      }
      const ssrRT = p.ssr.trace(scene, camera, p.sceneRT, params, dt)
      if (ssrRT) {
        p.ssr.composite(p.sceneRT, ssrRT, p.compRT, params.intensity)
        colorSource = p.compRT
      }
    }

    // 3. Fog volumétrico (meia res + temporal) → upsample para resolução interna
    if (p.fog && fogEnabled) {
      const params = fogConect ? {
        density: fogConect.density ?? 0.02,
        scattering: fogConect.scattering ?? 0.5,
        anisotropy: fogConect.anisotropy ?? 0.6,
        attenuationDistance: fogConect.attenuationDistance ?? 30,
        godRays: fogConect.godRays !== false,
        color: fogConect.color ?? '#a0c4ff',
        penumbra: fogConect.penumbraWidth ?? renderSettings?.fogPenumbra ?? 0.35,
        lightDir: [lightDirRef.current.x, lightDirRef.current.y, lightDirRef.current.z],
        lightColor: [1.0, 0.96, 0.88],
      } : {
        density: renderSettings?.fogDensity ?? 0.02,
        scattering: renderSettings?.fogScattering ?? 0.5,
        anisotropy: renderSettings?.fogAnisotropy ?? 0.6,
        attenuationDistance: renderSettings?.fogAttenuation ?? 30,
        godRays: renderSettings?.fogGodRays !== false,
        color: renderSettings?.fogColor ?? '#a0c4ff',
        penumbra: renderSettings?.fogPenumbra ?? 0.35,
        lightDir: [lightDirRef.current.x, lightDirRef.current.y, lightDirRef.current.z],
        lightColor: [1.0, 0.96, 0.88],
      }
      const fogRT = p.fog.render(camera, colorSource, p.sceneRT.depthTexture, params)
      if (fogRT) {
        // Upsample bilinear do fog (half-res) para a resolução interna
        p.copyMat.uniforms.tSrc.value = fogRT.texture
        blitMaterial(gl, p.copyMat, p.compRT)
        colorSource = p.compRT
      }
    }

    // 4. Saída: FSR para o ecrã (se ativo) ou blit direto
    if (fsrScale < 0.999) {
      p.fsr.render(colorSource, fsrScale, renderSettings?.fsrSharpness ?? 0.87)
    } else {
      p.copyMat.uniforms.tSrc.value = colorSource.texture
      blitMaterial(gl, p.copyMat, null)
    }
  }, 1)

  return null
}
