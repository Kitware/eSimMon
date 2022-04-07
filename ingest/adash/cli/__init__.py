import logging
import sys

import click
import coloredlogs
from click_plugins import with_plugins
from pkg_resources import iter_entry_points


@with_plugins(iter_entry_points("adash.cli_plugins"))
@click.group()
def main():
    root = logging.getLogger()
    root.setLevel(logging.DEBUG)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.DEBUG)
    formatter = coloredlogs.ColoredFormatter(
        "%(asctime)s,%(msecs)03d - %(name)s - %(levelname)s - %(message)s"
    )
    handler.setFormatter(formatter)
    root.addHandler(handler)
