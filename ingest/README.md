# Install

```bash
pip install -e <esimmon-dashboard-repo>/ingest
```

# Run the mock simulation upload site

```bash
esimmon mock -s 1 -r 1 -i 10 -t 10 -d <path-to-simulation-data>
```

# Run the watch ingester

```bash

esimmon watch -f <root-folder-id> -r http://localhost:5000 -k <girder-api-key> -u <girder-api-url> -v 5 -a <fastapi-url>
```
