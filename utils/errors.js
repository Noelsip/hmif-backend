class AppError extends Error {
    constructor(messege, statusCode, isOperational = true) {
        super(messege);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(messege) {
        super(messege, 400);
    }
}

class NotFoundError extends AppError {
    constructor(messege = 'Resource not found') {
        super(messege, 404);
    }
}

module.exports = {
    AppError,
    ValidationError,
    NotFoundError
};