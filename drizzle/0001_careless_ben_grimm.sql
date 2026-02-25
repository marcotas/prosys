PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text,
	`week_start` text NOT NULL,
	`day_index` integer NOT NULL,
	`title` text NOT NULL,
	`emoji` text,
	`completed` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `family_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tasks`("id", "member_id", "week_start", "day_index", "title", "emoji", "completed", "sort_order", "created_at", "updated_at") SELECT "id", "member_id", "week_start", "day_index", "title", "emoji", "completed", "sort_order", "created_at", "updated_at" FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_tasks_member_week_day` ON `tasks` (`member_id`,`week_start`,`day_index`);--> statement-breakpoint
CREATE INDEX `idx_tasks_week_day` ON `tasks` (`week_start`,`day_index`);