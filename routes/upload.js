const express = require('express');
const multer = require('multer');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { uploadFile, validateImageFile } = require('../config/imagekit');
const rateLimiters = require('../middleware/rateLimiter');

/**
 * @swagger
 * tags:
 *   name: Upload
 *   description: File upload endpoints
 */

/**
 * @swagger
 * /upload/profile-image:
 *   post:
 *     summary: Upload profile image
 *     description: Upload a profile image for the authenticated user
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file (max 5MB)
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                     thumbnailUrl:
 *                       type: string
 *                     fileId:
 *                       type: string
 *                     name:
 *                       type: string
 *       400:
 *         description: No image file provided
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to upload image
 */

/**
 * @swagger
 * /upload/news-image:
 *   post:
 *     summary: Upload news image
 *     description: Upload an image for news article (Admin only)
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file (max 5MB)
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *       400:
 *         description: No image file provided
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin privileges required
 *       500:
 *         description: Failed to upload image
 */

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const validation = validateImageFile(file);
        if (validation.success) {
            cb(null, true);
        } else {
            cb(new Error(validation.message), false);
        }
    }
});

// Upload profile image
router.post('/profile-image', 
    rateLimiters.upload, 
    authenticateToken, 
    upload.single('image'), 
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No image file provided'
                });
            }

            const fileName = `profile-${req.user.id}-${Date.now()}`;
            const result = await uploadFile(req.file, fileName, 'profile-images');

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to upload image',
                    error: result.error
                });
            }

            res.json({
                success: true,
                message: 'Image uploaded successfully',
                data: result.data
            });

        } catch (error) {
            console.error('Upload profile image error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to upload image'
            });
        }
    }
);

// Upload news image
router.post('/news-image', 
    rateLimiters.upload, 
    authenticateToken, 
    requireAdmin, 
    upload.single('image'), 
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No image file provided'
                });
            }

            const fileName = `news-${Date.now()}`;
            const result = await uploadFile(req.file, fileName, 'news-images');

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to upload image',
                    error: result.error
                });
            }

            res.json({
                success: true,
                message: 'Image uploaded successfully',
                data: result.data
            });

        } catch (error) {
            console.error('Upload news image error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to upload image'
            });
        }
    }
);

module.exports = router;