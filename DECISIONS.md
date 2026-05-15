# Architectural Decisions

This file contains some of the major technical decisions taken during the implementation of the project.

---

## 1. TypeScript with Strict Mode

Used TypeScript with strict mode enabled to reduce runtime errors and improve type safety across controllers, services, and JWT handling.

---

## 2. Separate `app.ts` and `server.ts`

Split Express app setup and server startup into separate files.

* `app.ts` → middleware, routes, error handling
* `server.ts` → database connection and `app.listen()`

This keeps the structure cleaner and makes testing easier.

---

## 3. Layered Project Structure

Used a layered structure:

* routes
* controllers
* services
* models

This keeps business logic separated from route handling and makes the code easier to maintain.

---

## 4. Async Handler Utility

Added a small `asyncHandler` utility to avoid repeating try/catch blocks in every async controller.

---

## 5. Simple Response Structure

Used a consistent API response structure across endpoints:

```json
{
  "success": true,
  "message": "...",
  "data": {}
}
```

Some assignment-specific endpoints return custom response shapes based on the requirements.

---

## 6. JWT Authentication

Implemented authentication using:

* Access Token
* Refresh Token

Separate secrets are used for both tokens.

Access tokens are short-lived while refresh tokens are used for session persistence.

---

## 7. Password Hashing with bcrypt

Passwords are hashed using bcrypt before storing them in MongoDB.

Password fields are excluded from normal queries using `select: false`.

---

## 8. MongoDB as Primary Data Store

MongoDB is used for storing:

* users
* activity logs
* replay check data
* analytics-related activity data

---

## 9. ActivityLog as Central Source for Tracking

All user actions are stored in the `ActivityLog` collection.

This collection is reused for:

* analytics
* suspicious activity detection
* replay protection
* rate limiting checks

---

## 10. Custom Rate Limiting

Implemented custom rate limiting using MongoDB queries instead of external libraries, as required in the assignment.

The system blocks users if they perform more than 5 actions within 10 seconds.

---

## 11. Replay Protection

Replay protection checks:

* client/server time difference
* duplicate actions within a short time window

This helps prevent repeated or replayed requests.

---

## 12. MongoDB Aggregation Pipelines

Used MongoDB aggregation pipelines for analytics features such as:

* most common actions
* actions per minute
* suspicious user detection
* most active users

---

## 13. Suspicious Activity Detection

Implemented suspicious activity checks for:

* high-frequency actions
* multiple IP usage within a short time period

---

## 14. Centralized Error Handling

Added a centralized error middleware using a custom `AppError` class to keep error responses consistent across the application.

---

## 15. Protected and Public Frontend Routes

Frontend routing is separated into:

* protected routes
* public/auth routes

Logged-in users cannot access login/register pages, and unauthenticated users cannot access dashboard pages.

---

## 16. Minimal Frontend Architecture

Frontend was intentionally kept minimal and utility-focused.

Used:

* React
* TypeScript
* TailwindCSS
* native fetch API

Avoided unnecessary state management libraries and complex UI abstractions.
