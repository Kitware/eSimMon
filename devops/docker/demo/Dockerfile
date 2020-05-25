FROM cirrusci/wget as wget
RUN wget -O shots.tar.gz https://data.kitware.com/api/v1/file/5ecbd6e19014a6d84e895290/download && \
    tar zxf shots.tar.gz

FROM nginx
COPY ./devops/docker/demo/nginx.conf /etc/nginx/nginx.conf
COPY --from=wget shots /etc/nginx/html/shots/