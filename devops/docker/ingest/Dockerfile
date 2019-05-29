FROM python:3.7.3-alpine

COPY ./ingest /ingest

RUN pip install /ingest

ENTRYPOINT ["/usr/local/bin/adash"]
