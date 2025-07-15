const express = require('express');
const { prisma } = require('../config/prisma');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

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