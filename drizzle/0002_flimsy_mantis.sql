ALTER TABLE `tasks` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `cancelled_at` text;