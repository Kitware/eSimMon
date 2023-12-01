# FastAPI

We use [FastAPI](https://fastapi.tiangolo.com/) to develop the endpoints that we use to find and parse ingested files, to serve up formatted data for dynamic plots, or create and download images or movies.

## Requirements

Install the requirements files found in the `fastapi` directory:

```bash
cd path-to-repo/fastapi
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

Pull the latest Docker container:

```bash
docker pull kitware/esimmon-fastapi:latest
```

## Interactive development

Start the Girder and FastAPI containers:

```bash
docker-compose -p esimmon \
-f devops/docker/docker-compose.girder.yml \
-f devops/docker/docker-compose.fastapi.yml up
```

Run the Uvicorn web server:

```bash
uvicorn main:app --reload
```

Navigate to the Swagger UI interactive API docs: <http://127.0.0.1:8000/docs>. You can then iteratively develop and test changes.
