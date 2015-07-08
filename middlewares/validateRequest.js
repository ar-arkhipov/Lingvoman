var config = require('../libs/config');
var jwt = require('jwt-simple');

module.exports = function(req, res, next) {
  var token = (req.headers['x-access-token']);
  if (token) {
    try {
      var decoded = jwt.decode(token, config.get('jwtSecret'));
      var dUser = decoded.user;

      if (decoded.exp <= Date.now()) {
        res.status(400);
        res.json({
          "status": 400,
          "message": "Token Expired"
        });
      }
      if (dUser) {
        var role = dUser.role;
        var query = req.url;
        if (checkRights(query, role)) {
          next(); // To move to next middleware
        } else {
          res.status(403);
          res.json({
            "status": 403,
            "message": "Forbidden"
          });
        }
      }
    } catch (err) {
      res.status(401);
      res.json({
        "status": 401,
        "message": "Invalid user",
        "error": err
      });
      console.log(err);
    }
  } else {
    res.status(401);
    res.json({
      "status": 401,
      "message": "Unauthorized"
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