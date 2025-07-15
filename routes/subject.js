const express = require('express');
const { prisma } = require('../config/prisma');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all subjects
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 10, search, semester } = req.query;
        const skip = (page - 1) * limit;

        // Build where clause
        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { code: { contains: search } },
                { description: { contains: search } }
            ];
        }
        if (semester) {
            where.semester = parseInt(semester);
        }

        const [subjects, total] = await Promise.all([
            prisma.subject.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                orderBy: { semester: 'asc' },
                include: {
                    _count: {
                        select: {
                            studentSubjects: true,
                            learningVideos: true
                        }
                    }
                }
            }),
            prisma.subject.count({ where })
        ]);

        res.json({
            success: true,
            data: subjects,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Get subjects error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subjects'
        });
    }
});

// Get subject by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const subject = await prisma.subject.findUnique({
            where: { id: parseInt(id) },
            include: {
                learningVideos: {
                    where: { isActive: true },
                    orderBy: { createdAt: 'asc' }
                },
                _count: {
                    select: { studentSubjects: true }
                }
            }
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        res.json({
            success: true,
            data: subject
        });

    } catch (error) {
        console.error('Get subject error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subject'
        });
    }
});

// Create new subject (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { code, name, description, semester, credits } = req.body;

        // Validate required fields
        if (!code || !name || !semester || !credits) {
            return res.status(400).json({
                success: false,
                message: 'Code, name, semester, and credits are required'
            });
        }

        const subject = await prisma.subject.create({
            data: {
                code,
                name,
                description,
                semester: parseInt(semester),
                credits: parseInt(credits)
            }
        });

        res.status(201).json({
            success: true,
            message: 'Subject created successfully',
            data: subject
        });

    } catch (error) {
        console.error('Create subject error:', error);
        
        if (error.code === 'P2002') {
            return res.status(400).json({
                success: false,
                message: 'Subject code already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create subject'
        });
    }
});

// Update subject (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { code, name, description, semester, credits } = req.body;

        const subject = await prisma.subject.update({
            where: { id: parseInt(id) },
            data: {
                ...(code && { code }),
                ...(name && { name }),
                ...(description !== undefined && { description }),
                ...(semester && { semester: parseInt(semester) }),
                ...(credits && { credits: parseInt(credits) })
            }
        });

        res.json({
            success: true,
            message: 'Subject updated successfully',
            data: subject
        });

    } catch (error) {
        console.error('Update subject error:', error);
        
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        if (error.code === 'P2002') {
            return res.status(400).json({
                success: false,
                message: 'Subject code already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to update subject'
        });
    }
});

// Delete subject (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.subject.delete({
            where: { id: parseInt(id) }
        });

        res.json({
            success: true,
            message: 'Subject deleted successfully'
        });

    } catch (error) {
        console.error('Delete subject error:', error);
        
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to delete subject'
        });
    }
});

// Enroll student to subject
router.post('/:id/enroll', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Check if subject exists
        const subject = await prisma.subject.findUnique({
            where: { id: parseInt(id) }
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        // Create enrollment
        const enrollment = await prisma.studentSubject.create({
            data: {
                userId,
                subjectId: parseInt(id)
            },
            include: {
                subject: true
            }
        });

        res.status(201).json({
            success: true,
            message: 'Successfully enrolled to subject',
            data: enrollment
        });

    } catch (error) {
        console.error('Enroll subject error:', error);
        
        if (error.code === 'P2002') {
            return res.status(400).json({
                success: false,
                message: 'Already enrolled to this subject'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to enroll to subject'
        });
    }
});

// Unenroll student from subject
router.delete('/:id/unenroll', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        await prisma.studentSubject.delete({
            where: {
                unique_user_subject: {
                    userId,
                    subjectId: parseInt(id)
                }
            }
        });

        res.json({
            success: true,
            message: 'Successfully unenrolled from subject'
        });

    } catch (error) {
        console.error('Unenroll subject error:', error);
        
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'Enrollment not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to unenroll from subject'
        });
    }
});

module.exports = router;