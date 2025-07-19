const { v4: uuidv4 } = require('uuid');

// Middleware to generate and attach a unique request ID to each request
const requestIdMiddleware = (req, res, next) => {
    req.requestId = uuidv4();
    res.setHeader('X-Request-Id', req.requestId);
    next();
};

module.exports = requestIdMiddleware;