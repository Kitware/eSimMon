FROM continuumio/miniconda3 as build

RUN apt-get update && apt-get install -y \
  build-essential \
  libgl1-mesa-dev \
  libosmesa6-dev && \
  apt-get clean all

RUN conda install -c \
  conda-forge \
  python=3.9 \
  cmake \
  ninja

# Build build VTK with OSMESA
RUN cd / && \
 git clone -b v9.1.0 https://gitlab.kitware.com/vtk/vtk.git vtk-src && \
 mkdir /vtk-build /vtk && \
 cd /vtk-build && \
 cmake ../vtk-src \
    -GNinja \
    -DVTK_WRAP_PYTHON:BOOL=ON \
    -DVTK_USE_X:BOOL=OFF \
    -DCMAKE_INSTALL_PREFIX:PATH=/vtk \
    -DVTK_OPENGL_HAS_OSMESA:BOOL=ON  \
    -DVTK_MODULE_ENABLE_VTK_RenderingMatplotlib:STRING=YES && \
 ninja install

FROM continuumio/miniconda3

RUN apt-get update && apt-get install -y \
  libgl1-mesa-dev \
  libosmesa6 && \
  apt-get clean all

RUN conda install -c \
  conda-forge \
  python=3.9 \
  adios2 \
  ffmpeg

COPY --from=build /vtk /vtk

RUN pip install gunicorn

COPY fastapi/ /app/

RUN pip install -r /app/requirements.txt

ENV PYTHONPATH=/vtk/lib/python3.9/site-packages

ENV LD_LIBRARY_PATH=/vtk/lib

WORKDIR /app/

ENTRYPOINT ["gunicorn", "-w",  "4", "--worker-class", "uvicorn.workers.UvicornWorker", "-t", "600", "app.main:app", "-b", "0.0.0.0:5000"]