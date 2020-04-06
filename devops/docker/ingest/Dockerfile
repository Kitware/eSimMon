FROM python:3.8.2-slim

COPY ./ingest /ingest

RUN pip install /ingest

ENTRYPOINT ["/usr/local/bin/adash"]
