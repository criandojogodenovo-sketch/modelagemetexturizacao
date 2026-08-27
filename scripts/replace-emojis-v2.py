#!/usr/bin/env python3
"""
Substitui TODOS os emojis restantes por nomes de ícones (em strings) ou remove (em JSX text).
"""
import os, re

EMOJI_TO_ICON = {
    '🏠': 'home', '📄': 'file', '⛰️': 'mountain', '🏃': 'film', '💾': 'save',
    '📂': 'folder-open', '📦': 'package', '📋': 'clipboard', '🐛': 'bug',
    '🎨': 'palette', '🧩': 'puzzle', '📱': 'smartphone', '🌈': 'palette',
    '📁': 'folder', '🌐': 'wifi', '📊': 'gauge', '📚': 'book', '⚙️': 'settings',
    '🎮': 'gamepad-2', '💡': 'lightbulb', '☀️': 'sun', '🌊': 'waves',
    '🌫️': 'wind', '🪞': 'git-branch', '✨': 'sparkles', '💫': 'zap',
    '🔊': 'volume-2', '🌤️': 'cloud', '🔘': 'mouse-pointer-2', '🕹️': 'joystick',
    '📝': 'type', '🖼️': 'image', '📍': 'map-pin', '🌀': 'spline', '🚩': 'flag',
    '⏱️': 'timer', '🛤️': 'route', '🔫': 'sword', '🎁': 'gift', '⚡': 'zap',
    '🎲': 'dice-5', '🔥': 'flame', '✅': 'check', '❌': 'x', '⚠️': 'alert',
    '🎯': 'target', '🤖': 'bot', '🚶': 'user', '🛑': 'octagon', '🧱': 'square',
    '🔵': 'circle-dot', '🔦': 'flashlight', '🔧': 'wrench', '🏗️': 'building',
    '🔄': 'refresh', '⬆️': 'arrow-up', '⬇️': 'arrow-down', '➡️': 'arrow-right',
    '⬅️': 'arrow-left', '🔍': 'search', '🎬': 'film', '🚀': 'rocket',
    '💥': 'zap', '🎒': 'package', '❤️': 'heart', '💀': 'skull', '⭐': 'star',
    '🌟': 'star', '🎵': 'music', '🎶': 'music', '🦴': 'bone', '🌳': 'tree',
    '🚗': 'car', '🏛️': 'building', '🌍': 'globe', '💧': 'droplet',
}

def process_file(path):
    with open(path, 'r') as f:
        content = f.read()

    original = content
    changes = 0

    for emoji, icon_name in EMOJI_TO_ICON.items():
        if emoji in content:
            count = content.count(emoji)
            # Substituir em strings (entre aspas): "emoji" → "icon_name"
            content = re.sub(
                r'(["\'`])\s*' + re.escape(emoji) + r'\s*(["\'`])',
                lambda m, name=icon_name: m.group(1) + name + m.group(2),
                content
            )
            # Substituir em placeholders: placeholder="emoji text" → placeholder="text"
            content = re.sub(
                r'(["\'`])\s*' + re.escape(emoji) + r'\s+',
                lambda m, name=icon_name: m.group(1),
                content
            )
            # Substituir em JSX text: >emoji< → >< (remover)
            content = re.sub(
                r'>\s*' + re.escape(emoji) + r'\s*<',
                '><',
                content
            )
            # Substituir em JSX text com conteúdo: >emoji text< → >text<
            content = re.sub(
                r'>\s*' + re.escape(emoji) + r'\s+([^<]+)<',
                r'>\1<',
                content
            )
            # Substituir emojis restantes em strings com texto: "emoji Pesquisar" → "Pesquisar"
            content = re.sub(
                re.escape(emoji) + r'\s+',
                '',
                content
            )
            # Remover emojis soltos restantes
            content = content.replace(emoji, '')
            remaining = content.count(emoji)
            changes += (count - remaining)

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
