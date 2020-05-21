FROM python:3.5-slim

ENV ADMIN_PASSWORD=$ADMIN_PASSWORD
ENV ESIMMON_PASSWORD=$ESIMMON_PASSWORD

RUN apt-get update && apt-get -y install \
  git \
  sshpass
RUN pip install ansible && \
  pip install girder_client

WORKDIR /devops/ansible

ENTRYPOINT ["../docker/wait-for-it.sh", "girder:8080", "-t", "30", "--", "../docker/ansible/entrypoint.sh"]