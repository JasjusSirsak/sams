# Shared agenda manual checks

Run these checks against a database with users, roles, enrollments, assignments, and agenda data for an active academic period.

1. **Student class scope:** create or use student A enrolled in class A, with a class-B agenda and schedule on the requested date. Request `GET /api/agenda?date=YYYY-MM-DD` as student A. The response must not contain class-B records. Supplying `studentId` for student B must not change the result.
2. **Parent-child scope:** request the endpoint as parent A with a `studentId` linked to parent B but not parent A. Expect HTTP `403`.
3. **No active period:** request a valid date outside every academic period. Expect HTTP `200` and `{ "data": [] }`.
4. **Date validation:** request a missing, malformed, or impossible date (for example, `2026-02-30`). Expect HTTP `400`.
