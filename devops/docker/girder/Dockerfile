FROM  girder/girder:3.0.12-py3

# Copy over adios-dashboard
COPY . /adios-dashboard

# Install eSimMon plugin
RUN pip3 install -e /adios-dashboard/girder/esimmon_plugin/

# Rebuild the Girder UI
RUN girder build
