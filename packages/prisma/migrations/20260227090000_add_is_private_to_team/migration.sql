-- Add isPrivate flag to Team to support private teams
ALTER TABLE "Team"
ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT FALSE;

