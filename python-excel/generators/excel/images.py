# python-excel/generators/excel/images.py
import os
from io import BytesIO
from openpyxl.drawing.image import Image as XLImage
from openpyxl.drawing.spreadsheet_drawing import TwoCellAnchor, AnchorMarker
from openpyxl.utils import get_column_letter
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
    if (isinstance(filename_hint, str) and filename_hint.lower().endswith(".svg")) or (
        b"<svg" in img_bytes[:200].lower()
    ):
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
                png_bytes = _rasterize_image_bytes(
                    raw_bytes, filename_hint=filename_hint
                )
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
            rowOff=int(3.7 * 914400),  # Your template height
        )

        anchor = TwoCellAnchor(editAs="oneCell")
        anchor._from = _from
        anchor.to = _to

        img.anchor = anchor
        ws.add_image(img)


def process_and_insert_logo(
    ws, logo_source, image_cache, col_start, row_start, width, height, is_left_logo=True
):
    """
    Process and insert a single logo image into the worksheet at specified position.
    Supports base64 data URLs, file paths, and file-like objects.

    Logo requirements:
    - Fixed height: Always fit within rows 0-4 (5 rows total) regardless of shape
    - Edge alignment: Left logo aligns to left edge, right logo aligns to right edge
    - Aspect ratio: Always preserved, width scales proportionally to height
    - No horizontal centering: Images stick to their respective edges
    - Logo replacement: Previous logos are cleared before insertion
    - Optional padding: Small padding to prevent tight border contact

    Args:
        is_left_logo: True for left logo (left edge), False for right logo (right edge)
    """
    print(f"DEBUG: Processing {'left' if is_left_logo else 'right'} logo")
    print(
        f"DEBUG: col_start: {col_start}, row_start: {row_start}, width: {width}, height: {height}"
    )

    if not logo_source:
        print("DEBUG: No logo source provided")
        return

    # 1. Get raw bytes into cache if needed
    if logo_source not in image_cache:
        try:
            if isinstance(logo_source, str) and logo_source.startswith("data:image"):
                print("DEBUG: Processing base64 data URL")
                header, b64data = logo_source.split(",", 1)
                image_cache[logo_source] = base64.b64decode(b64data)
                print("DEBUG: Successfully decoded base64")
            elif isinstance(logo_source, str) and os.path.exists(logo_source):
                print("DEBUG: Processing file path")
                with open(logo_source, "rb") as f:
                    image_cache[logo_source] = f.read()
            elif hasattr(logo_source, "read"):
                print("DEBUG: Processing file-like object")
                logo_source.seek(0)
                image_cache[logo_source] = logo_source.read()
            else:
                print("DEBUG: Unsupported logo source type")
                return
        except Exception as e:
            print(f"DEBUG: Error processing logo source: {e}")
            return

    raw_bytes = image_cache[logo_source]
    print(f"DEBUG: Raw bytes length: {len(raw_bytes)}")

    # 2. Convert / rasterize to PNG bytes
    cache_key = (logo_source, "raster")
    if cache_key in image_cache:
        png_bytes = image_cache[cache_key]
        print("DEBUG: Using cached PNG bytes")
    else:
        try:
            filename_hint = logo_source if isinstance(logo_source, str) else None
            print(f"DEBUG: Rasterizing image with hint: {filename_hint}")
            png_bytes = _rasterize_image_bytes(raw_bytes, filename_hint=filename_hint)
            image_cache[cache_key] = png_bytes
            print(f"DEBUG: Successfully rasterized to PNG, size: {len(png_bytes)}")
        except Exception as e:
            print(f"DEBUG: Error rasterizing image: {e}")
            return

    # 3. Get image dimensions using PIL
    try:
        with Image.open(BytesIO(png_bytes)) as pil_img:
            img_width_px, img_height_px = pil_img.size
        print(f"DEBUG: Image dimensions: {img_width_px} x {img_height_px} pixels")
    except Exception as e:
        print(f"DEBUG: Error getting image dimensions: {e}")
        return

    # 4. Calculate container size in EMUs (1 inch = 914400 EMUs)
    container_width_emu = int(width * 914400)
    container_height_emu = int(height * 914400)
    print(f"DEBUG: Container size: {container_width_emu} x {container_height_emu} EMUs")

    # 5. Convert image pixels to inches (assume 96 DPI)
    dpi = 96
    img_width_inches = img_width_px / dpi
    img_height_inches = img_height_px / dpi
    print(f"DEBUG: Image size in inches: {img_width_inches:.3f} x {img_height_inches:.3f}")

    # 6. Apply fixed height scaling logic (rows 0-4 = 5 rows total)
    fixed_height_inches = height  # Use the provided height (should be ~5.0 inches)
    
    # Apply small padding (5% reduction for breathing room from borders)
    padding_factor = 0.95
    effective_height_inches = fixed_height_inches * padding_factor
    
    # Calculate scale based on fixed height to preserve aspect ratio
    scale = effective_height_inches / img_height_inches if img_height_inches > 0 else 1
    
    # Calculate scaled width maintaining aspect ratio
    scaled_width_inches = img_width_inches * scale
    scaled_height_inches = effective_height_inches  # Fixed height
    
    print(f"DEBUG: Fixed height scaling - height: {fixed_height_inches:.2f}", end=" ")
    print(f"effective_height: {effective_height_inches:.2f}, scale: {scale:.3f}")

    # 7. Calculate scaled image size in inches (already calculated above)
    print(
        f"DEBUG: Scaled size in inches: {scaled_width_inches:.3f} x {scaled_height_inches:.3f}"
    )

    # 8. Convert scaled size to EMUs
    scaled_width_emu = int(scaled_width_inches * 914400)
    scaled_height_emu = int(scaled_height_inches * 914400)
    print(f"DEBUG: Scaled size in EMUs: {scaled_width_emu} x {scaled_height_emu}")

    # 9. Calculate edge-aligned offsets (no horizontal centering)
    if is_left_logo:
        # Left logo: align to left edge (no horizontal offset)
        col_off = 0
    else:
        # Right logo: align to right edge within the same column
        col_off = max(0, container_width_emu - scaled_width_emu)
    
    # Vertical centering within the fixed height
    row_off = (container_height_emu - scaled_height_emu) // 2
    print(f"DEBUG: Edge-aligned offsets: colOff={col_off}, rowOff={row_off}")

    img_data = BytesIO(png_bytes)
    img = XLImage(img_data)
    print("DEBUG: Created XLImage object")

    # 10. Set positioning for edge-aligned logos
    # Left logo: B1-B5 (column 1, rows 0-4) - left edge aligned
    # Right logo: K1-K5 (column 10, rows 0-4) - right edge aligned
    col_span = 1  # Single column width
    row_span = 5  # Rows 1-5 (rows 0-4 in 0-indexed)

    # 11. Anchor Logic for edge-aligned logo positioning
    # Note: row_start should be 0 for row 1 (0-indexed)
    _from = AnchorMarker(col=col_start, colOff=col_off, row=row_start, rowOff=0)
    _to = AnchorMarker(
        col=col_start,  # Same column for edge alignment
        colOff=col_off + scaled_width_emu,
        row=row_start + row_span - 1,  # 0 + 5 - 1 = 4 (row 5 in Excel)
        rowOff=container_height_emu,
    )

    anchor = TwoCellAnchor(editAs="oneCell")
    anchor._from = _from
    anchor.to = _to

    img.anchor = anchor
    ws.add_image(img)
    print("DEBUG: Successfully added image to worksheet")
    print(f"DEBUG: Final position - columns: {col_start} to {col_start + col_span}")
