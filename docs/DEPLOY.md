# R2RA — AWS Deployment Guide

**Classification:** CUI // BASIC

Two deployment paths are documented here:

- **[Path A — CodePipeline + Elastic Beanstalk](#path-a--codepipeline--elastic-beanstalk)** (recommended for wider deployment)
- **[Path B — GovCloud EC2 pilot](#path-b--govcloud-ec2-pilot)** (simpler single-server option; good for a controlled pilot)

---

## Path A — CodePipeline + Elastic Beanstalk

### Live resource inventory (us-east-1, account 885232248320)

| Resource | ID / ARN / Endpoint |
|---|---|
| S3 frontend bucket | `r2ra-frontend-885232248320` |
| S3 artifacts bucket | `r2ra-artifacts-885232248320` |
| RDS endpoint | `r2ra-postgres.cgxc4cmqqlek.us-east-1.rds.amazonaws.com` |
| EB application | `r2ra` |
| EB environment | `r2ra-prod` → `r2ra-prod.eba-yg3nk3rp.us-east-1.elasticbeanstalk.com` |
| CloudFront distribution | `E3RGJN1CAO1G43` → `d2si4nfgz87czj.cloudfront.net` |
| CodeBuild project | `r2ra-build` |
| CodePipeline | `r2ra` |
| GitHub connection ARN | `arn:aws:codestar-connections:us-east-1:885232248320:connection/9f03e92d-4ce0-452a-9815-260d5f240d14` (**pending authorization**) |

**One manual step required:** In the AWS Console → Developer Tools → Settings → Connections → `r2ra-github` → click **"Update pending connection"** and authorize with GitHub. Until this is done, the pipeline will not trigger on push.

**Architecture:**
```
GitHub (source)
    └─ CodePipeline
           ├─ CodeBuild  →  builds frontend → S3, packages backend → EB artifact
           └─ Elastic Beanstalk  →  runs FastAPI in Docker

CloudFront (single public domain)
    ├─ /api/*  →  Elastic Beanstalk (FastAPI)
    └─ /*      →  S3 (React static files)

RDS PostgreSQL  →  database
S3 bucket       →  evidence file uploads (future)
```

### Prerequisites

- AWS CLI installed and configured (`aws configure`)
- Node 20+ and Python 3.12+ for local builds

### 1. Create S3 buckets

**Frontend bucket** (static website hosting):
1. S3 → Create bucket → name it `r2ra-frontend-prod`
2. Block all public access: OFF (CloudFront serves it, not direct S3)
3. Versioning: off

**Evidence bucket** (file uploads — needed when evidence attachment is built):
1. Create bucket `r2ra-evidence-prod`
2. Block all public access: ON
3. Enable versioning: ON

### 2. Create RDS PostgreSQL

1. RDS → Create database → Standard create → PostgreSQL 16
2. Instance: `db.t4g.small` (~$25/mo)
3. DB identifier: `r2ra-prod`, Master username: `r2ra`
4. VPC: same VPC you'll use for Elastic Beanstalk
5. Public access: NO (EB connects over the VPC)
6. Note the endpoint — e.g. `r2ra-prod.xxxx.us-east-1.rds.amazonaws.com`

Connection string for the EB env var:
```
postgresql://r2ra:<password>@r2ra-prod.xxxx.us-east-1.rds.amazonaws.com:5432/r2ra
```

### 3. Create Elastic Beanstalk application

1. Elastic Beanstalk → Create application → name: `r2ra`
2. Create environment:
   - Tier: Web server
   - Platform: **Docker** (Amazon Linux 2023)
   - Application code: Sample application (pipeline handles real deploys)
3. Configure → Software → Environment properties — set:
   ```
   DATABASE_URL        = postgresql://r2ra:<password>@<rds-endpoint>:5432/r2ra
   SECRET_KEY          = <openssl rand -hex 32>
   S3_EVIDENCE_BUCKET  = r2ra-evidence-prod
   AWS_DEFAULT_REGION  = us-east-1
   DEBUG               = false
   ```
4. IAM instance profile needs:
   - `AWSElasticBeanstalkWebTier`
   - S3 policy scoped to `r2ra-evidence-prod/*`

### 4. Create CloudFront distribution

1. CloudFront → Create distribution
2. **Origin 1 — S3 (frontend)**:
   - Domain: `r2ra-frontend-prod.s3.us-east-1.amazonaws.com`
   - Access: Origin access control (OAC) — create OAC, apply generated bucket policy to S3
3. **Origin 2 — Elastic Beanstalk (API)**:
   - Domain: your EB environment URL (e.g. `r2ra-prod.us-east-1.elasticbeanstalk.com`)
   - Protocol: HTTP only
4. **Behaviors**:
   - `/api/*` → Origin 2, allowed methods ALL, cache policy: Disabled
   - Default `/*` → Origin 1, redirect HTTP to HTTPS
5. Note the CloudFront domain (`d123.cloudfront.net`) — this is your app URL

### 5. Set up CodePipeline

1. CodePipeline → Create pipeline
2. **Source**: GitHub (Version 2) → connect account → repo `R2RA` → branch `main`
3. **Build** → Create CodeBuild project:
   - Environment: Managed image, Amazon Linux 2023, `aws/codebuild/standard:7.0`
   - Environment variables:
     ```
     FRONTEND_BUCKET    = r2ra-frontend-prod
     CF_DISTRIBUTION_ID = <CloudFront distribution ID>
     ```
   - Buildspec: `buildspec.yml` (already in repo root)
   - Service role needs: S3 write to frontend bucket, CloudFront invalidation
4. **Deploy**: AWS Elastic Beanstalk → application `r2ra` → environment `r2ra-prod`

### Verifying

1. Push a commit to `main` — CodePipeline triggers automatically
2. Watch: Source → Build → Deploy in the console
3. `https://<cloudfront-domain>/` → R2RA login page
4. `https://<cloudfront-domain>/api/health` → `{"status": "ok"}`

### Environment variable reference

| Variable | Where | Example |
|---|---|---|
| `DATABASE_URL` | EB console | `postgresql://r2ra:pw@host:5432/r2ra` |
| `SECRET_KEY` | EB console | 64-char hex string |
| `S3_EVIDENCE_BUCKET` | EB console | `r2ra-evidence-prod` |
| `AWS_DEFAULT_REGION` | EB console | `us-east-1` |
| `DEBUG` | EB console | `false` |
| `FRONTEND_BUCKET` | CodeBuild project | `r2ra-frontend-prod` |
| `CF_DISTRIBUTION_ID` | CodeBuild project | `E1ABCD2EFGHIJ` |

### Custom domain (optional)

1. Request cert in ACM (us-east-1)
2. Add cert to CloudFront → Alternate domain names
3. Point DNS CNAME at the CloudFront domain

### Debrief AI pipeline (Amazon Transcribe + Claude on Bedrock)

> **Status: ENABLED and verified (2026-07-25).** The EB instance role
> `r2ra-eb-ec2-role` carries inline policy `r2ra-debrief-ai` (Transcribe +
> Bedrock invoke incl. `us.`/`global.` inference profiles + S3 RW on
> `r2ra-evidence-pilot`). `BEDROCK_MODEL_ID` is set in the EB console to
> `us.anthropic.claude-sonnet-4-6` — verified with a live invoke.
> Note: `anthropic.claude-opus-5` (the code default) is **gated for this
> account** ("not available for this account") — a self-service agreement
> offer exists (`aws bedrock list-foundation-model-agreement-offers
> --model-id anthropic.claude-opus-5` → `create-foundation-model-agreement`)
> if it's ever wanted; Sonnet-class is cheaper and sufficient for
> transcript distillation. The steps below remain as the from-scratch
> runbook.

The debrief recorder (M4, session 22) transcribes recorded team debriefs
with Amazon Transcribe and distills them with Claude on Amazon Bedrock.
Everything stays inside this AWS account — no outside AI APIs. One-time
enablement:

1. **Bedrock model access** — AWS console → Bedrock → Model access →
   enable the Anthropic Claude model matching `BEDROCK_MODEL_ID`
   (default `anthropic.claude-opus-5`). If your account/region exposes it
   only as an inference profile (e.g. `us.anthropic....`), set
   `BEDROCK_MODEL_ID` to that ID in the EB environment.
2. **IAM** — attach to the EB instance profile (`r2ra-eb-ec2-profile`):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["transcribe:StartTranscriptionJob", "transcribe:GetTranscriptionJob"],
         "Resource": "*"
       },
       {
         "Effect": "Allow",
         "Action": ["bedrock:InvokeModel"],
         "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.*"
       }
     ]
   }
   ```

   (S3 read/write on the app bucket is already granted for evidence
   storage; Transcribe stages its output in the same bucket under
   `debriefs/_transcripts/` and the app deletes it after reading.)
3. **Env vars** (EB console, all optional): `BEDROCK_MODEL_ID`,
   `TRANSCRIBE_LANGUAGE` (default `en-US`), `TRANSCRIBE_TIMEOUT_SEC`,
   `MAX_AUDIO_UPLOAD_BYTES`.
4. **Retention**: raw debrief audio is deleted automatically once
   distillation succeeds; transcripts and the distilled output remain in
   Postgres. Cost ≈ $1.44/hr of audio (Transcribe $0.024/min) plus a few
   cents of Bedrock inference per debrief.

Without S3 or these permissions the app degrades gracefully: recording
upload still works but processing returns 503 with a hint to use the
manual paste-a-transcript path, which only needs Bedrock.

---

## Path B — GovCloud EC2 pilot

**Classification:** CUI // BASIC  
**Environment:** AWS GovCloud (us-gov-west-1)  
**Target:** Single EC2 + RDS + S3 (pilot; scale later)

### Prerequisites

- AWS GovCloud account with IAM admin access
- SSH key pair uploaded to EC2
- Domain name (or EC2 Elastic IP for pilot)
- Docker and Docker Compose installed on your workstation

### AWS Infra — one-time setup

**S3 bucket:**
```bash
aws s3api create-bucket \
  --bucket r2ra-evidence-pilot \
  --region us-gov-west-1 \
  --create-bucket-configuration LocationConstraint=us-gov-west-1

aws s3api put-public-access-block \
  --bucket r2ra-evidence-pilot \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,\
    BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-bucket-encryption \
  --bucket r2ra-evidence-pilot \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

**IAM user (least privilege):**
```bash
aws iam create-user --user-name r2ra-app

aws iam put-user-policy \
  --user-name r2ra-app \
  --policy-name r2ra-s3 \
  --policy-document '{
    "Version":"2012-10-17",
    "Statement":[{
      "Effect":"Allow",
      "Action":["s3:PutObject","s3:GetObject","s3:DeleteObject"],
      "Resource":"arn:aws-us-gov:s3:::r2ra-evidence-pilot/*"
    }]
  }'

# Save output securely
aws iam create-access-key --user-name r2ra-app
```

**EC2 instance:**
- AMI: Amazon Linux 2023 or Ubuntu 22.04 LTS (GovCloud)
- Type: `t3.small` (2 vCPU / 2 GB — sufficient for pilot)
- Storage: 20 GB gp3
- Security group: 22 (SSH, your IP only), 443 (HTTPS), 80 (redirect)

```bash
# On the EC2 instance:
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user

sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
```

### TLS certificate

```bash
# Real domain:
sudo dnf install -y certbot
sudo certbot certonly --standalone -d your.domain.mil

# Self-signed for IP-only pilot:
sudo openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout /etc/ssl/r2ra.key \
  -out /etc/ssl/r2ra.crt \
  -subj "/CN=r2ra-pilot"
```

### Deploy

```bash
git clone <repo-url> /opt/r2ra
cd /opt/r2ra

cp .env.example .env
# Fill in SECRET_KEY, DATABASE_URL, AWS_* vars
nano .env

cd frontend && npm ci && npm run build && cd ..
docker compose -f deploy/docker-compose.prod.yml up -d --build
docker compose -f deploy/docker-compose.prod.yml exec api alembic upgrade head
```

### Ongoing operations

**Update:**
```bash
cd /opt/r2ra && git pull
cd frontend && npm ci && npm run build && cd ..
docker compose -f deploy/docker-compose.prod.yml up -d --build
docker compose -f deploy/docker-compose.prod.yml exec api alembic upgrade head
```

**Database backup:**
```bash
docker compose -f deploy/docker-compose.prod.yml exec db \
  pg_dump -U r2ra r2ra | gzip > /backups/r2ra_$(date +%Y%m%d).sql.gz
```

**Logs:**
```bash
docker compose -f deploy/docker-compose.prod.yml logs -f api
```

### Estimated monthly cost (us-gov-west-1 pilot)

| Resource | Size | Est. $/mo |
|---|---|---|
| EC2 t3.small | On-demand | ~$20 |
| EBS gp3 20 GB | — | ~$2 |
| RDS t3.micro (optional) | — | ~$25 |
| S3 | <1 GB pilot | <$1 |
| **Total** | | **~$25–50** |
