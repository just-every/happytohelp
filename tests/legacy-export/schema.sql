-- Final legacy core schema, derived from happytohelp/database/migrations through 2025-03-06.
-- No companies, attachments, project_ais, contact_events, or application-side accessors.
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL,
  email_verified_at TIMESTAMP NULL, password VARCHAR(255) NOT NULL, remember_token VARCHAR(100) NULL,
  timezone VARCHAR(255) NULL, type VARCHAR(255) NOT NULL DEFAULT 'regular', avatar_url VARCHAR(255) NULL,
  ai_profile JSON NULL, ai_profile_at TIMESTAMP NULL, ai_profile_count INT UNSIGNED NOT NULL DEFAULT 0,
  is_notifiable_on_conversation_assignment TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL, last_login_ip VARCHAR(255) NOT NULL, last_login_country CHAR(2) NOT NULL,
  created_at TIMESTAMP NULL, updated_at TIMESTAMP NULL, deleted_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE projects (
  id CHAR(36) PRIMARY KEY, name VARCHAR(255) NOT NULL, slug VARCHAR(255) NOT NULL DEFAULT '',
  website VARCHAR(255) NULL, avatar_url VARCHAR(255) NULL, timezone VARCHAR(255) NULL,
  email_from_address VARCHAR(255) NULL, email_from_name VARCHAR(255) NULL, help_center_domain VARCHAR(255) NULL,
  verification_secret VARCHAR(255) NOT NULL DEFAULT '', is_proxy_only TINYINT(1) NOT NULL,
  is_contact_tracking_enabled TINYINT(1) NOT NULL DEFAULT 0, is_human_response_enabled TINYINT(1) NOT NULL DEFAULT 1,
  is_availability_schedule_enabled TINYINT(1) NOT NULL DEFAULT 0, is_collection_created TINYINT(1) NOT NULL DEFAULT 0,
  is_ai_balance_top_up_enabled TINYINT(1) UNSIGNED NOT NULL, is_ai_level_dynamic TINYINT(1) UNSIGNED NOT NULL DEFAULT 1,
  availability_schedule JSON NULL, widget_settings JSON NULL, widget_settings_hash VARCHAR(255) NULL, metadata JSON NULL,
  proxy_html_requests_count INT UNSIGNED NOT NULL, proxy_other_requests_count INT UNSIGNED NOT NULL,
  ai_profile_at TIMESTAMP NULL, ai_profile_count INT UNSIGNED NOT NULL DEFAULT 0, ai_profile JSON NULL,
  default_visitor_ai_id CHAR(36) NULL, default_verified_user_ai_id CHAR(36) NULL,
  ai_level TINYINT UNSIGNED NOT NULL DEFAULT 4, ai_balance DECIMAL(12,6) NOT NULL,
  ai_monthly_budget DECIMAL(8,2) UNSIGNED NOT NULL, ai_balance_top_up_when_below DECIMAL(8,2) UNSIGNED NOT NULL,
  ai_balance_top_up_amount DECIMAL(8,2) UNSIGNED NOT NULL, stripe_id VARCHAR(255) NULL,
  pm_id VARCHAR(255) NULL, pm_type VARCHAR(255) NULL, pm_last_four VARCHAR(4) NULL,
  pm_error VARCHAR(255) NULL, pm_expires_at TIMESTAMP NULL,
  created_at TIMESTAMP NULL, updated_at TIMESTAMP NULL, deleted_at TIMESTAMP NULL,
  INDEX projects_slug_index (slug), INDEX projects_stripe_id_index (stripe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ais (
  id CHAR(36) PRIMARY KEY, project_id CHAR(36) NOT NULL, type VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL, role VARCHAR(255) NOT NULL, avatar_url VARCHAR(255) NULL, prompt TEXT NOT NULL,
  is_enabled TINYINT(1) UNSIGNED NOT NULL DEFAULT 1, is_animated TINYINT(1) UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL, updated_at TIMESTAMP NULL, INDEX ais_project_id_index (project_id),
  FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE projects ADD FOREIGN KEY (default_visitor_ai_id) REFERENCES ais(id) ON DELETE SET NULL,
  ADD FOREIGN KEY (default_verified_user_ai_id) REFERENCES ais(id) ON DELETE SET NULL;

CREATE TABLE ai_defaults (
  id CHAR(36) PRIMARY KEY, type VARCHAR(255) NOT NULL, role VARCHAR(255) NOT NULL, prompt TEXT NOT NULL,
  created_at TIMESTAMP NULL, updated_at TIMESTAMP NULL, INDEX ai_defaults_type_index (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE project_users (
  id CHAR(36) PRIMARY KEY, project_id CHAR(36) NOT NULL, user_id CHAR(36) NULL DEFAULT NULL,
  invited_by_id CHAR(36) NULL, role VARCHAR(255) NOT NULL DEFAULT 'AGENT', invitation_email VARCHAR(255) NOT NULL DEFAULT '',
  invitation_token VARCHAR(255) NULL, is_notified_on_unassigned_activity TINYINT(1) NOT NULL DEFAULT 1,
  is_primary TINYINT(1) NOT NULL DEFAULT 0, accepted_at DATETIME NULL, created_at TIMESTAMP NULL, updated_at TIMESTAMP NULL,
  UNIQUE KEY project_users_project_id_user_id_unique (project_id,user_id),
  INDEX project_users_project_id_index (project_id), INDEX project_users_user_id_index (user_id),
  INDEX project_users_invited_by_id_index (invited_by_id), INDEX project_users_role_index (role),
  INDEX project_users_invitation_token_index (invitation_token),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contacts (
  id CHAR(36) PRIMARY KEY, project_id CHAR(36) NOT NULL, nickname VARCHAR(255) NULL,
  name VARCHAR(255) NULL DEFAULT NULL, provided_name VARCHAR(255) NULL DEFAULT NULL,
  email VARCHAR(255) NULL DEFAULT NULL, provided_email VARCHAR(255) NULL DEFAULT NULL,
  identifier VARCHAR(255) NOT NULL DEFAULT '', user_agent TEXT NULL, ip_address VARCHAR(255) NULL,
  country_code CHAR(2) NULL, timezone VARCHAR(255) NOT NULL, language VARCHAR(255) NULL, avatar_url VARCHAR(255) NULL,
  key_hashes JSON NULL, metadata JSON NULL, is_verified TINYINT(1) NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMP NULL, blocked_at TIMESTAMP NULL, ai_profile_at TIMESTAMP NULL,
  ai_profile_count INT UNSIGNED NOT NULL DEFAULT 0, ai_profile JSON NULL,
  created_at TIMESTAMP NULL, updated_at TIMESTAMP NULL, deleted_at TIMESTAMP NULL,
  INDEX contacts_project_id_index (project_id), INDEX contacts_name_index (name), INDEX contacts_email_index (email),
  INDEX contacts_identifier_index (identifier), INDEX contacts_provided_name_index (provided_name),
  INDEX contacts_provided_email_index (provided_email), FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE conversations (
  id CHAR(36) PRIMARY KEY, project_id CHAR(36) NOT NULL, agent_id CHAR(36) NULL DEFAULT NULL, contact_id CHAR(36) NOT NULL,
  ai_id CHAR(36) NULL, last_message_id CHAR(36) NULL, metadata JSON NULL, ai_thoughts_at TIMESTAMP NULL, ai_thoughts JSON NULL,
  is_ai_locked TINYINT(1) UNSIGNED NOT NULL DEFAULT 0, is_ai_selected TINYINT(1) UNSIGNED NOT NULL DEFAULT 0,
  unread_agent_messages_count BIGINT NOT NULL DEFAULT 0, unread_contact_messages_count BIGINT NOT NULL DEFAULT 0,
  resolved_at DATETIME NULL, last_message_at DATETIME NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, deleted_at TIMESTAMP NULL,
  INDEX conversations_project_id_index (project_id), INDEX conversations_agent_id_index (agent_id),
  INDEX conversations_contact_id_index (contact_id), INDEX conversations_last_message_id_index (last_message_id),
  INDEX conversations_unread_agent_messages_count_index (unread_agent_messages_count),
  INDEX conversations_unread_contact_messages_count_index (unread_contact_messages_count),
  INDEX conversations_resolved_at_index (resolved_at), INDEX conversations_last_message_at_index (last_message_at),
  INDEX conversations_updated_at_index (updated_at),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (ai_id) REFERENCES ais(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE messages (
  id CHAR(36) PRIMARY KEY, project_id CHAR(36) NOT NULL, conversation_id CHAR(36) NOT NULL, bucket_id CHAR(36) NULL,
  contact_id CHAR(36) NULL, agent_id CHAR(36) NULL, local_id VARCHAR(255) NULL,
  content LONGTEXT NOT NULL, content_raw LONGTEXT NULL, read_by_agents JSON NULL, read_by_contacts JSON NULL,
  notified_by JSON NULL, notified_at TIMESTAMP NULL,
  created_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, deleted_at TIMESTAMP NULL,
  INDEX messages_project_id_index (project_id), INDEX messages_conversation_id_index (conversation_id),
  INDEX messages_contact_id_index (contact_id), INDEX messages_agent_id_index (agent_id), INDEX messages_local_id_index (local_id),
  INDEX messages_notified_at_index (notified_at), FULLTEXT INDEX message_content_index (content),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE conversations ADD FOREIGN KEY (last_message_id) REFERENCES messages(id) ON DELETE SET NULL;

CREATE TABLE buckets (
  id CHAR(36) PRIMARY KEY, project_id CHAR(36) NOT NULL, conversation_id CHAR(36) NOT NULL,
  first_message_id CHAR(36) NULL, last_message_id CHAR(36) NULL, counts JSON NULL,
  is_vectorized TINYINT(1) UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX buckets_created_at_index (created_at), INDEX buckets_is_summarized_index (is_vectorized),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (first_message_id) REFERENCES messages(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (last_message_id) REFERENCES messages(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE messages ADD FOREIGN KEY (bucket_id) REFERENCES buckets(id) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE conversation_participants (
  id CHAR(36) PRIMARY KEY, conversation_id CHAR(36) NOT NULL, contact_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NULL, updated_at TIMESTAMP NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE events (
  id CHAR(36) PRIMARY KEY, conversation_id CHAR(36) NOT NULL, bucket_id CHAR(36) NOT NULL,
  contact_id CHAR(36) NULL, agent_id CHAR(36) NULL, type VARCHAR(255) NOT NULL, payload JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (bucket_id) REFERENCES buckets(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE media (
  id CHAR(36) PRIMARY KEY, disk VARCHAR(32) NOT NULL, directory VARCHAR(255) NOT NULL, filename VARCHAR(255) NOT NULL,
  filename_original VARCHAR(255) NULL, url VARCHAR(255) NULL, extension VARCHAR(32) NOT NULL,
  mime_type VARCHAR(128) NOT NULL, aggregate_type VARCHAR(32) NOT NULL, size INT UNSIGNED NOT NULL,
  variant_name VARCHAR(255) NULL, original_media_id CHAR(36) NULL, created_at TIMESTAMP NULL, updated_at TIMESTAMP NULL,
  UNIQUE KEY media_disk_directory_filename_extension_unique (disk,directory,filename,extension),
  INDEX media_aggregate_type_index (aggregate_type),
  CONSTRAINT original_media_id FOREIGN KEY (original_media_id) REFERENCES media(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mediables (
  media_id CHAR(36) NOT NULL, mediable_type VARCHAR(255) NOT NULL, mediable_id CHAR(36) NOT NULL,
  tag VARCHAR(255) NOT NULL, `order` INT UNSIGNED NOT NULL,
  PRIMARY KEY (media_id,mediable_type,mediable_id,tag), INDEX mediables_mediable_id_mediable_type_index (mediable_id,mediable_type),
  INDEX mediables_tag_index (tag), INDEX mediables_order_index (`order`),
  FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categories (
  id CHAR(36) PRIMARY KEY, project_id CHAR(36) NOT NULL, _lft INT UNSIGNED NOT NULL DEFAULT 0,
  _rgt INT UNSIGNED NOT NULL DEFAULT 0, parent_id CHAR(36) NULL,
  title VARCHAR(255) NOT NULL, slug VARCHAR(255) NOT NULL, summary TEXT NULL,
  created_by_id CHAR(36) NULL, modified_by_id CHAR(36) NULL, published_at TIMESTAMP NULL,
  created_at TIMESTAMP NULL, updated_at TIMESTAMP NULL,
  INDEX categories__lft_index (_lft), INDEX categories__rgt_index (_rgt), INDEX categories_parent_id_index (parent_id),
  INDEX categories_slug_index (slug), FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (modified_by_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE articles (
  id CHAR(36) PRIMARY KEY, project_id CHAR(36) NOT NULL, title VARCHAR(255) NOT NULL, slug VARCHAR(255) NOT NULL,
  summary TEXT NULL, content LONGTEXT NOT NULL, created_by_id CHAR(36) NULL, modified_by_id CHAR(36) NULL,
  published_at TIMESTAMP NULL, created_at TIMESTAMP NULL, updated_at TIMESTAMP NULL,
  INDEX articles_slug_index (slug), FULLTEXT INDEX title_index (title), FULLTEXT INDEX summary_index (summary),
  FULLTEXT INDEX content_index (content), FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (modified_by_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE article_categories (
  id CHAR(36) PRIMARY KEY, article_id CHAR(36) NOT NULL, category_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NULL, updated_at TIMESTAMP NULL,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE macros (
  id CHAR(36) PRIMARY KEY, project_id CHAR(36) NOT NULL, created_by_id CHAR(36) NULL,
  title VARCHAR(255) NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP NULL, updated_at TIMESTAMP NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
