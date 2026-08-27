#!/usr/bin/env python3
"""
Substitui emojis por chamadas <Icon name="..."> em todos os ficheiros .jsx e .js.
Para emojis que aparecem em strings de texto (não em JSX), substitui por texto simples.
"""
import os, re

# Mapa: emoji → nome do ícone (do iconMap.jsx)
EMOJI_TO_ICON = {
    '🏠': 'home',
    '📄': 'file',
    '⛰️': 'mountain',
    '🏃': 'film',
    '💾': 'save',
    '📂': 'folder-open',
    '📦': 'package',
    '📋': 'clipboard',
    '🐛': 'bug',
    '🎨': 'palette',
    '🧩': 'puzzle',
    '📱': 'smartphone',
    '🌈': 'palette',
    '📁': 'folder',
    '🌐': 'wifi',
    '📊': 'gauge',
    '📚': 'book',
    '⚙️': 'settings',
    '🎮': 'gamepad-2',
    '💡': 'lightbulb',
    '☀️': 'sun',
    '🌊': 'waves',
    '🌫️': 'wind',
    '🪞': 'git-branch',
    '✨': 'sparkles',
    '💫': 'zap',
    '🔊': 'volume-2',
    '🌤️': 'cloud',
    '🔘': 'mouse-pointer-2',
    '🕹️': 'joystick',
    '📝': 'type',
    '🖼️': 'image',
    '📍': 'map-pin',
    '🌀': 'spline',
    '🚩': 'flag',
    '⏱️': 'timer',
    '🛤️': 'route',
    '🔫': 'sword',
    '🎁': 'gift',
    '⚡': 'zap',
    '🎲': 'dice-5',
    '🔥': 'flame',
    '✅': 'check',
    '❌': 'x',
    '⚠️': 'alert',
    '🎯': 'target',
    '🤖': 'bot',
    '🚶': 'user',
    '🛑': 'octagon',
    '🧱': 'square',
    '🔵': 'circle-dot',
    '🔦': 'flashlight',
    '🔧': 'wrench',
    '🏗️': 'building',
    '🔄': 'refresh',
    '⬆️': 'arrow-up',
    '⬇️': 'arrow-down',
    '➡️': 'arrow-right',
    '⬅️': 'arrow-left',
    '🔍': 'search',
    '🎬': 'film',
    '🚀': 'rocket',
    '💥': 'zap',
    '🎒': 'package',
    '❤️': 'heart',
    '💀': 'skull',
    '⭐': 'star',
    '🌟': 'star',
    '🎵': 'music',
    '🎶': 'music',
    '🦴': 'bone',
    '🌳': 'tree',
    '🚗': 'car',
    '🏛️': 'building',
    '🌍': 'globe',
}

# Padrões de substituição para texto (não-JS) — remove o emoji e deixa só o texto
TEXT_REPLACEMENTS = {
    '📋 ': '',
    '⚠️ ': '',
    '✅ ': '',
    '❌ ': '',
    '💡 ': '',
    '⭐ ': '',
}

def process_file(path):
    with open(path, 'r') as f:
        content = f.read()

    original = content
    changes = 0

    # Primeiro: substituir emojis em strings de texto (placeholders, labels)
    for emoji, replacement in TEXT_REPLACEMENTS.items():
        if emoji in content:
            count = content.count(emoji)
            content = content.replace(emoji, replacement)
            changes += count

    # Segundo: substituir emojis restantes por nome do ícone (apenas em contexto de string)
    # NÃO substituir emojis que já estão dentro de <Icon name="..."> 
    for emoji, icon_name in EMOJI_TO_ICON.items():
        if emoji in content:
            # Substituir em strings (entre aspas) por nome do ícone
            # Padrão: 'emoji' ou "emoji" ou `emoji`
            content = re.sub(
                r'(["\'`])' + re.escape(emoji) + r'(["\'`])',
                lambda m, name=icon_name: m.group(1) + name + m.group(2),
                content
            )
            # Contar quantos foram substituídos
            remaining = content.count(emoji)
            changes += (original.count(emoji) - remaining)

    # Terceiro: remover emojis restantes que aparecem como texto solto em JSX
    # (entre > e <) — substituir por string vazia
    for emoji in EMOJI_TO_ICON:
        if emoji in content:
            # Em JSX text: >emoji< → ><
            content = re.sub(
                r'>' + re.escape(emoji) + r'<',
                '><',
                content
            )
            # Em JSX text com espaço: > emoji < → ><
            content = re.sub(
                r'>\s*' + re.escape(emoji) + r'\s*<',
                '>',
                content
            )

    if content != original:
        with open(path, 'w') as f:
            f.write(content)
        return changes
    return 0

total_changes = 0
files_changed = 0

for root, dirs, files in os.walk('src'):
    for f in files:
        if f.endswith(('.jsx', '.js')):
            path = os.path.join(root, f)
            changes = process_file(path)
            if changes > 0:
                files_changed += 1
                total_changes += changes
                print(f'  {path}: {changes} substituições')

print(f'\nTotal: {files_changed} ficheiros, {total_changes} substituições')
