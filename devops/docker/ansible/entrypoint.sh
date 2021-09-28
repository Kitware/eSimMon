ansible-galaxy install -r requirements.yml
export ANSIBLE_LIBRARY=/root/.ansible/roles/girder/library
ansible-playbook -i localhost -e admin_password=$ADMIN_PASSWORD site.yml
