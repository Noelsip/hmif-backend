const rateLimit = require('express-rate-limit');

// Rate limiting middleware configuration
const createRateLimiter = (windowMs, max, message) => rateLimit ({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    general: createRateLimiter(15 * 60 * 1000, 100, 'Too many requests, please try again later.'),
    auth: createRateLimiter(60 * 1000, 5, 'Too many login attempts, please try again later.'),
    upload: createRateLimiter(60 * 1000, 10, 'Too many upload requests, please try again later.')
}