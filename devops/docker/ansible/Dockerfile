FROM python:3.5-slim

ENV ADMIN_PASSWORD=$ADMIN_PASSWORD
ENV ESIMMON_PASSWORD=$ESIMMON_PASSWORD

RUN apt-get update && apt-get -y install \
  git \
  sshpass
RUN pip install ansible && \
  pip install girder_client

WORKDIR /ansible
COPY ./devops/docker/ansible/entrypoint.sh /entrypoint.sh
COPY ./devops/docker/wait-for-it.sh /wait-for-it.sh
COPY ./devops/docker/watch.env /watch.env
COPY ./devops/ansible/* /ansible/

ENTRYPOINT ["/wait-for-it.sh", "girder:8080", "-t", "30", "--", "/entrypoint.sh"]