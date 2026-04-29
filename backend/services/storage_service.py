"""
Storage Service — abstraction over MinIO (default) and AWS S3.

Provides: upload, download, presigned URL generation, delete, list.
"""

from __future__ import annotations

import io
import uuid
from functools import lru_cache
from typing import BinaryIO, Optional

from config import get_settings

settings = get_settings()


class StorageService:
    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is not None:
            return self._client

        if settings.storage_backend == "s3":
            import boto3
            self._client = boto3.client(
                "s3",
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key,
                region_name=settings.aws_region,
            )
            self._bucket = settings.aws_s3_bucket
        else:
            from minio import Minio
            self._client = Minio(
                settings.minio_endpoint,
                access_key=settings.minio_access_key,
                secret_key=settings.minio_secret_key,
                secure=settings.minio_secure,
            )
            self._bucket = settings.minio_bucket
            self._ensure_bucket()

        return self._client

    def _ensure_bucket(self):
        client = self._client
        if not client.bucket_exists(self._bucket):
            client.make_bucket(self._bucket)

    def _key_for(self, category: str, filename: str) -> str:
        uid = uuid.uuid4().hex[:8]
        safe_name = filename.replace(" ", "_")
        return f"{category}/{uid}_{safe_name}"

    def upload_file(
        self,
        file_data: BinaryIO,
        filename: str,
        category: str = "documents",
        content_type: str = "application/octet-stream",
        size: Optional[int] = None,
    ) -> str:
        """Upload file-like object; returns the storage key."""
        client = self._get_client()
        key = self._key_for(category, filename)

        if settings.storage_backend == "s3":
            extra = {"ContentType": content_type}
            client.upload_fileobj(file_data, self._bucket, key, ExtraArgs=extra)
        else:
            data = file_data.read() if size is None else file_data
            if isinstance(data, bytes):
                size = len(data)
                file_data = io.BytesIO(data)
            else:
                file_data = data
                size = size or -1

            client.put_object(
                self._bucket, key, file_data, size,
                content_type=content_type,
            )

        return key

    def download_file(self, key: str) -> bytes:
        """Download file content as bytes."""
        client = self._get_client()

        if settings.storage_backend == "s3":
            obj = client.get_object(Bucket=self._bucket, Key=key)
            return obj["Body"].read()
        else:
            response = client.get_object(self._bucket, key)
            return response.read()

    def get_presigned_url(self, key: str, expires_seconds: int = 3600) -> str:
        """Generate a presigned download URL."""
        client = self._get_client()

        if settings.storage_backend == "s3":
            url = client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self._bucket, "Key": key},
                ExpiresIn=expires_seconds,
            )
            return url
        else:
            from datetime import timedelta
            url = client.presigned_get_object(
                self._bucket, key,
                expires=timedelta(seconds=expires_seconds),
            )
            return url

    def delete_file(self, key: str) -> None:
        """Delete a file by its storage key."""
        client = self._get_client()

        if settings.storage_backend == "s3":
            client.delete_object(Bucket=self._bucket, Key=key)
        else:
            client.remove_object(self._bucket, key)

    def list_files(self, prefix: str = "") -> list[dict]:
        """List files in the bucket with optional prefix."""
        client = self._get_client()
        results = []

        if settings.storage_backend == "s3":
            paginator = client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=self._bucket, Prefix=prefix):
                for obj in page.get("Contents", []):
                    results.append({
                        "key": obj["Key"],
                        "size": obj["Size"],
                        "last_modified": obj["LastModified"].isoformat(),
                    })
        else:
            objects = client.list_objects(self._bucket, prefix=prefix, recursive=True)
            for obj in objects:
                results.append({
                    "key": obj.object_name,
                    "size": obj.size,
                    "last_modified": obj.last_modified.isoformat(),
                })

        return results


@lru_cache(maxsize=1)
def get_storage_service() -> StorageService:
    return StorageService()
