FROM node:12.16.3 as build
COPY ./client /client
ARG VUE_APP_FOLDER_ID
RUN cd /client && yarn && yarn build

FROM nginx
COPY ./devops/docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /client/dist/ /etc/nginx/html/
