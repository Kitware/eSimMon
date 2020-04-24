import ffmpeg
import tempfile

from girder_client import GirderClient
from flask import Flask, send_file, request
from flask_cors import CORS

app = Flask(__name__)

CORS(app, resources={r'/*': {'origins': '*'}})

@app.route('/plots/api/movie', methods=['GET'])
def create_movie(id):
    gc = GirderClient(apiUrl='https://data.kitware.com/api/v1/')
    gc.setToken("Jka8QlMSkeMIAipeq1EBpQ9GHKBqcE78tsbQVdnHhzM2Wn9unT8B1li4FHKnstyM")
    output_file = tempfile.NamedTemporaryFile(suffix='.mp4', delete=True)
    with tempfile.TemporaryDirectory() as tmpdir:
        item = gc.getItem('5e87d2232660cbefba89703e')
        gc.downloadItem('5e87d2232660cbefba89703e', tmpdir, item['name'])
        path = tmpdir + '/' + item['name'] + '/*.svg'
        ffmpeg.input(path, pattern_type='glob', framerate=1).output(output_file.name).overwrite_output().run()
    return send_file(output_file, attachment_filename=item['name']+'.mp4')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
