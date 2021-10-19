
from girder.api import access
from girder.api.describe import Description, autoDescribeRoute
from girder.api.rest import Resource
from .models.view import View as ViewModel


class View(Resource):
    def __init__(self):
        super().__init__()
        self.resourceName = 'view'
        self._model = ViewModel()

        self.route('GET', (), self.find)
        self.route('POST', (), self.create_view)

    @access.user
    @autoDescribeRoute(
        Description('List or search for views.')
        .responseClass('View', array=True)
        .param('text', 'Pass this to perform a full text search for views', required=False)
        .pagingParams(defaultSort='name')
    )
    def find(self, text=None, offset=0, limit=0, sort=None):
        return list(self._model.search(
            text=text,
            user=self.getCurrentUser(),
            offset=offset,
            limit=limit,
            sort=sort
        ))

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
