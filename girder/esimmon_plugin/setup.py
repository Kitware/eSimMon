from setuptools import find_packages
from setuptools import setup

setup(
    name="esimmon-plugin",
    version="0.0.1",
    description="Provide endpoints to support eSimMon dashboard.",
    packages=find_packages(),
    install_requires=["girder>=3.0.0"],
    entry_points={"girder.plugin": ["esimmon_plugin = esimmon_plots:ESimMonPlugin"]},
)
