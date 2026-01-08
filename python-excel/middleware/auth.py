import jwt
import os
from functools import wraps
from flask import request, jsonify, current_app


def authenticate_token(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None

        # Try Authorization header first (matching frontend behavior)
        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                current_app.logger.info(
                    f"🔑 AUTH: Token extracted from Authorization header, length: {len(token)}"
                )
            else:
                current_app.logger.error("🚨 AUTH FAILED: Invalid Authorization format")
                return jsonify({"error": "Invalid authorization format"}), 401

        # Fallback to cookie (for compatibility)
        elif "access_token" in request.cookies:
            token = request.cookies.get("access_token")
            current_app.logger.info(f"🔑 AUTH: Token extracted from cookie")

        if not token:
            current_app.logger.error(
                "🚨 AUTH FAILED: No token found in cookies or headers"
            )
            current_app.logger.error(f"🚨 AUTH DEBUG: Headers: {dict(request.headers)}")
            current_app.logger.error(f"🚨 AUTH DEBUG: Cookies: {dict(request.cookies)}")
            return (
                jsonify({"error": "User not authenticated - Please login again"}),
                401,
            )

        try:
            # Get JWT secret from environment variable - MUST match Node.js backend
            jwt_secret = os.getenv("JWT_SECRET")
            if not jwt_secret:
                current_app.logger.error(
                    "🚨 AUTH FAILED: JWT_SECRET environment variable not set"
                )
                return jsonify({"error": "Server configuration error"}), 500

            current_app.logger.info(
                f"🔑 AUTH: Attempting to decode JWT with secret length: {len(jwt_secret)}"
            )

            # Decode and validate token
            decoded = jwt.decode(token, jwt_secret, algorithms=["HS256"])

            # Validate required fields in JWT payload (must match Node.js structure)
            required_fields = ["userId", "email", "role"]
            missing_fields = [
                field for field in required_fields if field not in decoded
            ]
            if missing_fields:
                current_app.logger.error(
                    f"🚨 AUTH FAILED: JWT missing required fields: {missing_fields}"
                )
                return jsonify({"error": "Invalid token structure"}), 401

            # Add user info to request context
            request.user = decoded

            current_app.logger.info(
                f'✅ AUTH SUCCESS: User {decoded.get("userId")} authenticated successfully'
            )

            return f(*args, **kwargs)

        except jwt.ExpiredSignatureError:
            current_app.logger.error("🚨 AUTH FAILED: Token has expired")
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError as e:
            current_app.logger.error(f"🚨 AUTH FAILED: Invalid token - {str(e)}")
            return jsonify({"error": "Invalid token"}), 401
        except Exception as e:
            current_app.logger.error(f"🚨 AUTH FAILED: Authentication error - {str(e)}")
            return jsonify({"error": "Authentication failed"}), 401

    return decorated_function


def validate_user_ownership(user_data):
    """Validate that the data belongs to the authenticated user"""
    if not hasattr(request, "user") or not request.user:
        current_app.logger.error(
            "🚨 OWNERSHIP VALIDATION FAILED: User not authenticated"
        )
        raise Exception("User not authenticated")

    # Get authenticated user ID from JWT
    authenticated_user_id = request.user.get("userId")
    current_app.logger.info(
        f"🔍 OWNERSHIP CHECK: Authenticated user ID: {authenticated_user_id}"
    )

    # Ensure userId in request data matches authenticated user
    if "userId" in user_data and user_data["userId"] != authenticated_user_id:
        current_app.logger.error(
            f'🚨 OWNERSHIP VALIDATION FAILED: Data userId {user_data["userId"]} does not match authenticated user {authenticated_user_id}'
        )
        raise Exception("Access denied: Data belongs to different user")

    current_app.logger.info(
        f"✅ OWNERSHIP VALIDATION PASSED: User {authenticated_user_id} can access this data"
    )
    return True
