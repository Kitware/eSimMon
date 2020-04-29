FROM python:3.8-slim

WORKDIR /app

RUN pip3 install gunicorn
RUN apt-get update && \
    apt-get install --no-install-recommends ffmpeg -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY flask/src/* /app/
COPY flask/requirements.txt /app/
RUN pip3 install -r /app/requirements.txt

ENTRYPOINT ["gunicorn", "-w",  "4", "-t", "600", "server:app", "-b", "0.0.0.0:5000"]
