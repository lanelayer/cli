export const LANE_SNAPSHOT_BUILDER_IMAGE =
  "ghcr.io/lanelayer/lane-snapshot-builder@sha256:5de1cfaea1a33c8cdcee1abd3306ae9a25709a2522fa33c95822a4fc209b7a18";
export const GUEST_AGENT_IMAGE =
  "ghcr.io/lanelayer/lane-guest-agent@sha256:efed94419b7ee1ee762f42fb55eb1700186d89fdf01f1d9f789d61bc151a119b";
export const CORE_LANE_IMAGE =
  process.env.CORE_LANE_IMAGE || "ghcr.io/lanelayer/core-lane/core-lane:latest";
