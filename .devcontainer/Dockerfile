# Use the official Microsoft devcontainer Node.js image
# Using Node.js v24 LTS (Krypton) - Latest LTS as of June 2026
ARG VARIANT="24-bookworm"
FROM mcr.microsoft.com/devcontainers/javascript-node:1-${VARIANT}

# Install additional build tools and utilities
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
        build-essential \
        curl \
        git \
        ca-certificates \
        gnupg \
        jq \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install latest npm globally
RUN npm install -g npm@latest

# Switch to the node user for any node-specific operations
USER node
