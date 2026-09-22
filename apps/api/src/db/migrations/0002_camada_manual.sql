CREATE TABLE `inspection_sample` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`collection_id` integer NOT NULL,
	`institution_id` integer NOT NULL,
	`selected_by` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`selected_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inspection_sample_collection_id_institution_id_unique` ON `inspection_sample` (`collection_id`,`institution_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_inspections_collection_id_institution_id_task_id_unique` ON `task_inspections` (`collection_id`,`institution_id`,`task_id`);