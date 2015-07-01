var mongoose    = require('mongoose');

mongoose.connect('mongodb://localhost/translate');
var db = mongoose.connection;

var Schema = mongoose.Schema;

// Schemas
var translateSchema = mongoose.Schema({
    projectID : Number,
    projectAlphaId : String,
    locale : String
    }, {strict:false});

var Tran = mongoose.model('Tran', translateSchema); 
var ReservedTran = mongoose.model('ReservedTran', translateSchema);

module.exports.Tran = Tran;
module.exports.ReservedTran = ReservedTran;