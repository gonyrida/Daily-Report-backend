import os
from flask import Flask, request, send_file
from flask_cors import CORS

# 1. Import the Engine and the Writer
from generators.excel.engine import generate_full_report
from generators.excel.writer import save_to_memory

app = Flask(__name__)
CORS(app)

# --- REFACTORED ROUTES ---

@app.route("/generate-report", methods=["POST"])
def generate_report():
    payload = request.json
    mode = payload.get('mode', 'report')
    data = payload.get('data')  # Extract the actual data
    
    # Debug: Print what we received
    print(f"Mode: {mode}")
    print(f"Data keys: {list(data.keys()) if data else 'None'}")
    
    wb = generate_full_report(data, mode=mode)
    output = save_to_memory(wb)
    
    return send_file(
        output,
        as_attachment=True,
        download_name="Report_Only_Verification.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

@app.route("/generate-reference", methods=["POST"])
def generate_reference():
    data = request.json 
    # Use the engine with mode="reference" (it will delete the report sheet automatically)
    wb = generate_full_report(data, mode="reference")
    output = save_to_memory(wb)

    return send_file(
        output,
        as_attachment=True,
        download_name="Reference_Only_Verification.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

@app.route("/generate-combined", methods=["POST"])
def generate_combined():
    data = request.json 
    # Use the engine with mode="combined" (keeps both sheets)
    wb = generate_full_report(data, mode="combined")
    output = save_to_memory(wb)

    return send_file(
        output,
        as_attachment=True,
        download_name="Full_Combined_Report.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

if __name__ == "__main__":
    # Note: Using your port 5001 as per your original code
    app.run(host="0.0.0.0", port=5001, debug=True)