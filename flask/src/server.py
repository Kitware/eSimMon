import ffmpeg
import json
import tempfile

import esimmon_api as esimmon

from girder_client import GirderClient
from flask import Flask, send_file, request
from flask_cors import CORS

app = Flask(__name__)

CORS(app, resources={r'/*': {'origins': '*'}})

@app.route('/plots/api/movie', methods=['GET'])
def create_movie():
    gc = GirderClient(apiUrl='https://data.kitware.com/api/v1/')
    gc.setToken("Jka8QlMSkeMIAipeq1EBpQ9GHKBqcE78tsbQVdnHhzM2Wn9unT8B1li4FHKnstyM")
    files = gc.get('item/5e87d2232660cbefba89703e/files')
    output_file = tempfile.NamedTemporaryFile(suffix='.mp4', delete=True)
    for i, file in enumerate(files):
        resp = gc.get('file/' + file['_id'] + '/download?contentDisposition=inline', jsonResp=False)
        f = tempfile.NamedTemporaryFile(delete=True)
        f.write(resp.content)
        if (i == 0):
            input = ffmpeg.input(f.name, framerate=1)
        else:
            input = ffmpeg.concat(
                        ffmpeg.input(f.name, framerate=1),
                        ffmpeg.input(output_file.name))
        (ffmpeg
            .output(input, output_file.name, format='yuv420p')
            .overwrite_output()
            .run())
        f.close()

    return send_file(output_file, attachment_filename='movie.mp4')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
