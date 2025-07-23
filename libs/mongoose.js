const config = require('./config.js');
const mongoose = require('mongoose');

console.log('---------------');
console.log(config['mongouri']);
console.log('---------------');
mongoose.connect(config['mongouri']).then(() => {
	console.log('Connected');
}).catch((err) => {
	console.log('error', err);
});

const Schema = mongoose.Schema;

// Schemas
const translateSchema = new Schema({
    projectID : Number,
    projectAlphaId : String,
    locale : String
    }, {strict:false});

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
