import datetime

from girder.constants import AccessType
from girder.exceptions import ValidationException
from girder.models.model_base import AccessControlledModel

class View(AccessControlledModel):

    def initialize(self):
        self.name = 'view'
        self.ensureIndices(['creatorId', 'created', 'items', 'name'])
        self.ensureTextIndex(
            {'name': 1, 'creatorFirst': 1, 'creatorLast': 1}, language='none')

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

        # Ensure unique names
        q = {'name': doc['name']}
        if '_id' in doc:
            q['_id'] = {'$ne': doc['_id']}
        existing = self.findOne(q)
        if existing is not None:
            raise ValidationException('View with that name already exists.',
                                      'name')

        return doc

    def create_view(self, name, rows, columns, items, public, user):
        view = {
            'name': name,
            'rows': rows,
            'columns': columns,
            'items': items,
            'created': datetime.datetime.utcnow(),
            'creatorId': user['_id'],
            'creatorFirst': user['firstName'],
            'creatorLast': user['lastName']
        }
        self.setUserAccess(view, user=user, level=AccessType.ADMIN, save=False)
        self.setPublic(view, public=public, save=False)
        view = self.save(view)

        return view

    def remove(self, view):
      super().remove(view)
