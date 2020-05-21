ansible-galaxy install -r /ansible/requirements.yml
ansible-playbook -i localhost -e admin_password=$ADMIN_PASSWORD -e esimmon_password=$ESIMMON_PASSWORD /ansible/site.yml