CREATE TABLE `chain_stages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chain_name` text NOT NULL,
	`stage_order` integer NOT NULL,
	`stage_name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `evidence_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`source_type` text NOT NULL,
	`publisher` text DEFAULT '' NOT NULL,
	`published_at` text DEFAULT '' NOT NULL,
	`accessed_at` text DEFAULT '' NOT NULL,
	`excerpt` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `relation_evidence` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`relation_id` integer NOT NULL,
	`evidence_id` integer NOT NULL,
	`support_level` text DEFAULT '支持' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `relation_metadata` (
	`relation_id` integer PRIMARY KEY NOT NULL,
	`relation_class` text DEFAULT '产业推断' NOT NULL,
	`confidence` integer DEFAULT 2 NOT NULL,
	`strength` integer DEFAULT 3 NOT NULL,
	`status` text DEFAULT '待核验' NOT NULL,
	`as_of_date` text DEFAULT '' NOT NULL,
	`analyst_note` text DEFAULT '' NOT NULL
);
