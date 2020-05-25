ansible-galaxy install -r requirements.yml
ansible-playbook -i localhost -e admin_password=$ADMIN_PASSWORD -e esimmon_password=$ESIMMON_PASSWORD site.yml