CREATE TABLE `companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`ticker` text NOT NULL,
	`market` text NOT NULL,
	`sector` text NOT NULL,
	`chain` text NOT NULL,
	`position` text NOT NULL,
	`summary` text NOT NULL,
	`moat` text NOT NULL,
	`catalyst` text NOT NULL,
	`risk` text NOT NULL,
	`color` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `relations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`target_id` integer NOT NULL,
	`type` text NOT NULL,
	`note` text NOT NULL
);
