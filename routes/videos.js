const express = require('express');
const { prisma } = require('../config/prisma');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Videos
 *   description: Learning video management endpoints
 */

/**
 * @swagger
 * /api/videos:
 *   get:
 *     summary: Get all learning videos
 *     description: Retrieve a paginated list of active learning videos
 *     tags: [Videos]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: subjectId
 *         schema:
 *           type: integer
 *         description: Filter by subject ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for title or description
 *     responses:
 *       200:
 *         description: Videos retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/LearningVideo'
 *   post:
 *     summary: Create new learning video
 *     description: Create a new learning video (Admin only)
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subjectId
 *               - title
 *               - videoUrl
 *               - duration
 *             properties:
 *               subjectId:
 *                 type: integer
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               videoUrl:
 *                 type: string
 *               duration:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Learning video created successfully
 *       400:
 *         description: Bad request - missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin privileges required
 *       404:
 *         description: Subject not found
 */

/**
 * @swagger
 * /api/videos/subject/{subjectId}:
 *   get:
 *     summary: Get videos by subject
 *     description: Retrieve all active videos for a specific subject
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Subject ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Videos retrieved successfully
 *       404:
 *         description: Subject not found
 */

/**
 * @swagger
 * /api/videos/{id}:
 *   get:
 *     summary: Get video by ID
 *     description: Retrieve a specific learning video
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Video ID
 *     responses:
 *       200:
 *         description: Video retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/LearningVideo'
 *       404:
 *         description: Video not found
 *   put:
 *     summary: Update learning video
 *     description: Update an existing learning video (Admin only)
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subjectId:
 *                 type: integer
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               videoUrl:
 *                 type: string
 *               duration:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Video updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin privileges required
 *       404:
 *         description: Video or subject not found
 *   delete:
 *     summary: Delete learning video
 *     description: Delete a learning video (Admin only)
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Video deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin privileges required
 *       404:
 *         description: Video not found
 */

/**
 * @swagger
 * /api/videos/{id}/toggle-active:
 *   patch:
 *     summary: Toggle video active status
 *     description: Toggle the active status of a learning video (Admin only)
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Video ID
 *     responses:
 *       200:
 *         description: Video status toggled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin privileges required
 *       404:
 *         description: Video not found
 */

const router = express.Router();

// Get all learning videos
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 10, subjectId, search } = req.query;
        const skip = (page - 1) * limit;

        // Build where clause
        const where = { isActive: true };
        if (subjectId) {
            where.subjectId = parseInt(subjectId);
        }
        if (search) {
            where.OR = [
                { title: { contains: search } },
                { description: { contains: search } }
            ];
        }

        const [videos, total] = await Promise.all([
            prisma.learningVideo.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    subject: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                            semester: true
                        }
                    }
                }
            }),
            prisma.learningVideo.count({ where })
        ]);

        res.json({
            success: true,
            data: videos,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Get videos error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch videos'
        });
    }
});

// Get videos by subject
router.get('/subject/:subjectId', async (req, res) => {
    try {
        const { subjectId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Check if subject exists
        const subject = await prisma.subject.findUnique({
            where: { id: parseInt(subjectId) }
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        const [videos, total] = await Promise.all([
            prisma.learningVideo.findMany({
                where: {
                    subjectId: parseInt(subjectId),
                    isActive: true
                },
                skip: parseInt(skip),
                take: parseInt(limit),
                orderBy: { createdAt: 'asc' },
                include: {
                    subject: {
                        select: {
                            id: true,
                            code: true,
                            name: true
                        }
                    }
                }
            }),
            prisma.learningVideo.count({
                where: {
                    subjectId: parseInt(subjectId),
                    isActive: true
                }
            })
        ]);

        res.json({
            success: true,
            data: videos,
            subject: subject,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Get videos by subject error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch videos'
        });
    }
});

// Get single video by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const video = await prisma.learningVideo.findUnique({
            where: { id: parseInt(id) },
            include: {
                subject: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        semester: true
                    }
                }
            }
        });

        if (!video || !video.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        res.json({
            success: true,
            data: video
        });

    } catch (error) {
        console.error('Get video error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch video'
        });
    }
});

// Create new learning video (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { subjectId, title, description, videoUrl, duration } = req.body;

        // Validate required fields
        if (!subjectId || !title || !videoUrl || !duration) {
            return res.status(400).json({
                success: false,
                message: 'Subject ID, title, video URL, and duration are required'
            });
        }

        // Check if subject exists
        const subject = await prisma.subject.findUnique({
            where: { id: parseInt(subjectId) }
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        const video = await prisma.learningVideo.create({
            data: {
                subjectId: parseInt(subjectId),
                title,
                description,
                videoUrl,
                duration: parseInt(duration)
            },
            include: {
                subject: {
                    select: {
                        id: true,
                        code: true,
                        name: true
                    }
                }
            }
        });

        res.status(201).json({
            success: true,
            message: 'Learning video created successfully',
            data: video
        });

    } catch (error) {
        console.error('Create video error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create learning video'
        });
    }
});

// Update learning video (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { subjectId, title, description, videoUrl, duration, isActive } = req.body;

        // If subjectId is provided, check if it exists
        if (subjectId) {
            const subject = await prisma.subject.findUnique({
                where: { id: parseInt(subjectId) }
            });

            if (!subject) {
                return res.status(404).json({
                    success: false,
                    message: 'Subject not found'
                });
            }
        }

        const video = await prisma.learningVideo.update({
            where: { id: parseInt(id) },
            data: {
                ...(subjectId && { subjectId: parseInt(subjectId) }),
                ...(title && { title }),
                ...(description !== undefined && { description }),
                ...(videoUrl && { videoUrl }),
                ...(duration && { duration: parseInt(duration) }),
                ...(isActive !== undefined && { isActive })
            },
            include: {
                subject: {
                    select: {
                        id: true,
                        code: true,
                        name: true
                    }
                }
            }
        });

        res.json({
            success: true,
            message: 'Learning video updated successfully',
            data: video
        });

    } catch (error) {
        console.error('Update video error:', error);
        
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to update learning video'
        });
    }
});

// Delete learning video (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.learningVideo.delete({
            where: { id: parseInt(id) }
        });

        res.json({
            success: true,
            message: 'Learning video deleted successfully'
        });

    } catch (error) {
        console.error('Delete video error:', error);
        
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to delete learning video'
        });
    }
});

// Toggle video active status (Admin only)
router.patch('/:id/toggle-active', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const video = await prisma.learningVideo.findUnique({
            where: { id: parseInt(id) }
        });

        if (!video) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        const updatedVideo = await prisma.learningVideo.update({
            where: { id: parseInt(id) },
            data: { isActive: !video.isActive }
        });

        res.json({
            success: true,
            message: `Video ${updatedVideo.isActive ? 'activated' : 'deactivated'} successfully`,
            data: updatedVideo
        });

    } catch (error) {
        console.error('Toggle video active error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle video status'
        });
    }
});

module.exports = router;