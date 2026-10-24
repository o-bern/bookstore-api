const jwt = require("jsonwebtoken");
const db = require("../db");

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    // Expect: Authorization: Bearer <token>
    const [scheme, token] = authHeader?.split(" ") ?? [];

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({
            error: "Authentication token required"
        });
    }

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            error: "Authentication service is not configured"
        });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        // Retrieve the current user and role from the database.
        const user = db.prepare(`
            SELECT id, email, role
            FROM users
            WHERE id = ?
        `).get(Number(payload.sub));

        if (!user) {
            return res.status(401).json({
                error: "Invalid authentication token"
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            error: "Invalid or expired authentication token"
        });
    }
}

function requireAdmin(req, res, next) {
    if (req.user?.role !== "admin") {
        return res.status(403).json({
            error: "Administrator access required"
        });
    }

    next();
}

module.exports = {
    authenticateToken,
    requireAdmin
};