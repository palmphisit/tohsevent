#!/usr/bin/env bash
# One-time GCP setup so GitHub Actions (.github/workflows/ci-deploy.yml) can deploy to Cloud Run
# without service account keys, using Workload Identity Federation.
# Safe to re-run: existing resources are left as they are.
#
#   bash scripts/gcp/setup-github-deploy.sh
set -euo pipefail

PROJECT_ID="tohs-event"
PROJECT_NUMBER="997706797091"
REGION="asia-southeast1"
GITHUB_REPO="palmphisit/tohsevent"
AR_REPO="tohsevent"
SERVICE="tohsevent"
RUNTIME_SA="tohsevent-run@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOY_SA_NAME="github-deployer"
DEPLOY_SA="${DEPLOY_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
POOL="github"
PROVIDER="tohsevent-repo"

gcloud config set project "$PROJECT_ID" >/dev/null

# New service accounts take a few seconds to propagate before IAM bindings accept them.
retry() {
  local attempt
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if "$@"; then return 0; fi
    echo "   ...not ready yet, retrying in 6s (attempt ${attempt}/10)"
    sleep 6
  done
  return 1
}

echo "==> Enabling APIs"
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com artifactregistry.googleapis.com run.googleapis.com

echo "==> Artifact Registry repository: ${AR_REPO}"
if ! gcloud artifacts repositories describe "$AR_REPO" --location "$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$AR_REPO" --repository-format=docker --location "$REGION" \
    --description="Tohs Event container images"
fi

echo "==> Deploy service account: ${DEPLOY_SA}"
if ! gcloud iam service-accounts describe "$DEPLOY_SA" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$DEPLOY_SA_NAME" --display-name="GitHub Actions deployer"
fi

echo "==> Granting deploy permissions"
# Push images to this repository only.
retry gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" --location "$REGION" \
  --member="serviceAccount:${DEPLOY_SA}" --role="roles/artifactregistry.writer" --condition=None >/dev/null
# Deploy new revisions of Cloud Run services.
retry gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA}" --role="roles/run.developer" --condition=None >/dev/null
# Revisions run as the runtime service account, so the deployer must be allowed to "act as" it.
retry gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:${DEPLOY_SA}" --role="roles/iam.serviceAccountUser" --condition=None >/dev/null

echo "==> Workload Identity pool and GitHub provider"
if ! gcloud iam workload-identity-pools describe "$POOL" --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL" --location=global --display-name="GitHub Actions"
fi
if ! gcloud iam workload-identity-pools providers describe "$PROVIDER" --location=global \
  --workload-identity-pool="$POOL" >/dev/null 2>&1; then
  # Only tokens from this repository's main branch are accepted.
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --location=global --workload-identity-pool="$POOL" \
    --display-name="tohsevent repo" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository == '${GITHUB_REPO}' && assertion.ref == 'refs/heads/main'"
fi

echo "==> Allowing the GitHub repository to impersonate the deploy service account"
retry gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
  --role="roles/iam.workloadIdentityUser" --condition=None \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${GITHUB_REPO}" \
  >/dev/null

echo
echo "Done. Values used by .github/workflows/ci-deploy.yml:"
echo "  WORKLOAD_IDENTITY_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
echo "  DEPLOY_SERVICE_ACCOUNT=${DEPLOY_SA}"
echo "  Service: ${SERVICE} (${REGION})"
