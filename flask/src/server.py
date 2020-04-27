import ffmpeg
import tempfile
import os

from girder_client import GirderClient
from flask import Flask, send_file, request, Response
from flask_cors import CORS

app = Flask(__name__)

CORS(app, resources={r'/*': {'origins': '*'}})

@app.route('/api/movie/<id>', methods=['GET'])
def create_movie(id):
    token = request.headers.get('girderToken', '')
    if not token or not id:
        return Response('Invalid token or parameter ID.', status=400, mimetype='application/json')

    gc = GirderClient(apiUrl='https://data.kitware.com/api/v1/')
    gc.setToken(token)
    output_file = tempfile.NamedTemporaryFile(suffix='.mp4', delete=True)
    with tempfile.TemporaryDirectory() as tmpdir:
        item = gc.getItem(id)
        if not item:
            return Response('Unable to fetch item', status=400, mimetype='application/json')
        gc.downloadItem(id, tmpdir, item['name'])
        path_name = os.path.join(tmpdir, item['name'], '*.svg')
        ffmpeg.input(path_name, pattern_type='glob', framerate=1).output(output_file.name).overwrite_output().run()
    response = make_response(send_file(output_file, attachment_filename=item['name']+'.mp4'))
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
