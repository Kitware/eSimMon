import abc
import asyncio
import json
import logging
import mimetypes
import re
import ssl
import tarfile
import tempfile
from io import BytesIO
from json.encoder import INFINITY
from pathlib import Path
from typing import Union
from urllib.parse import urlparse

import adios2
import aiofiles
import aiohttp
import click
import tenacity
from async_lru import alru_cache


class AsyncGirderClient(object):
    def __init__(self, session, api_url, fastapi_url):
        self._ratelimit_semaphore = asyncio.Semaphore(5)
        self._api_url = api_url.rstrip("/")
        self._fastapi_url = fastapi_url
        self._folder_create_semaphore = asyncio.Semaphore()
        self._item_create_semaphore = asyncio.Semaphore()
        self._movie_create_semaphore = asyncio.Semaphore()
        self._session = session

    async def authenticate(self, api_key):
        params = {"key": api_key}
        async with self._session.post(
            "%s/api_key/token" % (self._api_url), params=params
        ) as r:
            r.raise_for_status()
            auth = await r.json()
        self._headers = {"Girder-Token": auth["authToken"]["token"]}

    @tenacity.retry(
        retry=tenacity.retry_if_exception_type(
            aiohttp.client_exceptions.ServerConnectionError
        ),
        wait=tenacity.wait_exponential(max=10),
        stop=tenacity.stop_after_attempt(10),
    )
    async def post(
        self,
        path,
        headers=None,
        params=None,
        raise_for_status=True,
        useFastApi=False,
        **kwargs,
    ):
        if params is not None:
            params = {k: str(v) for (k, v) in params.items()}

        if headers is None:
            headers = self._headers
        else:
            headers.update(self._headers)

        url = self._fastapi_url if useFastApi else self._api_url

        async with self._ratelimit_semaphore:
            async with self._session.post(
                "%s/%s" % (url, path),
                headers=headers,
                params=params,
                **kwargs,
            ) as r:
                if raise_for_status:
                    r.raise_for_status()
                return await r.json()

    @tenacity.retry(
        retry=tenacity.retry_if_exception_type(
            aiohttp.client_exceptions.ServerConnectionError
        ),
        wait=tenacity.wait_exponential(max=10),
        stop=tenacity.stop_after_attempt(10),
    )
    async def put(
        self,
        path,
        headers=None,
        params=None,
        raise_for_status=True,
        useFastApi=False,
        **kwargs,
    ):
        if params is not None:
            params = {k: str(v) for (k, v) in params.items()}

        if headers is None:
            headers = self._headers
        else:
            headers.update(self._headers)

        url = self._fastapi_url if useFastApi else self._api_url

        async with self._ratelimit_semaphore:
            async with self._session.put(
                "%s/%s" % (url, path),
                headers=headers,
                params=params,
                **kwargs,
            ) as r:
                if raise_for_status:
                    r.raise_for_status()
                return await r.json()

    @tenacity.retry(
        retry=tenacity.retry_if_exception_type(
            aiohttp.client_exceptions.ServerConnectionError
        ),
        wait=tenacity.wait_exponential(max=10),
        stop=tenacity.stop_after_attempt(10),
    )
    async def get(
        self,
        path,
        raise_for_status=True,
        params=None,
        status=False,
        useFastApi=False,
        **kwargs,
    ):
        if params is not None:
            params = {k: str(v) for (k, v) in params.items()}

        url = self._fastapi_url if useFastApi else self._api_url

        async with self._ratelimit_semaphore:
            async with self._session.get(
                "%s/%s" % (url, path),
                headers=self._headers,
                params=params,
                **kwargs,
            ) as r:
                if raise_for_status and not status:
                    r.raise_for_status()

                if status:
                    return (r.status, await r.json())
                else:
                    return await r.json()

    @alru_cache(maxsize=1000)
    async def create_folder(self, parent_id, parent_type, name):
        params = {
            "parentId": parent_id,
            "parentType": parent_type,
            "name": name,
            "description": "",
            "reuseExisting": True,
        }

        # We need this sempahore to prevent two folders with the same name be
        # create, this opertion in not atomic in Girder.
        async with self._folder_create_semaphore:
            return await self.post("folder", params=params)

    async def list_item(self, folder, name=None):
        params = {"folderId": folder["_id"]}
        if name is not None:
            params["name"] = name

        return await self.get("item", params=params)

    @alru_cache(maxsize=1000)
    async def create_item(self, folder_id, name):
        params = {
            "folderId": folder_id,
            "name": name,
            "description": "",
            "reuseExisting": True,
        }

        # We need this sempahore to prevent two items with the same name be
        # create, this opertion in not atomic in Girder.
        async with self._item_create_semaphore:
            return await self.post("item", params=params)

    async def get_item(self, item_id):
        return await self.get(f"item/{item_id}")

    async def upload_file(self, item, file_name, bits, size):
        mime_type, _ = mimetypes.guess_type(file_name)

        params = {
            "parentType": "item",
            "parentId": item["_id"],
            "name": file_name,
            "size": size,
            "mimeType": mime_type,
        }

        headers = {"Content-Length": str(size)}
        headers.update(self._headers)
        upload = await self.post("file", params=params, headers=headers, data=bits)

        return upload

    async def set_metadata(self, resource_type, _id, meta, semaphore=None):
        # The metadata put operation is not atomic!
        if semaphore is not None:
            await semaphore.acquire()
        try:
            return await self.put("%s/%s/metadata" % (resource_type, _id), json=meta)
        finally:
            if semaphore is not None:
                semaphore.release()

    async def get_metadata(self, resource_type, _id):
        resource = await self.get("%s/%s" % (resource_type, _id))

        return resource.get("meta")

    @alru_cache(maxsize=1000)
    async def resource_path(self, _id, resource_type):
        params = {"type": resource_type}

        return await self.get("resource/%s/path" % _id, params=params)

    async def lookup_resource(self, path):
        params = {"path": path, "test": True}

        (status, json_body) = await self.get(
            "resource/lookup", params=params, status=True
        )
        if status == 400:
            return None
        else:
            return json_body

    async def file_exist(self, item, name):
        item_path = await self.resource_path(item["_id"], "item")

        return await self.lookup_resource("%s/%s" % (item_path, name)) is not None

    async def get_folder(self, folder_id):
        return await self.get(f"folder/{folder_id}")

    async def list_folder(self, folder_id):
        params = {"parentId": folder_id, "parentType": "folder"}

        return await self.get("folder", params=params)

    async def create_movie(self, item, ext):
        # We need this sempahore to prevent two movies for the same item form
        # being created.
        async with self._movie_create_semaphore:
            await self.put(
                f"variables/{item['_id']}/timesteps/movie?format={ext}",
                useFastApi=True,
            )


class UploadSource(abc.ABC):
    @abc.abstractmethod
    async def fetch_json(self, url: str) -> Union[dict, None]:
        pass

    @abc.abstractmethod
    async def fetch_binary(self, url: str) -> Union[bytes, None]:
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


class HttpUploadSource(UploadSource):
    def __init__(self):
        self.session = None

    async def __aenter__(self):
        def ignore_aiohttp_ssl_eror(loop, aiohttpversion="3.5.4"):
            """Ignore aiohttp #3535 issue with SSL data after close

            There appears to be an issue on Python 3.7 and aiohttp SSL that throws a
            ssl.SSLError fatal error (ssl.SSLError: [SSL: KRB5_S_INIT] application data
            after close notify (_ssl.c:2609)) after we are already done with the
            connection. See GitHub issue aio-libs/aiohttp#3535

            Given a loop, this sets up a exception handler that ignores this specific
            exception, but passes everything else on to the previous exception handler
            this one replaces.

            If the current aiohttp version is not exactly equal to aiohttpversion
            nothing is done, assuming that the next version will have this bug fixed.
            This can be disabled by setting this parameter to None

            """
            if aiohttpversion is not None and aiohttp.__version__ != aiohttpversion:
                return

            orig_handler = loop.get_exception_handler()

            def ignore_ssl_error(loop, context):
                if context.get("message") == "SSL error in data received":
                    # validate we have the right exception, transport and protocol
                    exception = context.get("exception")
                    protocol = context.get("protocol")
                    if (
                        isinstance(exception, ssl.SSLError)
                        and exception.reason == "KRB5_S_INIT"
                        and isinstance(protocol, asyncio.sslproto.SSLProtocol)
                        and isinstance(
                            protocol._app_protocol, aiohttp.client_proto.ResponseHandler
                        )
                    ):
                        if loop.get_debug():
                            asyncio.log.logger.debug(
                                "Ignoring aiohttp SSL KRB5_S_INIT error"
                            )
                        return
                if orig_handler is not None:
                    orig_handler(loop, context)
                else:
                    loop.default_exception_handler(context)

            loop.set_exception_handler(ignore_ssl_error)

        ignore_aiohttp_ssl_eror(asyncio.get_running_loop())

        self.session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(verify_ssl=False)
        )

        return await super().__aenter__()

    async def __aexit__(self, *args):
        if self.session is not None:
            await self.session.close()

    @tenacity.retry(
        retry=tenacity.retry_if_exception_type(
            aiohttp.client_exceptions.ServerConnectionError
        ),
        wait=tenacity.wait_exponential(max=10),
        stop=tenacity.stop_after_attempt(10),
    )
    async def fetch_json(self, url: str) -> Union[dict, None]:
        if self.session is None:
            raise RuntimeError("Session has not been initialized")

        async with self.session.get(url) as r:
            if r.status == 404:
                return None

            r.raise_for_status()

            return await r.json()

    @tenacity.retry(
        retry=tenacity.retry_if_exception_type(
            aiohttp.client_exceptions.ServerConnectionError
        ),
        wait=tenacity.wait_exponential(max=10),
        stop=tenacity.stop_after_attempt(10),
    )
    async def fetch_binary(self, url: str) -> Union[bytes, None]:
        if self.session is None:
            raise RuntimeError("Session has not been initialized")

        async with self.session.get(url) as r:
            if r.status == 404:
                return None

            r.raise_for_status()

            return await r.read()


class FileSystemUploadSource(UploadSource):
    def _extract_path(self, url: str) -> str:
        r = urlparse(url)
        return r.path

    async def fetch_json(self, url: str) -> Union[dict, None]:
        if not Path(self._extract_path(url)).exists():
            return None

        async with aiofiles.open(self._extract_path(url), "r") as fp:
            data = await fp.read()

            return json.loads(data)

    async def fetch_binary(self, url: str) -> Union[bytes, None]:
        async with aiofiles.open(self._extract_path(url), "br") as fp:
            return await fp.read()


async def update_range_metadata(gc, image_tarball, bp_path, variable_items, semaphore):
    with tempfile.TemporaryDirectory() as tempdir:
        image_tarball.extractall(tempdir)
        with adios2.open(f"{tempdir}/{bp_path}", "r") as fh:
            for var, id in variable_items.items():
                attrs = fh.read_attribute_string(var)
                if not attrs:
                    # Current variable isn't in this file
                    continue

                # get existing item metadata
                item_meta = await gc.get_metadata("item", id)
                new_meta = {}

                # get variable names for current item
                attrs = json.loads(attrs[0])
                vars = fh.available_variables()

                if attrs["type"] != "mesh-colormap":
                    # All plots except mesh-colormap have x and y vars to grab
                    new_meta["x_range"] = item_meta.get(
                        "x_range", [INFINITY, -INFINITY]
                    )
                    x0 = float(vars[attrs["x"]]["Min"])
                    x1 = float(vars[attrs["x"]]["Max"])
                    old_x0, old_x1 = new_meta["x_range"]
                    new_meta["x_range"] = [min(old_x0, x0), max(old_x1, x1)]

                    new_meta["y_range"] = item_meta.get(
                        "y_range", [INFINITY, -INFINITY]
                    )
                    old_y0, old_y1 = new_meta["y_range"]
                    y_attrs = attrs["y"]
                    if not isinstance(attrs["y"], list):
                        y_attrs = [attrs["y"]]
                    for y in [vars[n] for n in y_attrs]:
                        start = min(old_y0, float(y["Min"]))
                        end = max(old_y1, float(y["Max"]))
                        new_meta["y_range"] = [start, end]

                color = attrs.get("color", None)
                if color is not None:
                    # Only some 2D plots have a color scalar variable
                    new_meta["color_range"] = item_meta.get(
                        "color_range", [INFINITY, -INFINITY]
                    )
                    c0 = float(vars[color]["Min"])
                    c1 = float(vars[color]["Max"])
                    old_c0, old_c1 = new_meta["color_range"]
                    new_meta["color_range"] = [min(old_c0, c0), max(old_c1, c1)]

                # update item metadata
                await gc.set_metadata("item", id, new_meta, semaphore)


async def ensure_folders(gc, parent, folders):
    for folder_name in folders:
        parent = await gc.create_folder(parent["_id"], "folder", folder_name)

    return parent


async def upload_image(
    gc, folder, shot_name, run_name, variable, timestep, bits, size, check_exists=False
):
    log = logging.getLogger("esimmon")
    image_path = Path(variable["image_name"])

    image_folders = [shot_name, run_name, variable["group_name"]]
    parent_folder = await ensure_folders(gc, folder, image_folders)

    name = None
    for k in ["name", "variable_name"]:
        name = variable.get(k)
        if name is not None:
            break

    if name is None:
        raise Exception("Unable to extract variable name.")

    variable_item = await gc.create_item(parent_folder["_id"], name)
    image_name = "%s%s" % (str(timestep).zfill(4), image_path.suffix)

    create = True
    if check_exists:
        create = not await gc.file_exist(variable_item, image_name)

    if create:
        log.info(
            'Uploading "%s/%s/%s".'
            % ("/".join([str(i) for i in image_folders]), name, image_name)
        )
        await gc.upload_file(variable_item, image_name, bits, size)


async def create_variable_item(
    gc, folder, shot_name, run_name, group_name, variable_name, timestep, time
):
    image_folders = [shot_name, run_name, group_name]
    parent_folder = await ensure_folders(gc, folder, image_folders)

    item = await gc.create_item(parent_folder["_id"], variable_name)
    meta = item["meta"]

    # Save the shot and run folder in the metadata
    if "runFolderId" not in meta:
        run_folder = await gc.get_folder(parent_folder["parentId"])
        shot_folder = await gc.get_folder(run_folder["parentId"])
        meta["runFolderId"] = run_folder["_id"]
        meta["shotFolderId"] = shot_folder["_id"]

    timesteps = meta.setdefault("timesteps", [])
    timesteps.append(timestep)
    time_values = meta.setdefault("time", [])
    time_values.append(time)

    await gc.set_metadata("item", item["_id"], meta)

    movie_folders = [shot_name, run_name, "movies", group_name]
    parent_folder = await ensure_folders(gc, folder, movie_folders)

    movie_item = await gc.create_item(parent_folder["_id"], variable_name)
    movie_meta = movie_item["meta"]

    # Save the associated item and movie ids for later reference
    movie_meta["itemId"] = item["_id"]
    await gc.set_metadata("item", movie_item["_id"], movie_meta)
    meta["movieItemId"] = movie_item["_id"]
    await gc.set_metadata("item", item["_id"], meta)

    return item["_id"]


async def create_movies(folder, gc):
    log = logging.getLogger("esimmon")
    ignored_folders = ["timesteps", "movies"]
    folders = await gc.list_folder(folder["_id"])
    folders = [f for f in folders if f["name"] not in ignored_folders]
    items = []
    for f in folders:
        items_list = await gc.list_item(f)
        items.extend(items_list)
    for item in items:
        log.info(
            f"Creating movies for item \"{item['name']}\" in run \"{folder['name']}\""
        )
        for ext in ["mp4", "mpg"]:
            await gc.create_movie(item, ext)


async def upload_timestep_bp_archive(
    gc,
    folder,
    shot_name,
    run_name,
    timestep,
    bp_filename,
    bits,
    size,
    check_exists=False,
):
    log = logging.getLogger("esimmon")

    folders = [shot_name, run_name, "timesteps"]
    parent_folder = await ensure_folders(gc, folder, folders)

    # Get/create the timesteps item
    timesteps_item = await gc.create_item(parent_folder["_id"], timestep)

    create = True
    if check_exists:
        create = not await gc.file_exist(timesteps_item, bp_filename)

    if create:
        log.info(
            'Uploading "%s/%s/%s".'
            % ("/".join([str(i) for i in folders]), timestep, bp_filename)
        )
        await gc.upload_file(timesteps_item, bp_filename, bits, size)


async def fetch_variables(
    source: UploadSource, upload_url, shot_name, run_name, timestep
):
    url = f"{upload_url}/shots/{shot_name}/{run_name}/{timestep}/variables.json"

    return await source.fetch_json(url)


async def fetch_images_archive(
    source: UploadSource, upload_url, shot_name, run_name, timestep
):
    url = f"{upload_url}/shots/{shot_name}/{run_name}/{timestep}/images.tar.gz"

    return await source.fetch_binary(url)


async def fetch_images(
    source: UploadSource,
    gc,
    folder,
    upload_url,
    shot_name,
    run_name,
    timestep,
    metadata_semaphore,
    check_exists=False,
):
    log = logging.getLogger("esimmon")
    log.info('Fetching variables.json for timestep: "%d".' % timestep)

    # Fetch variables.json
    variables = await fetch_variables(source, upload_url, shot_name, run_name, timestep)

    if not variables:
        log.info('No variables for timestep "%d".' % timestep)
        return

    if variables is None:
        log.warning(
            'Unable to fetch variables.json. Timestep "%d" is missing.' % timestep
        )
    else:
        log.info('Fetching images.tar.gz for timestep: "%d".' % timestep)
        image_archive = await fetch_images_archive(
            source, upload_url, shot_name, run_name, timestep
        )
        if image_archive is None:
            log.warning("Data archive not found")
            return

        variable_items = {}
        buffer = BytesIO(image_archive)

        with tarfile.open(fileobj=buffer) as images_tgz:
            bp_files_to_upload = set([v["file_name"] for v in variables])

            # First ensure will be all variable items created
            for v in variables:
                variable_name = v["attribute_name"]
                try:
                    group_name = v["group_name"]
                except KeyError:
                    log.warning(
                        f"Unable to extract groups_name for '{variable_name}' in {shot_name}, skipping."
                    )
                    return

                try:
                    time = v["time"]
                except KeyError:
                    log.warning(
                        f"Unable to extract time for '{variable_name}' in {shot_name}, skipping."
                    )
                    return

                # Ensure we have the variable item created
                item_id = await create_variable_item(
                    gc,
                    folder,
                    shot_name,
                    run_name,
                    group_name,
                    variable_name,
                    timestep,
                    time,
                )
                variable_items[variable_name] = item_id

            tasks = []
            # Now upload the BP files
            for bp in bp_files_to_upload:
                timestep_bp_bytes = BytesIO()
                with tarfile.open(
                    mode="w:gz", fileobj=timestep_bp_bytes
                ) as timestep_bp_tgz:
                    # Remove the prefix
                    bp_file_path = "/".join(bp.split("/")[2:])
                    bp_file_regex = f"^{bp_file_path}.*"

                    bp_members = [
                        m
                        for m in images_tgz.getmembers()
                        if re.match(bp_file_regex, m.name)
                    ]
                    name = ""
                    for m in bp_members:
                        f = images_tgz.extractfile(m)
                        timestep_bp_tgz.addfile(m, f)
                        if Path(m.name).suffix == ".bp":
                            name = m.name

                await update_range_metadata(
                    gc, images_tgz, name, variable_items, metadata_semaphore
                )

                upload_filename = Path(bp).name.split(".")[0]
                upload_filename = f"{upload_filename}.bp.tgz"
                bytes = timestep_bp_bytes.getvalue()
                tasks.append(
                    asyncio.create_task(
                        upload_timestep_bp_archive(
                            gc,
                            folder,
                            shot_name,
                            run_name,
                            f"{timestep:04}",
                            upload_filename,
                            bytes,
                            len(bytes),
                            check_exists=False,
                        )
                    )
                )
            # Gather, so we fetch all images for this timestep before moving on to the
            # next one!
            await asyncio.gather(*tasks)

    # Set the current timestep
    metadata = {"currentTimestep": timestep}
    run_folder = await ensure_folders(gc, folder, [shot_name, run_name])
    await gc.set_metadata("folder", run_folder["_id"], metadata, metadata_semaphore)


# scheduler used to schedule fetch_images request inorder, so we fetch the images
# in timestep order.
async def fetch_images_scheduler(queue):
    log = logging.getLogger("esimmon")
    while True:
        try:
            fetch = await queue.get()
            await fetch
            queue.task_done()
        except asyncio.CancelledError:
            raise
        except:
            log.exception("Exception occured fetching images.")


async def fetch_run_time(source: UploadSource, upload_url, shot_name, run_name):
    run_path = f"{upload_url}/shots/{shot_name}/{run_name}/time.json"

    return await source.fetch_json(run_path)


async def watch_run(
    source: UploadSource,
    gc,
    folder,
    upload_url,
    shot_name,
    run_name,
    username,
    machine,
    run_poll_interval,
):
    log = logging.getLogger("esimmon")
    log.info('Starting to watch run "%s" shot "%s".' % (run_name, shot_name))
    fetch_images_queue = asyncio.Queue()
    metadata_semaphore = asyncio.Semaphore()
    scheduler = asyncio.create_task(fetch_images_scheduler(fetch_images_queue))
    last_timestep = None
    metadata = {"username": username, "machine": machine}
    run_folder = await ensure_folders(gc, folder, [shot_name, run_name])
    await gc.set_metadata("folder", run_folder["_id"], metadata, metadata_semaphore)
    while True:
        # Check to see what the last successfully processed timestep was
        metadata = await gc.get_metadata("folder", run_folder["_id"])
        if last_timestep is None:
            last_timestep = metadata.get("currentTimestep")
            if last_timestep is not None:
                log.info('Last timestep processed: "%d"' % last_timestep)
            else:
                log.info("No previous timestep have been processed.")
                last_timestep = 0

        # Now see where the simulation upload has got to
        run_path = "shots/%s/%s/time.json" % (shot_name, run_name)
        time = await fetch_run_time(source, upload_url, shot_name, run_name)
        # Wait for time.json to appear
        if time is None:
            log.warn('Unable to fetch "%s", waiting for 1 sec.' % run_path)
            await asyncio.sleep(1)
            continue

        new_timestep = time["current"]
        complete = time.get("complete", False)
        # Are we done. The run is marked as complete and we have ingested all the
        # timesteps.
        if complete and last_timestep == new_timestep:
            log.info('Run "%s" is complete.' % run_name)
            await fetch_images_queue.join()
            scheduler.cancel()
            # Create movies for all run params
            log.info('Generating movies for run "%s".' % run_name)
            await create_movies(run_folder, gc)
            log.info('Movies for run "%s" have been generated.' % run_name)
            break

        # Did we miss any timesteps?
        delta = new_timestep - last_timestep
        # We have missed to timesteps so need to catch up!
        if delta > 1:
            # First schedule a fetch of the next timesetp checking if the files
            # exists ( this is the one that could be partially processed.
            fetch_images_queue.put_nowait(
                fetch_images(
                    source,
                    gc,
                    folder,
                    upload_url,
                    shot_name,
                    run_name,
                    last_timestep + 1,
                    metadata_semaphore,
                    check_exists=True,
                )
            )

            # Then process the rest normally
            for t in range(last_timestep + 2, new_timestep + 1):
                fetch_images_queue.put_nowait(
                    fetch_images(
                        source,
                        gc,
                        folder,
                        upload_url,
                        shot_name,
                        run_name,
                        t,
                        metadata_semaphore,
                    )
                )
        # We successfully processed the last timestep so just schedule the processing
        # of the next.
        elif delta == 1:
            fetch_images_queue.put_nowait(
                fetch_images(
                    source,
                    gc,
                    folder,
                    upload_url,
                    shot_name,
                    run_name,
                    new_timestep,
                    metadata_semaphore,
                    # If we processing the first timestep we need to check
                    # the existence of the files, as the fetching of this
                    # timestep may have failed before.
                    last_timestep == 0,
                )
            )

        last_timestep = new_timestep

        await asyncio.sleep(run_poll_interval)


async def fetch_shot_index(source: UploadSource, upload_url):
    url = f"{upload_url}/shots/index.json"
    return await source.fetch_json(url)


async def watch_shots_index(
    source: UploadSource,
    gc,
    folder,
    upload_url,
    api_url,
    api_key,
    shot_poll_interval,
    run_poll_internval,
):
    log = logging.getLogger("esimmon")
    runs = set()
    shot_metadata_semaphore = asyncio.Semaphore()

    # Get users and machines
    metadata = await gc.get_metadata("folder", folder["_id"])
    users = set(metadata.get("users", [])) if metadata is not None else set()
    machines = set(metadata.get("machines", [])) if metadata is not None else set()

    while True:
        log.info("Fetching /shots/index.json")
        index = await fetch_shot_index(source, upload_url)
        if index is None:
            # Just wait for index.json to appear
            log.warn(
                f'Unable to fetch "shots/index.json", waiting for {shot_poll_interval} sec.'
            )
            await asyncio.sleep(shot_poll_interval)
            continue

        for shot in index:
            username = shot.get("username", None)
            users.add(username)
            machine = shot.get("machine_name", None)
            machines.add(machine)

            # TODO Update the meta data

            shot_name = shot["shot_name"]
            run_name = shot["run_name"]
            run_key = "%s/%s" % (shot_name, run_name)
            if run_key not in runs:
                asyncio.create_task(
                    watch_run(
                        source,
                        gc,
                        folder,
                        upload_url,
                        shot_name,
                        run_name,
                        username,
                        machine,
                        run_poll_internval,
                    )
                )
                runs.add(run_key)
        metadata = {"machines": list(machines), "users": list(users)}
        await gc.set_metadata(
            "folder", folder["_id"], metadata, shot_metadata_semaphore
        )
        await asyncio.sleep(shot_poll_interval)


async def watch(
    folder_id,
    upload_url,
    api_url,
    api_key,
    shot_poll_interval,
    run_poll_internval,
    fastapi_url,
):
    # Select the appropriate source class based on the URL
    if upload_url.startswith("http"):
        cls = HttpUploadSource
    elif upload_url.startswith("file"):
        cls = FileSystemUploadSource
    else:
        raise ValueError("Unsupported URL")

    async with cls() as source:
        async with aiohttp.ClientSession() as session:
            gc = AsyncGirderClient(session, api_url, fastapi_url)
            await gc.authenticate(api_key)

            folder = {"_id": folder_id}
            await watch_shots_index(
                source,
                gc,
                folder,
                upload_url,
                api_url,
                api_key,
                shot_poll_interval,
                run_poll_internval,
            )


@click.command("watch", help="Watch upload site and ingest data into Girder")
@click.option(
    "-f",
    "--folder-id",
    help="the folder to ingest into. [default: GIRDER_FOLDER_ID env. variable]",
    envvar="GIRDER_FOLDER_ID",
)
@click.option(
    "-r",
    "--upload_url",
    help="the URL to the upload location to watch. [default: UPLOAD_URL env. variable]",
    envvar="UPLOAD_URL",
    required=True,
)
@click.option(
    "-u",
    "--api-url",
    default="http://localhost:8080/api/v1",
    help="RESTful API URL "
    "(e.g https://girder.example.com/api/v1). [default: GIRDER_API_URL env. variable]",
    envvar="GIRDER_API_URL",
)
@click.option(
    "-k",
    "--api-key",
    envvar="GIRDER_API_KEY",
    help="[default: GIRDER_API_KEY env. variable]",
)
@click.option(
    "-i", "--shot-poll-interval", default=30, type=int, help="shot poll interval (sec)"
)
@click.option(
    "-v", "--run-poll-interval", default=30, type=int, help="run poll interval (sec)"
)
@click.option(
    "-a",
    "--fastapi-url",
    default=None,
    help="RESTful API URL (e.g https://girder.example.com/api/v1)",
)
def main(
    folder_id,
    upload_url,
    api_url,
    api_key,
    shot_poll_interval,
    run_poll_interval,
    fastapi_url,
):
    # gc = GC(api_url=api_url, api_key=api_key)
    if upload_url.startswith("http") and upload_url[-1] == "/":
        upload_url = upload_url[:-1]

    url = urlparse(upload_url)
    if url.scheme not in ["http", "https", "file"]:
        raise click.ClickException(f"'{url.scheme}' is not a supported URL scheme")

    log = logging.getLogger("esimmon")
    log.info("Watching: %s" % upload_url)

    if fastapi_url is None:
        fastapi_url = api_url

    asyncio.run(
        watch(
            folder_id,
            upload_url,
            api_url,
            api_key,
            shot_poll_interval,
            run_poll_interval,
            fastapi_url,
        )
    )
