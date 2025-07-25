Lingvoman
=========

Authorization
-------------
JWT (JSON Web Token) technology is used as authorization method.
User receives token after succesfull login and then this token should be placed in "x-access-token" header of every query. Only administrator can create users and set their rights.
Method for login will be described in "API" section.

## Migration Note
All legacy routing and business logic have been fully migrated to a new layered architecture (controllers, services, DTOs, middleware). Legacy files (`routes/index.js`, `routes/api.js`) have been removed. All endpoints are now handled by the new structure in `src/routes/index.js` and corresponding controllers/services.

## Cleanup
If you encounter any references to legacy files, please remove them. All documentation and code should now reference the new structure only.

Dynamic Translation Sync
------------------------
New feature: Automatic translation sync to any language using OpenAI API.

**Requirements:**
- Set `OPENAI_API_KEY` environment variable with your OpenAI API key
- Install dependencies: `npm install` (includes the `openai` package)

**How it works:**
1. Select a project in the UI translations interface
2. Click "Sync to Other Languages" button
3. System discovers available languages from database documents
4. Missing sections/keys are automatically translated using OpenAI
5. Target language documents are updated with new translations
6. Progress and results are shown in the UI

**Features:**
- Smart comparison: Only translates missing sections, preserves existing translations
- Context-aware: Uses project and section context for better translations
- Placeholder preservation: Maintains {variables}, %s, HTML tags, etc.
- Error handling: Comprehensive error reporting and fallback mechanisms
- Progress tracking: Real-time sync status with loading indicators

#API

/login
------
It is used to authenticate user and send JWT token to him.

Method: POST.  
Body: {username:*username*, password:*password*}  
Response: {token}

/uitranslate
-----------
It is used to simply get the user interface translations in definite language in JSON format.

Method: GET.  
Params: id - numerous id of the project
        lang - locale definition (for example: "ru")  
Response: { ... } - translations in json format.  
QueryExample: /uitranslate/32?lang=ru

#UI Translations private methods:
These methods can be used by authorized users with 'admin' or 'translater' rights.

/api/uitranslate/list
---------------------
It is used to get the list of available projects and translations, aggregated from UiTrans mongo collection.

Method: GET.  
Params: -  
Response: {projectID, projectAlphabeticalId, [available locales list]}

/api/uitranslate/item
---------------------
This url can be used with  4 different methods for different actions:

**Get document for definite project and locale**  
Method: GET  
Params: projectID - numerous ID of the project  
        locale - locale definition  
Response: {mongoId, projectID, locale, porjectAlphabeticalId, { translations }}  
QueryExample: /api/uitranslate?projectID=44&locale=ru  

**Save, update or make copy of the document (for another locale)**  

Method: POST  
Body: {full document json}  
Response: {mongo response (data.ok=1)}  //TODO: Refactor response  

**Create fully new document for new project, only if such projectID is free** 

Method: PUT  
Params: projectID - numerous ID of the new project  
        projectAlphaId - name of the new project  
        locale - locale of new document  
Response: status (400 - if document wasnt created because ID is not free, 200 - if OK)  
BodyExample: {projectID:55, projectAlphaId:'newproject', locale:'ru'}  

**Delete document**  

Method: DELETE  
Params: projectID - numerous ID of the project  
        locale - locale  
Response: {mongo response}  //will refactor  

/api/uitranslate/sync
---------------------
**NEW:** Synchronize translations to any language using OpenAI API.

Method: POST  
Body: {projectID: *number*, projectAlphaId: *string*}  
Response: {status: 'success'|'error', message: *string*, data: {...}}  

**Response format (success):**
```json
{
  "status": "success", 
  "message": "Successfully translated X sections",
  "data": {
    "translatedSections": ["SECTION1", "SECTION2"],
    "skippedSections": ["EXISTING_SECTION"],  
    "totalSections": 5,
    "newTranslations": {...}
  }
}
```

**Response format (error):**
```json
{
  "status": "error",
  "message": "Error description", 
  "error": "Detailed error message"
}
```

**Prerequisites:**
- English (en) document must exist for the project
- Valid OpenAI API key must be configured
- User must have 'admin' or 'translater' role

/api/uitranslate/backup
------------------------
It is used to get the list of available projects and translations from special BACKUP mongo collection, where the previous state of documents is stored.  

Method: GET  
Params: -  
Response: {{projectID, [locales]}, ... {}}  

/api/uitranslate/backup/item
----------------------------
It is used to restore a previous state of any document, or to restore document if it was deleted.  

Method: POST  
Body: {projectID:*id*, locale:*locale*}  
Response: status  

#Admin private methods:
These methods are used to get, delete and create users with definite rights.  
Now there 2 main access levels:  
        *admin - has access to all of the methods  
        *translater - can work only with translations  

/api/users
----------
Use *get* method for receiving list of all users.  
Use *put* method to create user.  
Use *delete* method to delete user.  
  
Better description will be made soon...

Environment Variables
--------------------
```bash
PORT=1337                    # Server port (default: 1337)
JWT_SECRET=your_jwt_secret   # JWT signing secret
MONGO_URI=mongodb://localhost/lingvoman  # MongoDB connection string
OPENAI_API_KEY=sk-...        # OpenAI API key for translation sync
```












