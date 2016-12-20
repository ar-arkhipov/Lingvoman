var express = require('express');
var router = express.Router();
var auth = require('../middlewares/auth.js');
var api = require('./api.js');

router.post('/login', auth.login);

// UI TRANSLATIONS PART

// serve translations in json for client (public method)
router.get('/uitranslate/:projectID', api.uiTranslationsGet);

// Private methods:

//serve aggregated list of available translations
router.get('/api/uitranslate/list', api.uiTranslationsGetList);
//serve a definite translations document
router.get('/api/uitranslate/item', api.uiTranslationsGetItem);
//save and update documents
router.post('/api/uitranslate/item', api.uiTranslationsChange);
//delete document from main base
router.delete('/api/uitranslate/item', api.uiTranslationsDelete);
//creating fully new document (new id, loc, alphaId)
router.put('/api/uitranslate/item', api.uiTranslationsCreate);
//serve aggregated list of available translations in backup collection
router.get('/api/uitranslate/backup', api.uiTranslationsBackupGetList);
//backup the previous version of document from backup collection
router.post('/api/uitranslate/backup', api.uiTranslationsBackupRestore);


//USERS ADMINISTRATION PART (admin rights only)
//Get list of all users
router.get('/api/users', api.userGetList);
//Create new user
router.put('/api/users', api.userCreate);
//Delete user
router.delete('/api/users', api.userDelete);


// OTHER PARTS NOT IMPLEMENTED YET

module.exports = router;

