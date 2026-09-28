CREATE TABLE `discovery_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`institution_id` integer NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`requested_by` integer,
	`progress_json` text,
	`summary_json` text,
	`replacements_json` text,
	`error` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `discovery_runs_institution_idx` ON `discovery_runs` (`institution_id`);--> statement-breakpoint
CREATE INDEX `discovery_runs_status_idx` ON `discovery_runs` (`status`);