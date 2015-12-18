var UiTran = require('../libs/mongoose.js').UiTran; //model for main translations collection
var UiReservedTran = require('../libs/mongoose.js').UiReservedTran; //model for reserved (backup) translations collection
var User = require('../libs/mongoose.js').User; //user model
var pwd = require('../middlewares/pwd.js');

var api = {
    //UI translations
    uiTranslationsGet: function(req, res) {
        if (req.query.lang) {
            UiTran.findOne({
                    "projectID": req.params.projectID,
                    "locale": req.query.lang
                },
                {translations: 1, _id: 0},
                function (err, doc) {
                    if (doc && doc.toObject()) {
                        res.json(doc.toObject().translations);
                    } else {
                        res.status(404);
                        res.json({msg: "Document not found."});
                    }
                });
        } else {
            UiTran.aggregate([
                {$match:{projectID:parseInt(req.params.projectID)}},
                {$group: {
                    _id: "$projectID",
                    locales: {$addToSet: "$locale"}
                }},
                {$project:{
                    _id:0,
                    locales:1
                }}
            ]).exec(function(err, data) {
               res.send(data[0] || []);
            });
        }
    },

    uiTranslationsGetList: function(req, res) {
        UiTran.aggregate([
            {$group:{
                _id:{projectID:"$projectID", alpha:"$projectAlphaId"},
                locales: {$addToSet : "$locale"}}
            },
            {$project:{
                projectID: "$_id.projectID",
                projectAlphaId: "$_id.alpha",
                locales:1}
            }
        ]).exec(function(err, data){
            console.log(data);
            res.send(data);
        });
    },

    uiTranslationsGetItem : function(req, res) {
        if(req.query.projectID && req.query.locale) {
            var query = {
                projectID:req.query.projectID,
                locale: req.query.locale
            };
            UiTran.find(query, function (err, data) {
                res.send(data);
            });
        } else {
            res.status(400);
            res.json({
                status:400,
                message:"Bad request"
            });
        }
    },

    uiTranslationsChange : function(req, res) {
        if(req.body.projectID&&req.body.locale) {
            var query = {
                'projectID': req.body.projectID,
                'locale': req.body.locale
            };
            uiReservator(query, res, makeChanges);
            function makeChanges() {
                UiTran.update(query, req.body, {upsert: true}, function (err, data) {
                    res.send(data);
                });
            }
        } else {
            res.status(400);
            res.json({
                status:400,
                message:'Bad request'
            })
        }
    },

    uiTranslationsDelete : function(req, res) {
        if(req.query.projectID && req.query.locale) {
            var query = {
                'projectID': req.query.projectID,
                'locale': req.query.locale
            };
            uiReservator(query, res, makeChanges);
            function makeChanges() {
                UiTran.remove(query, function (err, data) {
                    res.send(data);
                });
            }
        } else {
            res.status(400);
            res.json({
                status:400,
                message:'Bad request'
            });
        }
    },

    uiTranslationsCreate : function(req, res) {
        if(req.body.projectID) {
            UiTran.count({'projectID': req.body.projectID}, function (err, data) {
                if (data == 0) {
                    UiTran.create(req.body, function (err, data) {
                        res.status(201);
                        res.send(data);
                    });
                } else {
                    res.json({status: 400, msg: "Such projectID already exists, or incorrect request!"});
                }
            });
        } else {
            res.json({
                status:400,
                message: 'Bad request'
            })
        }
    },

    uiTranslationsBackupGetList : function(req, res) {
        UiReservedTran.aggregate([
            {$group:{
                _id:{projectID:"$projectID", alpha:"$projectAlphaId"},
                locales: {$addToSet : "$locale"}}
            },
            {$project:
            {projectID: "$_id.projectID", projectAlphaId: "$_id.alpha",
                locales:1}
            }
        ]).exec(function(err, data){
            console.log(data);
            res.send(data);
        });
    },

    uiTranslationsBackupRestore : function(req, res) {
        if(req.body.projectID&&req.body.locale) {
            var query = {
              projectID: req.body.projectID,
                locale: req.body.locale
            };
            UiReservedTran.findOne(query, function (err, doc) {
                if (doc) {
                    delete doc._id;
                    newDoc = JSON.parse(JSON.stringify(doc));
                    UiTran.update(req.body, newDoc, {upsert: true}, function (err, data) {
                        console.log(data);
                        res.send(data);
                    });
                } else {
                    res.status(400);
                    res.json({status: 400, msg: "Document not found."})
                }
            });
        } else {
            res.status(400);
            res.json({
                status:400,
                message:"Bad request"
            })
        }
    },
    //USERS ADMINISTRATION

    userGetList : function(req, res) {
        User.find({}, function(err, data) {
            res.send(data);
        });
    },

    userCreate : function(req, res) {
        if (req.body.username&&req.body.password&&req.body.userObj) {
            User.create({
                username: req.body.username,
                password: pwd.pwdgen(req.body.password),
                userObj: {
                    role: req.body.userObj.role,
                    name: req.body.userObj.name}
            }, response);
        } else {
            res.status(400);
            res.json({
                status:400,
                message: 'Bad request'
            })
        }
        function response(err, data) {
            if (err) {
                res.status(400);
                res.json({
                    status: 400,
                    message: 'Unable to create such user.'
                })
            } else {
                res.send(data);
            }
        }
    },

    userDelete : function(req, res) {
        if(req.query.username) {
            User.remove({username : req.query.username}, function(err, data) {
               if(err){
                   res.status(400);
                   res.json({
                       status:400,
                       message: 'Can not delete user'
                   })
               } else {
                   res.send(data);
               }
            });
        }
    }

};

var uiReservator = function(query, res, callback) {
    UiTran.findOne(query, function(err, doc) {
        if (doc) {
            delete doc._id;
            newDoc = JSON.parse(JSON.stringify(doc));
            UiReservedTran.update(query, newDoc, {upsert:true}, function(err, data) {
                console.log(data);
                callback();
            });
        } else {
            callback();
        }
    });
};

module.exports = api;


