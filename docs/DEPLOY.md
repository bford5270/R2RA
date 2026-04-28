# R2RA Deployment Runbook — AWS GovCloud Pilot

**Classification:** CUI // BASIC  
**Environment:** AWS GovCloud (us-gov-west-1)  
**Target:** Single EC2 + RDS + S3 (pilot; scale later)

---

## 1. Pre-requisites

- AWS GovCloud account with IAM admin access
- SSH key pair uploaded to EC2
- Domain name (or EC2 Elastic IP for pilot)
- Docker and Docker Compose installed on your workstation

---

## 2. AWS Infra — one-time setup

### S3 bucket

```bash
aws s3api create-bucket \
  --bucket r2ra-evidence-pilot \
  --region us-gov-west-1 \
  --create-bucket-configuration LocationConstraint=us-gov-west-1

# Block all public access
aws s3api put-public-access-block \
  --bucket r2ra-evidence-pilot \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,\
    BlockPublicPolicy=true,RestrictPublicBuckets=true

# Enable default encryption (AES-256 — app also sets per-object)
aws s3api put-bucket-encryption \
  --bucket r2ra-evidence-pilot \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

### IAM user for the app (least privilege)

```bash
# Create user
aws iam create-user --user-name r2ra-app

# Inline policy — only allows PutObject/GetObject/DeleteObject on the bucket
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

# Create access key — save output securely
aws iam create-access-key --user-name r2ra-app
```

### EC2 instance

- AMI: Amazon Linux 2023 or Ubuntu 22.04 LTS (GovCloud region)
- Instance type: `t3.small` (2 vCPU / 2 GB — sufficient for pilot)
- Storage: 20 GB gp3 root volume
- Security group: allow 22 (SSH, restrict to your IP), 443 (HTTPS), 80 (HTTP redirect)

```bash
# On the EC2 instance after SSH in:
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user

# Install Docker Compose plugin
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
```

### RDS (optional — can use containerized Postgres for pilot)

For pilot the `db` container in docker-compose is sufficient. Migrate to RDS
managed Postgres before any production data volume.

---

## 3. TLS certificate

For a real domain:
```bash
sudo dnf install -y certbot
sudo certbot certonly --standalone -d your.domain.mil
# Update deploy/nginx.conf ssl_certificate paths to match
```

For pilot with IP only (self-signed — accept the browser warning):
```bash
sudo openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout /etc/letsencrypt/live/r2ra/privkey.pem \
  -out /etc/letsencrypt/live/r2ra/fullchain.pem \
  -subj "/CN=r2ra-pilot"
sudo mkdir -p /etc/letsencrypt/live/r2ra
```

---

## 4. Deploy

```bash
# Clone repo onto server
git clone <repo-url> /opt/r2ra
cd /opt/r2ra

# Create .env from example
cp .env.example .env
# Edit .env — fill in SECRET_KEY, POSTGRES_PASSWORD, AWS_* vars
nano .env

# Build frontend
cd frontend && npm ci && npm run build && cd ..

# Build + start containers
cd deploy
docker compose -f docker-compose.prod.yml up -d --build

# Run migrations
docker compose -f docker-compose.prod.yml exec api alembic upgrade head

# Create first admin user (interactive)
docker compose -f docker-compose.prod.yml exec api python -m app.scripts.create_user
```

---

## 5. First-time database seed

```bash
# Load content into DB (if applicable)
docker compose -f docker-compose.prod.yml exec api \
  python -c "from app.scripts.seed import run; run()"
```

---

## 6. Ongoing operations

### Update to new release

```bash
cd /opt/r2ra
git pull
cd frontend && npm ci && npm run build && cd ..
cd deploy
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
```

### Database backup

```bash
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U r2ra r2ra | gzip > /backups/r2ra_$(date +%Y%m%d).sql.gz
```

### View logs

```bash
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f nginx
```

---

## 7. Estimated monthly cost (us-gov-west-1 pilot)

| Resource | Size | Est. $/mo |
|---|---|---|
| EC2 t3.small | On-demand | ~$20 |
| EBS gp3 20 GB | — | ~$2 |
| RDS t3.micro (optional) | — | ~$25 |
| S3 storage + requests | <1 GB pilot | <$1 |
| Data transfer | Minimal | <$5 |
| **Total** | | **~$25–50** |

---

## 8. Environment variables reference

See `.env.example` for full list with descriptions.

Critical production values to set:
- `SECRET_KEY` — generate with `openssl rand -hex 32`
- `POSTGRES_PASSWORD` — strong random password
- `AWS_S3_BUCKET` — your bucket name (activates S3 mode)
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — from IAM user created above
