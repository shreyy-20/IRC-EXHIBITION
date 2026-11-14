from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://irc_user:change_this_local_password@localhost:5432/irc_finder"
    cors_origins: str = "http://localhost:5173"
    jwt_secret_key: str = "development-only-change-before-deployment"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

settings = Settings()
