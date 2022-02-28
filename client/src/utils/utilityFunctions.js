export function saveLayout(layout, name, rows, cols, meta, step=1, vis=true) {
  var formData = new FormData();
  processLayout(formData, layout);
  formData.set('name', name);
  formData.set('rows', rows);
  formData.set('columns', cols);
  formData.set('step', step);
  formData.set('public', vis);
  formData.set('meta', JSON.stringify(meta))

  return formData;
}

function processLayout(formData, layout) {
  const items = {}
  layout.forEach(item => {
    const { row, col } = item.$attrs;
    items[`${row}::${col}`] = item.itemId;
  });
  formData.set('items', JSON.stringify(items));
}
