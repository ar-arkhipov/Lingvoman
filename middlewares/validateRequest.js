const config = require('../libs/config');
const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  const token = (req.headers['x-access-token']);

  if (token) {
    try {
      const decoded = jwt.verify(token, config['jwtSecret']);
      const dUser = decoded.user;

      if (decoded.exp <= Date.now() / 1000) {
        res.status(400);
        res.json({
          'status': 400,
          'message': 'Token Expired'
        });
      }

      if (dUser) {
        const role = dUser.role;
        const query = req.url;

        if (checkRights(query, role)) {
          next(); // To move to next middleware
        } else {
          res.status(403);
          res.json({
            'status': 403,
            'message': 'Forbidden'
          });
        }
      }
    } catch (err) {
      res.status(401);
      res.json({
        'status': 401,
        'message': 'Invalid user',
        'error': err
      });
      console.log(err);
    }
  } else {
    res.status(401);
    res.json({
      'status': 401,
      'message': 'Unauthorized'
    });
  }

  function checkRights(query, role) {
    if (role === 'admin') {
      return true;
    } else if (role === 'translater' && query.indexOf('/api/users') >= 0 || role !== 'translater') {
      return false;
    } else {
      return true;
    }
  }
};