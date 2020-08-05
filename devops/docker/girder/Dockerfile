FROM  girder/girder:3.0.12-py3

# Copy over girder
COPY girder /plugin/

# Force the latest version of CherryPy and cheroot for connection timeout fix
# See https://github.com/cherrypy/cheroot/pull/277
# Otherwise we run into issues with the load balancer on AWS
RUN pip3 install -U CherryPy==18.6.0 cheroot==8.4.2

# Install eSimMon plugin
RUN pip3 install -e /plugin/esimmon_plugin
