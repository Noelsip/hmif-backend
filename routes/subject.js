const express = require('express');
const { prisma } = require('../config/prisma');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Subjects
 *   description: Subject management endpoints
 */

/**
 * @swagger
 * /api/subject:
 *   get:
 *     summary: Get all subjects
 *     description: Retrieve a paginated list of all subjects
 *     tags: [Subjects]
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
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for name, code, or description
 *       - in: query
 *         name: semester
 *         schema:
 *           type: integer
 *         description: Filter by semester
 *     responses:
 *       200:
 *         description: Subjects retrieved successfully
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
 *                         $ref: '#/components/schemas/Subject'
 *       500:
 *         description: Failed to fetch subjects
 *   post:
 *     summary: Create new subject
 *     description: Create a new subject (Admin only)
 *     tags: [Subjects]
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
 *               - code
 *               - name
 *               - semester
 *               - credits
 *             properties:
 *               code:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               semester:
 *                 type: integer
 *               credits:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Subject created successfully
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
 *                   $ref: '#/components/schemas/Subject'
 *       400:
 *         description: Bad request or subject code already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin privileges required
 */

/**
 * @swagger
 * /api/subject/{id}:
 *   get:
 *     summary: Get subject by ID
 *     description: Retrieve a specific subject with its learning videos
 *     tags: [Subjects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Subject ID
 *     responses:
 *       200:
 *         description: Subject retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Subject'
 *       404:
 *         description: Subject not found
 *   put:
 *     summary: Update subject
 *     description: Update an existing subject (Admin only)
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Subject ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               semester:
 *                 type: integer
 *               credits:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Subject updated successfully
 *       400:
 *         description: Bad request or subject code already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin privileges required
 *       404:
 *         description: Subject not found
 *   delete:
 *     summary: Delete subject
 *     description: Delete a subject (Admin only)
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Subject ID
 *     responses:
 *       200:
 *         description: Subject deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin privileges required
 *       404:
 *         description: Subject not found
 */

/**
 * @swagger
 * /api/subject/{id}/enroll:
 *   post:
 *     summary: Enroll to subject
 *     description: Enroll the authenticated user to a subject
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Subject ID
 *     responses:
 *       201:
 *         description: Successfully enrolled to subject
 *       400:
 *         description: Already enrolled to this subject
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Subject not found
 */

/**
 * @swagger
 * /api/subject/{id}/unenroll:
 *   delete:
 *     summary: Unenroll from subject
 *     description: Unenroll the authenticated user from a subject
 *     tags: [Subjects]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Subject ID
 *     responses:
 *       200:
 *         description: Successfully unenrolled from subject
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Enrollment not found
 */

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