var is = require('joi');

module.exports = is.object({
  _id: is.string().pattern(/^region_[A-Z0-9-]+$/),
  region_id: is.number().min(0),
  doc_type: 'region',
  region_code: is.string().pattern(/^[A-Z0-9-]+$/),
  local_code: is.string().uppercase(),
  region_name: is.string(),
  continent_code: is.string().uppercase(),
  iso_country: is.string().uppercase(),
});
