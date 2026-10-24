
# Bookstore API

A RESTful Bookstore API built with Node.js, Express, and SQLite. This project demonstrates backend development fundamentals, including user authentication, role-based access control, database persistence, input validation, and automated testing.

## Features

- **User authentication:** Register and log in using email and password.
- **Password security:** Hash passwords with bcrypt.
- **JWT authentication:** Protect API endpoints with JSON Web Tokens.
- **Role-based access control (RBAC):** Restrict book creation, updating, and deletion to administrators.
- **Book management:** Create, retrieve, update, and delete books.
- **Search and filtering:** Search books by title or author and filter by author.
- **Pagination:** Retrieve books in manageable pages.
- **Sorting:** Sort books by supported fields in ascending or descending order.
- **SQLite database:** Persist application data locally.
- **Input validation:** Handle invalid requests, duplicate books, and missing resources.
- **Automated testing:** Test API behavior using Jest and Supertest.

## Technology Stack

- Node.js
- Express.js
- SQLite with better-sqlite3
- bcrypt
- JSON Web Tokens (JWT)
- Jest
- Supertest

## Getting Started

### Prerequisites

Install the following:

- Node.js and npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/o-bern/bookstore-api.git
cd bookstore-api
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
PORT=3000
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=15m
```

Generate a random secret using:

```bash
openssl rand -hex 32
```

Copy the generated value into `JWT_SECRET`.

**Security:** Never commit your `.env` file or share your secret publicly.

Note: The current login implementation sets token expiry to `15m` directly in the code. `JWT_EXPIRES_IN` will only affect behavior if the application is configured to read that variable.

### 4. Start the server

```bash
npm start
```

If your project does not define a `start` script yet, run:

```bash
node server.js
```

The server uses port `3000` by default unless configured otherwise.

### 5. Check the API

Open this URL in your browser:

http://localhost:3000/api/health

Expected response:

```json
{
  "status": "ok"
}
```

## API Endpoints

Base URL: `http://localhost:3000`

### Authentication

| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/api/auth/register` | Register a user | Public |
| POST | `/api/auth/login` | Log in and receive a JWT | Public |

Example registration request:

```json
{
  "email": "reader@example.com",
  "password": "StrongPassword123!"
}
```

Send this JSON to `POST /api/auth/register`.

Example login request:

```json
{
  "email": "reader@example.com",
  "password": "StrongPassword123!"
}
```

A successful login returns a JWT token. Use it to authenticate requests to protected endpoints.

### Books

| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/api/books` | List books | Authenticated |
| GET | `/api/books/:id` | Retrieve one book | Authenticated |
| POST | `/api/books` | Create a book | Admin |
| PUT | `/api/books/:id` | Update a book | Admin |
| DELETE | `/api/books/:id` | Delete a book | Admin |

Example book request:

```json
{
  "title": "Things Fall Apart",
  "author": "Chinua Achebe"
}
```

For protected requests, include this HTTP header:

```text
Authorization: Bearer YOUR_JWT_TOKEN
```

Replace `YOUR_JWT_TOKEN` with the token returned by login. Do not publish real tokens.

### Search, Filtering, Pagination, and Sorting

The books endpoint supports query parameters.

Examples:

```text
GET /api/books?q=Gatsby
GET /api/books?author=Jane%20Austen
GET /api/books?page=1&limit=5
GET /api/books?sort=title&order=asc
```

Combine supported parameters as needed. Pagination responses include book data and pagination metadata.

## Authentication and Authorization

The API distinguishes between authentication and authorization:

- **Authentication:** Verifies the user's identity using a JWT.
- **Authorization:** Checks whether the authenticated user has the required role.

Newly registered users receive the `user` role by default. Administrative privileges must be assigned through a trusted administrative process, not by accepting a role from public registration input.

Typical responses include:

| Status | Meaning |
|---|---|
| 200 | Request successful |
| 201 | Resource created |
| 400 | Invalid request |
| 401 | Authentication required or invalid |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 409 | Duplicate resource |
| 500 | Internal server error |

## Automated Testing

Run the test suite with:

```bash
npm test
```

The project currently includes 25 automated tests covering authentication, authorization, book operations, search, pagination, sorting, and error handling.

The test command also generates a code coverage report.

Open the HTML report with:

```bash
xdg-open coverage/lcov-report/index.html
```

Coverage reports are generated locally and should not be committed to Git.

## Project Structure

```text
bookstore-api/
├── middleware/
│   └── auth.js
├── routes/
│   ├── auth.js
│   └── books.js
├── tests/
│   └── books.test.js
├── .gitignore
├── db.js
├── package.json
├── package-lock.json
├── server.js
└── README.md
```

## Future Improvements

- Add API documentation using Swagger/OpenAPI.
- Add rate limiting to authentication endpoints.
- Improve automated test coverage for exceptional error paths.
- Add integration testing for more database scenarios.
- Implement a deployment workflow.
- Add a frontend interface for browsing and managing books.

## Author

**o-bern**

GitHub: https://github.com/o-bern

---

This project was built as a practical backend development project to strengthen skills in REST API design, authentication, authorization, database management, and automated testing.
