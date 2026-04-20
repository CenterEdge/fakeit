var is = require('joi');

module.exports = is.object({
  _id: is.string().pattern(/^user_[1-6]_auth$/),
  doc_type: 'user-auth',
  username: is.string(),
  password: is.string(),
  user_id: is.number(),
});
