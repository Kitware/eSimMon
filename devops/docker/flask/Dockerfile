FROM python:3.7-slim

WORKDIR /app

COPY flask/src/* /app/
COPY flask/requirements.txt /app/

RUN pip3 install gunicorn
RUN pip3 install -r /app/requirements.txt

ENTRYPOINT ["gunicorn", "-w",  "4", "-t", "600", "server:app", "-b", "0.0.0.0:5000"]
