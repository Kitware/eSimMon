from setuptools import setup, find_packages

setup(
    name='esimmon-plugin',
    version='0.0.1',
    description='Finds items matching search parameters.',
    packages=find_packages(),
    install_requires=[
      'girder>=3.0.0'
    ],
    entry_points={
      'girder.plugin': [
          'esimmon_plugin = esimmon_plots:ESimMonPlugin'
      ]
    }
)
