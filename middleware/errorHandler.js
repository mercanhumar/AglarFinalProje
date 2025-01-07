const { ValidationError } = require('express-validator');

// Custom error classes
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationAppError extends AppError {
    constructor(errors) {
        super('Validation Error', 400);
        this.errors = errors;
    }
}

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Log error for monitoring
    console.error({
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
        ip: req.ip
    });

    if (process.env.NODE_ENV === 'development') {
        return sendDevError(err, res);
    }

    return sendProdError(err, res);
};

// Development error response
const sendDevError = (err, res) => {
    return res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack
    });
};

// Production error response
const sendProdError = (err, res) => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
            ...(err instanceof ValidationAppError && { errors: err.errors })
        });
    }
    
    // Programming or other unknown error: don't leak error details
    console.error('ERROR 💥:', err);
    return res.status(500).json({
        status: 'error',
        message: 'Something went wrong!'
    });
};

// Async error handler wrapper
const catchAsync = fn => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};

// WebSocket error handler
const handleWebSocketError = (socket, error) => {
    console.error('WebSocket Error:', {
        error: error.message,
        stack: error.stack,
        socketId: socket.id,
        userId: socket.userId,
        timestamp: new Date().toISOString()
    });

    const errorMessage = process.env.NODE_ENV === 'development' 
        ? error.message 
        : 'Connection error occurred';

    socket.emit('error', {
        message: errorMessage,
        code: error.code || 'INTERNAL_ERROR'
    });
};

// Input validation middleware
const validateInput = (schema) => {
    return async (req, res, next) => {
        try {
            await schema.validateAsync(req.body, { abortEarly: false });
            next();
        } catch (error) {
            if (error.isJoi) {
                next(new ValidationAppError(
                    error.details.map(detail => ({
                        field: detail.context.key,
                        message: detail.message
                    }))
                ));
            } else {
                next(error);
            }
        }
    };
};

module.exports = {
    AppError,
    ValidationAppError,
    errorHandler,
    catchAsync,
    handleWebSocketError,
    validateInput
};
