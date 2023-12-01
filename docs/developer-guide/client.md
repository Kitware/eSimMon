# Client

## Requirements

- [NGINX](https://www.nginx.com/resources/wiki/start/topics/tutorials/install/)
- [Node Version Manager](https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating)
- Node.js
```bash
nvm install node
```
- Yarn Package Manager
```bash
# Requires Node >= 18.12.0
cd path-to-repo/client
corepack enable
yarn init -2
```

## Development

The simplest way to iteratively develop the client is to bring the [Girder](./girder.md) and [FastAPI](./fastapi.md) containers up (along with any additional containers you may need) and then install and serve the client locally. First you will need to setup nginx:
```bash
sudo systemctl start nginx     # Debian/Ubuntu
brew services start nginx      # homebrew
cd C:\nginx && start nginx.exe # Windows
```

You can then copy the nginx file from `path-to-repo/devops/docker/nginx/nginx.conf` into your configuration file. The `proxy_pass` lines should be changed from `girder` and `fastapi` to `localhost`.

#### Debian/Ubuntu/Mac OS X
The default place of nginx.conf is `/usr/local/etc/nginx/nginx.conf`.
#### Windows
The primary configuration file is `nginx.conf`, located in the conf subdirectory of the directory where Nginx was extracted.

After updating the configuration file restart the service:
```bash
sudo service nginx restart  # Debian/Ubuntu
brew services restart nginx # homebrew
nginx -s reload             # Windows
```

Bring the containers up:
```bash
docker-compose -p esimmon \
-f path-to-repo/devops/docker/docker-compose.girder.yml \
-f path-to-repo/devops/docker/docker-compose.fastapi.yml up
```

Install and serve the client:
```bash
cd path-to-repo/client
yarn install
yarn run serve
```

The application should be served on <http://localhost:8081> and updates will be applied after a refresh of the page.

*Note*: The order of these steps is important. If the client is served before the containers are brought up it will commandeer the `8080` port that Girder needs and the container will not start up.

### Adding new components

We use a combination of [vuetify](https://v2.vuetifyjs.com/en/introduction/why-vuetify/) and [Girder web components](https://github.com/girder/girder_web_components) in the design of the dashboard application.

### Stop NGINX

When you are done developing the NGINX service can be stopped:
```bash
sudo service nginx stop  # Debian/Ubuntu
brew services stop nginx # homebrew
nginx -s quit            # Windows
```
