const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.js');
const api = require('./api.js');

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

router.post('/api/uitranslate/sync', api.uiTranslationsSync);

// NEW FLEXIBLE LANGUAGE-AGNOSTIC TRANSLATION ENDPOINTS
//get available languages for a project
router.get('/api/uitranslate/languages/:projectID', api.uiTranslationsGetLanguages);
//add new language to project
router.post('/api/uitranslate/add-language', api.uiTranslationsAddLanguage);
//get unsynchronized translation info for a project
router.get('/api/uitranslate/unsync-info/:projectID', api.uiTranslationsGetUnsyncInfo);
//start flexible translation sync to any target language
router.post('/api/uitranslate/sync-flexible', api.uiTranslationsFlexibleSync);
//get translation sync progress (for long polling)
router.get('/api/uitranslate/sync-progress/:jobId', api.uiTranslationsGetSyncProgress);
//get sync status for a specific target locale
router.get('/api/uitranslate/sync-status/:projectID/:targetLocale', api.uiTranslationsGetSyncStatus);

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

