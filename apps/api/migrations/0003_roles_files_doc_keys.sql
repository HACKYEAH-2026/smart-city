CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`community_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`community_id`) REFERENCES `communities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_community_user_idx` ON `memberships` (`community_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `plugin_files` (
	`id` text PRIMARY KEY NOT NULL,
	`installation_id` text NOT NULL,
	`uploaded_by` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`installation_id`) REFERENCES `plugin_installations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `plugin_files_status_created_idx` ON `plugin_files` (`status`,`created_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_plugin_docs` (
	`id` text NOT NULL,
	`installation_id` text NOT NULL,
	`collection` text NOT NULL,
	`data` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`installation_id`, `collection`, `id`),
	FOREIGN KEY (`installation_id`) REFERENCES `plugin_installations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_plugin_docs`("id", "installation_id", "collection", "data", "created_by", "created_at", "updated_at") SELECT "id", "installation_id", "collection", "data", "created_by", "created_at", "updated_at" FROM `plugin_docs`;--> statement-breakpoint
DROP TABLE `plugin_docs`;--> statement-breakpoint
ALTER TABLE `__new_plugin_docs` RENAME TO `plugin_docs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `plugin_docs_installation_collection_idx` ON `plugin_docs` (`installation_id`,`collection`,`created_at`);