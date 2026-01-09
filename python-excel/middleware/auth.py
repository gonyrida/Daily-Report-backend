import jwt
import os
from functools import wraps
from flask import request, jsonify

# JWT Secret (should match backend)
JWT_SECRET = os.getenv('JWT_SECRET', '8127619f1382cb5f434127e02f344c7d0a9620dc492f6c34cfe8d5f7f320d53cdefe84ef7d84f9186df9cf0f995b46c91feb66140aa5f0d2bda40ee7c05ee12e')

def authenticateToken(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Try Authorization header first
        auth_header = request.headers.get('Authorization')
        token = None
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            print(f"🔑 PYTHON AUTH: Found token in Authorization header")
        
        # Fallback: check for token in request body
        if not token and request.is_json:
            data = request.get_json()
            if data and 'userId' in data:
                # For combined exports, we might get userId directly
                print(f"🔑 PYTHON AUTH: Found userId in request body: {data['userId']}")
                return f(*args, **kwargs)
        
        if not token:
            print(f"🚨 PYTHON AUTH: No token found")
            return jsonify({'error': 'Authentication required'}), 401
        
        try:
            # Decode JWT
            decoded = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            userId = decoded.get('userId')
            
            if not userId:
                print(f"🚨 PYTHON AUTH: No userId in token")
                return jsonify({'error': 'Invalid token'}), 401
            
            print(f"🔑 PYTHON AUTH: Successfully authenticated userId: {userId}")
            
            # Add userId to request context
            request.userId = userId
            
            # For combined exports, verify userId matches payload
            if request.is_json:
                data = request.get_json()
                if data and 'userId' in data and data['userId'] != userId:
                    print(f"🚨 PYTHON AUTH: userId mismatch - token: {userId}, payload: {data['userId']}")
                    return jsonify({'error': 'User ownership validation failed'}), 403
            
            return f(*args, **kwargs)
            
        except jwt.ExpiredSignatureError:
            print(f"🚨 PYTHON AUTH: Token expired")
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError as e:
            print(f"🚨 PYTHON AUTH: Invalid token: {e}")
            return jsonify({'error': 'Invalid token'}), 401
        except Exception as e:
            print(f"🚨 PYTHON AUTH: Authentication error: {e}")
            return jsonify({'error': 'Authentication failed'}), 500
    
    return decorated_function
