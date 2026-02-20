#!/bin/bash

# Создаёт простую иконку для приложения
# Требует sips (встроен в macOS)

ICON_DIR="/Users/rudomanenkodenis/Documents/NPF-project/NPF-Development.app/Contents/Resources"
ICONSET_DIR="$ICON_DIR/AppIcon.iconset"

mkdir -p "$ICONSET_DIR"

# Создаём простое SVG и конвертируем
# Так как SVG требует дополнительных инструментов, создадим через Python

python3 << 'EOF'
from PIL import Image, ImageDraw, ImageFont
import os

sizes = [16, 32, 64, 128, 256, 512, 1024]
iconset_dir = "/Users/rudomanenkodenis/Documents/NPF-project/NPF-Development.app/Contents/Resources/AppIcon.iconset"
os.makedirs(iconset_dir, exist_ok=True)

for size in sizes:
    # Создаём изображение
    img = Image.new('RGBA', (size, size), (26, 54, 93, 255))  # Тёмно-синий фон
    draw = ImageDraw.Draw(img)

    # Рисуем круг
    margin = size // 8
    draw.ellipse([margin, margin, size-margin, size-margin], fill=(56, 161, 105, 255))

    # Добавляем текст "NPF"
    try:
        font_size = size // 4
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except:
        font = ImageFont.load_default()

    text = "NPF"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (size - text_width) // 2
    y = (size - text_height) // 2
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)

    # Сохраняем
    img.save(f"{iconset_dir}/icon_{size}x{size}.png")
    if size <= 512:
        img_2x = img.resize((size*2, size*2), Image.LANCZOS)
        img_2x.save(f"{iconset_dir}/icon_{size}x{size}@2x.png")

print("Icons created!")
EOF

# Конвертируем iconset в icns
iconutil -c icns "$ICONSET_DIR" -o "$ICON_DIR/AppIcon.icns" 2>/dev/null || echo "iconutil not available, using PNG"

# Удаляем временную папку
rm -rf "$ICONSET_DIR"

echo "Icon created at $ICON_DIR/AppIcon.icns"
