FROM continuumio/miniconda3

COPY ./ingest /ingest

RUN conda install -c \
  conda-forge \
  python=3.11 \
  adios2

RUN pip install /ingest

COPY ./devops/docker/wait-for-it.sh /wait-for-it.sh

ENTRYPOINT ["/opt/conda/bin/esimmon"]
