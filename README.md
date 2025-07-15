# HMIF App Backend API Documentation

## Base URL
```
http://localhost:3000
```

## Authentication
The API uses JWT (JSON Web Token) for authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## Health Check

### GET `/`
Basic health check endpoint.

**Response:**
```json
{
  "success": true,
  "message": "HMIF App Backend API is running!",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "development"
}
```

### GET `/health`
Health check endpoint.

**Response:**
```json
{
  "success": true,
  "message": "Server is healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Authentication Routes (`/auth`)

### POST `/auth/google`
Login with Google ID token (for Flutter).

**Request Body:**
```json
{
  "idToken": "google_id_token_here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "nim": "11220001",
      "email": "11220001@student.itk.ac.id",
      "name": "John Doe",
      "profileImageUrl": "https://image.url"
    },
    "token": "jwt_token_here"
  }
}
```

### GET `/auth/google`
Start Google OAuth authentication (for web).

### GET `/auth/google/callback`
Google OAuth callback endpoint.

### GET `/auth/failure`
Google OAuth failure endpoint.

**Response:**
```json
{
  "success": false,
  "message": "Google authentication failed. Please ensure you use a valid ITK student email."
}
```

### POST `/auth/logout`
Logout endpoint.

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

### GET `/auth/profile`
Get current user profile (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nim": "11220001",
    "email": "11220001@student.itk.ac.id",
    "name": "John Doe",
    "profile_image_url": "https://image.url",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST `/auth/refresh`
Refresh JWT token.

**Request Body:**
```json
{
  "token": "current_jwt_token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_jwt_token"
  }
}
```

### GET `/auth/search`
Search user by NIM.

**Query Parameters:**
- `nim` (required): Student identification number

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nim": "11220001",
    "email": "11220001@student.itk.ac.id",
    "name": "John Doe",
    "profile_image_url": "https://image.url"
  }
}
```

---

## Subject Routes (`/api/subcject`)

### GET `/api/subcject`
Get all subjects.

**Response:**
```json
{
  "success": true,
  "subjects": [
    {
      "id": 1,
      "code": "CS101",
      "name": "Introduction to Computer Science",
      "description": "Basic concepts of computer science",
      "credits": 3
    }
  ]
}
```

### GET `/api/subcject/enrolledsub`
Get user's enrolled subjects (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "subjects": [
    {
      "id": 1,
      "code": "CS101",
      "name": "Introduction to Computer Science",
      "description": "Basic concepts of computer science",
      "semester": 1,
      "credits": 3,
      "enrolled_at": "2024-01-01T00:00:00.000Z",
      "video_count": 5
    }
  ],
  "totalCredits": 3
}
```

### POST `/api/subcject/enroll`
Enroll user to a subject (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "subjectId": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully enrolled in subject",
  "data": {
    "subjectId": 1,
    "enrolledAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### DELETE `/api/subcject/unenroll/:subjectId`
Unenroll from a subject (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully unenrolled from subject"
}
```

### GET `/api/subcject/:subjectId/videos`
Get videos for a specific subject (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "videos": [
    {
      "id": 1,
      "title": "Introduction to Programming",
      "description": "Basic programming concepts",
      "video_url": "https://video.url",
      "thumbnail_url": "https://thumbnail.url",
      "duration": 1800,
      "order_index": 1
    }
  ]
}
```

### POST `/api/subcject`
Create new subject (requires admin authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "code": "CS101",
  "name": "Introduction to Computer Science",
  "description": "Basic concepts of computer science",
  "semester": 1,
  "credits": 3
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subject created successfully",
  "subject": {
    "id": 1,
    "code": "CS101",
    "name": "Introduction to Computer Science",
    "description": "Basic concepts of computer science",
    "semester": 1,
    "credits": 3
  }
}
```

---

## Video Routes (`/api/videos`)

### POST `/api/videos`
Add video to subject (requires admin authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "subjectId": 1,
  "title": "Introduction to Programming",
  "description": "Basic programming concepts",
  "videoUrl": "https://video.url",
  "thumbnailUrl": "https://thumbnail.url",
  "duration": 1800,
  "orderIndex": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Video added successfully",
  "data": {
    "id": 1,
    "subjectId": 1,
    "title": "Introduction to Programming",
    "description": "Basic programming concepts",
    "videoUrl": "https://video.url",
    "thumbnailUrl": "https://thumbnail.url",
    "duration": 1800,
    "orderIndex": 1
  }
}
```

### GET `/api/videos/:videoId`
Get video details (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "video": {
    "id": 1,
    "subject_name": "Introduction to Computer Science",
    "subject_code": "CS101"
  }
}
```

### PUT `/api/videos/:videoId`
Update video (requires admin authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "title": "Updated Video Title",
  "description": "Updated description",
  "videoUrl": "https://updated-video.url",
  "thumbnailUrl": "https://updated-thumbnail.url",
  "duration": 2400,
  "orderIndex": 2,
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Video updated successfully"
}
```

### DELETE `/api/videos/:videoId`
Delete video (requires admin authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Video deleted successfully"
}
```

---

## News Routes (`/api/news`)

### GET `/api/news`
Get all published news (public access).

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `category` (optional): Filter by category
- `search` (optional): Search in title and excerpt

**Response:**
```json
{
  "success": true,
  "data": {
    "news": [
      {
        "id": 1,
        "title": "News Title",
        "excerpt": "News excerpt",
        "image_url": "https://image.url",
        "category": "general",
        "published_at": "2024-01-01T00:00:00.000Z",
        "is_published": true,
        "create_at": "2024-01-01T00:00:00.000Z",
        "author_name": "John Doe",
        "author_email": "john@student.itk.ac.id"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalNews": 50,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

### GET `/api/news/:id`
Get single news by ID (public access).

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "News Title",
    "content": "Full news content",
    "excerpt": "News excerpt",
    "image_url": "https://image.url",
    "category": "general",
    "published_at": "2024-01-01T00:00:00.000Z",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z",
    "author_name": "John Doe",
    "author_email": "john@student.itk.ac.id"
  }
}
```

### GET `/api/news/admin/all`
Get all news including unpublished (requires admin authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `category` (optional): Filter by category
- `status` (optional): Filter by status ('published' or 'draft')

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "News Title",
      "excerpt": "News excerpt",
      "image_url": "https://image.url",
      "category": "general",
      "is_published": true,
      "published_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z",
      "author_name": "John Doe",
      "author_email": "john@student.itk.ac.id"
    }
  ]
}
```

### POST `/api/news`
Create new news (requires admin authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Request Body (Form Data):**
- `title` (required): News title
- `content` (required): News content
- `excerpt` (optional): News excerpt
- `category` (optional): News category (default: 'general')
- `isPublished` (optional): Boolean (default: true)
- `image` (optional): Image file (max 5MB)

**Response:**
```json
{
  "success": true,
  "message": "News created successfully",
  "data": {
    "id": 1,
    "title": "News Title",
    "content": "News content",
    "excerpt": "News excerpt",
    "imageUrl": "https://image.url",
    "category": "general",
    "isPublished": true
  }
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information (development only)"
}
```

### Common HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## Database Tables Structure

### Users Table
- `id` (Primary Key)
- `nim` (Student ID)
- `email` (ITK Student Email)
- `name` (Full Name)
- `google_id` (Google OAuth ID)
- `profile_image_url` (Profile Image URL)
- `created_at` (Creation Timestamp)
- `updated_at` (Last Update Timestamp)
- `last_login` (Last Login Timestamp)

### Subjects Table
- `id` (Primary Key)
- `code` (Subject Code)
- `name` (Subject Name)
- `description` (Subject Description)
- `semester` (Semester Number)
- `credits` (Credit Hours)

### User_Subjects Table (Enrollment)
- `user_id` (Foreign Key to Users)
- `subject_id` (Foreign Key to Subjects)
- `enrolled_at` (Enrollment Timestamp)

### Learning_Videos Table
- `id` (Primary Key)
- `subject_id` (Foreign Key to Subjects)
- `title` (Video Title)
- `description` (Video Description)
- `video_url` (Video URL)
- `thumbnail_url` (Thumbnail URL)
- `duration` (Video Duration in seconds)
- `order_index` (Display Order)
- `is_active` (Active Status)
- `created_at` (Creation Timestamp)
- `updated_at` (Last Update Timestamp)

### News Table
- `id` (Primary Key)
- `title` (News Title)
- `content` (News Content)
- `excerpt` (News Excerpt)
- `image_url` (News Image URL)
- `author_id` (Foreign Key to Users)
- `category` (News Category)
- `is_published` (Publication Status)
- `published_at` (Publication Timestamp)
- `created_at` (Creation Timestamp)
- `updated_at` (Last Update Timestamp)

---

## Notes

1. All authenticated endpoints require a valid JWT token in the Authorization header.
2. Admin-only endpoints require the user to be in the admin email list.
3. Only ITK student emails (`@student.itk.ac.id`) are allowed for registration.
4. File uploads are handled through ImageKit service.
5. All timestamps are in ISO 8601 format.
6. Video duration is stored in seconds.
7. The API uses MySQL database with connection pooling.

## Rate Limiting
- 100 requests per 15 minutes per IP address
- File upload limit: 5MB per file
- Request body limit: 1