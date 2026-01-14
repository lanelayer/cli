export const LANE_SNAPSHOT_BUILDER_IMAGE =
  "ghcr.io/lanelayer/lane-snapshot-builder@sha256:8c9e5a2838040be2c8979dfc197292cbfa46f9944f29b8af84c98edcba8f7ca0";
export const GUEST_AGENT_IMAGE =
  "ghcr.io/lanelayer/lane-guest-agent@sha256:efed94419b7ee1ee762f42fb55eb1700186d89fdf01f1d9f789d61bc151a119b";
export const CORE_LANE_IMAGE =
  process.env.CORE_LANE_IMAGE || "ghcr.io/lanelayer/core-lane/core-lane:latest";
