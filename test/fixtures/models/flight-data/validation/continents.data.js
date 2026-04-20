var is = require('joi');

module.exports = is.object({
  _id: is.string().pattern(/^continent_[A-Z0-9]+$/),
  continent_code: is.string().uppercase(),
  doc_type: 'continent',
  continent_name: is.string().pattern(/^[A-Z][A-Za-z\s]+$/),
});
