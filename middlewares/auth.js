const config = require('../libs/config');
const jwt = require('jsonwebtoken');
const User = require('../libs/mongoose.js').User;
const pwd = require('./pwd.js');

const auth = {
	async login(req, res) {
		const username = req.body.username || '';
		const password = req.body.password || '';

		if (username === '' || password ==='') {
			res.status(401);
			res.json({
				'status':401,
				'message': 'Invalid credentials'
			});
		} else {
			await auth.validate(username, password, res);
		}
	},

	async validate(username, password, res) {
		try {
			const doc = await User.findOne({username});

			if(doc) {
				const splitted = doc.password.split(':');

				if (splitted[0] === pwd.pwdcheck(password, splitted[1])) {
					res.status(200);
					res.json(genToken(doc.userObj));
				} else {
					res.status(401);
					res.json({
						'status': 401,
						'message': 'Invalid credentials'
					});
				}
			} else {
				res.status(401);
				res.json({
					'status': 401,
					'message': 'Invalid credentials'
				});
			}
		} catch (err) {
			console.error(err);
			res.status(500);
			res.json({
				'status': 500,
				'message': 'Internal server error'
			});
		}
	}
};

function genToken(user) {
	const expires = expiresIn(1);
	const token = jwt.sign({
		exp : Math.floor(expires / 1000),
		user
	}, config['jwtSecret']);

	return {
		token,
		expires,
		user
	};
}

function expiresIn(num) {
	const dateObj = new Date();

	return dateObj.setDate(dateObj.getDate() + num);
}

module.exports = auth;
