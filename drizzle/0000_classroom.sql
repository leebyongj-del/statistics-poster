CREATE TABLE class_runs (id TEXT PRIMARY KEY, code TEXT NOT NULL, grade INTEGER NOT NULL, room INTEGER NOT NULL, title TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, closed_at INTEGER);
--> statement-breakpoint
CREATE UNIQUE INDEX one_active_class_code ON class_runs(code) WHERE active = 1;
--> statement-breakpoint
CREATE TABLE teacher_sessions (token TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE student_sessions (token TEXT PRIMARY KEY, id TEXT NOT NULL UNIQUE, class_id TEXT NOT NULL REFERENCES class_runs(id), name TEXT NOT NULL, number TEXT NOT NULL, expires_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE drafts (student_id TEXT PRIMARY KEY REFERENCES student_sessions(id), data TEXT NOT NULL, updated_at INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
--> statement-breakpoint
CREATE TABLE login_limits (ip TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_start INTEGER NOT NULL);
