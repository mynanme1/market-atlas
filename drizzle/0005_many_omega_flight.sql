CREATE TABLE `driver_fact_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`driver_id` integer NOT NULL,
	`fact_id` integer NOT NULL,
	`stance` text DEFAULT '支持' NOT NULL,
	`relevance` integer DEFAULT 3 NOT NULL,
	`rationale` text DEFAULT '' NOT NULL
);
