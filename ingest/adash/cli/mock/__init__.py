import re
import types
import sys
import os
import io
from pathlib import Path
import tempfile
import random
import json
import asyncio
import shutil
import logging
from datetime import datetime
import threading

import click
from girder_client import GirderClient
from faker import Faker
from faker.providers import internet
from flask import Flask, send_from_directory, jsonify


log = logging.getLogger('adash')
fake = Faker()
fake.add_provider(internet)
machines = ['summit', 'titan', 'frontier']

async def add_shot_entry(output_path, shot_entry):
    log.info('Updating shots/index.json')
    shots_path = output_path / 'shots'
    shots_index_path = shots_path / 'index.json'
    shots_index = []
    if shots_index_path.exists():
        with shots_index_path.open() as f:
            shots_index = json.load(f)
    shots_index.append(shot_entry)
    with shots_index_path.open('w') as f:
        json.dump(shots_index, f)

async def update_timestep(output_path, shot_name, run_name, timestep):
    time_path = output_path / 'shots' / shot_name / run_name / 'time.json'
    log.info('Updating "%s" timestep="%d"' % (os.path.join('shots', shot_name, run_name,'time.json'),
                                              timestep ))
    if time_path.exists():
        with time_path.open() as f:
            time = json.load(f)
        time['current'] += 1
    with time_path.open('w') as f:
        time = {
            'current': timestep
        }
        json.dump(time, f)


async def mock_run(images_path, output_path, shot, run, username, run_interval, timestep_interval):
    create_time = random.randrange(run_interval)
    run_name = 'run%d' % run
    log.info('Starting run "%s" in %s seconds.' % (run_name, create_time))
    await asyncio.sleep(create_time)

    shot_entry = {
        'shot_name': shot,
        'run_name': run_name,
        'username': username,
        'machine_name': random.choice(machines),
        'date': datetime.now().isoformat()
    }
    await add_shot_entry(output_path, shot_entry)
    log.info('Starting run')
    log.info(json.dumps(shot_entry, indent=2))

    timestep = 1
    while True:
        await asyncio.sleep(timestep_interval)
        timestep_path = images_path / str(timestep)
        if not timestep_path.exists():
            # We are done!
            break
        target_run_path = output_path / 'shots' / shot / run_name / str(timestep)
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, shutil.copytree, timestep_path, target_run_path)
        await update_timestep(output_path, shot, run_name, timestep)
        timestep += 1

async def mock_runs(images_path, output_path, shots, runs, run_interval, timestep_interval):
    shot_names = ['shot%d' % x for x in range(0, shots)]
    usernames = [fake.user_name() for x in range(0, runs)]

    shots_path = output_path / 'shots'
    if not shots_path.exists():
        shots_path.mkdir(parents=True, exist_ok=False)

    tasks = []
    for shot in shot_names:
        for run in range(0, runs):
            tasks.append(
                asyncio.create_task(
                    mock_run(images_path, output_path, shot, run,
                    random.choice(usernames), run_interval, timestep_interval)
                )
            )

    print(tasks)
    await asyncio.gather(*tasks)
    print(tasks)
    print('end')

@click.command('mock', help='Mock simulation web upload site')
@click.option('-s', '--shots', default=2, type=int, help='number of shots to simulate')
@click.option('-r', '--runs', default=2, type=int, help='number of runs per shot')
@click.option('-i', '--run-interval', default=30, type=int, help='seconds to create runs in')
@click.option('-t', '--timestep-interval', default=30, type=int, help='timestep delta seconds')
@click.option('-d', '--data-path', required=True,
              type=click.Path(exists=True, file_okay=False, dir_okay=True,
                              resolve_path=True), help='path to images')
def main(shots, runs, run_interval, timestep_interval, data_path):
    app = Flask(__name__)

    with tempfile.TemporaryDirectory() as static_content_dir:
        log.info('static content directory: %s' % static_content_dir)
        static_content_dir = Path(static_content_dir)
        @app.route('/<path:path>')
        def static_proxy(path):
            path = static_content_dir / path

            return send_from_directory(path.parent, path.name)

        threading.Thread(target=app.run).start()
        asyncio.run(mock_runs(Path(data_path), Path(static_content_dir), shots,
                              runs, run_interval, timestep_interval))
