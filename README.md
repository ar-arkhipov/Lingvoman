Lingvoman
=========

Authorization
-------------
JWT (JSON Web Token) technology is used as authorization method.
User receives token after succesfull login and then this token should be placed in "x-access-token" header of every query. Only administrator can create users and set their rights.
Method for login will be described in "API" section.

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












