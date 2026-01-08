import os
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from middleware.auth import authenticate_token, validate_user_ownership

# Load environment variables from .env file
load_dotenv()

# 1. Import the Engine and the Writer
from generators.excel.engine import generate_full_report
from generators.excel.writer import save_to_memory

app = Flask(__name__)

# Configure CORS for development and production
CORS(
    app,
    origins=[
        "http://localhost:8080",  # Vite dev server
        "http://localhost:3000",  # React dev server
        "http://localhost:5173",  # Vite default
        "http://127.0.0.1:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://10.10.20.122:8080",  # Your network IP
        os.getenv("FRONTEND_URL", "http://localhost:3000"),  # Production fallback
    ],
    supports_credentials=True,
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Security: Validate required environment variables
jwt_secret = os.getenv("JWT_SECRET")
if not jwt_secret:
    app.logger.error("❌ CRITICAL: JWT_SECRET environment variable not set")
    exit(1)

app.logger.info(f"✅ JWT_SECRET loaded successfully, length: {len(jwt_secret)}")

# --- SECURED ROUTES WITH AUTHENTICATION ---


@app.route("/generate-report", methods=["POST"])
@authenticate_token
def generate_report():
    try:
        payload = request.json
        mode = payload.get("mode", "report")
        data = payload.get("data")  # Extract the actual data

        # Validate user ownership of data
        validate_user_ownership(data)

        # Security: Log minimal info for debugging
        app.logger.info(
            f"Report generation: Mode={mode}, UserID={request.user.get('userId')}"
        )

        wb = generate_full_report(data, mode=mode)
        output = save_to_memory(wb)

        return send_file(
            output,
            as_attachment=True,
            download_name=f"Report_{request.user.get('userId')}_Verification.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except Exception as e:
        app.logger.error(f"Report generation error: {str(e)}")
        return jsonify({"error": "Report generation failed"}), 401


@app.route("/generate-reference", methods=["POST"])
@authenticate_token
def generate_reference():
    try:
        data = request.json

        # Validate user ownership of data
        validate_user_ownership(data)

        app.logger.info(f"Reference generation: UserID={request.user.get('userId')}")

        # Use the engine with mode="reference" (it will delete the report sheet automatically)
        wb = generate_full_report(data, mode="reference")
        output = save_to_memory(wb)

        return send_file(
            output,
            as_attachment=True,
            download_name=f"Reference_{request.user.get('userId')}_Verification.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except Exception as e:
        app.logger.error(f"Reference generation error: {str(e)}")
        return jsonify({"error": "Reference generation failed"}), 401


@app.route("/generate-combined", methods=["POST"])
@authenticate_token
def generate_combined():
    try:
        data = request.json

        # Validate user ownership of data
        validate_user_ownership(data)

        app.logger.info(
            f"Combined report generation: UserID={request.user.get('userId')}"
        )

        # Use the engine with mode="combined" (keeps both sheets)
        wb = generate_full_report(data, mode="combined")
        output = save_to_memory(wb)

        return send_file(
            output,
            as_attachment=True,
            download_name=f"Combined_{request.user.get('userId')}_Report.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except Exception as e:
        app.logger.error(f"Combined report generation error: {str(e)}")
        return jsonify({"error": "Combined report generation failed"}), 401


# Health check endpoint
@app.route("/health", methods=["GET"])
def health_check():
    return jsonify(
        {"status": "healthy", "service": "python-excel-export", "auth_required": True}
    )


if __name__ == "__main__":
    # Note: Using your port 5001 as per your original code
    app.run(host="0.0.0.0", port=5001, debug=False)  # Disable debug in production
