# API Documentation

## Endpoints
- `GET /api/ideas`: Fetch all ideas with search query and filter.
- `GET /api/ideas/trending`: Fetch top 6 trending ideas based on algorithm.
- `GET /api/ideas/:id`: Fetch a single idea by its MongoDB ObjectId.
- `POST /api/ideas`: Create a new startup idea (Protected).
- `PUT /api/ideas/:id`: Update an existing idea (Protected, Author only).
- `DELETE /api/ideas/:id`: Delete an idea (Protected, Author only).

- `GET /api/comments/:ideaId`: Fetch all comments for a given idea.
- `POST /api/comments`: Post a new comment (Protected).
- `PUT /api/comments/:id`: Update your comment (Protected).
- `DELETE /api/comments/:id`: Delete your comment (Protected).

## Authentication
Uses BetterAuth plugins internally (`/api/auth/token`). Protected routes expect a valid JSON Web Token (JWT) in the `Authorization: Bearer <token>` header.
