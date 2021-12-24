
from girder.api import access
from girder.api.describe import Description, autoDescribeRoute
from girder.api.rest import Resource
from girder.constants import AccessType
from .models.view import View as ViewModel


class View(Resource):
    def __init__(self):
        super().__init__()
        self.resourceName = 'view'
        self._model = ViewModel()

        self.route('DELETE', (':id',), self.deleteView)
        self.route('GET', (), self.find)
        self.route('POST', (), self.create_view)
        self.route('PUT', (':id',), self.update_view)

    @access.user
    @autoDescribeRoute(
        Description('List or search for views.')
        .responseClass('View', array=True)
        .param('text', 'Pass this to perform a full text search for views', required=False)
        .param('exact', 'If true, only return exact name matches. This is '
               'case sensitive.', required=False, dataType='boolean', default=False)
        .pagingParams(defaultSort='name')
    )
    def find(self, text=None, exact=False, offset=0, limit=0, sort=None):
        user = self.getCurrentUser()
        if text is not None:
          if exact:
            viewList = self._model.find(
              {'name': text}, offset=offset, limit=limit, sort=sort)
          else:
            viewList = self._model.textSearch(
              text, user=user, offset=offset, limit=limit, sort=sort)
        else:
          viewList = self._model.list(
            user=user, offset=offset, limit=limit, sort=sort)

        return viewList

    @access.user
    @autoDescribeRoute(
        Description('Create a new view.')
        .responseClass('View')
        .param('name', "The name of the new view.", paramType='formData')
        .param('rows', "The number of rows in the view.", paramType='formData')
        .param('columns', "The number of columns in the view.",
                paramType='formData')
        .jsonParam('items', 'The object describing the items shown and their position in the grid.',
                    paramType='formData', requireObject=True)
        .param('public', 'Whether this view should be available to everyone.', 
                required=False, dataType='boolean', default=True, paramType='formData')
        .errorResponse('A parameter was invalid, or the specified name already exists in the system.')
    )
    def create_view(self, name, rows, columns, items, public=True):
        user = self.getCurrentUser()

        view = self._model.create_view(
            name=name,
            rows=rows,
            columns=columns,
            items=items,
            public=public,
            user=user
        )

        return view

    @access.user
    @autoDescribeRoute(
      Description('Delete a view by ID.')
      .modelParam('id', model=ViewModel, level=AccessType.READ)
      .errorResponse('ID was invalid.')
    )
    def deleteView(self, view):
      self._model.remove(view)
      return {'message': f'Deleted view {view["name"]}.'}

    @access.user
    @autoDescribeRoute(
      Description("Update a view's information.")
      .modelParam('id', model=ViewModel, level=AccessType.WRITE)
      .param('name', 'The name of the view.', required=False)
      .param('rows', 'The number of rows in the view.', required=False)
      .param('columns', 'The number of columns in the view.', required=False)
      .jsonParam('items', 'The object describing the items shown and their position in the grid.',
                 required=False)
      .param('public', 'Whether this view should be available to everyone.',
             required=False, dataType='boolean')
      .errorResponse()
    )
    def update_view(self, view, name=None, rows=None, columns=None, items=None, public=None):
      if name is not None:
        view['name'] = name
      if rows is not None:
        view['rows'] = rows
      if columns is not None:
        view['columns'] = columns
      if items is not None:
        view['items'] = items
      if public is not None:
        self._model.setPublic(view, public, save=False)

      return self._model.save(view)
