ansible-galaxy install -r requirements.yml
export ANSIBLE_LIBRARY=/root/.ansible/roles/girder/library
ansible-playbook -i localhost \
-e admin_password=$ADMIN_PASSWORD \
-e smtp_host=$SMTP_HOST \
-e smtp_username=$SMTP_USERNAME \
-e smtp_password=$SMTP_PASSWORD \
-e email_from=$EMAIL_FROM \
-e email_host=$EMAIL_HOST \
site.yml
