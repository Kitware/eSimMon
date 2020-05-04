FROM  girder/girder:3.0.12-py3

# Copy over girder
COPY girder /plugin/

# Install eSimMon plugin
RUN pip3 install -e /plugin/esimmon_plugin
