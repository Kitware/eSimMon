FROM continuumio/miniconda3

WORKDIR /app/

RUN apt-get update && apt-get install -y python3-opencv -y libgl1-mesa-dev -y xvfb
RUN conda install -c conda-forge python=3.9 adios2 ffmpeg
RUN pip install gunicorn
COPY fastapi/ /app/
RUN pip install -r /app/requirements.txt

RUN ["chmod", "+x", "/app/scripts/offscreen_rendering.sh"]
ENTRYPOINT ["/app/scripts/offscreen_rendering.sh"]
