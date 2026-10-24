process.env.DB_PATH = ":memory:";

const request = require("supertest");
const app = require("../server");
const db = require("../db");

const password = "TestPassword123!";
const userEmail = "ordinary@example.test";
const adminEmail = "admin@example.test";

let userToken;
let adminToken;

beforeAll(async () => {
    await request(app)
        .post("/api/auth/register")
        .send({ email: userEmail, password })
        .expect(201);

    await request(app)
        .post("/api/auth/register")
        .send({ email: adminEmail, password })
        .expect(201);

    db.prepare(`
        UPDATE users SET role = 'admin' WHERE email = ?
    `).run(adminEmail);

    const userLogin = await request(app)
        .post("/api/auth/login")
        .send({ email: userEmail, password })
        .expect(200);

    userToken = userLogin.body.token;

    const adminLogin = await request(app)
        .post("/api/auth/login")
        .send({ email: adminEmail, password })
        .expect(200);

    adminToken = adminLogin.body.token;
});

afterAll(() => {
    db.close();
});

describe("Bookstore API", () => {
    test("health endpoint returns 200", async () => {
        const response = await request(app)
            .get("/api/health");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: "ok" });
    });

    test("books endpoint rejects missing tokens", async () => {
        await request(app)
            .get("/api/books")
            .expect(401);
    });

    test("registration rejects a short password", async () => {
        await request(app)
            .post("/api/auth/register")
            .send({
                email: "shortpass@example.test",
                password: "abc"
            })
            .expect(400);
    });

    test("login rejects an incorrect password", async () => {
        await request(app)
            .post("/api/auth/login")
            .send({
                email: userEmail,
                password: "WrongPassword123!"
            })
            .expect(401);
    });

    test("ordinary user cannot create a book", async () => {
        await request(app)
            .post("/api/books")
            .set("Authorization", `Bearer ${userToken}`)
            .send({
                title: "User Permission Test",
                author: "Test Author"
            })
            .expect(403);
    });

    test("administrator can create a book", async () => {
        const response = await request(app)
            .post("/api/books")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
                title: "Admin Permission Test",
                author: "Test Author"
            })
            .expect(201);

        expect(response.body.title).toBe("Admin Permission Test");
        expect(response.body.author).toBe("Test Author");
        expect(response.body.id).toBeDefined();
    });

    test("duplicate books are rejected", async () => {
        await request(app)
            .post("/api/books")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
                title: "admin permission test",
                author: "TEST AUTHOR"
            })
            .expect(409);
    });

    test("administrator can retrieve a single book", async () => {
        const created = await request(app)
            .post("/api/books")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
                title: "Single Book Test",
                author: "Test Author"
            })
            .expect(201);

        const response = await request(app)
            .get(`/api/books/${created.body.id}`)
            .set("Authorization", `Bearer ${userToken}`)
            .expect(200);

        expect(response.body.title).toBe("Single Book Test");
    });

    test("invalid book ID is rejected", async () => {
        await request(app)
            .get("/api/books/abc")
            .set("Authorization", `Bearer ${userToken}`)
            .expect(400);
    });

    test("missing book returns 404", async () => {
        await request(app)
            .get("/api/books/999999")
            .set("Authorization", `Bearer ${userToken}`)
            .expect(404);
    });

    test("search finds a book by title", async () => {
        const response = await request(app)
            .get("/api/books?q=Great%20Gatsby")
            .set("Authorization", `Bearer ${userToken}`)
            .expect(200);

        expect(response.body.data.some(
            book => book.title === "The Great Gatsby"
        )).toBe(true);
    });

    test("author filter finds matching books", async () => {
        const response = await request(app)
            .get("/api/books?author=Jane%20Austen")
            .set("Authorization", `Bearer ${userToken}`)
            .expect(200);

        expect(response.body.data.length).toBeGreaterThan(0);

        expect(response.body.data.every(
            book => book.author.includes("Jane Austen")
        )).toBe(true);
    });

    test("pagination returns the requested page size", async () => {
        const response = await request(app)
            .get("/api/books?page=1&limit=2")
            .set("Authorization", `Bearer ${userToken}`)
            .expect(200);

        expect(response.body.data).toHaveLength(2);
        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.limit).toBe(2);
        expect(response.body.pagination.total).toBeGreaterThanOrEqual(2);
        expect(response.body.pagination.hasNextPage).toBe(true);
    });

    test("descending sort returns IDs in descending order", async () => {
        const response = await request(app)
            .get("/api/books?sort=id&order=desc")
            .set("Authorization", `Bearer ${userToken}`)
            .expect(200);

        const ids = response.body.data.map(book => book.id);

        expect(ids).toEqual([...ids].sort((a, b) => b - a));
    });

    test("invalid sort field is rejected", async () => {
        await request(app)
            .get("/api/books?sort=password")
            .set("Authorization", `Bearer ${userToken}`)
            .expect(400);
    });

    test("excessive page size is rejected", async () => {
        await request(app)
            .get("/api/books?limit=100")
            .set("Authorization", `Bearer ${userToken}`)
            .expect(400);
    });

    test("administrator can update a book", async () => {
        const created = await request(app)
            .post("/api/books")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
                title: "Book Before Update",
                author: "Test Author"
            })
            .expect(201);

        const response = await request(app)
            .put(`/api/books/${created.body.id}`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
                title: "Book After Update",
                author: "Updated Author"
            })
            .expect(200);

        expect(response.body.title).toBe("Book After Update");
        expect(response.body.author).toBe("Updated Author");
    });

    test("ordinary user cannot update a book", async () => {
        await request(app)
            .put("/api/books/1")
            .set("Authorization", `Bearer ${userToken}`)
            .send({
                title: "Unauthorized Update",
                author: "Test Author"
            })
            .expect(403);
    });

    test("administrator can delete a book", async () => {
        const created = await request(app)
            .post("/api/books")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
                title: "Book To Delete",
                author: "Test Author"
            })
            .expect(201);

        await request(app)
            .delete(`/api/books/${created.body.id}`)
            .set("Authorization", `Bearer ${adminToken}`)
            .expect(200);

        await request(app)
            .get(`/api/books/${created.body.id}`)
            .set("Authorization", `Bearer ${userToken}`)
            .expect(404);
    });

    test("ordinary user cannot delete a book", async () => {
        await request(app)
            .delete("/api/books/1")
            .set("Authorization", `Bearer ${userToken}`)
            .expect(403);
    });


test("registration rejects a missing email", async () => {
    await request(app)
        .post("/api/auth/register")
        .send({ password: "TestPassword123!" })
        .expect(400);
});

test("registration rejects an existing email", async () => {
    await request(app)
        .post("/api/auth/register")
        .send({
            email: userEmail,
            password
        })
        .expect(409);
});

test("login rejects a missing password", async () => {
    await request(app)
        .post("/api/auth/login")
        .send({ email: userEmail })
        .expect(400);
});

test("login rejects an unknown email", async () => {
    await request(app)
        .post("/api/auth/login")
        .send({
            email: "unknown@example.test",
            password: "TestPassword123!"
        })
        .expect(401);
});

test("login fails when JWT_SECRET is missing", async () => {
    const originalSecret = process.env.JWT_SECRET;

    try {
        delete process.env.JWT_SECRET;

        const response = await request(app)
            .post("/api/auth/login")
            .send({
                email: userEmail,
                password
            })
            .expect(500);

        expect(response.body.error).toBe(
            "Authentication service is not configured"
        );
    } finally {
        if (originalSecret === undefined) {
            delete process.env.JWT_SECRET;
        } else {
            process.env.JWT_SECRET = originalSecret;
        }
    }
});

});