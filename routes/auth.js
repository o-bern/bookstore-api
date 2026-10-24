
const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");

const router = express.Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
    const { email, password } = req.body;

    if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        password.length < 8
    ) {
        return res.status(400).json({
            error: "A valid email and a password of at least 8 characters are required"
        });
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
        const passwordHash = await bcrypt.hash(password, 12);

        const result = db.prepare(`
            INSERT INTO users (email, password_hash)
            VALUES (?, ?)
        `).run(cleanEmail, passwordHash);

        return res.status(201).json({
            message: "User registered successfully",
            user: {
                id: result.lastInsertRowid,
                email: cleanEmail,
                role: "user"
            }
        });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                error: "An account with this email already exists"
            });
        }

        console.error("Registration error:", error);

        return res.status(500).json({
            error: "An internal server error occurred"
        });
    }
});


const jwt = require("jsonwebtoken");

// POST /api/auth/login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password
    ) {
        return res.status(400).json({
            error: "Email and password are required"
        });
    }

    try {
        const cleanEmail = email.trim().toLowerCase();

        const user = db.prepare(`
            SELECT id, email, password_hash, role
            FROM users
            WHERE email = ?
        `).get(cleanEmail);

        // Use the same response for an unknown email or wrong password.
        if (
            !user ||
            !(await bcrypt.compare(password, user.password_hash))
        ) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET is not configured");
            return res.status(500).json({
                error: "Authentication service is not configured"
            });
        }

        const token = jwt.sign(
            { sub: String(user.id) },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );

        return res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            error: "An internal server error occurred"
        });
    }
});
module.exports = router;


