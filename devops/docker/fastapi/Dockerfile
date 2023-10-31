FROM continuumio/miniconda3 AS build

RUN apt-get update && apt-get install -y \
  curl \
  libgl1 \
  build-essential \
  llvm-dev \
  meson \
  byacc \
  flex \
  bison && \
  apt-get clean all

RUN conda install -c \
  conda-forge \
  python=3.9 \
  cmake=3.26.4 \
  ninja \
  mako

RUN curl -L -O https://archive.mesa3d.org/mesa-21.3.1.tar.xz && \
  tar -xvf mesa-21.3.1.tar.xz

RUN mkdir mesa-21.3.1-build && \
  cd mesa-21.3.1-build && \
  meson \
    ../mesa-21.3.1 \
    --buildtype=release \
    --prefix=/mesa \
    -Dvulkan-drivers= \
    -Ddri-drivers= \
    -Dgallium-vdpau=disabled \
    -Dgallium-xvmc=disabled \
    -Dgallium-omx=disabled \
    -Dgallium-va=disabled \
    -Dgallium-xa=disabled \
    -Dgallium-nine=false \
    -Dgallium-opencl=disabled \
    -Dbuild-tests=false \
    -Degl=disabled \
    -Dgbm=disabled \
    -Dglx=disabled \
    -Dplatforms= \
    -Dglvnd=false \
    -Dosmesa=true \
    -Dopengl=true \
    -Dgles1=disabled \
    -Dgles2=disabled \
    -Dshared-glapi=enabled \
    -Dllvm=enabled \
    -Dshared-llvm=enabled \
    -Dgallium-drivers=swrast,swr && \
  ninja && \
  ninja install

# Build build VTK with OSMESA
RUN cd / && \
 git clone -b v9.1.0 https://gitlab.kitware.com/vtk/vtk.git vtk-src && \
 mkdir /vtk-build /vtk && \
 cd /vtk-build && \
 cmake ../vtk-src \
    -GNinja \
    -DCMAKE_BUILD_TYPE:STRING=Release \
    -DVTK_WRAP_PYTHON:BOOL=ON \
    -DVTK_USE_X:BOOL=OFF \
    -DCMAKE_INSTALL_PREFIX:PATH=/vtk \
    -DVTK_OPENGL_HAS_OSMESA:BOOL=ON  \
    -DOSMESA_INCLUDE_DIR:PATH=/mesa/include \
    -DOSMESA_LIBRARY:PATH=/mesa/lib/x86_64-linux-gnu/libOSMesa.so.8.0.0 \
    -DVTK_MODULE_ENABLE_VTK_RenderingMatplotlib:STRING=YES && \
 ninja install

FROM continuumio/miniconda3

RUN apt-get update && apt-get install -y \
  libgl1 && \
  apt-get clean all

RUN conda install -c \
  conda-forge \
  python=3.9 \
  adios2 \
  gunicorn \
  ffmpeg \
  libstdcxx-ng=13.1.0

COPY --from=build /vtk /vtk

COPY --from=build /mesa /mesa

COPY fastapi/requirements.txt /app/requirements.txt

RUN pip install -r /app/requirements.txt

ENV PYTHONPATH=/vtk/lib/python3.9/site-packages

ENV LD_LIBRARY_PATH=/vtk/lib:/mesa/lib/x86_64-linux-gnu/

WORKDIR /app/

COPY fastapi/ /app/

ENTRYPOINT ["gunicorn", "-w",  "4", "--worker-class", "uvicorn.workers.UvicornWorker", "-t", "600", "--keep-alive", "30", "app.main:app", "-b", "0.0.0.0:5000"]
