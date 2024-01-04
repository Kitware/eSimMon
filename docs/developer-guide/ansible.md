# Ansible Playbook

Ansible streamlines the management of systems by using playbooks, which are essentially automation plans in YAML format. These playbooks offer repeatable, reusable, simple configuration management and are a great tool for guaranteeing identical final system states regardless of machine or user. In our use case this means that we can provide a playbook to take care of all of the setup and initialization required for the Girder data management platform that will serve as our database.

In order to run the playbook you will first need to make [Girder](girder.md) available.

## Run with Docker (recommended)

### Requirements

```bash
docker pull kitware/esimmon-ansible:latest
```

### Start the container

Ansible cannot be started without the Girder container.

```bash
cd <repo>/devops/docker
docker-compose -p esimmon -f docker-compose.girder.yml -f docker-compose.ansible.yml up
```

## Run Locally

### Requirements

Install Ansible

```bash
pip install ansible
```

Install the requirements

```bash
cd {path-to-repo}/devops/ansible
ansible-galaxy install -r requirements.yml
```

Set the `ANSIBLE_LIBRARY` environment variable. This should be colon separated paths to tell Ansible where to search for Modules.

```bash
export ANSIBLE_LIBRARY=~/.ansible/roles/girder/library
```

### Run the playbook

The `-i` flag is shorthand for `--inventory` and points to the specify inventory host path. The `site.yml` is the actual playbook that will be used.

```bash
ansible-playbook -i localhost site.yml
```

Extra variables can be passed in if needed. For example, if setting up the SMTP server you should set the variables in `../docker/.env` and pass them in when running the playbook. You will need to uncomment lines [86-130](https://github.com/Kitware/eSimMon/blob/master/devops/ansible/site.yml#L86-L130).

```bash
ansible-playbook -i localhost \
-e admin_password=$ADMIN_PASSWORD \
-e smtp_host=$SMTP_HOST \
-e smtp_username=$SMTP_USERNAME \
-e smtp_password=$SMTP_PASSWORD \
-e email_from=$EMAIL_FROM \
-e email_host=$EMAIL_HOST \
site.yml
```

## Developing/Updating the playbook

If you would like to customize your Girder configuration you can add or remove tasks from `{path-to-repo}/devops/ansible/site.yml`. See the [documentation](https://docs.ansible.com/ansible/latest/playbook_guide/index.html) for detailed information on creating playbook tasks.
