from girder.api import access
from girder.api.describe import Description, autoDescribeRoute
from girder.api.rest import getCurrentUser

from girder.utility.path import getResourcePath

from girder.models.collection import Collection
from girder.models.folder import Folder

from girder.exceptions import RestException


def _filter_items(folders, user, query, matches, parent):
    for folder in folders:
        items = list(Folder().childItems(folder, parentType='folder', user=user))
        for item in items:
            full_path = getResourcePath('item', item, user)
            trimmed_path = full_path.split(parent['name'])[1]
            if query in trimmed_path:
                matches.append({'text': trimmed_path, 'value': item})
        folders = list(Folder().childFolders(folder, parentType='folder', user=user))
        if folders:
            _filter_items(folders, user, query, matches, parent)
    return matches

@access.public
@autoDescribeRoute(
  Description('Search for items that are children of the given resource.')
  .param('id', 'The ID of the resource.', paramType='path')
  .param('type', 'The type of the resource (must be collection or folder).')
  .param('q', 'The search query.', dataType='string', required=False)
)
def find_items(id, type, q):
    user = getCurrentUser()
    if type == 'collection':
        resource = Collection().load(id, user=user)
        if resource is None:
            raise RestException('Invalid resource id.')
        folders = list(Folder().childFolders(resource, parentType=type, user=user))
    elif type == 'folder':
        resource = Folder().load(id, user=user)
        if resource is None:
            raise RestException('Invalid resource id.')
        folders = [resource]
    else:
        raise RestException('Parent must be a collection or folder.')

    results = _filter_items(folders, user, q, [], resource)

    return {'results': results}
