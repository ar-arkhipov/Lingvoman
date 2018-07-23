var config = require('../libs/config');
var jwt = require('jwt-simple');
var User = require('../libs/mongoose.js').User;
var pwd = require('./pwd.js');

var auth = {
	login: function(req, res) {
		var username = req.body.username || '';
		var password = req.body.password || '';
		if (username == '' || password =='') {
			res.status(401);
			res.json({
				"status":401,
				"message": "Invalid credentials"
			});
		} else {
			auth.validate(username, password, res);
		}
	},

	validate: function(username, password, res) {
		User.findOne({username:username}, function(err, doc) {
			if(doc) {
				var splitted = doc.password.split(':');
				if (splitted[0] == pwd.pwdcheck(password, splitted[1])) {
					res.status(200);
					res.json(genToken(doc.userObj));
				} else {
					res.status(401);
					res.json({
						"status": 401,
						"message": "Invalid credentials"
					});
				}
			} else {
				res.status(401);
				res.json({
					"status": 401,
					"message": "Invalid credentials"
				});
			}
		});
	}
};

function genToken(user) {
	var expires = expiresIn(1);
	var token = jwt.encode({
		exp : expires,
		user : user
	}, config['jwtSecret']);

	return {
		token: token,
		expires: expires,
		user: user
	};
}

function expiresIn(num) {
	var dateObj = new Date();
	return dateObj.setDate(dateObj.getDate() + num);
}

module.exports = auth;