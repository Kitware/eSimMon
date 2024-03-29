from typing import List
from typing import Literal
from typing import Union

from pydantic import AnyHttpUrl
from pydantic import BaseSettings
from pydantic import validator


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    SERVER_NAME: str
    SERVER_HOST: AnyHttpUrl
    # CORS_ORIGINS is a JSON-formatted list of origins
    # e.g: '["http://localhost", "http://localhost:4200", "http://localhost:3000", \
    # "http://localhost:8080", "http://local.dockertoolbox.tiangolo.com"]'
    CORS_ORIGINS: List[Union[AnyHttpUrl, Literal["*"]]] = []

    @validator("CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    PROJECT_NAME: str
    GIRDER_API_URL: str = "http://localhost:8080/api/v1/"

    class Config:
        case_sensitive = True
        env_file = ".env"


settings = Settings()
