import ffmpeg
import tempfile
import os

from girder_client import GirderClient
from flask import Flask, request, Response, send_file
from flask_cors import CORS

app = Flask(__name__)

CORS(app, expose_headers=["x-suggested-filename"])

@app.route('/api/movie/<id>', methods=['GET'])
def create_movie(id):
    token = request.headers.get('girderToken', '')
    if not token or not id:
        return Response('Invalid token or parameter ID.', status=400)

    gc = GirderClient(apiUrl='https://data.kitware.com/api/v1/')
    gc.setToken(token)
    with tempfile.TemporaryDirectory() as tmpdir:
        gc.downloadItem(id, tmpdir)
        item_name = os.listdir(tmpdir)[0]
        path_name = os.path.join(tmpdir, item_name, '*.svg')
        output_file = tempfile.NamedTemporaryFile(suffix='.mp4')
        (ffmpeg
            .input(path_name, pattern_type='glob', framerate=1)
            .output(output_file.name)
            .overwrite_output()
            .run())

        return send_file(output_file, mimetype='mp4')


if __name__ == '__main__':
    app.run(host='0.0.0.0')
