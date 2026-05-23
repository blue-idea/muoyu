CREATE TYPE "public"."chapter_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."content_file_type" AS ENUM('character', 'outline', 'writing_plan', 'chapter');--> statement-breakpoint
CREATE TYPE "public"."creation_pace" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TYPE "public"."export_format" AS ENUM('md', 'txt', 'pdf', 'epub');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."knowledge_doc_status" AS ENUM('processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."knowledge_source_type" AS ENUM('upload', 'url');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'planning', 'writing', 'validating', 'completed');--> statement-breakpoint
CREATE TYPE "public"."writing_mode" AS ENUM('serial', 'parallel');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" timestamp with time zone,
	"name" varchar(120),
	"image" varchar(512),
	"password_hash" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "content_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"file_type" "content_file_type" NOT NULL,
	"relative_path" varchar(255) NOT NULL,
	"chapter_number" integer,
	"title" varchar(200),
	"word_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"format" "export_format" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"file_size" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"current_chapter_number" integer,
	"locked_at" timestamp with time zone,
	"locked_by" varchar(64),
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" varchar(1024),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planning_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" varchar(64),
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" varchar(1024),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" jsonb
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"source_type" "knowledge_source_type" NOT NULL,
	"source_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "knowledge_doc_status" DEFAULT 'processing' NOT NULL,
	"text_storage_key" varchar(512) NOT NULL,
	"failure_reason" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_knowledge_bindings" (
	"project_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"bound_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_knowledge_bindings_pk" PRIMARY KEY("project_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "user_llm_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"base_url" varchar(512) NOT NULL,
	"encrypted_api_key" varchar(4096) NOT NULL,
	"model_name" varchar(120) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"last_tested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"storage_prefix" varchar(512) NOT NULL,
	"creation_config" jsonb,
	"planning_ready" boolean DEFAULT false NOT NULL,
	"llm_config_id" uuid,
	"writing_plan_etag" varchar(64),
	"chapter_completed_count" integer DEFAULT 0 NOT NULL,
	"total_chapters" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"storage_delete_pending" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_files" ADD CONSTRAINT "content_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_records" ADD CONSTRAINT "export_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_records" ADD CONSTRAINT "export_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_jobs" ADD CONSTRAINT "planning_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_jobs" ADD CONSTRAINT "planning_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_knowledge_bindings" ADD CONSTRAINT "project_knowledge_bindings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_knowledge_bindings" ADD CONSTRAINT "project_knowledge_bindings_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_llm_configs" ADD CONSTRAINT "user_llm_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_llm_config_id_user_llm_configs_id_fk" FOREIGN KEY ("llm_config_id") REFERENCES "public"."user_llm_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accounts_user_id" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "content_files_project_relative_path_unique" ON "content_files" USING btree ("project_id","relative_path");--> statement-breakpoint
CREATE INDEX "idx_content_files_project_type" ON "content_files" USING btree ("project_id","file_type");--> statement-breakpoint
CREATE INDEX "idx_content_files_project_chapter" ON "content_files" USING btree ("project_id","chapter_number");--> statement-breakpoint
CREATE INDEX "idx_export_records_project" ON "export_records" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_export_records_user" ON "export_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_project_status" ON "generation_jobs" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "idx_jobs_pending" ON "generation_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_planning_jobs_project_status" ON "planning_jobs" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "idx_planning_jobs_pending" ON "planning_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_knowledge_chunks_document" ON "knowledge_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_chunks_document_chunk" ON "knowledge_chunks" USING btree ("document_id","chunk_index");--> statement-breakpoint
CREATE INDEX "idx_knowledge_documents_user_id" ON "knowledge_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_documents_status" ON "knowledge_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_llm_user_id" ON "user_llm_configs" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_llm_user_default" ON "user_llm_configs" USING btree ("user_id","is_default");--> statement-breakpoint
CREATE INDEX "idx_projects_user_status" ON "projects" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_projects_user_updated" ON "projects" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_user_slug_unique" ON "projects" USING btree ("user_id","slug");