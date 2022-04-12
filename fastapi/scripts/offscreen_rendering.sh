#!/bin/bash
export DISPLAY=:99.0
which Xvfb
Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
sleep 3
exec "$@"
gunicorn -w 4 --worker-class uvicorn.workers.UvicornWorker -t 600 app.main:app -b 0.0.0.0:5000
