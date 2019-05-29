import re
import types
import sys
import os
import io
from pathlib import Path
from urllib.parse import urlparse
import logging
import asyncio
import tarfile
from io import BytesIO
import mimetypes
import functools

import click
from girder_client import GirderClient
from flask import Flask, send_from_directory, jsonify
import aiohttp
from async_lru import alru_cache
import tenacity


class AsyncGirderClient(object):

    def __init__(self, session, api_url):
        self._ratelimit_semaphore = asyncio.Semaphore(5)
        self._api_url = api_url.rstrip('/')
        self._folder_create_semaphore = asyncio.Semaphore()
        self._item_create_semaphore = asyncio.Semaphore()
        self._session = session

    async def authenticate(self, api_key):
        params = {'key': api_key}
        async with self._session.post('%s/api_key/token' % (self._api_url), params=params) as r:
            r.raise_for_status()
            auth = await r.json()
        self._headers = {
            'Girder-Token': auth['authToken']['token']
        }

    @tenacity.retry(retry=tenacity.retry_if_exception_type(aiohttp.client_exceptions.ServerConnectionError),
                    wait=tenacity.wait_exponential(max=10),
                    stop=tenacity.stop_after_attempt(10))
    async def post(self, path, headers=None, params=None, raise_for_status=True, **kwargs):
        if params is not None:
            params = {k:str(v) for (k,v) in params.items()}

        if headers is None:
            headers = self._headers
        else:
            headers.update(self._headers)

        async with self._ratelimit_semaphore:
            async with self._session.post('%s/%s' % (self._api_url, path),
                                        headers=headers, params=params,
                                        **kwargs) as r:
                if raise_for_status:
                    r.raise_for_status()
                return await r.json()

    @tenacity.retry(retry=tenacity.retry_if_exception_type(aiohttp.client_exceptions.ServerConnectionError),
                    wait=tenacity.wait_exponential(max=10),
                    stop=tenacity.stop_after_attempt(10))
    async def put(self, path, headers=None, params=None, raise_for_status=True, **kwargs):
        if params is not None:
            params = {k:str(v) for (k,v) in params.items()}

        if headers is None:
            headers = self._headers
        else:
            headers.update(self._headers)

        async with self._ratelimit_semaphore:
            async with self._session.put('%s/%s' % (self._api_url, path),
                                         headers=headers, params=params,
                                         **kwargs) as r:
                if raise_for_status:
                    r.raise_for_status()
                return await r.json()

    @tenacity.retry(retry=tenacity.retry_if_exception_type(aiohttp.client_exceptions.ServerConnectionError),
                    wait=tenacity.wait_exponential(max=10),
                    stop=tenacity.stop_after_attempt(10))
    async def get(self, path, raise_for_status=True, params=None, **kwargs):
        if params is not None:
            params = {k:str(v) for (k,v) in params.items()}

        async with self._ratelimit_semaphore:
            async with self._session.get('%s/%s' % (self._api_url, path),
                                        headers=self._headers, params=params, **kwargs) as r:
                if raise_for_status:
                    r.raise_for_status()
                return await r.json()

    @alru_cache(maxsize=1000)
    async def create_folder(self, parent_id, parent_type, name):
        params = {
           'parentId': parent_id,
           'parentType': parent_type,
           'name': name,
           'description': '',
           'reuseExisting': True
        }

        # We need this sempahore to prevent two folders with the same name be
        # create, this opertion in not atomic in Girder.
        async with self._folder_create_semaphore:
            return await self.post('folder', params=params)

    async def list_item(self, folder, name):
        params = {
            'parentId': folder['_id'],
            'name': name
        }

        return await self.get('item', params=params)

    @alru_cache(maxsize=1000)
    async def create_item(self, folder_id, name):
        params = {
           'folderId': folder_id,
           'name': name,
           'description': '',
           'reuseExisting': True
        }

        # We need this sempahore to prevent two items with the same name be
        # create, this opertion in not atomic in Girder.
        async with self._item_create_semaphore:
            return await self.post('item', params=params)

    async def upload_file(self, item, file_name, br, size):
        mime_type, _ = mimetypes.guess_type(file_name)

        params = {
            'parentType': 'item',
            'parentId': item['_id'],
            'name': file_name,
            'size': size,
            'mimeType': mime_type
        }

        headers = {
            'Content-Length': str(size),
            'Content-Type': 'image/png'
        }
        headers.update(self._headers)
        upload = await self.post('file', params=params, headers=headers, data=br)

        return upload

    async def set_metadata(self, resource_type, _id, meta, semaphore=None):
        # The metadata put operation is not atomic!
        if semaphore is not None:
            await semaphore.acquire()
        try:
            return await self.put('%s/%s/metadata' % (resource_type, _id), json=meta)
        finally:
            if semaphore is not None:
                semaphore.release()

    async def get_metadata(self, resource_type, _id):
        resource = await self.get('%s/%s' % (resource_type, _id))

        return resource.get('meta')


    @alru_cache(maxsize=1000)
    async def resource_path(self, _id, resource_type):
        params = {
            'type': resource_type
        }

        return await self.get('resource/%s/path' % _id, params=params)

    async def lookup_resource(self, path):
        params = {
            'path': path,
            'test': True
        }

        return await self.get('resource/lookup', params=params)

    async def file_exist(self, item, name):
        item_path = await self.resource_path(item['_id'], 'item')

        return await self.lookup_resource('%s/%s' % (item_path, name)) is not None

async def ensure_folders(gc, parent, folders):
    for folder_name in folders:
        parent = await gc.create_folder(parent['_id'], 'folder', folder_name)

    return parent

async def upload_image(gc, folder, shot_name, run_name, variable, timestep, br, size, check_exists=False):
    log = logging.getLogger('adash')
    type = Path(variable['image_name']).parent
    image_folders = [shot_name, run_name, type]
    parent_folder = await ensure_folders(gc, folder, image_folders)
    variable_item = await gc.create_item(parent_folder['_id'], variable['name'])
    image_name = '%s.png' % str(timestep).zfill(4)

    create = True
    if check_exists:
        create = not await gc.file_exist(variable_item, image_name)

    if create:
        log.info('Uploading "%s/%s/%s".' % ('/'.join([str(i) for i in image_folders]), variable['name'], image_name))
        await gc.upload_file(variable_item, image_name, br, size)

@tenacity.retry(retry=tenacity.retry_if_exception_type(aiohttp.client_exceptions.ServerConnectionError),
                wait=tenacity.wait_exponential(max=10),
                stop=tenacity.stop_after_attempt(10))
async def fetch_variables(session, upload_site_url, shot_name, run_name, timestep):
    async with session.get('%s/shots/%s/%s/%d/variables.json' % (upload_site_url, shot_name,
                                                                 run_name, timestep)) as r:
        if r.status == 404:
            return None

        r.raise_for_status()

        return await r.json()

@tenacity.retry(retry=tenacity.retry_if_exception_type(aiohttp.client_exceptions.ServerConnectionError),
                wait=tenacity.wait_exponential(max=10),
                stop=tenacity.stop_after_attempt(10))
async def fetch_images_archive(session, upload_site_url, shot_name,
                               run_name, timestep):
    async with session.get('%s/shots/%s/%s/%d/images.tar.gz' % (upload_site_url, shot_name,
                                                            run_name, timestep)) as r:
        if r.status == 404:
            return None

        r.raise_for_status()

        return await r.read()


async def fetch_images(session, gc, folder, upload_site_url, shot_name, run_name, timestep,
                       metadata_semaphore, check_exists=False):
    log = logging.getLogger('adash')
    log.info('Fetching variables.json for timestep: "%d".' % timestep)

    # Fetch variables.json
    variables = await fetch_variables(session, upload_site_url, shot_name, run_name, timestep)
    if variables is None:
        log.warning('Unable to fetch variables.json. Timestep "%d" is missing.' % timestep)
    else:
        log.info('Fetching images.tar.gz for timestep: "%d".' % timestep)
        buffer = BytesIO(await fetch_images_archive(session, upload_site_url, shot_name, run_name, timestep))
        tasks = []
        with tarfile.open(fileobj=buffer) as tgz:
            for v in variables:
                info = tgz.getmember('./%s' % v['image_name'])
                br = tgz.extractfile(info)
                tasks.append(
                    asyncio.create_task(
                        upload_image(gc, folder, shot_name, run_name, v,
                                     timestep, br, info.size, check_exists)
                    )
                )
        # Gather, so we fetch all images for this timestep before moving on to the
        # next one!
        await asyncio.gather(*tasks)

    # Set the current timestep
    metadata = {
        'currentTimestep': timestep
    }
    run_folder = await ensure_folders(gc, folder, [shot_name, run_name])
    await gc.set_metadata('folder', run_folder['_id'], metadata, metadata_semaphore)

# scheduler used to schedule fetch_images request inorder, so we fetch the images
# in timestep order.
async def fetch_images_scheduler(queue):
    log = logging.getLogger('adash')
    while True:
        try:
            fetch = await queue.get()
            log.info(fetch)
            await fetch
            queue.task_done()
        except asyncio.CancelledError:
            raise
        except:
            log.exception('Exception occured fetching images.')


@tenacity.retry(retry=tenacity.retry_if_exception_type(aiohttp.client_exceptions.ServerConnectionError),
                wait=tenacity.wait_exponential(max=10),
                stop=tenacity.stop_after_attempt(10))
async def fetch_run_time(session, upload_site_url, shot_name, run_name):

    run_path = 'shots/%s/%s/time.json' % (shot_name, run_name)
    async with session.get('%s/%s' % (upload_site_url, run_path),
                           raise_for_status=False) as r:
        if r.status == 404:
            return None
        return await r.json()

async def watch_run(session, gc, folder, upload_site_url, shot_name, run_name,
                    username, machine, run_poll_interval):
    log = logging.getLogger('adash')
    log.info('Starting to watch run "%s" shot "%s".' % (run_name, shot_name))
    fetch_images_queue = asyncio.Queue()
    metadata_semaphore = asyncio.Semaphore()
    scheduler = asyncio.create_task(
        fetch_images_scheduler(fetch_images_queue)
    )
    last_timestep = None
    metadata = {
        'username': username,
        'machine': machine
    }
    run_folder = await ensure_folders(gc, folder, [shot_name, run_name])
    await gc.set_metadata('folder', run_folder['_id'], metadata, metadata_semaphore)
    while True:
        # Check to see what the last successfully processed timestep was
        metadata = await gc.get_metadata('folder', run_folder['_id'])
        if last_timestep is None:
            last_timestep = metadata.get('currentTimestep')
            if last_timestep is not None:
                log.info('Last timestep processed: "%d"' % last_timestep)
            else:
                log.info('No previous timestep have been processed.')
                last_timestep = 0

        # Now see where the simulation upload has got to
        run_path = 'shots/%s/%s/time.json' % (shot_name, run_name)
        time = await fetch_run_time(session, upload_site_url, shot_name, run_name)
        # Wait for time.json to appear
        if time is None:
            log.warn('Unable to fetch "%s", waiting for 1 sec.' % run_path)
            await asyncio.sleep(1)
            continue

        new_timestep = time['current']
        complete = time.get('complete', False)
        # Are we done. The run is marked as complete and we have ingested all the
        # timesteps.
        if complete and last_timestep == new_timestep:
            log.info('Run "%s" is complete.' % run_name)
            await fetch_images_queue.join()
            scheduler.cancel()
            break

        # Did we miss any timesteps?
        delta = new_timestep - last_timestep
        # We have missed to timesteps so need to catch up!
        if  delta > 1:

            # First schedule a fetch of the next timesetp checking if the files
            # exists ( this is the one that could be partially processed.
            fetch_images_queue.put_nowait(
                fetch_images(session, gc, folder, upload_site_url,
                             shot_name, run_name, last_timestep+1,
                             metadata_semaphore, check_exists=True)
            )

            # Then process the rest normally
            for t in range(last_timestep+2, new_timestep+1):
                fetch_images_queue.put_nowait(
                    fetch_images(session, gc, folder, upload_site_url,
                                 shot_name, run_name, t,
                                 metadata_semaphore)
                )
        # We successfully processed the last timestep so just schedule the processing
        # of the next.
        elif delta == 1:
            fetch_images_queue.put_nowait(
                fetch_images(session, gc, folder, upload_site_url,
                             shot_name, run_name, new_timestep,
                             metadata_semaphore,
                             # If we processing the first timestep we need to check
                             # the existence of the files, as the fetching of this
                             # timestep may have failed before.
                             last_timestep == 0)
            )

        last_timestep = new_timestep

        await asyncio.sleep(run_poll_interval)

@tenacity.retry(retry=tenacity.retry_if_exception_type(aiohttp.client_exceptions.ServerConnectionError),
                wait=tenacity.wait_exponential(max=10),
                stop=tenacity.stop_after_attempt(10))
async def fetch_shot_index(session, upload_site_url):
    async with session.get('%s/shots/index.json' % upload_site_url) as r:
        if r.status == 404:
            return None
        else:
            r.raise_for_status()

        return await r.json()

async def watch_shots_index(session, gc, folder, upload_site_url, api_url,
                            api_key, shot_poll_interval, run_poll_internval):
    log = logging.getLogger('adash')
    runs = set()
    shot_metadata_semaphore = asyncio.Semaphore()

    # Get users and machines
    metadata = await gc.get_metadata('folder', folder['_id'])
    users = set(metadata.get('users', []))
    machines = set(metadata.get('machines', []))

    while True:
        log.info('Fetching /shots/index.json')
        index = await fetch_shot_index(session, upload_site_url)
        if index is None:
            # Just wait for index.json to appear
            log.warn('Unable to fetch "shots/index.json", waiting for 1 sec.')
            await asyncio.sleep(1)
            continue

        for shot in index:
            username = shot['username']
            users.add(username)
            machine = shot['machine_name']
            machines.add(machine)

            # TODO Update the meta data

            shot_name = shot['shot_name']
            run_name = shot['run_name']
            run_key = '%s/%s' % ( shot_name, run_name)
            if run_key not in runs:
                asyncio.create_task(
                    watch_run(session, gc, folder, upload_site_url, shot_name,
                              run_name, username, machine, run_poll_internval)
                )
                runs.add(run_key)
        metadata = {
            'machines': list(machines),
            'users': list(users)
        }
        await gc.set_metadata('folder', folder['_id'], metadata, shot_metadata_semaphore)
        await asyncio.sleep(shot_poll_interval)

async def watch(folder_id, upload_site_url, api_url, api_key,
                shot_poll_interval, run_poll_internval):
    async with aiohttp.ClientSession() as session:
        gc = AsyncGirderClient(session, api_url)
        await gc.authenticate(api_key)

        folder = {
            '_id': folder_id
        }
        await watch_shots_index(session, gc, folder, upload_site_url, api_url,
                                api_key, shot_poll_interval, run_poll_internval)



@click.command('watch', help='Watch upload site and ingest data into Girder')
@click.option('-f', '--folder-id', help='the folder to ingest into', required=True)
@click.option('-r', '--upload-site_url', help='the URL to the upload site to watch', required=True)
@click.option('-u', '--api-url', default='http://localhost:8080/api/v1', help='RESTful API URL '
                   '(e.g https://girder.example.com/api/v1)')
@click.option('-k', '--api-key', envvar='GIRDER_API_KEY', default=None,
              help='[default: GIRDER_API_KEY env. variable]', required=True)
@click.option('-i', '--shot-poll-interval', default=30, type=int, help='shot poll interval (sec)')
@click.option('-v', '--run-poll-interval', default=30, type=int, help='shot poll interval (sec)')
def main(folder_id, upload_site_url, api_url, api_key, shot_poll_interval, run_poll_interval):
    #gc = GC(api_url=api_url, api_key=api_key)
    if upload_site_url[-1] == '/':
        upload_site_url = upload_site_url[:-1]
    log = logging.getLogger('adash')
    log.info('Watching: %s' % upload_site_url)

    asyncio.run(
        watch(folder_id, upload_site_url, api_url, api_key,
              shot_poll_interval, run_poll_interval)
    )
