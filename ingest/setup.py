from setuptools import find_packages
from setuptools import setup

setup(
    name="esimmon",
    version="0.0.2",
    description="eSimMon dashboard.",
    long_description="eSimMon dashboard.",
    url="https://github.com/Kitware/eSimMon",
    author="Kitware Inc",
    license="BSD 3-Clause",
    classifiers=[
        "Development Status :: 3 - Alpha",
        "License :: OSI Approved :: BSD License",
        "Programming Language :: Python :: 3",
    ],
    keywords="",
    packages=find_packages(),
    install_requires=[
        "girder_client",
        "click",
        "requests",
        "faker",
        "flask",
        "aiohttp",
        "click_plugins",
        "async_lru",
        "coloredlogs",
        "tenacity",
        "aiofiles",
    ],
    entry_points={
        "console_scripts": ["esimmon=esimmon.cli:main"],
        "esimmon.cli_plugins": [
            "mock = esimmon.cli.mock:main",
            "watch = esimmon.cli.watch:main",
        ],
    },
)
