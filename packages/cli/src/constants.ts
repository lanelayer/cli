export const LANE_SNAPSHOT_BUILDER_IMAGE =
  "ghcr.io/lanelayer/lane-snapshot-builder@sha256:5de1cfaea1a33c8cdcee1abd3306ae9a25709a2522fa33c95822a4fc209b7a18";
export const GUEST_AGENT_IMAGE =
  "ghcr.io/lanelayer/lane-guest-agent@sha256:c1aee2fe8f05eecce9f1750286ec833e6b10f3258ae473cb31d57cc5644867d5";

/** Default container registry for `lane push` when no registry is specified (e.g. `lane push myapp:latest`). */
export const DEFAULT_REGISTRY_BASE = "cli-backend-registry.fly.dev";

/**
 * Default URL the CLI notifies after a successful push (lane handshake).
 * Override with env LANE_NOTIFY_URL.
 */
export const DEFAULT_LANE_NOTIFY_ENDPOINT =
  "https://cli-backend-notification-server.fly.dev/";
