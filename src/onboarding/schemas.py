"""Pydantic request/response schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CheckIn(BaseModel):
    item_key: str = Field(min_length=1, max_length=64)
    checked: bool


class ItemNoteIn(BaseModel):
    body: str = Field(default="", max_length=20000)
    height: int = Field(default=0, ge=0, le=2000)


class ItemNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    item_key: str
    body: str
    height: int
    created_at: datetime
    updated_at: datetime


class FreeNoteIn(BaseModel):
    title: str = Field(default="", max_length=200)
    body: str = Field(default="", max_length=20000)
    height: int = Field(default=0, ge=0, le=2000)


class FreeNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    phase_id: str
    title: str
    body: str
    height: int
    position: int
    created_at: datetime
    updated_at: datetime


class LinkIn(BaseModel):
    label: str = Field(default="", max_length=200)
    url: str = Field(min_length=1, max_length=2000)

    @field_validator("url")
    @classmethod
    def _require_http(cls, v: str) -> str:
        v = v.strip()
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("URL skal starte med http:// eller https://")
        return v


class LinkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    phase_id: str
    label: str
    url: str
    created_at: datetime
