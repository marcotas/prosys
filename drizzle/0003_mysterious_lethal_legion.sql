ALTER TABLE `tasks` ADD `reschedule_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `reschedule_history` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `rescheduled_from_id` text;