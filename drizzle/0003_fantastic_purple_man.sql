CREATE TABLE `driver_impacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`driver_id` integer NOT NULL,
	`target_type` text NOT NULL,
	`target_key` text NOT NULL,
	`direction` text NOT NULL,
	`strength` integer NOT NULL,
	`transmission` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `drivers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`probability` integer NOT NULL,
	`horizon` text NOT NULL,
	`leading_indicator` text DEFAULT '' NOT NULL,
	`evidence_status` text DEFAULT '待核验' NOT NULL,
	`updated_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`probability` integer NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`impact_multiplier` real DEFAULT 1 NOT NULL
);
