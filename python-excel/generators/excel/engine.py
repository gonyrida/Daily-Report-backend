# generators/excel/engine.py
import os
from openpyxl import load_workbook
from .sheets.report import (
    fill_report_header, 
    fill_activities, 
    fill_team_tables, 
    fill_material_machinery_tables,
    fill_report_sheet
)
from .sheets.reference import fill_reference_sheet

def generate_full_report(data, mode="combined"):

    print(f"Processing data: {data}")
    
    # Different validation for reference mode
    if mode == "reference":
        if not data or 'reference' not in data:
            print("ERROR: Missing reference data")
            # return create_empty_workbook()
    else:
        # Original validation for report modes
        if not data or 'projectName' not in data:
            print("ERROR: Missing required data")
            # return create_empty_workbook()

    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    template_path = os.path.join(base_dir, "templates", "template.xlsx")
    wb = load_workbook(template_path)
    
    ws_report = wb.worksheets[0]
    ws_ref = wb.worksheets[1]

    if mode == "report":
        # Fill Report, then delete Reference
        fill_report_sheet(ws_report, data)
        fill_report_header(ws_report, data)
        fill_activities(ws_report, data)
        team_shift = fill_team_tables(ws_report, data)
        fill_material_machinery_tables(ws_report, data, team_shift)
        wb.remove(ws_ref) 

    elif mode == "reference":
        # Fill Reference, then delete Report
        reference_data = data.get('reference', [])
        print(f"DEBUG: Passing to fill_reference_sheet: {reference_data}")
        fill_reference_sheet(ws_ref, reference_data, data.get("table_title", "PHOTO REFERENCE"))
        _apply_reference_print_settings(ws_ref)
        wb.remove(ws_report)

    elif mode == "combined":
        # FILL BOTH
        reference_data = data.get('reference', [])
        # 1. Report Sheet
        fill_report_header(ws_report, data)
        fill_activities(ws_report, data)
        team_shift = fill_team_tables(ws_report, data)
        fill_material_machinery_tables(ws_report, data, team_shift)
        
        # 2. Reference Sheet (The 4-per-page logic lives here!)
        fill_reference_sheet(ws_ref, reference_data, data.get("table_title", "PHOTO REFERENCE"))
        _apply_reference_print_settings(ws_ref)

        # Set the Report sheet (index 0) as the active one
        wb.active = 0

        # Optional: Ensure the Reference sheet isn't the "selected" one
        for sheet in wb.worksheets:
            sheet.sheet_view.tabSelected = False
        wb.worksheets[0].sheet_view.tabSelected = True

    return wb

def _apply_reference_print_settings(ws):
    """
    Ensures the Reference sheet fits perfectly on paper/PDF.
    """
    # 1. THE BIG ONE: Fit all columns to 1 page width
    ws.page_setup.fitToWidth = 1
    
    # 2. DO NOT fit to height (Set to 0/False)
    # This allows our manual page breaks to work!
    ws.page_setup.fitToHeight = 0 
    
    # 3. Enable the "Fit to" logic 
    # (Openpyxl requires setting this so the numbers above are used)
    ws.sheet_properties.pageSetUpPr.fitToPage = True

    # 4. Standard Paper Settings
    ws.page_setup.orientation = ws.ORIENTATION_PORTRAIT
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    
    # 5. Repeating Header (Rows 1-4)
    ws.print_title_rows = '1:4'
    
    # 6. Center on page horizontally
    ws.page_setup.horizontalCentered = True