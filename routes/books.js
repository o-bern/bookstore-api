const express = require("express");
const router = express.Router();
const db = require("../db");

const {
    authenticateToken,
    requireAdmin
} = require("../middleware/auth");

// GET books with search, filtering, sorting, and pagination
router.get("/", authenticateToken, (req, res) => {
    try {
        const { q, author, page, limit, sort, order } = req.query;

        // 1. Validate text parameters
        if (
            (q !== undefined && typeof q !== "string") ||
            (author !== undefined && typeof author !== "string")
        ) {
            return res.status(400).json({
                error: "Search and author must be strings"
            });
        }

        // 2. Validate pagination parameters
        const isPositiveInteger = (value) =>
            typeof value === "string" &&
            /^[1-9]\d*$/.test(value);

        if (
            page !== undefined &&
            !isPositiveInteger(page)
        ) {
            return res.status(400).json({
                error: "Page must be a positive integer"
            });
        }

        if (
            limit !== undefined &&
            !isPositiveInteger(limit)
        ) {
            return res.status(400).json({
                error: "Limit must be a positive integer"
            });
        }

        const currentPage = page === undefined
            ? 1
            : Number(page);

        const pageSize = limit === undefined
            ? 10
            : Number(limit);

        if (!Number.isSafeInteger(currentPage)) {
            return res.status(400).json({
                error: "Page number is too large"
            });
        }

        if (
            !Number.isSafeInteger(pageSize) ||
            pageSize > 50
        ) {
            return res.status(400).json({
                error: "Limit must be between 1 and 50"
            });
        }

        // 3. Validate sorting options
        const allowedSortFields = [
            "id",
            "title",
            "author"
        ];

        const sortField = sort || "id";
        const sortOrder = order || "asc";

        if (!allowedSortFields.includes(sortField)) {
            return res.status(400).json({
                error: "Invalid sort field",
                allowedFields: allowedSortFields
            });
        }

        if (!["asc", "desc"].includes(sortOrder)) {
            return res.status(400).json({
                error: "Order must be asc or desc"
            });
        }

        // 4. Build safe filtering conditions
        const conditions = [];
        const params = [];

        const searchTerm = q?.trim();
        const authorTerm = author?.trim();

        if (searchTerm) {
            conditions.push(`
                (
                    title LIKE ? ESCAPE '\\'
                    OR author LIKE ? ESCAPE '\\'
                )
            `);

            const escapeLike = (value) =>
                value.replace(/[\\%_]/g, "\\$&");

            const pattern = `%${escapeLike(searchTerm)}%`;

            params.push(pattern, pattern);
        }

        if (authorTerm) {
            conditions.push("author LIKE ? ESCAPE '\\'");

            const escapeLike = (value) =>
                value.replace(/[\\%_]/g, "\\$&");

            params.push(`%${escapeLike(authorTerm)}%`);
        }

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        // 5. Count all matching books before pagination
        const countResult = db.prepare(`
            SELECT COUNT(*) AS total
            FROM books
            ${whereClause}
        `).get(...params);

        const total = countResult.total;
        const totalPages = Math.ceil(total / pageSize);

        // 6. Retrieve the requested page
        const offset = (currentPage - 1) * pageSize;

        const books = db.prepare(`
            SELECT *
            FROM books
            ${whereClause}
            ORDER BY ${sortField} ${sortOrder.toUpperCase()}
            LIMIT ? OFFSET ?
        `).all(...params, pageSize, offset);

        // 7. Return books and pagination information
        return res.json({
            data: books,
            pagination: {
                page: currentPage,
                limit: pageSize,
                total,
                totalPages,
                hasNextPage: currentPage < totalPages,
                hasPreviousPage: currentPage > 1 &&
                    currentPage <= totalPages
            }
        });

    } catch (error) {
        console.error("Failed to retrieve books:", error.message);

        return res.status(500).json({
            error: "Failed to retrieve books"
        });
    }
});
// GET a single book
router.get("/:id", authenticateToken, (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({
            error: "Invalid book ID"
        });
    }

    const book = db.prepare(
        "SELECT * FROM books WHERE id = ?"
    ).get(id);

    if (!book) {
        return res.status(404).json({
            error: "Book not found"
        });
    }

    res.json(book);
});

// POST - Create a new book
router.post("/", authenticateToken, requireAdmin, (req, res) => {
    try {
        const { title, author } = req.body;

        // 1. Validate the incoming data
        if (
            typeof title !== "string" ||
            typeof author !== "string" ||
            !title.trim() ||
            !author.trim()
        ) {
            return res.status(400).json({
                error: "Title and author are required"
            });
        }

        const cleanTitle = title.trim();
        const cleanAuthor = author.trim();

        // 2. Check whether this book already exists
        const duplicate = db.prepare(`
            SELECT id, title, author FROM books
            WHERE LOWER(title) = LOWER(?)
            AND LOWER(author) = LOWER(?)
        `).get(cleanTitle, cleanAuthor);

        if (duplicate) {
            return res.status(409).json({
                error: "This book already exists",
                book: duplicate
            });
        }

        // 3. Insert the new book
        const result = db.prepare(`
            INSERT INTO books (title, author)
            VALUES (?, ?)
        `).run(cleanTitle, cleanAuthor);

        // 4. Retrieve the inserted record
        const newBook = db.prepare(
            "SELECT * FROM books WHERE id = ?"
        ).get(result.lastInsertRowid);

        return res.status(201).json(newBook);

    } catch (error) {
        // 5. Handle database uniqueness violations
        if (
            error.code === "SQLITE_CONSTRAINT_UNIQUE" ||
            error.code === "SQLITE_CONSTRAINT_PRIMARYKEY"
        ) {
            return res.status(409).json({
                error: "A book with this title and author already exists"
            });
        }

        // Log unexpected errors for debugging
        console.error("Failed to create book:", error.message);

        return res.status(500).json({
            error: "An unexpected error occurred while creating the book"
        });
    }
});


// PUT - Update a book
router.put("/:id", authenticateToken, requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const { title, author } = req.body;

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({
            error: "Invalid book ID"
        });
    }

    if (
        typeof title !== "string" ||
        typeof author !== "string" ||
        !title.trim() ||
        !author.trim()
    ) {
        return res.status(400).json({
            error: "Title and author are required"
        });
    }

    const existingBook = db.prepare(
        "SELECT * FROM books WHERE id = ?"
    ).get(id);

    if (!existingBook) {
        return res.status(404).json({
            error: "Book not found"
        });
    }

    const cleanTitle = title.trim();
    const cleanAuthor = author.trim();

    const duplicate = db.prepare(`
        SELECT id FROM books
        WHERE LOWER(title) = LOWER(?)
        AND LOWER(author) = LOWER(?)
        AND id != ?
    `).get(cleanTitle, cleanAuthor, id);

    if (duplicate) {
        return res.status(409).json({
            error: "Another book with this title and author already exists"
        });
    }

    db.prepare(`
        UPDATE books
        SET title = ?, author = ?
        WHERE id = ?
    `).run(cleanTitle, cleanAuthor, id);

    const updatedBook = db.prepare(
        "SELECT * FROM books WHERE id = ?"
    ).get(id);

    res.json(updatedBook);
});

// DELETE - Delete a book
router.delete("/:id", authenticateToken, requireAdmin, (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({
            error: "Invalid book ID"
        });
    }

    const book = db.prepare(
        "SELECT * FROM books WHERE id = ?"
    ).get(id);

    if (!book) {
        return res.status(404).json({
            error: "Book not found"
        });
    }

    db.prepare(
        "DELETE FROM books WHERE id = ?"
    ).run(id);

    res.json({
        message: "Book deleted successfully",
        book
    });
});

module.exports = router;