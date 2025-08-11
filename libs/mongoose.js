const config = require('./config.js');
const mongoose = require('mongoose');

mongoose.connect(config['mongouri']).then(() => {
	console.log('Connected');
}).catch((err) => {
	console.log('error', err);
});

// mongoose.set('debug', true);

const Schema = mongoose.Schema;

// Schemas
const translateSchema = new Schema({
    projectID: Number,
    projectAlphaId: String,
    locale: String,
    translations: { type: Object, default: {} }
}, { strict: false, minimize: false });

const UserSchema = new Schema({
	username: {
		type: String,
		unique: true,
		required: true
	},

	password: {
		type: String,
		required: true
	},

	userObj: {
		type: Object
	}
});

//Models

const UiTran = mongoose.model('UiTran', translateSchema);
const UiReservedTran = mongoose.model('UiReservedTran', translateSchema);
const User = mongoose.model('User', UserSchema);

module.exports.UiTran = UiTran;
module.exports.UiReservedTran = UiReservedTran;
module.exports.User = User;
