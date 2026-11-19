#!/usr/bin/env python3
"""Generate original UGN app icon assets for desktop, Android, and PWA.
No downloaded artwork, Minecraft textures or proprietary fonts are required.
Requires Pillow (pip install pillow)."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math, random

ROOT = Path(__file__).resolve().parents[2]
DESKTOP = ROOT / "apps" / "desktop" / "assets"
PWA = ROOT / "icons"
ANDROID = ROOT / "apps" / "android" / "app" / "src" / "main" / "res" / "mipmap-xxxhdpi"
for folder in (DESKTOP, PWA, ANDROID):
    folder.mkdir(parents=True, exist_ok=True)
SIZE = 1024
img = Image.new("RGBA", (SIZE, SIZE), (7, 12, 33, 255))
d = ImageDraw.Draw(img)
for y in range(SIZE):
    t=y/(SIZE-1)
    d.line((0,y,SIZE,y),fill=(int(7+18*t),int(12+17*t),int(33+30*t),255))
random.seed(71192)
for _ in range(145):
    x=random.randrange(45,980); y=random.randrange(45,975)
    r=random.choice((1,1,1,2,3))
    a=random.randrange(75,215)
    d.ellipse((x-r,y-r,x+r,y+r),fill=(166,180,255,a))
d.ellipse((76,76,948,948),outline=(76,217,255,190),width=16)
d.arc((130,130,893,893),35,290,fill=(153,116,255,245),width=26)
d.arc((162,162,866,866),205,352,fill=(90,247,174,245),width=13)
try:
    fonts = ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
             '/Library/Fonts/Arial Bold.ttf',
             'C:/Windows/Fonts/arialbd.ttf']
    fontpath=next((x for x in fonts if Path(x).exists()), None)
    font=ImageFont.truetype(fontpath,242) if fontpath else ImageFont.load_default()
    subfont=ImageFont.truetype(fontpath,55) if fontpath else ImageFont.load_default()
except Exception:
    font=ImageFont.load_default()
    subfont=ImageFont.load_default()
d.text((512,465),"UGN",font=font,fill=(239,247,255),anchor="mm",stroke_width=2,stroke_fill=(111,87,235))
d.text((512,650),"JAVA",font=subfont,fill=(124,232,255),anchor="mm")
img.save(DESKTOP/"icon.png",optimize=True)
img.save(DESKTOP/"icon.ico",format="ICO",sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
img.save(DESKTOP/"icon.icns",format="ICNS",sizes=[(16,16),(32,32),(64,64),(128,128),(256,256),(512,512),(1024,1024)])
img.resize((512,512),Image.Resampling.LANCZOS).save(PWA/"icon-512.png")
img.resize((192,192),Image.Resampling.LANCZOS).save(PWA/"icon-192.png")
img.resize((192,192),Image.Resampling.LANCZOS).save(ANDROID/"ic_launcher.png")
print("UGN branded icons generated.")
