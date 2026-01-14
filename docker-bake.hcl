target "docker-metadata-action" {
  context = "."
}

target "docker-platforms" {
  platforms = [
    "linux/amd64",
    "linux/arm64"
  ]
}

target "docker-platforms-amd64-only" {
  platforms = [
    "linux/amd64"
  ]
}


target "docker-platforms-riscv64-only" {
  platforms = [
    "linux/riscv64"
  ]
}

target "lane-kernels" {
  inherits = ["docker-metadata-action", "docker-platforms-amd64-only"]
  context = "./packages/vcr-kernels"
  dockerfile = "Dockerfile"
  tags = ["ghcr.io/lanelayer/lane-kernels:latest"]
}

target "guest-agent" {
  inherits = ["docker-metadata-action", "docker-platforms-riscv64-only"]
  context = "."
  dockerfile = "./packages/guest-agent/Dockerfile"
  tags = ["ghcr.io/lanelayer/lane-guest-agent:latest"]
}

target "snapshot-builder" {
  inherits = ["docker-metadata-action", "docker-platforms"]
  context = "./packages/snapshot-builder"
  dockerfile = "Dockerfile"
  tags = ["ghcr.io/lanelayer/lane-snapshot-builder:latest"]
  depends_on = ["lane-kernels"]
}

target "kv-service" {
  inherits = ["docker-metadata-action", "docker-platforms"]
  context = "./packages/kv-service"
  dockerfile = "Dockerfile"
  tags = ["ghcr.io/lanelayer/lane-kv-service:latest"]
}

target "default" {
  inherits = ["lane-kernels", "snapshot-builder", "kv-service"]
} 