export const LANE_SNAPSHOT_BUILDER_IMAGE =
  "ghcr.io/lanelayer/lane-snapshot-builder@sha256:60d395e0d887ac2821e8e14fa2ac2aa5c100106f5c1b93e88979070af2c8e8c0";
export const GUEST_AGENT_IMAGE =
  "ghcr.io/lanelayer/lane-guest-agent@sha256:9b59e773b3bfe9336d4d87299bc6da594f6cbec70a10bc4fde33ab37d78b056a";

/** Default container registry for `lane push` when no registry is specified (e.g. `lane push myapp:latest`). */
export const DEFAULT_REGISTRY_BASE = "cli-backend-registry.fly.dev";

/**
 * Default URL the CLI notifies after a successful push (lane handshake).
 * Override with env LANE_NOTIFY_URL.
 */
export const DEFAULT_LANE_NOTIFY_ENDPOINT =
  "https://cli-backend-notification-server.fly.dev/notify";
