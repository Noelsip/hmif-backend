# HMIF App Backend - API Documentation

## Base URL
```
http://localhost:3000
```

## Authentication
API ini menggunakan JWT (JSON Web Token) untuk autentikasi. Setelah login berhasil, sertakan token dalam header:
```
Authorization: Bearer <your_jwt_token>
```

---

## API Endpoints

### 1. Health Check

#### `GET /`
**Deskripsi:** Endpoint untuk mengecek status API.

**Response:**
```json
{
  "success": true,
  "message": "HMIF App Backend API is running!",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "development"
}
```

#### `GET /health`
**Deskripsi:** Health check endpoint untuk monitoring.

**Response:**
```json
{
  "success": true,
  "message": "Server is healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### 2. Authentication

#### `GET /auth/google`
**Deskripsi:** Memulai proses autentikasi Google OAuth untuk web browser.

**Response:** Redirect ke halaman login Google

---

#### `POST /auth/google`
**Deskripsi:** Login menggunakan Google ID Token (untuk aplikasi mobile/Flutter).

**Request Body:**
```json
{
  "idToken": "google_id_token_here"
}
```

**Response Success:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "nim": "11231001",
      "email": "11231001@student.itk.ac.id",
      "name": "John Doe",
      "profileImageUrl": "https://example.com/image.jpg"
    },
    "token": "jwt_access_token_here"
  }
}
```

**Response Error:**
```json
{
  "success": false,
  "message": "Only ITK student email is allowed"
}
```

**Validasi:**
- Email harus berakhiran `@student.itk.ac.id`
- NIM harus dimulai dengan "11"

---

#### `GET /auth/google/callback`
**Deskripsi:** Callback URL untuk Google OAuth (web flow).

**Response Success:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "nim": "11231001",
      "email": "11231001@student.itk.ac.id",
      "name": "John Doe",
      "profileImageUrl": "https://example.com/image.jpg"
    },
    "token": "jwt_access_token_here"
  }
}
```

---

#### `GET /auth/failure`
**Deskripsi:** Endpoint untuk handle kegagalan autentikasi Google.

**Response:**
```json
{
  "success": false,
  "message": "Google authentication failed. Please ensure you use a valid ITK student email."
}
```

---

#### `POST /auth/logout`
**Deskripsi:** Logout pengguna (client-side token removal).

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

### 3. User Profile

#### `GET /auth/profile`
**Deskripsi:** Mendapatkan profil pengguna yang sedang login.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response Success:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nim": "11231001",
    "email": "11231001@student.itk.ac.id",
    "name": "John Doe",
    "profile_image_url": "https://example.com/image.jpg",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Response Error:**
```json
{
  "success": false,
  "message": "Access token required"
}
```

---

### 4. Token Management

#### `POST /auth/refresh`
**Deskripsi:** Refresh JWT access token.

**Request Body:**
```json
{
  "token": "current_jwt_token"
}
```

**Response Success:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_jwt_token_here"
  }
}
```

**Response Error:**
```json
{
  "success": false,
  "message": "Invalid refresh token."
}
```

---

### 5. User Search

#### `GET /auth/search?nim=<nim>`
**Deskripsi:** Mencari pengguna berdasarkan NIM.

**Query Parameters:**
- `nim` (required): NIM mahasiswa (contoh: 11231001)

**Example Request:**
```
GET /auth/search?nim=11231001
```

**Response Success:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nim": "11231001",
    "email": "11231001@student.itk.ac.id",
    "name": "John Doe",
    "profile_image_url": "https://example.com/image.jpg"
  }
}
```

**Response Error:**
```json
{
  "success": false,
  "message": "User not found Or Database error."
}
```

**Validasi:**
- NIM harus dimulai dengan "11"
- NIM harus terdiri dari 10-12 digit

---

### 6. Test Endpoint

#### `POST /auth/test`
**Deskripsi:** Endpoint untuk testing POST request dan debugging.

**Request Body:** Any JSON data

**Response:**
```json
{
  "success": true,
  "message": "POST test successful",
  "receivedData": {
    "key": "value"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Error Responses

### Format Error Response
Semua error response menggunakan format yang konsisten:

```json
{
  "success": false,
  "message": "Error message description",
  "error": "Detailed error (hanya muncul di development mode)"
}
```

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (token missing/invalid)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource tidak ditemukan)
- `500` - Internal Server Error

---

## Rate Limiting
- **Limit:** 100 requests per IP
- **Window:** 15 menit
- **Response saat limit tercapai:**
```json
{
  "success": false,
  "message": "Too many requests, please try again later."
}
```

---

## CORS Policy
**Allowed Origins:**
- `http://localhost:3000`
- `http://localhost:8080`
- `http://10.0.2.2:3000` (Android Emulator)
- `http://127.0.0.1:3000`
- `http://10.160.132.88:3000`
- Origins dari environment variable `ALLOWED_ORIGINS`

**Allowed Methods:** GET, POST, PUT, DELETE, OPTIONS

**Allowed Headers:** Content-Type, Authorization

---

## Environment Requirements

**Required Environment Variables:**
```env
# Database
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=
DB_NAME=hmif_app
DB_PORT=3306

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=1h

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Session
SESSION_SECRET=your_session_secret

# ImageKit (optional untuk upload gambar)
IMAGEKIT_PUBLIC_KEY=your_public_key
IMAGEKIT_PRIVATE_KEY=your_private_key
IMAGEKIT_URL_ENDPOINT=your_endpoint

# Admin (optional)
ADMIN_EMAILS=admin1@student.itk.ac.id,admin2@student.itk.ac.id
```

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nim VARCHAR(12) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  google_id VARCHAR(255),
  profile_image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);
```

---

## Postman Collection Example

```json
{
  "info": {
    "name": "HMIF App API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/health",
          "host": ["{{baseUrl}}"],
          "path": ["health"]
        }
      }
    },
    {
      "name": "Google Login",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"idToken\": \"your_google_id_token\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/auth/google",
          "host": ["{{baseUrl}}"],
          "path": ["auth", "google"]
        }
      }
    },
    {
      "name": "Get Profile",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/auth/profile",
          "host": ["{{baseUrl}}"],
          "path": ["auth", "profile"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "token",
      "value": "your_jwt_token_here"
    }
  ]
}
```