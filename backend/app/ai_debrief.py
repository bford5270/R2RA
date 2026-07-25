"""
Debrief AI pipeline: Amazon Transcribe (speech-to-text) + Claude on Amazon
Bedrock (distillation). Everything stays inside the deployment's AWS account
boundary — no outside AI APIs — per the project's CUI posture.

Requires (production):
  - S3 bucket configured (audio + transcript staging)
  - IAM: transcribe:StartTranscriptionJob / GetTranscriptionJob,
         bedrock:InvokeModel (on the configured model), S3 rw on the bucket
  - Bedrock model access enabled for the configured model in the AWS console

When S3/Bedrock aren't configured (dev), is_transcription_available() /
is_distillation_available() return False and the API degrades gracefully:
manual transcript paste still works, and distillation errors are surfaced.
"""
from __future__ import annotations

import json
import time

from app.config import settings

# Distillation output schema — Claude fills this from the transcript.
DISTILL_SCHEMA = {
    "type": "object",
    "properties": {
        "sustains": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "event_codes": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["text", "event_codes"],
                "additionalProperties": False,
            },
        },
        "improves": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "event_codes": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["text", "event_codes"],
                "additionalProperties": False,
            },
        },
        "next_time": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "event_codes": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["text", "event_codes"],
                "additionalProperties": False,
            },
        },
        "summary": {"type": "string"},
    },
    "required": ["sustains", "improves", "next_time", "summary"],
    "additionalProperties": False,
}

_DISTILL_SYSTEM = """You are distilling a recorded after-action debrief from a
military Role 2 medical training exercise (USMC/Navy HSS). The transcript is a
team conversation reviewing how training events went.

Extract, in the team's own substance (not verbatim quotes):
- sustains: what went well and should be repeated
- improves: opportunities for growth — deficiencies, friction points, gaps
- next_time: concrete actions or changes for the next exercise iteration

Each item is one clear, complete sentence a training officer can act on.
Attribute nothing to named individuals — describe the team or role (e.g.
"the triage team"), never a person's name or rank+name. If a point clearly
relates to a specific T&R event code mentioned in the conversation or the
provided wicket list, include the code(s) in event_codes; otherwise leave it
empty. Do not invent event codes. Finish with a 2-3 sentence summary of the
debrief's overall tone and top priority."""


def is_transcription_available() -> bool:
    return bool(settings.aws_s3_bucket or settings.s3_evidence_bucket)


def is_distillation_available() -> bool:
    # Bedrock uses the same AWS credentials chain; the model id is always set.
    return bool(settings.bedrock_model_id)


def _bucket() -> str:
    return settings.aws_s3_bucket or settings.s3_evidence_bucket


def transcribe_audio(blob_ref: str, media_format: str, job_name: str) -> str:
    """
    Run an Amazon Transcribe job on s3://{bucket}/{blob_ref}; return the
    transcript text. Blocks (polls) until the job finishes — call from a
    background thread. Cleans up the transcript staging object.
    """
    import boto3  # lazy — prod-only dependency

    bucket = _bucket()
    if not bucket:
        raise RuntimeError("Transcription requires S3 (AWS_S3_BUCKET) to be configured")

    region = settings.aws_region
    transcribe = boto3.client("transcribe", region_name=region)
    s3 = boto3.client("s3", region_name=region)

    output_key = f"debriefs/_transcripts/{job_name}.json"
    transcribe.start_transcription_job(
        TranscriptionJobName=job_name,
        Media={"MediaFileUri": f"s3://{bucket}/{blob_ref}"},
        MediaFormat=media_format,
        LanguageCode=settings.transcribe_language,
        OutputBucketName=bucket,
        OutputKey=output_key,
    )

    deadline = time.monotonic() + settings.transcribe_timeout_sec
    while True:
        job = transcribe.get_transcription_job(TranscriptionJobName=job_name)
        status = job["TranscriptionJob"]["TranscriptionJobStatus"]
        if status == "COMPLETED":
            break
        if status == "FAILED":
            reason = job["TranscriptionJob"].get("FailureReason", "unknown")
            raise RuntimeError(f"Transcription failed: {reason}")
        if time.monotonic() > deadline:
            raise RuntimeError("Transcription timed out")
        time.sleep(10)

    obj = s3.get_object(Bucket=bucket, Key=output_key)
    payload = json.loads(obj["Body"].read())
    transcript = payload["results"]["transcripts"][0]["transcript"]
    # Clean up staging output; audio deletion is handled by the caller.
    try:
        s3.delete_object(Bucket=bucket, Key=output_key)
    except Exception:
        pass
    return transcript


def distill_transcript(transcript: str, wicket_context: str) -> dict:
    """
    Distill a debrief transcript into structured sustains / improves /
    next-time actions using Claude on Amazon Bedrock (Mantle client, uses the
    instance's AWS credential chain).
    """
    from anthropic import AnthropicBedrockMantle  # lazy — prod-only dependency

    client = AnthropicBedrockMantle(aws_region=settings.aws_region)
    response = client.messages.create(
        model=settings.bedrock_model_id,
        max_tokens=8000,
        system=_DISTILL_SYSTEM,
        output_config={"format": {"type": "json_schema", "schema": DISTILL_SCHEMA}},
        messages=[
            {
                "role": "user",
                "content": (
                    "T&R wickets evaluated in this exercise (code — title):\n"
                    f"{wicket_context}\n\n"
                    "Debrief transcript:\n"
                    f"{transcript}"
                ),
            }
        ],
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("Distillation was declined by the model's safety system")
    text = next(b.text for b in response.content if b.type == "text")
    return json.loads(text)
