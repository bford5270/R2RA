# R2RA — AWS Cost Optimization Runbook

> **Status: APPLIED 2026-07-25** (via AWS API from a Claude Code session).
> What was done, verified against the live account:
>
> - **`r2ra-prod` → single-instance** (classic ELB deleted) **+ t4g.micro**
>   (arm64). Env Green; CNAME re-pointed to the new instance; CloudFront
>   origin unchanged.
> - **`role2-builder-prod` → t4g.micro** (was already single-instance;
>   EIP re-attached). Env Green.
> - **RDS `r2ra-postgres` → db.t4g.micro + gp3** (was db.t3.micro/gp2).
>   Fully operational; background storage-optimization phase is normal.
> - **Found & STOPPED an orphaned `t3.small`** (`i-02d4f9ed565eef469`,
>   launched 2026-04-28, key `r2ra-key`, no tags, nothing in DNS points
>   at it — the pre-EB manual pilot box, ~$19/mo). Stopped, not
>   terminated: **terminate it + delete its 20 GB volume** once confirmed
>   nothing on it is needed.
> - **S3 lifecycle**: artifacts bucket 90-day expiry; frontend bucket
>   30-day noncurrent-version expiry; EB app versions capped at 10 for
>   both applications.
> - **AWS Budget** `r2ra-monthly`: $40/mo, email alerts at 80% actual /
>   100% forecast.
> - Verified already-clean: **no NAT gateways**, no idle EIPs, both
>   CodePipelines **already V2**, RDS Enhanced Monitoring off.
> - Not done (needs owner decision): RDS/EC2 reserved instances
>   (see Change 3 — gated on the GovCloud question).
>
> Estimated bill after: **~$34/mo** (was ~$55–75 including the orphan).

Companion to `docs/DEPLOY.md`. Goal: cut the monthly AWS bill roughly in
half **without reducing capability** — same app, same URL, same CI/CD,
same database, same CUI posture. Every change below is capability-neutral
for the current pilot scale (single t3.micro instance, low traffic);
the two soft tradeoffs are called out explicitly where they exist.

All resource IDs refer to the live inventory in `docs/DEPLOY.md`
(us-east-1, account `885232248320`).

---

## Where the money goes today (estimated)

| Item | Est. $/mo | Notes |
|---|---|---|
| **Application Load Balancer (r2ra-prod)** | ~$16.40 base + ~$4–8 IPv4/LCU | EB env was created "load balanced" (Session 16). The ALB costs **more than the t3.micro it fronts** and adds nothing at 1 instance. |
| ALB on role2-builder EB env (if load balanced) | ~$16–24 | Verify — same fix applies. |
| EC2 t3.micro (r2ra-prod) | ~$7.60 + $3.65 public IPv4 | |
| EC2 t3.micro (role2-builder) | ~$7.60 + $3.65 | |
| RDS db.t3.micro + 20 GB | ~$12.40 + $2.30 | |
| CodePipeline ×2 (V1) | ~$1 | First active V1 pipeline is free-tier; second is $1/mo. |
| Route 53 ×2 zones | $1 | Needed for the two domains — keep. |
| S3 / CloudFront / CodeBuild / data | ~$2–4 | Small, but artifacts grow forever without lifecycle rules. |
| **Total** | **~$60–85/mo** (both ALBs) / ~$45–55 (one ALB) | |

> **If the bill currently looks near $0:** the account may still be
> inside the AWS free tier. The changes below are still worth making now
> — they determine what the bill becomes when the free tier lapses.

Target after this runbook: **~$30–37/mo** with no capability change.

---

## Change 1 — Switch Elastic Beanstalk to single-instance (biggest win, ~$20–45/mo)

The ALB is pure overhead at one instance: CloudFront is already the
public entry point, TLS terminates at CloudFront, and the CloudFront
`/api/*` origin talks plain HTTP to the EB CNAME either way. Single-instance
EB keeps the same environment, same CNAME, same deploys, same env vars —
EB just points the CNAME at the instance's public IP instead of an ALB.

**Console:** Elastic Beanstalk → `r2ra-prod` → Configuration → *Instance
traffic and scaling* (Capacity) → Environment type: **Single instance** →
Apply.

**CLI equivalent:**

```bash
aws elasticbeanstalk update-environment \
  --environment-name r2ra-prod \
  --option-settings \
    Namespace=aws:elasticbeanstalk:environment,OptionName=EnvironmentType,Value=SingleInstance
```

Then repeat for the **role2-builder** EB environment if it is also
load balanced.

**Verify after the switch:**

1. Environment health returns to Green (the switch replaces the instance
   — expect a few minutes of API downtime while it happens; do it
   off-hours).
2. `https://d2si4nfgz87czj.cloudfront.net/api/health` → `{"status":"ok"}`.
   No CloudFront change is needed — the origin is the EB CNAME, which EB
   re-points automatically.
3. Security group on the instance allows inbound 80 from anywhere
   (EB sets this up; CloudFront connects over the public internet).

**The one real tradeoff:** deploys and platform updates cause a ~1–3
minute API blip instead of a rolling handoff (the SPA itself stays up —
it's served from S3/CloudFront). At pilot scale with a single instance
there was never real high-availability anyway; the ALB was not buying
redundancy, only a second hop. If HA is ever actually needed (2+
instances, multi-AZ), flip the environment type back — it's the same
one-setting change.

---

## Change 2 — Graviton instances (t4g), ~$3–4/mo

`t4g.micro` is ~20% cheaper than `t3.micro` with the same (slightly
better) performance. The stack is architecture-clean: `python:3.12-slim`
is multi-arch, and every backend dependency (FastAPI, uvicorn,
psycopg2-binary, boto3) ships aarch64 wheels. The Docker image is built
on the instance at deploy time, so nothing in `buildspec.yml` changes.

- **EB:** Configuration → Capacity → Instance types: `t4g.micro` → Apply.
  EB selects the matching arm64 AMI for the Docker/AL2023 platform. Watch
  the first deploy; if anything fails to build, switch back the same way.
- **RDS:** Modify `r2ra-postgres` → instance class `db.t4g.micro` → apply
  off-hours (brief restart, a few minutes).

---

## Change 3 — RDS reserved instance (~$4/mo) — **decision required first**

A 1-year no-upfront reserved instance for `db.t4g.micro` cuts the
instance cost ~30–35% (≈ $12.40 → ≈ $8).

**Do NOT buy this yet if the Phase 3 GovCloud migration is likely within
the year** — reservations are region- and class-locked, and a move to
us-gov-west-1 would strand it. Buy it only once the hosting-enclave
decision (DEVLOG "Blocked on") lands on staying in us-east-1, or if the
GovCloud decision is more than ~a year out.

Console: RDS → Reserved instances → Purchase → PostgreSQL,
`db.t4g.micro`, 1 year, No upfront.

---

## Change 4 — Stop paying for storage that only grows

None of this is visible cost today, but all three grow monotonically:

1. **CodePipeline artifacts bucket** (`r2ra-artifacts-885232248320`):
   every push stores a full source + build artifact forever. Add a
   lifecycle rule: expire objects after 90 days.

   ```bash
   aws s3api put-bucket-lifecycle-configuration \
     --bucket r2ra-artifacts-885232248320 \
     --lifecycle-configuration '{"Rules":[{"ID":"expire-artifacts","Status":"Enabled","Filter":{},"Expiration":{"Days":90},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":7}}]}'
   ```

2. **Frontend bucket** (`r2ra-frontend-885232248320`) has versioning ON,
   and every deploy runs `aws s3 sync --delete` — so every old asset
   lives on as a noncurrent version forever. Add: expire **noncurrent**
   versions after 30 days (current versions untouched).

   ```bash
   aws s3api put-bucket-lifecycle-configuration \
     --bucket r2ra-frontend-885232248320 \
     --lifecycle-configuration '{"Rules":[{"ID":"expire-old-versions","Status":"Enabled","Filter":{},"NoncurrentVersionExpiration":{"NoncurrentDays":30}}]}'
   ```

3. **EB application versions** accumulate in EB's own
   `elasticbeanstalk-us-east-1-*` bucket. Cap them at the last 10:

   ```bash
   aws elasticbeanstalk update-application-resource-lifecycle \
     --application-name r2ra \
     --resource-lifecycle-config '{"ServiceRole":"arn:aws:iam::885232248320:role/aws-elasticbeanstalk-service-role","VersionLifecycleConfig":{"MaxCountRule":{"Enabled":true,"MaxCount":10,"DeleteSourceFromS3":true}}}'
   ```

   (Repeat for the role2-builder EB application.)

---

## Change 5 — CodePipeline V1 → V2 (~$1/mo)

V1 pipelines cost $1/month each while active (the free tier covers one).
V2 pipelines have no monthly charge — you pay $0.002 per action-minute
after 100 free minutes/month, which at a few deploys a month rounds to
zero. Both pipelines can be upgraded in place:

Console: CodePipeline → `r2ra` → Edit → Pipeline settings → Pipeline
type: **V2** → Save. Repeat for the role2-builder pipeline. No stage or
buildspec changes needed.

---

## Cheap one-time checks (5 minutes in the console)

- **NAT gateway** — the single most expensive thing that could be
  lurking (~$32/mo + data). EB in the default VPC with public subnets
  should not have one. Verify:
  `aws ec2 describe-nat-gateways --filter Name=state,Values=available`
  → expect an empty list. If one exists and nothing private needs
  egress, delete it.
- **Unattached Elastic IPs** — every public IPv4 now bills ~$3.65/mo,
  attached or not. EC2 → Elastic IPs → release any not in use.
- **RDS storage type** — if the 20 GB volume is gp2, modify to gp3
  (same price, better baseline performance; no downside).
- **RDS backup retention** — 7 days is plenty for the pilot; backup
  storage beyond the free allotment (= DB size) bills per GB.
- **CloudWatch** — confirm RDS *Enhanced Monitoring* is off (it has a
  per-instance cost; standard metrics + free-tier Performance Insights
  are enough) and EB log streaming to CloudWatch is off unless being
  actively used.
- **Budget alarm** — AWS Budgets → create a monthly cost budget
  (e.g. $40) with an email alert at 80% and 100%. Effectively free, and
  it converts "surprise bill" into an email. Also worth checking
  Billing → Free Tier to see what's still covered and when it expires.
- **Debrief AI model** — `BEDROCK_MODEL_ID` defaults to Claude Opus.
  This is pay-per-use and small, but if debrief volume grows, setting it
  to a Sonnet-class model cuts inference cost ~5× — transcript
  distillation is well within a smaller model's capability.

---

## What NOT to do (these would reduce capability)

- **Don't drop RDS for SQLite-on-instance.** Single-instance EB replaces
  the instance on every platform update — the database must live off-box.
- **Don't stop/pause the environment or database on a schedule.** The
  app is field-facing; unpredictable availability costs more than $12/mo.
- **Don't move the API off AWS to a cheaper host.** The
  everything-in-one-account posture (S3 evidence, Transcribe, Bedrock,
  IAM-scoped access, GovCloud path) is a CUI/security decision, not an
  accident.
- **Don't consolidate R2RA and role2-builder onto one instance.** A
  t4g.micro per app is ~$6/mo; coupling two apps' deploy and failure
  domains isn't worth $6.

---

## Path to a $10–15/mo target — **EXECUTED 2026-07-25**

All three steps were applied the same day (user approved):

1. **Consolidation** — role2-builder's API now runs as a second Docker
   Compose service on the r2ra instance (`deploy/docker-compose.eb.yml`;
   80→r2ra, 8080→role2-builder). Its pipeline no longer deploys to EB —
   its Publish stage uploads the built bundle to
   `s3://r2ra-artifacts-885232248320/role2-builder/latest.zip`, which the
   r2ra build pulls in. `api.role2builder.org` CloudFront origin now
   points at the r2ra EB CNAME port 8080. `role2-builder-prod` EB env
   terminated (instance + EIP released). **Note:** a role2-builder repo
   push now needs its pipeline run *and then* an r2ra pipeline run to
   reach production.
2. **Aurora Serverless v2** — cluster `r2ra-aurora` (PG 16.13, 0–2 ACU,
   auto-pause 300 s) created as a live replica of `r2ra-postgres`,
   promoted, data verified via RDS Data API (users/assessments/responses
   counts + alembic head `m3n4o5p6q7r8`), EB `DATABASE_URL` repointed,
   externally verified 200 on `/api/health`. Old instance deleted behind
   final snapshot `r2ra-postgres-final-20260725`. First request after
   ≥5 min idle waits ~15 s for DB resume (accepted tradeoff).
   Data API is enabled; master creds for it live in Secrets Manager
   (`r2ra-aurora-master`, ~$0.40/mo) — handy for ops queries without
   VPC access.
3. **1-yr commitment** — EC2 Instance Savings Plan
   `c0cea13e-bcc5-4330-b7fb-34436e84cd94`, t4g family us-east-1,
   No Upfront, $0.0053/hr commitment (exactly one t4g.micro), ends
   2027-07-25. (Direct RI purchase was quota-blocked; Savings Plan has
   identical economics.)

**Resulting bill (steady state): ~$12–15/mo**
(t4g.micro via SP $3.87 + 1 IPv4 $3.65 + EBS ~$0.60 + Aurora storage/IO
~$1–2 + ACU-hours while in use ~$1–4 + Route 53 $1 + S3/CF/secrets ~$1.)
Budget alert lowered to $25/mo.

Deferred cleanup (another ~$3.5/mo when done): terminate the stopped
`t3.small` + its 20 GB volume; delete snapshot
`r2ra-postgres-final-20260725` once Aurora has a few weeks of history.
The artifacts-bucket lifecycle was re-scoped to prefixes `r2ra/` and
`role2-builder/BuildOutpu` so it can never expire the load-bearing
`role2-builder/latest.zip`.

---

## Regression — Aurora never paused (found & fixed 2026-08-05)

The $10–15 target above assumed Aurora scale-to-zero. It never happened.
August 1–5 billed **$8.32 (~$50/mo run rate)**; Cost Explorer showed
`Aurora:ServerlessV2Usage` at a flat **12 ACU-hours/day** ($1.44/day,
~$44/mo) every day since 2026-07-29.

**Cause.** Auto-pause requires *zero* client connections, and a pooled
connection counts even when idle. `backend/app/database.py` called
`create_engine()` with no pool arguments → SQLAlchemy's default
`QueuePool` (`pool_size=5`, no idle reaper). `pg_stat_activity` showed
five `r2ra` connections from `172.31.5.170` (the EB instance), opened
2026-07-28 17:19 and idle **7½ days** — never released. The cluster was
therefore pinned at its 0.5-ACU floor 24/7. Config was never the
problem: `MinCapacity=0.0`, `MaxCapacity=2.0`,
`SecondsUntilAutoPause=300` were all correct.

**Why it surfaced on Aug 1, not Jul 29.** AWS credits (−$5.06) absorbed
the late-July usage. They ran out; August is the first fully-billed
month.

**Fix.** `poolclass=NullPool` for Postgres (SQLite dev keeps its driver
default), plus `connect_timeout` sized above the ~15 s resume. Verified:
with the old pool a connection stays open after requests complete; with
NullPool zero remain, which is the precondition for pause.

Pooling costs nothing here — intra-VPC connect is single-digit ms at
pilot traffic (~20 users over a few days), and a pause terminates
server-side connections anyway, so a retained pool would serve dead
connections without `pool_pre_ping`.

**Verify after deploy** — `ServerlessDatabaseCapacity` should reach 0
within ~5 min of the last request:

```bash
aws cloudwatch get-metric-statistics --namespace AWS/RDS \
  --metric-name ServerlessDatabaseCapacity \
  --dimensions Name=DBClusterIdentifier,Value=r2ra-aurora \
  --start-time 2026-08-05T00:00:00Z --end-time 2026-08-06T00:00:00Z \
  --period 3600 --statistics Average Minimum
```

**Operational notes.** The first request after ≥5 min idle now waits
~15 s for resume — real and repeated at sparse usage, so pre-warm before
a scheduled session (one DB-touching request, or set `MinCapacity=0.5`
for the day). Raising `MaxCapacity` above 2 is free: billing is on
ACU-hours consumed, not on the ceiling.

Still outstanding from the July deferred list (~$2.50/mo): stopped
`t3.small` `i-02d4f9ed565eef469` and its volume `vol-020b4c7892935dc6c`
(20 GB gp3), plus snapshot `r2ra-postgres-final-20260725`.

---

## Expected bill after all changes

| Item | Est. $/mo |
|---|---|
| EC2 t4g.micro ×2 + public IPv4 ×2 | ~$19.60 |
| RDS db.t4g.micro (+RI if bought) + 20 GB gp3 | ~$14 (≈$10 with RI) |
| Route 53 ×2 | $1 |
| S3 / CloudFront / CodeBuild / pipelines | ~$2 |
| **Total** | **~$33–37/mo** (vs ~$60–85 before) |
