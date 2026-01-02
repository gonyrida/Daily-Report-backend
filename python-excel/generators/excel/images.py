# python-excel/generators/excel/images.py
import os
from io import BytesIO
from openpyxl.drawing.image import Image as XLImage
from openpyxl.drawing.spreadsheet_drawing import TwoCellAnchor, AnchorMarker
import base64

# New imports
from PIL import Image, UnidentifiedImageError
try:
    import cairosvg
except Exception:
    cairosvg = None
try:
    import imageio
except Exception:
    imageio = None

def _rasterize_image_bytes(img_bytes, filename_hint=None):
    """
    Convert image bytes to PNG bytes suitable for openpyxl.
    Supports: SVG (via cairosvg), WebP/BMP/TIFF/GIF (via Pillow), and fallback via imageio.
    Returns PNG bytes or raises an exception on failure.
    """
    # Quick SVG sniff: filename endswith .svg or bytes contain '<svg'
    if (isinstance(filename_hint, str) and filename_hint.lower().endswith(".svg")) or (b"<svg" in img_bytes[:200].lower()):
        if not cairosvg:
            raise RuntimeError("SVG input requires cairosvg (pip install cairosvg)")
        return cairosvg.svg2png(bytestring=img_bytes)

    # Try Pillow first (handles webp if built with libwebp)
    try:
        with Image.open(BytesIO(img_bytes)) as im:
            # For animated formats like GIF, take first frame
            if getattr(im, "is_animated", False):
                im.seek(0)
            # Preserve transparency by converting to RGBA and save PNG
            out = BytesIO()
            im.convert("RGBA").save(out, format="PNG")
            return out.getvalue()
    except UnidentifiedImageError:
        # Try imageio fallback (helps for some exotic formats)
        if imageio:
            try:
                arr = imageio.imread(img_bytes)
                out = BytesIO()
                Image.fromarray(arr).convert("RGBA").save(out, format="PNG")
                return out.getvalue()
            except Exception:
                pass
        raise

def process_and_insert_images(ws, entry, image_cache, image_row, data_columns):
    """
    Revised to work with both file paths (Node.js style) and streams.
    Note: 'files' argument removed, assuming image_cache or paths within 'entry'.
    """
    for idx, img_source in enumerate(entry.get("images", [])):
        if not img_source or idx >= len(data_columns):
            continue

        # 1. Get raw bytes into cache if needed
        if img_source not in image_cache:
            try:
                if isinstance(img_source, str) and img_source.startswith("data:image"):
                    header, b64data = img_source.split(",", 1)
                    image_cache[img_source] = base64.b64decode(b64data)
                elif isinstance(img_source, str) and os.path.exists(img_source):
                    with open(img_source, "rb") as f:
                        image_cache[img_source] = f.read()
                elif hasattr(img_source, "read"):
                    img_source.seek(0)
                    image_cache[img_source] = img_source.read()
                else:
                    continue
            except Exception:
                continue

        raw_bytes = image_cache[img_source]

        # 1.5 Convert / rasterize to PNG bytes (cache converted bytes to avoid reprocessing)
        cache_key = (img_source, "raster")
        if cache_key in image_cache:
            png_bytes = image_cache[cache_key]
        else:
            try:
                filename_hint = img_source if isinstance(img_source, str) else None
                png_bytes = _rasterize_image_bytes(raw_bytes, filename_hint=filename_hint)
                image_cache[cache_key] = png_bytes
            except Exception:
                # If conversion fails, skip this image
                continue

        img_data = BytesIO(png_bytes)
        img = XLImage(img_data)

        # 2. Anchor Logic (Exactly your old working math)
        col_start = data_columns[idx] - 1
        row_start = image_row - 1

        _from = AnchorMarker(col=col_start, colOff=0, row=row_start, rowOff=0)
        _to = AnchorMarker(
            col=col_start,
            colOff=int(4.93 * 914400),  # Your template width
            row=row_start,
            rowOff=int(3.7 * 914400)    # Your template height
        )

        anchor = TwoCellAnchor(editAs='oneCell')
        anchor._from = _from
        anchor.to = _to

        img.anchor = anchor
        ws.add_image(img)