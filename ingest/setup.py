from setuptools import setup, find_packages

setup(
    name='adash',
    version='0.0.1',
    description='ADIOS dashboard.',
    long_description='ADIOS dashboard.',
    url='https://github.com/Kitware/adios-dashboard',
    author='Kitware Inc',
    license='BSD 3-Clause',
    classifiers=[
        'Development Status :: 3 - Alpha',
        'License :: OSI Approved :: BSD License',
        'Programming Language :: Python :: 3',
    ],
    keywords='',
    packages=find_packages(),
    install_requires=[
        'girder_client',
        'click',
        'requests'
    ],
    entry_points= {
        'console_scripts': [
            'adash=adash.ingest:cli'
        ]
    }
)
