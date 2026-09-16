CREATE TABLE `company_chain_memberships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`chain_name` text NOT NULL,
	`stage` text NOT NULL,
	`stage_order` integer NOT NULL,
	`role` text NOT NULL,
	`strength` integer DEFAULT 3 NOT NULL,
	`evidence` text DEFAULT '' NOT NULL,
	`verified_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `company_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`tag_type` text NOT NULL,
	`tag_name` text NOT NULL,
	`strength` integer DEFAULT 3 NOT NULL,
	`evidence` text DEFAULT '' NOT NULL,
	`verified_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `macro_exposures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`factor` text NOT NULL,
	`direction` text NOT NULL,
	`sensitivity` text NOT NULL,
	`evidence` text DEFAULT '' NOT NULL,
	`verified_at` text DEFAULT '' NOT NULL
);
