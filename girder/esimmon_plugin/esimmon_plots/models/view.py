import datetime

from girder.constants import AccessType
from girder.exceptions import ValidationException
from girder.models.model_base import AccessControlledModel

class View(AccessControlledModel):

    def initialize(self):
        self.name = 'views'
        self.ensureIndices(['creatorId', 'created', 'items', 'name'])
        self.ensureTextIndex({'name': 1, 'items': 1}, language='none')

    def validate(self, doc):
        doc['name'] = doc.get('name', '').lower().strip()
        doc['rows'] = doc.get('rows', '')
        doc['columns'] = doc.get('columns', '')
        doc['items'] = doc.get('items', {})
        doc['creatorId'] = doc.get('creatorId', '')

        if not doc['name']:
            raise ValidationException('Name must not be empty.', 'name')

        if not doc['rows']:
            raise ValidationException('Rows must not be empty.', 'rows')

        if not doc['columns']:
            raise ValidationException('Columns must not be empty.', 'columns')

        if not doc['items']:
            raise ValidationException('Items must not be empty.', 'items')

        self._validate_name(doc['name'], doc['creatorId'])

        return doc

    def _validate_name(self, name, creatorId):
        public_view = self.findOne({'name': name, 'public': True})
        private_view = self.findOne({'name': name, 'creatorId': creatorId})

        if public_view is not None or private_view is not None:
            raise ValidationException('View with this name already exists.', 'name')

    def create_view(self, name, rows, columns, items, public, user):
        view = {
            'name': name,
            'rows': rows,
            'columns': columns,
            'items': items,
            'created': datetime.datetime.utcnow(),
            'creatorId': user['_id'],
        }
        self.setPublic(view, public=public, save=False)
        view = self.save(view)

        return view

    def search(self, text, user, limit, offset, sort):
        if text is not None:
            cursor = self.textSearch(text, sort=sort)
        else:
            cursor = self.find({}, sort=sort)

        filtered_results = self.filterResultsByPermission(
            cursor=cursor,
            user=user,
            level=AccessType.READ,
            limit=limit,
            offset=offset
        )

        return filtered_results
