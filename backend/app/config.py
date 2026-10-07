"""Runtime configuration from environment variables."""

import os
from dataclasses import dataclass, field
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent.parent


def _env(name: str) -> str | None:
    value = os.environ.get(name, "").strip()
    return value or None


@dataclass
class Settings:
    copilot_token: str | None = field(
        default_factory=lambda: _env("COPILOT_GITHUB_TOKEN") or _env("GH_TOKEN") or _env("GITHUB_TOKEN")
    )
    # Local development reuses the signed-in Copilot CLI user; containers should pass a token.
    copilot_use_logged_in_user: bool = field(
        default_factory=lambda: (_env("COPILOT_USE_LOGGED_IN_USER") or "true").lower() == "true"
    )
    copilot_model: str | None = field(default_factory=lambda: _env("COPILOT_MODEL"))
    agent_timeout_seconds: float = field(default_factory=lambda: float(_env("AGENT_TIMEOUT_SECONDS") or 80))
    static_dir: Path = field(default_factory=lambda: Path(_env("STATIC_DIR")) if _env("STATIC_DIR") else _ROOT / "dist")

    @property
    def copilot_auth_mode(self) -> str:
        if self.copilot_token:
            return "token"
        if self.copilot_use_logged_in_user:
            return "logged-in-user"
        return "not-configured"


settings = Settings()
