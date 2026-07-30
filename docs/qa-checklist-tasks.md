# Tasks Module — QA Checklist

Generated during hardening session. All items must pass before merging to production.

---

## 1. Task CRUD — Happy Paths

| #   | Action                                                                   | Expected                          |
| --- | ------------------------------------------------------------------------ | --------------------------------- |
| 1   | `POST /api/groups/:groupId/tasks` as group member, valid body            | 201 + task object returned        |
| 2   | `GET /api/groups/:groupId/tasks` (kanban view)                           | 200 + `{ statuses: [...] }` array |
| 3   | `GET /api/groups/:groupId/tasks/:taskId`                                 | 200 + full task detail            |
| 4   | `PATCH /api/groups/:groupId/tasks/:taskId` (update title only)           | 200 + updated task                |
| 5   | `DELETE /api/groups/:groupId/tasks/:taskId` as creator                   | 200                               |
| 6   | `DELETE /api/groups/:groupId/tasks/:taskId` as group owner (non-creator) | 200                               |

---

## 2. Task CRUD — Authorization Boundaries

| #   | Action                                                                                 | Expected |
| --- | -------------------------------------------------------------------------------------- | -------- |
| 7   | `POST /api/groups/:groupId/tasks` without JWT                                          | 401      |
| 8   | `POST /api/groups/:groupId/tasks` as non-member of the group                           | 403      |
| 9   | `DELETE /api/groups/:groupId/tasks/:taskId` as regular member (non-creator, non-owner) | 403      |
| 10  | `PATCH /api/groups/:groupId/tasks/:taskId` as non-member                               | 403      |

---

## 3. Task CRUD — Input Validation

| #   | Action                                                           | Expected                          |
| --- | ---------------------------------------------------------------- | --------------------------------- |
| 11  | `POST` with invalid (non-ObjectId) `groupId` param               | 404 `Nhóm không tồn tại`          |
| 12  | `PATCH` with invalid (non-ObjectId) `taskId` param               | 404 `Task không tồn tại`          |
| 13  | `POST` with `statusId` that belongs to a different group         | 400                               |
| 14  | `POST` with `assigneeId` of a user NOT in the group              | 400                               |
| 15  | `POST` with `deadline` set to a past timestamp                   | 400                               |
| 16  | `POST` without `statusId` when no default status exists in group | 400                               |
| 17  | `POST` with an invalid (non-ObjectId) string in `labelIds` array | 400                               |
| 18  | `GET /kanban` with invalid (non-ObjectId) `groupId`              | 200 `{ statuses: [] }` (graceful) |

---

## 4. Notification Flag Reset — Critical Business Logic

| #   | Action                                                                               | Expected (verify in DB)                               |
| --- | ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| 19  | Seed task with `reminderSentAt = <date>`, then PATCH status from Done → incomplete   | `reminderSentAt = null`, `overdueSentAt = null` in DB |
| 20  | Seed task with `reminderSentAt = <date>`, then PATCH `deadline` to a new future date | `reminderSentAt = null`, `overdueSentAt = null` in DB |
| 21  | Seed completed task, PATCH `deadline` only (status stays completed)                  | Flags must NOT be reset (still sent)                  |
| 22  | PATCH status from incomplete → Done                                                  | Flags must NOT be reset                               |

---

## 5. Cron — Reminder Notifications

| #   | Scenario                                                                           | Expected                                                       |
| --- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 23  | Seed: task with `deadline = now+30min`, `reminderSentAt = null`, incomplete status | Reminder email sent; `reminderSentAt` set in DB after cron run |
| 24  | Run same cron again on same task (flag already set)                                | Email NOT sent again                                           |
| 25  | Task with `deadline = now+90min` (outside 60-min window)                           | Reminder NOT sent                                              |
| 26  | Task with `deadline = now-10min` (already past)                                    | Reminder NOT sent (deadline `$gt: now` filter)                 |
| 27  | Task with completed status                                                         | Reminder NOT sent (filtered by `isCompleted = false`)          |
| 28  | Cron SMTP failure → check DB                                                       | `reminderSentAt` remains `null`; next run retries              |
| 29  | Verify reminder email subject contains `[Nhắc hạn]`                                |                                                                |

---

## 6. Cron — Overdue Notifications

| #   | Scenario                                                                          | Expected                                                     |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 30  | Seed: task with `deadline = yesterday`, `overdueSentAt = null`, incomplete status | Overdue email sent; `overdueSentAt` set in DB after cron run |
| 31  | Run same cron again (flag already set)                                            | Email NOT sent again                                         |
| 32  | Task with `deadline = null`                                                       | Overdue NOT sent (`$ne: null` filter)                        |
| 33  | Task with completed status                                                        | Overdue NOT sent                                             |
| 34  | Cron SMTP failure → check DB                                                      | `overdueSentAt` remains `null`; next run retries             |
| 35  | Verify overdue email subject contains `[Trễ hạn]` (NOT `[Quá hạn]`)               |                                                              |

---

## 7. Dashboard

| #   | Action                                         | Expected                             |
| --- | ---------------------------------------------- | ------------------------------------ |
| 36  | `GET /api/groups/:groupId/dashboard` as member | 200 + correct task counts per status |
| 37  | Dashboard with 0 tasks in group                | 200 + all counts = 0                 |
| 38  | Dashboard after task is completed              | Completed count increments           |

---

## 8. Performance / Database

| #   | Check                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 39  | Run slow-query profiler during both cron jobs — confirm exactly 3 DB queries per cron (status distinct + task find + user find) regardless of task count |
| 40  | Confirm `deadline` + `reminderSentAt` + `overdueSentAt` indexes exist on `tasks` collection                                                              |
| 41  | Confirm compound index on `(groupId, statusId)` exists for kanban query                                                                                  |

---

## 9. Schema Integrity

| #   | Check                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------- |
| 42  | `DELETE /api/groups/:groupId/tasks/:taskId` — verify corresponding `task_labels` documents are also deleted (cascade)      |
| 43  | `DELETE /api/groups/:groupId` — verify all group tasks and task_labels are deleted (if group-level cascade is implemented) |
