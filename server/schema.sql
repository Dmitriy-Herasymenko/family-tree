CREATE TABLE IF NOT EXISTS ridni_users (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ridni_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES ridni_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS ridni_sessions_user_idx ON ridni_sessions(user_id);
CREATE TABLE IF NOT EXISTS ridni_trees (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES ridni_users(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ridni_trees_owner_idx ON ridni_trees(owner_id);
CREATE TABLE IF NOT EXISTS ridni_photos (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES ridni_users(id) ON DELETE CASCADE,
  data bytea NOT NULL CHECK (octet_length(data) <= 262144),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ridni_photos_owner_idx ON ridni_photos(owner_id);
