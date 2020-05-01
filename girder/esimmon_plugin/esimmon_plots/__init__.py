from girder.plugin import GirderPlugin

from .esimmonfile import find_parameters


class ESimMonPlugin(GirderPlugin):
  DISPLAY_NAME = 'ESimMon Plugin'

  def load(self, info):
    info['apiRoot'].resource.route('GET', (':id', 'search'), find_parameters)
