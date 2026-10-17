#!/usr/bin/env bash
# Run from the checkout. All access is supplied through explicit LEGACY_* env vars.
set -euo pipefail
if [[ $# != 4 ]]; then
  echo 'Usage: bash scripts/legacy-export/export-project.sh PROJECT_ID SOURCE_REVISION NATIVE_AI_MODEL OUTPUT_DIRECTORY' >&2
  exit 2
fi
project_id=$1
source_revision=$2
native_model=$3
output_directory=$4
: "${LEGACY_S3_BUCKET:?Set the confirmed attachments bucket name}"
: "${LEGACY_AWS_REGION:?Set its region}"
: "${LEGACY_MAIL_FROM_DOMAIN:?Set the legacy MAIL_FROM_DOMAIN for project inbound addresses}"
umask 077
mkdir -p -- "$output_directory"
node scripts/export-legacy.mjs snapshot --project "$project_id" --revision "$source_revision" --ai-model "$native_model" --mail-from-domain "$LEGACY_MAIL_FROM_DOMAIN" --chunk-bytes "${LEGACY_CHUNK_BYTES:-4194304}" --output "$output_directory/snapshot"
node scripts/export-legacy.mjs attachments --input "$output_directory/snapshot" --bucket "$LEGACY_S3_BUCKET" --region "$LEGACY_AWS_REGION" --output "$output_directory/import"
