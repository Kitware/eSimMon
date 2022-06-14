FROM python:3.8.2-slim

COPY ./ingest /ingest

RUN pip install /ingest

COPY ./devops/docker/wait-for-it.sh /wait-for-it.sh

ENTRYPOINT ["/usr/local/bin/esimmon"]
