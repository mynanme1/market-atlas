CREATE TABLE `extracted_facts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`document_id` integer NOT NULL,
	`fact_type` text NOT NULL,
	`label` text NOT NULL,
	`value_text` text DEFAULT '' NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`reporting_period` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`evidence_summary` text DEFAULT '' NOT NULL,
	`confidence` integer DEFAULT 3 NOT NULL,
	`verified_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`document_type` text NOT NULL,
	`title` text NOT NULL,
	`reporting_period` text DEFAULT '' NOT NULL,
	`publication_date` text DEFAULT '' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`source_tier` text NOT NULL,
	`extraction_status` text DEFAULT '待提取' NOT NULL
);
