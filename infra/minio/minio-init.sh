#!/bin/sh
# Idempotent MinIO bootstrap: private bucket + least-privilege service account.
set -eu

mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"

mc mb --ignore-existing "local/$MINIO_BUCKET_DOCUMENTS"
# No anonymous access, ever: documents are served only through short-lived,
# session-bound URLs issued by the API after decryption.
mc anonymous set none "local/$MINIO_BUCKET_DOCUMENTS"
# Keep prior object versions so an overwrite cannot silently destroy evidence.
mc version enable "local/$MINIO_BUCKET_DOCUMENTS"

cat > /tmp/sba-app-policy.json <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": ["arn:aws:s3:::${MINIO_BUCKET_DOCUMENTS}/*"]
    }
  ]
}
POLICY

mc admin policy create local sba-app /tmp/sba-app-policy.json 2>/dev/null \
  || mc admin policy update local sba-app /tmp/sba-app-policy.json 2>/dev/null \
  || true

if ! mc admin user info local "$MINIO_APP_ACCESS_KEY" >/dev/null 2>&1; then
  mc admin user add local "$MINIO_APP_ACCESS_KEY" "$MINIO_APP_SECRET_KEY"
fi
mc admin policy attach local sba-app --user "$MINIO_APP_ACCESS_KEY" 2>/dev/null || true

echo "MinIO bootstrap complete."
