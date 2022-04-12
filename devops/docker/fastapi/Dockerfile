FROM continuumio/miniconda3

WORKDIR /app/

RUN apt-get update && apt-get install -y python3-opencv
RUN conda install -c conda-forge python=3.9 adios2 ffmpeg
RUN pip install gunicorn opencv-python-headless
COPY fastapi/ /app/
RUN pip install -r /app/requirements.txt

ENTRYPOINT ["gunicorn", "-w",  "4", "--worker-class", "uvicorn.workers.UvicornWorker", "-t", "600", "app.main:app", "-b", "0.0.0.0:5000"]
