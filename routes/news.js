const express = require('express');
const { prisma } = require('../config/prisma');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: News
 *   description: News management endpoints
 */

/**
 * @swagger
 * /api/news:
 *   get:
 *     summary: Get all published news
 *     description: Retrieve a paginated list of published news
 *     tags: [News]
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
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for title, excerpt, or content
 *     responses:
 *       200:
 *         description: News retrieved successfully
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
 *                         $ref: '#/components/schemas/News'
 *   post:
 *     summary: Create new news
 *     description: Create a new news article (Admin only)
 *     tags: [News]
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
 *               - title
 *               - content
 *               - excerpt
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               excerpt:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *               category:
 *                 type: string
 *                 default: general
 *               isPublished:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: News created successfully
 *       400:
 *         description: Bad request - missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin privileges required
 */

/**
 * @swagger
 * /api/news/admin:
 *   get:
 *     summary: Get all news (Admin only)
 *     description: Retrieve all news including unpublished (Admin only)
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
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
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [published, draft]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: News retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin privileges required
 */

/**
 * @swagger
 * /api/news/categories:
 *   get:
 *     summary: Get news categories
 *     description: Get all available news categories with count
 *     tags: [News]
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       count:
 *                         type: integer
 */

/**
 * @swagger
 * /api/news/{id}:
 *   get:
 *     summary: Get news by ID
 *     description: Retrieve a specific published news article
 *     tags: [News]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: News ID
 *     responses:
 *       200:
 *         description: News retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/News'
 *       404:
 *         description: News not found
 *   put:
 *     summary: Update news
 *     description: Update an existing news article (Admin only)
 *     tags: [News]
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
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               excerpt:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *               category:
 *                 type: string
 *               isPublished:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: News updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin privileges required
 *       404:
 *         description: News not found
 *   delete:
 *     summary: Delete news
 *     description: Delete a news article (Admin only)
 *     tags: [News]
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
 *         description: News deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin privileges required
 *       404:
 *         description: News not found
 */

/**
 * @swagger
 * /api/news/{id}/toggle-publish:
 *   patch:
 *     summary: Toggle news publish status
 *     description: Toggle the published status of a news article (Admin only)
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: News ID
 *     responses:
 *       200:
 *         description: News publish status toggled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin privileges required
 *       404:
 *         description: News not found
 */


const router = express.Router();

// Get all published news
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 10, category, search } = req.query;
        const skip = (page - 1) * limit;

        // Build where clause
        const where = { isPublished: true };
        if (category && category !== 'all') {
            where.category = category;
        }
        if (search) {
            where.OR = [
                { title: { contains: search } },
                { excerpt: { contains: search } },
                { content: { contains: search } }
            ];
        }

        const [news, total] = await Promise.all([
            prisma.news.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                orderBy: { publishedAt: 'desc' },
                include: {
                    author: {
                        select: {
                            id: true,
                            name: true,
                            profilePicture: true
                        }
                    }
                }
            }),
            prisma.news.count({ where })
        ]);

        res.json({
            success: true,
            data: news,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Get news error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch news'
        });
    }
});

// Get all news (including unpublished) - Admin only
router.get('/admin', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10, category, status, search } = req.query;
        const skip = (page - 1) * limit;

        // Build where clause
        const where = {};
        if (category && category !== 'all') {
            where.category = category;
        }
        if (status === 'published') {
            where.isPublished = true;
        } else if (status === 'draft') {
            where.isPublished = false;
        }
        if (search) {
            where.OR = [
                { title: { contains: search } },
                { excerpt: { contains: search } },
                { content: { contains: search } }
            ];
        }

        const [news, total] = await Promise.all([
            prisma.news.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    author: {
                        select: {
                            id: true,
                            name: true,
                            profilePicture: true
                        }
                    }
                }
            }),
            prisma.news.count({ where })
        ]);

        res.json({
            success: true,
            data: news,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Get admin news error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch news'
        });
    }
});

// Get news categories
router.get('/categories', async (req, res) => {
    try {
        const categories = await prisma.news.groupBy({
            by: ['category'],
            where: { isPublished: true },
            _count: {
                category: true
            },
            orderBy: {
                category: 'asc'
            }
        });

        res.json({
            success: true,
            data: categories.map(cat => ({
                name: cat.category,
                count: cat._count.category
            }))
        });

    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch categories'
        });
    }
});

// Get single news by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const news = await prisma.news.findUnique({
            where: { id: parseInt(id) },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        profilePicture: true
                    }
                }
            }
        });

        if (!news || !news.isPublished) {
            return res.status(404).json({
                success: false,
                message: 'News not found'
            });
        }

        res.json({
            success: true,
            data: news
        });

    } catch (error) {
        console.error('Get news error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch news'
        });
    }
});

// Create new news (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { title, content, excerpt, imageUrl, category, isPublished = false } = req.body;
        const authorId = req.user.id;

        // Validate required fields
        if (!title || !content || !excerpt) {
            return res.status(400).json({
                success: false,
                message: 'Title, content, and excerpt are required'
            });
        }

        const news = await prisma.news.create({
            data: {
                title,
                content,
                excerpt,
                imageUrl,
                category: category || 'general',
                isPublished,
                authorId,
                publishedAt: isPublished ? new Date() : undefined
            },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        profilePicture: true
                    }
                }
            }
        });

        res.status(201).json({
            success: true,
            message: 'News created successfully',
            data: news
        });

    } catch (error) {
        console.error('Create news error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create news'
        });
    }
});

// Update news (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, excerpt, imageUrl, category, isPublished } = req.body;

        // Get current news to check if published status is changing
        const currentNews = await prisma.news.findUnique({
            where: { id: parseInt(id) }
        });

        if (!currentNews) {
            return res.status(404).json({
                success: false,
                message: 'News not found'
            });
        }

        const updateData = {
            ...(title && { title }),
            ...(content && { content }),
            ...(excerpt && { excerpt }),
            ...(imageUrl !== undefined && { imageUrl }),
            ...(category && { category }),
            ...(isPublished !== undefined && { isPublished })
        };

        // Update publishedAt if status changes from draft to published
        if (isPublished === true && !currentNews.isPublished) {
            updateData.publishedAt = new Date();
        }

        const news = await prisma.news.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        profilePicture: true
                    }
                }
            }
        });

        res.json({
            success: true,
            message: 'News updated successfully',
            data: news
        });

    } catch (error) {
        console.error('Update news error:', error);
        
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'News not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to update news'
        });
    }
});

// Delete news (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.news.delete({
            where: { id: parseInt(id) }
        });

        res.json({
            success: true,
            message: 'News deleted successfully'
        });

    } catch (error) {
        console.error('Delete news error:', error);
        
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'News not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to delete news'
        });
    }
});

// Toggle news published status (Admin only)
router.patch('/:id/toggle-publish', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const news = await prisma.news.findUnique({
            where: { id: parseInt(id) }
        });

        if (!news) {
            return res.status(404).json({
                success: false,
                message: 'News not found'
            });
        }

        const updatedNews = await prisma.news.update({
            where: { id: parseInt(id) },
            data: {
                isPublished: !news.isPublished,
                publishedAt: !news.isPublished ? new Date() : news.publishedAt
            }
        });

        res.json({
            success: true,
            message: `News ${updatedNews.isPublished ? 'published' : 'unpublished'} successfully`,
            data: updatedNews
        });

    } catch (error) {
        console.error('Toggle publish news error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle publish status'
        });
    }
});

module.exports = router;