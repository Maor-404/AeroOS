# Multi-stage minimal AeroOS Control Hub container (Ubuntu 26.04 LTS + Rust)
FROM ubuntu:26.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends rustc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY src ./src
RUN rustc -O src/aero-hub/main.rs -o /aero-hub \
    && rustc -O src/aero-webapp/main.rs -o /aero-webapp

FROM ubuntu:26.04
LABEL org.opencontainers.image.title="AeroOS Control Hub" \
      org.opencontainers.image.description="Minimal Ubuntu 26.04 LTS AeroOS container with Rust Control Hub" \
      org.opencontainers.image.source="https://github.com/Maor-404/AeroOS"

COPY --from=builder /aero-hub /usr/local/bin/aero-hub
COPY --from=builder /aero-webapp /usr/local/bin/aero-webapp
COPY docs/hub /usr/share/aeroos/hub
COPY docs/assets /usr/share/aeroos/assets
COPY configs/themes /usr/share/aeroos/themes

EXPOSE 8080
CMD ["/usr/local/bin/aero-hub", "--serve-only", "--bind", "0.0.0.0", "--port", "8080"]
