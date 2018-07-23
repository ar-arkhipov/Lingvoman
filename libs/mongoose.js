var config = require('./config.js');
var mongoose    = require('mongoose');

mongoose.connect(config['mongouri']);
var db = mongoose.connection;

var Schema = mongoose.Schema;

// Schemas
var translateSchema = new Schema({
    projectID : Number,
    projectAlphaId : String,
    locale : String
    }, {strict:false});

var UserSchema = new Schema({
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

var UiTran = mongoose.model('UiTran', translateSchema);
var UiReservedTran = mongoose.model('UiReservedTran', translateSchema);
var User = mongoose.model('User', UserSchema);

module.exports.UiTran = UiTran;
module.exports.UiReservedTran = UiReservedTran;
module.exports.User = User;