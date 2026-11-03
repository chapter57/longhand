#!/usr/bin/env python3
"""Turn a 1024x1024 PNG into a Mac .icns icon file.

    python3 icon/make_icns.py icon/icon-1024.png icon/AppIcon.icns

Needs Pillow (pip3 install pillow). Writes both the old icon formats that
Mac OS X 10.5 Leopard reads and the PNG-based sizes (up to 1024px Retina)
that newer versions use, so one file works everywhere.
"""
import io
import struct
import sys

from PIL import Image


def packbits(channel: bytes) -> bytes:
    """Apple's run-length encoding for the old 'is32/il32/ih32/it32' types."""
    out = bytearray()
    i, n = 0, len(channel)
    while i < n:
        # Run of identical bytes (3..130 long)?
        run = 1
        while i + run < n and run < 130 and channel[i + run] == channel[i]:
            run += 1
        if run >= 3:
            out += bytes([0x80 + run - 3, channel[i]])
            i += run
            continue
        # Otherwise copy literally until the next run of 3 starts (max 128).
        start = i
        while i < n and i - start < 128:
            if i + 2 < n and channel[i] == channel[i + 1] == channel[i + 2]:
                break
            i += 1
        out += bytes([i - start - 1]) + channel[start:i]
    return bytes(out)


def sized(master: Image.Image, size: int) -> Image.Image:
    return master.resize((size, size), Image.LANCZOS)


def png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def legacy(img: Image.Image, prefix_zeros: bool) -> tuple:
    r, g, b, a = img.split()
    rgb = b"".join(packbits(c.tobytes()) for c in (r, g, b))
    if prefix_zeros:  # it32 starts with four zero bytes
        rgb = b"\0\0\0\0" + rgb
    return rgb, a.tobytes()


def main():
    src, dst = sys.argv[1], sys.argv[2]
    master = Image.open(src).convert("RGBA")
    if master.size != (1024, 1024):
        master = sized(master, 1024)

    chunks = []
    # Old formats (10.0+): RLE-compressed colour plus an 8-bit mask.
    for size, rgb_type, mask_type in ((16, b"is32", b"s8mk"), (32, b"il32", b"l8mk"),
                                      (48, b"ih32", b"h8mk"), (128, b"it32", b"t8mk")):
        rgb, mask = legacy(sized(master, size), rgb_type == b"it32")
        chunks += [(rgb_type, rgb), (mask_type, mask)]
    # PNG formats (10.5+ for ic08/ic09, 10.7+ for the rest).
    for size, kind in ((128, b"ic07"), (256, b"ic08"), (512, b"ic09"), (1024, b"ic10"),
                       (32, b"ic11"), (64, b"ic12"), (256, b"ic13"), (512, b"ic14")):
        chunks.append((kind, png_bytes(sized(master, size))))

    body = b"".join(kind + struct.pack(">I", len(data) + 8) + data for kind, data in chunks)
    with open(dst, "wb") as f:
        f.write(b"icns" + struct.pack(">I", len(body) + 8) + body)
    print(f"wrote {dst} ({len(body) + 8:,} bytes)")


if __name__ == "__main__":
    main()
