#!/usr/bin/env bash
# Source AWS login-session credentials into env vars for tools that don't use the aws CLI credential chain.
# Usage: source ./aws-env.sh (credentials are NOT printed)
CACHE_DIR="$HOME/.aws/login/cache"
FILE=$(ls "$CACHE_DIR"/*.json 2>/dev/null | head -1)
[ -n "$FILE" ] || { echo "no login cache found" >&2; return 1 2>/dev/null || exit 1; }
node - "$FILE" <<'EOF'
const fs = require('fs');
const c = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const t = c.accessToken;
console.log(`export AWS_ACCESS_KEY_ID=${t.accessKeyId}`);
console.log(`export AWS_SECRET_ACCESS_KEY=${t.secretAccessKey}`);
console.log(`export AWS_SESSION_TOKEN=${t.sessionToken}`);
EOF