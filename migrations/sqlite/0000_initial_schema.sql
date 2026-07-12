CREATE TABLE `wallet_card_payloads` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`item_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`barcode_format` text,
	`payload_encrypted` integer DEFAULT false NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `wallet_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `wallet_card_payloads_item_idx` ON `wallet_card_payloads` (`item_id`);--> statement-breakpoint
CREATE TABLE `wallet_items` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`kind` text NOT NULL,
	`kind_hint` text,
	`storage_object_key` text,
	`encryption_version` text,
	`encrypted_metadata` text,
	`wrapped_dek` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wallet_items_tenant_owner_idx` ON `wallet_items` (`tenant_id`,`owner_user_id`);