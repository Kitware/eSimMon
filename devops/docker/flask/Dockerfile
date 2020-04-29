FROM python:3.8-slim

WORKDIR /app

COPY flask/src/* /app/
COPY flask/requirements.txt /app/

RUN pip3 install gunicorn
RUN pip3 install -r /app/requirements.txt
RUN apt-get update && \
    apt-get install ffmpeg -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ENTRYPOINT ["gunicorn", "-w",  "4", "-t", "600", "server:app", "-b", "0.0.0.0:5000"]
