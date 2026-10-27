-- HerHandmade: PostgreSQL schema (PostgreSQL 14+)
-- Run once on an empty database:  npm run db:init
-- Rules live in the database wherever possible (CHECK, UNIQUE, FOREIGN KEY),
-- so a bug in the API cannot save bad data.

BEGIN;

-- ---------------------------------------------------------------------------
-- USERS: admins and Sakhi Captains (role = 'leader'). Workers have no account.
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id             INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           TEXT        NOT NULL,
  phone          TEXT        NOT NULL UNIQUE,
  password_hash  TEXT        NOT NULL,
  role           TEXT        NOT NULL CHECK (role IN ('admin', 'leader')),
  active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- GROUPS: one women's group per Sakhi Captain.
-- access_code is the read-only link code for workers (e.g. K7M2-9QXA).
-- ---------------------------------------------------------------------------
CREATE TABLE groups (
  id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name         TEXT        NOT NULL,
  village      TEXT        NOT NULL,
  district     TEXT        NOT NULL,
  leader_id    INT         NOT NULL UNIQUE REFERENCES users(id),
  access_code  TEXT        NOT NULL UNIQUE,
  active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional roster: names only, no phone or email.
CREATE TABLE members (
  id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id    INT         NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_members_group ON members (group_id);

-- ---------------------------------------------------------------------------
-- SKILLS and per-group ratings.
-- aliases are stored lower-case by the API ("rakhee", "राखी", ...).
-- ---------------------------------------------------------------------------
CREATE TABLE skills (
  id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name     TEXT   NOT NULL,
  aliases  TEXT[] NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX uq_skills_name ON skills (lower(name));

-- RATING RULES: see backend/src/modules/groups/ratingPolicy.js
-- Only the admin sets rating (1-5). verified = admin has checked the skill.
CREATE TABLE group_skills (
  group_id  INT      NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  skill_id  INT      NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  rating    SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  verified  BOOLEAN  NOT NULL DEFAULT FALSE,
  PRIMARY KEY (group_id, skill_id)
);
CREATE INDEX idx_group_skills_skill ON group_skills (skill_id);

-- ---------------------------------------------------------------------------
-- ORDERS placed by businesses through the public form.
-- Status is changed manually by the admin (see TRANSITIONS in orders.service.js).
-- tracking_token is unguessable and is the business's only "login".
-- ---------------------------------------------------------------------------
CREATE TABLE orders (
  id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_ref       TEXT        NOT NULL UNIQUE,
  tracking_token  TEXT        NOT NULL UNIQUE,
  business_name   TEXT        NOT NULL,
  location        TEXT        NOT NULL,
  item            TEXT        NOT NULL,
  quantity        INT         NOT NULL CHECK (quantity > 0),
  delivery_date   DATE        NOT NULL,
  email           TEXT        NOT NULL,
  phone           TEXT,
  status          TEXT        NOT NULL DEFAULT 'submitted'
                  CHECK (status IN ('submitted', 'accepted', 'rejected', 'in_production',
                                    'completed', 'dispatched', 'delivered', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_status_id ON orders (status, id DESC);

-- One row per status change: gives the tracking timeline and the audit trail.
CREATE TABLE order_events (
  id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id    INT         NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      TEXT        NOT NULL,
  by_user_id  INT         REFERENCES users(id),   -- NULL when the business submits
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_events_order ON order_events (order_id);

-- ---------------------------------------------------------------------------
-- ASSIGNMENTS: part (or all) of an order given to one group.
-- One order -> many assignments. A task for "all women" is ONE row.
-- Quantity cap (sum of non-declined quantities <= order quantity) is checked
-- inside a transaction in assignments.service.js (SELECT ... FOR UPDATE on the order).
-- ---------------------------------------------------------------------------
CREATE TABLE assignments (
  id                INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id          INT         NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  group_id          INT         NOT NULL REFERENCES groups(id),
  quantity          INT         NOT NULL CHECK (quantity > 0),
  deadline          DATE        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'assigned'
                    CHECK (status IN ('assigned', 'accepted', 'declined', 'done')),
  decline_reason    TEXT,
  produced_qty      INT         CHECK (produced_qty >= 0),
  done_at           TIMESTAMPTZ,
  evidence_approved BOOLEAN     NOT NULL DEFAULT FALSE,  -- admin approves the photo set once
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assignments_group  ON assignments (group_id, status, deadline);
CREATE INDEX idx_assignments_order  ON assignments (order_id);

-- Reference images (admin -> group) and proof photos (captain -> admin -> business).
-- file_name is a random 128-bit name, so URLs cannot be guessed.
CREATE TABLE assignment_media (
  id             INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assignment_id  INT         NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  kind           TEXT        NOT NULL CHECK (kind IN ('reference', 'evidence')),
  file_name      TEXT        NOT NULL UNIQUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_media_assignment ON assignment_media (assignment_id);

-- ---------------------------------------------------------------------------
-- BROADCASTS: admin -> all groups / one leader; captain -> own group.
-- Videos are YouTube links (no upload). Images are uploaded files.
-- ---------------------------------------------------------------------------
CREATE TABLE broadcasts (
  id               INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  author_id        INT         NOT NULL REFERENCES users(id),
  audience         TEXT        NOT NULL CHECK (audience IN ('all_groups', 'one_leader', 'own_group')),
  target_group_id  INT         REFERENCES groups(id),
  type             TEXT        NOT NULL CHECK (type IN ('text', 'image', 'video')),
  body             TEXT,
  file_name        TEXT,
  video_url        TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (audience = 'all_groups' OR target_group_id IS NOT NULL),
  CHECK (type <> 'image' OR file_name IS NOT NULL),
  CHECK (type <> 'video' OR video_url IS NOT NULL)
);
CREATE INDEX idx_broadcasts_target ON broadcasts (target_group_id, id DESC);
CREATE INDEX idx_broadcasts_audience ON broadcasts (audience, id DESC);
ALTER TABLE orders ADD COLUMN idempotency_key TEXT UNIQUE;
COMMIT;
