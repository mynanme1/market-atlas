CREATE TABLE `paper_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`base_currency` text DEFAULT 'CNY' NOT NULL,
	`initial_cash` real NOT NULL,
	`cash` real NOT NULL,
	`commission_bps` real DEFAULT 3 NOT NULL,
	`slippage_bps` real DEFAULT 5 NOT NULL,
	`created_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `paper_nav_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`snapshot_date` text NOT NULL,
	`cash` real NOT NULL,
	`market_value` real NOT NULL,
	`total_value` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `paper_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`company_id` integer NOT NULL,
	`side` text NOT NULL,
	`quantity` real NOT NULL,
	`signal_date` text NOT NULL,
	`signal_price_cny` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT '待成交' NOT NULL,
	`submitted_at` text DEFAULT '' NOT NULL,
	`filled_at` text DEFAULT '' NOT NULL,
	`filled_price_cny` real DEFAULT 0 NOT NULL,
	`fees` real DEFAULT 0 NOT NULL,
	`rationale` text DEFAULT '' NOT NULL,
	`driver_name` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `paper_positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`company_id` integer NOT NULL,
	`quantity` real NOT NULL,
	`avg_cost_cny` real NOT NULL,
	`updated_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `price_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`symbol` text NOT NULL,
	`price` real NOT NULL,
	`currency` text NOT NULL,
	`fx_to_cny` real DEFAULT 1 NOT NULL,
	`price_cny` real NOT NULL,
	`price_date` text NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`captured_at` text DEFAULT '' NOT NULL
);
