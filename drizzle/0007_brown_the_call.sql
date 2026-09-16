CREATE TABLE IF NOT EXISTS `factor_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`metric` text NOT NULL,
	`value` real NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`reporting_period` text NOT NULL,
	`published_at` text NOT NULL,
	`observed_at` text NOT NULL,
	`source_document_id` integer NOT NULL,
	`confidence` integer DEFAULT 3 NOT NULL,
	`created_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `research_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`company_id` integer NOT NULL,
	`snapshot_date` text NOT NULL,
	`research_score` real DEFAULT 0 NOT NULL,
	`evidence_coverage` real DEFAULT 0 NOT NULL,
	`benchmark_symbol` text DEFAULT '' NOT NULL,
	`horizon` text DEFAULT '中期' NOT NULL,
	`invalidation` text DEFAULT '' NOT NULL,
	`thesis` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `research_snapshots_order_id_unique` ON `research_snapshots` (`order_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `strategy_model_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_date` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `strategy_model_snapshots_snapshot_date_unique` ON `strategy_model_snapshots` (`snapshot_date`);
