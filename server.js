require("dotenv").config();

const express = require("express");
const booksRouter = require("./routes/books");
const authRouter = require("./routes/auth");
require("./db");

const app = express();

app.use(express.json());

app.use("/api/auth", authRouter);

app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
});

app.use("/api/books", booksRouter);

app.get("/", (req, res) => {
    res.send("Bookstore API is running!");
});

// Only start the server when this file is run directly.
if (require.main === module) {
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;