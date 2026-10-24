const Database = require("better-sqlite3");
const path = require("path");

// Open (or create) the database file in the project folder
const dbPath =
    process.env.DB_PATH || path.join(__dirname, "bookstore.db");
const db = new Database(dbPath);

// Create the books table if it doesn't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL
    )
`);


db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user'
            CHECK (role IN ('user', 'admin')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`);


db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_book_title_author
    ON books (LOWER(title), LOWER(author));
`);

console.log("SQLite database connected successfully!");

// Export the database connection
module.exports = db;

// Insert the initial books only if the table is empty
const bookCount = db.prepare(
    "SELECT COUNT(*) AS count FROM books"
).get();

if (bookCount.count === 0) {
    const insertBook = db.prepare(`
        INSERT INTO books (title, author)
        VALUES (?, ?)
    `);

    const seedBooks = db.transaction(() => {
        insertBook.run("Pride and Prejudice", "Jane Austen");
        insertBook.run("The Great Gatsby", "F. Scott Fitzgerald");
        insertBook.run(
            "The Subtle Art of Not Giving a F*ck",
            "Mark Manson"
        );
    });

    seedBooks();
    console.log("Initial books added to SQLite.");
}