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

async def update_timestep(output_path, shot_name, run_name, timestep, complete):
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
        if complete:
            time['complete'] = True
        json.dump(time, f)


async def mock_run(images_path, output_path, shot, run_name, username, run_interval, timestep_interval, machine):
    create_time = random.randrange(run_interval)
    log.info('Starting run "%s" in %s seconds.' % (run_name, create_time))
    await asyncio.sleep(create_time)

    shot_entry = {
        'shot_name': shot,
        'run_name': run_name,
        'username': username,
        'machine_name': machine,
        'date': datetime.now().isoformat()
    }

    await add_shot_entry(output_path, shot_entry)
    log.info('Starting run')
    log.info(json.dumps(shot_entry, indent=2))

    timestep = 1
    while True:
        await asyncio.sleep(timestep_interval)
        timestep_path = images_path / str(timestep)
        complete = False
        if not timestep_path.exists():
            # We are done!
            complete = True

        target_run_path = output_path / 'shots' / shot / run_name / str(timestep)
        loop = asyncio.get_event_loop()
        if not complete:
            await loop.run_in_executor(None, shutil.copytree, timestep_path, target_run_path)
        await update_timestep(output_path, shot, run_name, timestep, complete)
        if complete:
            # We need to wait so the watching client gets the message
            await asyncio.sleep(60)
            break
        timestep += 1

async def mock_runs(images_path, output_path, shots, runs, run_interval, timestep_interval):
    shot_names = ['shot%d' % x for x in range(0, shots)]
    usernames = [fake.user_name() for x in range(0, runs)]
    run_names = ['run%d' % run for run in range(0, runs)]
    image_paths = [images_path]*runs
    machine_names = [random.choice(machines) for x in range(0, runs)]

    index_path = images_path / 'index.json'
    # If we are using a real data set then we can use the index file.
    if index_path.exists():
        usernames = []
        shot_names = []
        run_names = []
        image_paths = []
        machine_names = []
        with index_path.open('r') as fp:
            shots = json.load(fp)
            for shot in shots:
                usernames.append(shot['username'])
                shot_names.append(shot['shot_name'])
                run_names.append(shot['run_name'])
                image_paths.append( images_path / shot['shot_name'] / shot['run_name'])
                machine_names.append(shot['machine_name'])

    shots_path = output_path / 'shots'
    if not shots_path.exists():
        shots_path.mkdir(parents=True, exist_ok=False)

    tasks = []
    for shot in shot_names:
        for path, run, user, machine in zip(image_paths, run_names, usernames, machine_names):
            tasks.append(
                asyncio.create_task(
                    mock_run(path, output_path, shot, run,
                    user, run_interval, timestep_interval, machine)
                )
            )

    await asyncio.gather(*tasks)

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
