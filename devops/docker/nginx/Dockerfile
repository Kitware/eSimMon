FROM node:8.11 as build
COPY . /adash
RUN cd /adash && npm install && npm run build

FROM nginx
COPY ./devops/docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /adash/dist/ /etc/nginx/html/
