CREATE TABLE presence (student_id TEXT PRIMARY KEY REFERENCES student_sessions(id),last_seen INTEGER NOT NULL,visible INTEGER NOT NULL DEFAULT 1,step INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE submissions (student_id TEXT PRIMARY KEY REFERENCES student_sessions(id),data TEXT NOT NULL,submitted_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE away_events (id TEXT PRIMARY KEY,student_id TEXT NOT NULL REFERENCES student_sessions(id),tab TEXT NOT NULL,started_at INTEGER NOT NULL,ended_at INTEGER);
--> statement-breakpoint
CREATE INDEX away_student ON away_events(student_id,started_at);
