FROM python:3.8.2-slim

COPY ./ingest /ingest

RUN pip install /ingest

CMD ["../docker/wait-for-it.sh", "girder:8080", "-t", "30"]
ENTRYPOINT ["/usr/local/bin/adash"]
