CREATE TABLE `family_members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`theme_variant` text DEFAULT 'default' NOT NULL,
	`theme_accent` text NOT NULL,
	`theme_accent_light` text NOT NULL,
	`theme_accent_dark` text NOT NULL,
	`theme_header_bg` text NOT NULL,
	`theme_ring_color` text NOT NULL,
	`theme_check_color` text NOT NULL,
	`theme_emoji` text DEFAULT '' NOT NULL,
	`quote_text` text DEFAULT '' NOT NULL,
	`quote_author` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `habit_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`week_start` text NOT NULL,
	`day_index` integer NOT NULL,
	`completed` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_habit_completions_unique` ON `habit_completions` (`habit_id`,`week_start`,`day_index`);--> statement-breakpoint
CREATE INDEX `idx_habit_completions_week` ON `habit_completions` (`habit_id`,`week_start`);--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`name` text NOT NULL,
	`emoji` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `family_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_habits_member_order` ON `habits` (`member_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
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
CREATE INDEX `idx_tasks_member_week_day` ON `tasks` (`member_id`,`week_start`,`day_index`);