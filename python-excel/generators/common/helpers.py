# generators/common/helpers.py
from io import BytesIO
from PIL import Image
import textwrap
import os

def write_to_merged_safe(ws, row, col, value):
    """
    Safely writes a value to a cell that might be part of a merged range.
    Openpyxl requires writing to the top-left cell of a merge to display correctly.
    """
    for merged in ws.merged_cells.ranges:
        if (
            merged.min_row <= row <= merged.max_row
            and merged.min_col <= col <= merged.max_col
        ):
            # Write to the absolute top-left coordinate of the merge
            ws.cell(row=merged.min_row, column=merged.min_col).value = value
            return
            
    # If not merged, write normally
    ws.cell(row=row, column=col).value = value

def get_image_from_path(file_path):
    """
    New helper: Reads an image from a local path if Node.js 
    saves the file to a 'uploads' folder first.
    """
    if not file_path or not os.path.exists(file_path):
        return None
    with open(file_path, 'rb') as f:
        return f.read()

def write_wrapped_rows(ws, start_row, col, text, max_rows, width=55):
    if not text:
        return

    raw = str(text)

    # Split by explicit newlines first
    paragraphs = raw.splitlines()

    lines = []
    for p in paragraphs:
        p = p.strip()
        if not p:
            # keep a blank line if user put an empty line
            lines.append("")
            continue

        # wrap each paragraph, but keep it grouped
        wrapped = textwrap.wrap(p, width=width) or [""]
        lines.extend(wrapped)

    for i in range(min(len(lines), max_rows)):
        ws.cell(row=start_row + i, column=col).value = lines[i]

def to_num(value):
    """
    Safely converts a value to a float. 
    Equivalent to the Node.js 'safeNumber' logic.
    """
    try:
        if value is None or value == "":
            return 0.0
        return float(value)
    except (ValueError, TypeError):
        return 0.0