"""Makes a clean meme look saved, screenshotted and reposted a few times.

    python .github/memes/crunch.py in.png out.jpg
"""
import io
import sys

from PIL import Image, ImageEnhance, ImageFilter

src, dst = sys.argv[1:3]
im = Image.open(src).convert("RGB")
w, h = im.size
im = im.resize((int(w * 0.62), int(h * 0.62)), Image.BILINEAR).resize((w, h), Image.BILINEAR)
im = ImageEnhance.Contrast(im).enhance(1.12)
for q in (38, 30):
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=q)
    im = Image.open(buf).convert("RGB")
im = im.filter(ImageFilter.UnsharpMask(radius=1.5, percent=60))
im.save(dst, "JPEG", quality=55)
