#!/usr/bin/env bash
# ============================================================
# build-apk.sh — Build do APK Android da Flir Engine (S20/Parte E)
#
# PRÉ-REQUISITOS (máquina local com Android Studio):
#   npm install @capacitor/core @capacitor/cli @capacitor/android
#   npx cap init "Flir Engine" com.flir.engine --web-dir=dist   (já feito: capacitor.config.json)
#
# USO:
#   bash scripts/build-apk.sh          # debug APK
#   bash scripts/build-apk.sh release  # release (assinado, se configurado)
#
# O APK final fica em:
#   android/app/build/outputs/apk/debug/app-debug.apk
#
# INSTALAR NO DISPOSITIVO:
#   adb install android/app/build/outputs/apk/debug/app-debug.apk
#
# NOTA: Este ambiente de desenvolvimento (Linux sandbox) NÃO tem o
# Android SDK — o script valida e instrui. A geração real do APK
# acontece em máquina com Android Studio (documentado no README S20).
# ============================================================
set -e
cd "$(dirname "$0")/.."

MODE="${1:-debug}"
echo "=== Flir Engine — build APK ($MODE) ==="

# 1. Verificar capacitor
if [ ! -d "node_modules/@capacitor/core" ]; then
  echo "[ERRO] Capacitor não instalado. Corre:"
  echo "  npm install @capacitor/core @capacitor/cli @capacitor/android"
  exit 1
fi

# 2. Build web (dist/)
echo "[1/4] npm run build..."
npm run build

# 3. Sync para o projeto Android
echo "[2/4] npx cap sync android..."
npx cap sync android

# 4. Verificar SDK
if [ -z "$ANDROID_HOME" ]; then
  echo "[AVISO] ANDROID_HOME não definido — abre no Android Studio:"
  echo "  npx cap open android"
  echo "  (Android Studio > Build > Build APK(s))"
  echo ""
  echo "Depois de configurar o SDK (ANDROID_HOME), este script gera o APK"
  echo "automaticamente via gradle."
  exit 0
fi

# 5. Gradle build
echo "[3/4] gradle assemble..."
cd android
if [ "$MODE" = "release" ]; then
  ./gradlew assembleRelease
else
  ./gradlew assembleDebug
fi
cd ..

echo "[4/4] Pronto!"
echo "APK: android/app/build/outputs/apk/$MODE/app-${MODE}.apk"
echo "Instalar: adb install android/app/build/outputs/apk/$MODE/app-${MODE}.apk"
