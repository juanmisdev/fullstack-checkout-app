#!/usr/bin/env zsh
# Source AWS login-session credentials into env vars (zsh-safe, no printing).
CACHE_DIR="$HOME/.aws/login/cache"
FILE=$(ls "$CACHE_DIR"/*.json 2>/dev/null | head -1)
if [ -z "$FILE" ]; then echo "no login cache found" >&2; return 1; fi
export AWS_ACCESS_KEY_ID="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).accessToken.accessKeyId)' "$FILE")"
export AWS_SECRET_ACCESS_KEY="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).accessToken.secretAccessKey)' "$FILE")"
export AWS_SESSION_TOKEN="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).accessToken.sessionToken)' "$FILE")"