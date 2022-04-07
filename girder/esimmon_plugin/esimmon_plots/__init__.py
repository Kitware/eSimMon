from girder.plugin import GirderPlugin

from .folder_search import find_items
from .view import View


class ESimMonPlugin(GirderPlugin):
    DISPLAY_NAME = "eSimMon Plugin"

    def load(self, info):
        info["apiRoot"].resource.route("GET", (":id", "search"), find_items)
        info["apiRoot"].view = View()
