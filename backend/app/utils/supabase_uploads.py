"""
Supabase Storage sync for serverless (e.g. Vercel): each invocation may run on a
different instance, so /tmp and in-memory maps are not shared. Uploading a copy
to Supabase lets any instance resolve a fileId.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

# Create this bucket in Supabase (private is fine; server uses service role).
BUCKET = "excel-uploads"


def is_remote_storage_configured() -> bool:
    return bool(
        os.getenv("VERCEL")
        and os.getenv("SUPABASE_URL")
        and os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )


def _base_and_headers() -> Optional[Tuple[str, dict]]:
    url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    headers = {
        "Authorization": f"Bearer {key}",
        "apikey": key,
    }
    return url, headers


def upload_session_file(file_id: str, filename: str, ext: str, content: bytes) -> None:
    """Persist upload to Supabase Storage (meta + binary)."""
    if not is_remote_storage_configured():
        return
    bh = _base_and_headers()
    if not bh:
        return
    base, headers = bh
    meta = json.dumps({"filename": filename, "ext": ext}).encode("utf-8")
    uploads: list[tuple[str, bytes, str]] = [
        (f"{file_id}.meta.json", meta, "application/json"),
        (f"{file_id}{ext}", content, "application/octet-stream"),
    ]
    for path, body, ctype in uploads:
        h = {**headers, "Content-Type": ctype, "x-upsert": "true"}
        r = httpx.post(
            f"{base}/storage/v1/object/{BUCKET}/{path}",
            headers=h,
            content=body,
            timeout=120.0,
        )
        if r.status_code not in (200, 201):
            logger.error(
                "Supabase upload failed %s: %s %s",
                path,
                r.status_code,
                r.text[:500],
            )
            raise RuntimeError(f"Supabase upload failed for {path}: {r.status_code}")


def try_hydrate_upload_from_remote(
    file_id: str,
    upload_dir: Path,
) -> Optional[Tuple[Path, str, str]]:
    """
    Download meta + file bytes from Supabase into upload_dir.
    Returns (local_path, original_filename, ext) or None.
    """
    if not is_remote_storage_configured():
        return None
    bh = _base_and_headers()
    if not bh:
        return None
    base, headers = bh
    try:
        r = httpx.get(
            f"{base}/storage/v1/object/{BUCKET}/{file_id}.meta.json",
            headers=headers,
            timeout=60.0,
        )
        if r.status_code != 200:
            return None
        meta = json.loads(r.text)
        ext = meta.get("ext") or ".xlsx"
        if ext not in (".xlsx", ".csv"):
            ext = ".xlsx"
        filename = meta.get("filename") or f"{file_id}{ext}"
    except Exception as e:
        logger.info("Remote meta not available for %s: %s", file_id, e)
        return None

    try:
        r2 = httpx.get(
            f"{base}/storage/v1/object/{BUCKET}/{file_id}{ext}",
            headers=headers,
            timeout=120.0,
        )
        if r2.status_code != 200:
            return None
        content = r2.content
    except Exception as e:
        logger.warning("Remote file download failed for %s: %s", file_id, e)
        return None

    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / f"{file_id}{ext}"
    file_path.write_bytes(content)
    return (file_path, filename, ext)
