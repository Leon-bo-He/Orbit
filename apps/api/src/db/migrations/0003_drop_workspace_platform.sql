-- Remove the single-platform field from workspaces (replaced by per-content targetPlatforms and the global platform settings)
ALTER TABLE workspaces DROP COLUMN IF EXISTS platform;
