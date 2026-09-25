#!/usr/bin/env bash
# Deploy the SPA to S3 + CloudFront (us-east-1). Idempotent: reuses existing bucket/distribution.
# Usage: VITE_API_URL=<api-gateway-url> ./deploy-frontend.sh
set -euo pipefail

REGION="us-east-1"
BUCKET="${FRONTEND_BUCKET:-checkout-spa-33971295360}"
ROOT="${ROOT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
CLIENT_DIR="$ROOT/client"
DIST_DIR="$CLIENT_DIR/dist"

echo "==> Building client (VITE_API_URL=${VITE_API_URL:-<unset, uses default>})"
(cd "$CLIENT_DIR" && npm run build)

echo "==> Ensuring S3 bucket exists: $BUCKET"
if ! aws s3api head-bucket --bucket "$BUCKET" --region "$REGION" 2>/dev/null; then
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
fi

echo "==> Syncing dist/ to S3"
aws s3 sync "$DIST_DIR" "s3://$BUCKET" --delete --cache-control "public,max-age=300"

echo "==> Ensuring CloudFront distribution"
DIST_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?contains(Origins.Items[0].DomainName, '${BUCKET}.s3')].Id | [0]" --output text 2>/dev/null || true)

if [ -z "$DIST_ID" ] || [ "$DIST_ID" = "None" ]; then
  CALLER_REF="checkout-spa-$(date +%s)"
  DIST_ID=$(aws cloudfront create-distribution \
    --distribution-config "{
      \"CallerReference\": \"${CALLER_REF}\",
      \"Comment\": \"checkout SPA\",
      \"DefaultRootObject\": \"index.html\",
      \"Origins\": {
        \"Quantity\": 1,
        \"Items\": [{
          \"Id\": \"s3-origin\",
          \"DomainName\": \"${BUCKET}.s3.amazonaws.com\",
          \"S3OriginConfig\": {\"OriginAccessIdentity\": \"\"}
        }]
      },
      \"DefaultCacheBehavior\": {
        \"TargetOriginId\": \"s3-origin\",
        \"ViewerProtocolPolicy\": \"redirect-to-https\",
        \"ForwardedValues\": {\"QueryString\": false, \"Cookies\": {\"Forward\": \"none\"}},
        \"MinTTL\": 60,
        \"DefaultTTL\": 300,
        \"Compress\": true
      },
      \"CustomErrorResponses\": {
        \"Quantity\": 1,
        \"Items\": [{
          \"ErrorCode\": 404,
          \"ResponsePagePath\": \"/index.html\",
          \"ResponseCode\": \"200\",
          \"ErrorCachingMinTTL\": 30
        }]
      },
      \"Enabled\": true,
      \"PriceClass\": \"PriceClass_100\"
    }" \
    --query 'Distribution.Id' --output text --region "$REGION")
  echo "==> Created CloudFront distribution $DIST_ID (initial deploy may take ~10 min to become Deployed)"
fi

DOMAIN=$(aws cloudfront get-distribution --id "$DIST_ID" --query 'Distribution.DomainName' --output text --region "$REGION")
echo ""
echo "CloudFront URL: https://$DOMAIN"
echo "Distribution ID: $DIST_ID"
echo "S3 bucket: $BUCKET"