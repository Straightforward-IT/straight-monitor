const errorHandler = (err, req, res, next) => {
    console.error(`🔥 Error: ${err.message}`);
    console.error(`📌 Request: ${req.method} ${req.originalUrl}`);
    console.error(`📋 Headers: ${JSON.stringify(req.headers, null, 2)}`);
    console.error(`📝 Body: ${JSON.stringify(req.body, null, 2)}`);
    console.error(`🔗 Params: ${JSON.stringify(req.params, null, 2)}`);
    console.error(`🔍 Query: ${JSON.stringify(req.query, null, 2)}`);
    console.error(`💾 Stack: ${err.stack}`);

    // Default status code
    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
};

module.exports = errorHandler;
