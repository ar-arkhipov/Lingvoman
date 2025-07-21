//Dependencies
const config = require('./libs/config.js');
const express = require('express');
const methodOverride = require('method-override');
const morgan = require('morgan');
const path = require('path');

const app = express();


app.use(morgan('dev')); //logger
app.use(express.json()); //parsing of JSON request body (built into Express 4.16+)
app.use(express.urlencoded({ extended: true })); //parsing of URL-encoded request body
app.use(methodOverride()); //adding understanding of put, delete etc. methods
app.use(express.static(path.join(__dirname, 'public'))); //static files serve

//allow cross-domain requests
app.all('*', function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  next();
 });

app.all('/api/*', [require('./middlewares/validateRequest')]);

app.use('/', require('./routes'));

//start server
app.listen(config['port'], function(){
    console.log('Express server listening on port ' + config['port']);
});