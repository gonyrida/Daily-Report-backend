# generators/excel/writer.py
from io import BytesIO

def save_to_memory(wb):
    """
    Saves the workbook into a BytesIO buffer for the API response.
    """
    stream = BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream