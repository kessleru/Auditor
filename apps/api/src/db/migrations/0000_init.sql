CREATE TABLE `assistive_checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`collection_page_id` integer NOT NULL,
	`kind` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`severity` text,
	`note` text,
	`inspector_id` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`collection_page_id`) REFERENCES `collection_pages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`inspector_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assistive_checks_collection_page_id_kind_unique` ON `assistive_checks` (`collection_page_id`,`kind`);--> statement-breakpoint
CREATE TABLE `collection_pages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`collection_id` integer NOT NULL,
	`route_id` integer NOT NULL,
	`function_id` integer,
	`status` text DEFAULT 'queued' NOT NULL,
	`http_status` integer,
	`error` text,
	`snapshot_path` text,
	`passes_count` integer DEFAULT 0 NOT NULL,
	`violations_count` integer DEFAULT 0 NOT NULL,
	`incomplete_count` integer DEFAULT 0 NOT NULL,
	`inapplicable_count` integer DEFAULT 0 NOT NULL,
	`evaluated_at` integer,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`function_id`) REFERENCES `page_functions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `collection_pages_queue_idx` ON `collection_pages` (`collection_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `collection_pages_collection_id_route_id_unique` ON `collection_pages` (`collection_id`,`route_id`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`scope_json` text NOT NULL,
	`axe_version` text,
	`browser_version` text,
	`user_agent` text,
	`created_by` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `findings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`collection_page_id` integer NOT NULL,
	`rule_id` text NOT NULL,
	`wcag_criteria` text NOT NULL,
	`principle` text NOT NULL,
	`axe_impact` text NOT NULL,
	`severity` text NOT NULL,
	`selector` text NOT NULL,
	`html_snippet` text NOT NULL,
	`help` text NOT NULL,
	`help_url` text NOT NULL,
	`fingerprint` text NOT NULL,
	`validation` text DEFAULT 'pending' NOT NULL,
	`validation_note` text,
	`validated_by` integer,
	`validated_at` integer,
	FOREIGN KEY (`collection_page_id`) REFERENCES `collection_pages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`validated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `findings_collection_page_idx` ON `findings` (`collection_page_id`);--> statement-breakpoint
CREATE INDEX `findings_fingerprint_idx` ON `findings` (`fingerprint`);--> statement-breakpoint
CREATE TABLE `institutions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`acronym` text NOT NULL,
	`domain` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `institutions_domain_unique` ON `institutions` (`domain`);--> statement-breakpoint
CREATE TABLE `page_functions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `page_functions_key_unique` ON `page_functions` (`key`);--> statement-breakpoint
CREATE TABLE `routes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`institution_id` integer NOT NULL,
	`url` text NOT NULL,
	`normalized_url` text NOT NULL,
	`function_id` integer,
	`source` text NOT NULL,
	`status` text DEFAULT 'suggested' NOT NULL,
	`exclusion_reason` text,
	`replaced_by_route_id` integer,
	`discovered_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`confirmed_at` integer,
	`last_seen_at` integer,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`function_id`) REFERENCES `page_functions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`replaced_by_route_id`) REFERENCES `routes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routes_institution_id_normalized_url_unique` ON `routes` (`institution_id`,`normalized_url`);--> statement-breakpoint
CREATE TABLE `target_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`function_id` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`function_id`) REFERENCES `page_functions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `task_inspections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`collection_id` integer NOT NULL,
	`institution_id` integer NOT NULL,
	`task_id` integer NOT NULL,
	`result` text NOT NULL,
	`interactions` integer NOT NULL,
	`duration_seconds` integer NOT NULL,
	`depth` integer NOT NULL,
	`path_json` text NOT NULL,
	`heuristic` text,
	`severity` text,
	`note` text NOT NULL,
	`inspector_id` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `target_tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`inspector_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);