from girder.plugin import GirderPlugin

from .esimmonfile import find_items


class ESimMonPlugin(GirderPlugin):
  DISPLAY_NAME = 'eSimMon Plugin'

  def load(self, info):
    info['apiRoot'].resource.route('GET', (':id', 'search'), find_items)
