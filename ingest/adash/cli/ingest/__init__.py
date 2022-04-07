import io
import os
import re
import sys
import types
from pathlib import Path
from urllib.parse import urlparse

import click
import requests
from flask import Flask
from flask import jsonify
from flask import send_from_directory
from girder_client import GirderClient


class GC(GirderClient):
    def __init__(self, api_url=None, api_key=None):
        super(GC, self).__init__(apiUrl=api_url)

        self.authenticate(apiKey=api_key)


folders = {}


def _ensure_folder(gc, root_folder, path):
    if path in folders:
        return folders[path]

    parent = os.path.dirname(path)
    child = os.path.basename(path)

    parent_type = "folder"
    # lookup parent folder
    if parent:
        parent = _ensure_folder(gc, root_folder, folders[parent])
    else:
        parent = root_folder

    click.echo(click.style("Creating folder: %s" % path, fg="red"))
    folder = gc.createFolder(parent, child, parentType=parent_type, reuseExisting=True)

    folders[path] = folder["_id"]

    return folder["_id"]


items = {}
file_regex = re.compile(r"(^.*)\.(\d{4})\.png")
item_files = {}


def _process_file(gc, root_folder, file_request, path):
    # For now only process png

    match = file_regex.match(os.path.basename(path))
    if match:

        filename = match.group(1)
        timestep = match.group(2)
        parent_path = os.path.dirname(path)
        # Use parent folder if its not a duplicate of the filename
        if os.path.basename(parent_path) != filename:
            parent_folder_id = _ensure_folder(gc, root_folder, parent_path)
        # Otherwise use grandparent
        else:
            parent_path = os.path.dirname(parent_path)
            parent_folder_id = _ensure_folder(gc, root_folder, parent_path)

        item_path = os.path.join(parent_path, filename)
        if item_path not in items:
            click.echo(click.style("Creating item: %s" % item_path, fg="blue"))
            item_id = gc.createItem(parent_folder_id, filename, reuseExisting=True)[
                "_id"
            ]
            items[item_path] = item_id
        else:
            item_id = items[item_path]

        size = len(file_request.content)
        stream = io.BytesIO(file_request.content)
        name = "%s.png" % timestep
        file_path = os.path.join(item_path, name)

        # Check we haven't already uploaded the file
        if item_id in item_files:
            files = item_files[item_id]
        else:
            files = set([x["name"] for x in gc.listFile(item_id)])
            item_files[item_id] = files

        if name not in files:
            click.echo(click.style("Uploading file: %s" % file_path, fg="green"))
            gc.uploadFile(item_id, stream, name, size, parentType="item")
        else:
            click.echo(click.style("File already exists: %s" % file_path, fg="yellow"))


@click.command("ingest", help="Ingest data into Girder")
@click.option("-f", "--folder", help="the folder to ingest into", required=True)
@click.option(
    "-r",
    "--image-list-url",
    help="the URL to the image list file to ingest",
    required=True,
)
@click.option(
    "-u",
    "--api-url",
    default="http://localhost:8080/api/v1",
    help="RESTful API URL " "(e.g https://girder.example.com/api/v1)",
)
@click.option(
    "-k",
    "--api-key",
    envvar="GIRDER_API_KEY",
    default=None,
    help="[default: GIRDER_API_KEY env. variable]",
    required=True,
)
def main(folder, image_list_url, api_url, api_key):
    gc = GC(api_url=api_url, api_key=api_key)
    base_url = image_list_url.rsplit("/", 1)[0]
    # First fetch the image list
    image_list_request = requests.get(image_list_url)

    # Do we have a retry file from a previous run?
    retry_filename = ".%s.adash" % urlparse(image_list_url).path.replace("/", "_")
    retry_file_path = Path.home() / retry_filename
    # The last file processed loaded from the retry file
    retry_last_processed = None
    if retry_file_path.exists():
        with retry_file_path.open() as fp:
            retry_last_processed = fp.readline()

    # The last file processed on this run
    last_processed = None
    try:
        for line in image_list_request.text.splitlines():

            # Skip until we find the file we last processed
            if retry_last_processed is not None and line != retry_last_processed:
                continue
            else:
                retry_last_processed = None

            # Try to fetch to see if we are dealing with a file or folder
            r = requests.get("%s/%s" % (base_url, line))

            if r.status_code == 200:
                _process_file(gc, folder, r, line)
            elif r.status_code == 403:
                # folder
                pass
            else:
                r.raise_for_status()

            last_processed = line
    except:
        if last_processed is not None:
            with retry_file_path.open("w") as fp:
                fp.write(last_processed)
        raise

    # If we get to the end remove any retry file
    if retry_file_path.exists():
        retry_file_path.unlink()
