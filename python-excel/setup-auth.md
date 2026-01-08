# Python Backend Authentication Setup

## JWT Secret Configuration

The Python backend requires the **same JWT secret** as the Node.js backend to validate tokens properly.

### Step 1: Copy JWT Secret from Node.js Backend

1. Open your Node.js backend `.env` file (located in the main backend directory)
2. Copy the `JWT_SECRET` value
3. Create a new `.env` file in this `python-excel` directory
4. Add the JWT secret:

```bash
# Copy the EXACT same JWT_SECRET from your main backend .env file
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random-min-32-chars

# Flask Configuration
FLASK_ENV=development
FLASK_DEBUG=True

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:8080
```

### Step 2: Restart Python Backend

After setting the JWT secret, restart the Python backend:

```bash
cd python-excel
python app.py
```

### Step 3: Test Authentication Flow

1. Login to the frontend (this stores the JWT token in localStorage)
2. Try generating a combined Excel report
3. Check the Python backend console for authentication logs

### Debugging

If you still get 401 errors:

1. **Check JWT Secret**: Ensure both backends use the EXACT same JWT secret
2. **Check Token**: Open browser dev tools → Application → Local Storage → Check if "token" exists
3. **Check Console**: Look for authentication logs in both backends

### Expected Logs

**Frontend** (Browser Console):
```
🔑 COMBINED EXPORT: Extracted userId from token: 507f1f77bcf86cd799439011
🔑 COMBINED EXPORT: Sending payload with userId: 507f1f77bcf86cd799439011
```

**Python Backend** (Console):
```
🔑 AUTH: Token extracted from Authorization header
🔑 AUTH: Attempting to decode JWT with secret length: 64
✅ AUTH SUCCESS: User 507f1f77bcf86cd799439011 authenticated successfully
🔍 OWNERSHIP CHECK: Authenticated user ID: 507f1f77bcf86cd799439011
✅ OWNERSHIP VALIDATION PASSED: User 507f1f77bcf86cd799439011 can access this data
```

## Security Notes

- Never commit the `.env` file to version control
- Use a strong, random JWT secret (minimum 32 characters)
- The JWT secret must be identical between both backends
- Tokens expire after 1 hour by default
