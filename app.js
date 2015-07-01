//Dependencies
var express         = require('express');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var morgan = require('morgan');
var path            = require('path'); 
var Tran = require('./mongoose.js').Tran; //model for main translations collection
var ReservedTran = require('./mongoose.js').ReservedTran; //model for reserved (backup) translations collection
var app = express();


app.use(morgan('dev')); //logger
app.use(bodyParser());  //parsing of post request body
app.use(methodOverride()); //adding understanding of put, delete etc. methods
app.use(express.static(path.join(__dirname, "public"))); //static files serve 


//allow cross-domain requests
app.all('*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type");
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  next();
 });

//simple serving of translations for site, should be exported as independent app
app.get('/translate/:productId', function (req, res) {
    Tran.find({"projectID":req.params.productId, "locale":req.query.lang}, {translations:1, _id:0}, function(err, data) {
    	res.json(data[0].toObject().translations);
    });
});

//serve aggregated list of available translations
app.get('/init', function(req, res) {
	Tran.aggregate([
		{$group:{_id:{projectID:"$projectID", alpha:"$projectAlphaId"}, locales: {$addToSet : "$locale"}}},
		{$project:{projectID: "$_id.projectID", projectAlphaId: "$_id.alpha", locales:1}}
		]).exec(function(err, data){
		console.log(data);
		res.send(data);
	});
});

//serve a definite translations document
app.get('/translations', function(req, res) {
	console.log('REQUESTED: ', req.query);
	Tran.find(req.query, function(err, data){
			res.send(data);
	});
});

//save and update documents
app.post('/changetranslation', function(req, res) {
	var query = {'projectID':req.body.projectID, 'locale':req.body.locale};
	reservator(query, makeChanges);
	function makeChanges() {
		Tran.update(query, req.body, {upsert:true}, function(err, data) {
			res.send(data);
		});
	}
});

//delete document from main base
app.delete('/changetranslation', function(req, res) {
	var query = {'projectID':req.query.projectID, 'locale': req.query.locale};
	Tran.remove(query, function(err, data) {
		res.send(data);
	});
	console.log('project: ' + req.query.projectID, 'loc: ' + req.query.locale);
});

//creating fully new document (new id, loc, alphaId)
app.put('/changetranslation', function(req, res) {
	Tran.count({'projectID':req.body.projectID}, function(err, data) {
		if (err) console.log(err);
		if (data == 0) {
			Tran.create(req.body, function(err, data) {
				if (err) console.log(err);
				res.send(data);
			});
		} else {
			res.send({code:0, msg:'already exists'});
		}
	});
});

//serve aggregated list of available translations in backup collection
app.get('/restore', function(req, res) {
	ReservedTran.aggregate([
		{$group:{_id:{projectID:"$projectID", alpha:"$projectAlphaId"}, locales: {$addToSet : "$locale"}}},
		{$project:{projectID: "$_id.projectID", projectAlphaId: "$_id.alpha", locales:1}}
		]).exec(function(err, data){
		console.log(data);
		res.send(data);
	});
});

//backup the previous version of document from backup collection
app.post('/restore', function(req, res) {
	ReservedTran.findOne(req.body, function(err, doc) {
		if (err) console.log(err);
		if (doc) {
			delete doc._id;
			newDoc = JSON.parse(JSON.stringify(doc));
			Tran.update(req.body, newDoc, {upsert:true}, function(err, data) {
				console.log(data);
				res.send(data);
			});
		}
	});
})


//function for making backup of the last version of file before changing or deleting,
// backup collection always stores previous state of document (1 step back)
var reservator = function(query, callback) {
	Tran.findOne(query, function(err, doc) {
		if (err) console.log(err);
		if (doc) {
			delete doc._id;
			newDoc = JSON.parse(JSON.stringify(doc));
			ReservedTran.update(query, newDoc, {upsert:true}, function(err, data) {
				if (err) throw err;
				console.log(data);
				callback();
			});
		} else {
			callback();
		}
	});
}

//start server
app.listen(1337, function(){
    console.log('Express server listening on port 1337');
});