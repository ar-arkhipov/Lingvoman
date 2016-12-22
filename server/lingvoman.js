//Dependencies
var config = require('./libs/config.js');
var express         = require('express');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var morgan = require('morgan');
var path            = require('path');

var app = express();


app.use(morgan('dev')); //logger
app.use(bodyParser());  //parsing of post request body
app.use(methodOverride()); //adding understanding of put, delete etc. methods
app.use(express.static(path.join(__dirname, "public"))); //static files serve

//allow cross-domain requests
app.all('*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "x-access-token, Accept, Content-Type, Origin");
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE, OPTIONS');
  if (req.method == 'OPTIONS') {
      res.status(200);
      return res.send();
  }
  next();
 });

app.all('/api/*', [require('./middlewares/validateRequest')]);

app.use('/', require('./routes'));

//start server
app.listen(config.get('port'), function(){
    console.log('Express server listening on port ' + config.get('port'));
});