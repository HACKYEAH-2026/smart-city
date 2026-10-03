CREATE TABLE `communities` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `communities_slug_unique` ON `communities` (`slug`);--> statement-breakpoint
CREATE TABLE `plugin_docs` (
	`id` text PRIMARY KEY NOT NULL,
	`installation_id` text NOT NULL,
	`collection` text NOT NULL,
	`data` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`installation_id`) REFERENCES `plugin_installations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `plugin_docs_installation_collection_idx` ON `plugin_docs` (`installation_id`,`collection`,`created_at`);--> statement-breakpoint
CREATE TABLE `plugin_installations` (
	`id` text PRIMARY KEY NOT NULL,
	`community_id` text NOT NULL,
	`plugin_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`community_id`) REFERENCES `communities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plugin_installations_community_plugin_idx` ON `plugin_installations` (`community_id`,`plugin_id`);--> statement-breakpoint
CREATE TABLE `plugin_sources` (
	`plugin_id` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
