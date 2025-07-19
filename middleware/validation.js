const { body, param, query, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
}

const sanitizeContent = (req, res, next) => {
    if (req.body.content) {
        req.body.content = sanitizeHtml(req.body.content);
    }
    if (req.query.content) {
        req.query.content = sanitizeHtml(req.query.content);
    }
    next();
};

module.exports = {
    handleValidationErrors,
    sanitizeContent
};