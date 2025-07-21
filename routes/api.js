const { UiTran, UiReservedTran, User } = require('../libs/mongoose.js');
const pwd = require('../middlewares/pwd.js');

const api = {
    //UI translations
    async uiTranslationsGet(req, res) {
        try {
            if (req.query.lang) {
                const doc = await UiTran.findOne({
                    'projectID': req.params.projectID,
                    'locale': req.query.lang
                }, {translations: 1, _id: 0});
                
                if (doc && doc.toObject()) {
                    res.json(doc.toObject().translations);
                } else {
                    res.status(404);
                    res.json({msg: 'Document not found.'});
                }
            } else {
                const data = await UiTran.aggregate([
                    {$match:{projectID:parseInt(req.params.projectID)}},
                    {$group: {
                        _id: '$projectID',
                        locales: {$addToSet: '$locale'}
                    }},
                    {$project:{
                        _id:0,
                        locales:1
                    }}
                ]);

                res.send(data[0] || []);
            }
        } catch (error) {
            res.status(500);
            res.json({msg: 'Internal server error'});
        }
    },

    async uiTranslationsGetList(req, res) {
        try {
            const data = await UiTran.aggregate([
                {$group:{
                    _id:{projectID:'$projectID', alpha:'$projectAlphaId'},
                    locales: {$addToSet : '$locale'}}
                },
                {$project:{
                    projectID: '$_id.projectID',
                    projectAlphaId: '$_id.alpha',
                    locales:1}
                },
                {$sort: {projectAlphaId: 1}}
            ]);

            console.log(data);
            res.send(data);
        } catch (error) {
            res.status(500);
            res.json({msg: 'Internal server error'});
        }
    },

    async uiTranslationsGetItem(req, res) {
        if(req.query.projectID && req.query.locale) {
            try {
                const query = {
                    projectID:req.query.projectID,
                    locale: req.query.locale
                };
                const data = await UiTran.find(query);

                res.send(data);
            } catch (error) {
                res.status(500);
                res.json({msg: 'Internal server error'});
            }
        } else {
            res.status(400);
            res.json({
                status:400,
                message:'Bad request'
            });
        }
    },

    async uiTranslationsChange(req, res) {
        if(req.body.projectID && req.body.locale && req.body.translations) {
            try {
                const query = {
                    'projectID': req.body.projectID,
                    'locale': req.body.locale
                };

                await uiReservator(query);
                const data = await UiTran.updateOne(query, { $set: {translations: req.body.translations}}, {upsert: true});

                res.send(data);
            } catch (error) {
                res.status(500);
                res.json({msg: 'Internal server error'});
            }
        } else {
            res.status(400);
            res.json({
                status:400,
                message:'Bad request'
            });
        }
    },

    async uiTranslationsDelete(req, res) {
        if(req.query.projectID && req.query.locale) {
            try {
                const query = {
                    'projectID': req.query.projectID,
                    'locale': req.query.locale
                };

                await uiReservator(query);
                const data = await UiTran.deleteOne(query);

                res.send(data);
            } catch (error) {
                res.status(500);
                res.json({msg: 'Internal server error'});
            }
        } else {
            res.status(400);
            res.json({
                status:400,
                message:'Bad request'
            });
        }
    },

    async uiTranslationsCreate(req, res) {
        if(req.body.projectID) {
            try {
                const count = await UiTran.countDocuments({'projectID': req.body.projectID});

                if (count == 0) {
                    const data = await UiTran.create(req.body);

                    res.status(201);
                    res.send(data);
                } else {
                    res.json({status: 400, msg: 'Such projectID already exists, or incorrect request!'});
                }
            } catch (error) {
                res.status(500);
                res.json({msg: 'Internal server error'});
            }
        } else {
            res.json({
                status:400,
                message: 'Bad request'
            });
        }
    },

    async uiTranslationsBackupGetList(req, res) {
        try {
            const data = await UiReservedTran.aggregate([
                {$group:{
                    _id:{projectID:'$projectID', alpha:'$projectAlphaId'},
                    locales: {$addToSet : '$locale'}}
                },
                {$project:
                {projectID: '$_id.projectID', projectAlphaId: '$_id.alpha',
                    locales:1}
                }
            ]);

            console.log(data);
            res.send(data);
        } catch (error) {
            res.status(500);
            res.json({msg: 'Internal server error'});
        }
    },

    async uiTranslationsBackupRestore(req, res) {
        if(req.body.projectID&&req.body.locale) {
            try {
                const query = {
                  projectID: req.body.projectID,
                    locale: req.body.locale
                };
                const doc = await UiReservedTran.findOne(query);

                if (doc) {
                    const newDoc = JSON.parse(JSON.stringify(doc));

                    delete newDoc._id;
                    const data = await UiTran.updateOne(req.body, newDoc, {upsert: true});

                    console.log(data);
                    res.send(data);
                } else {
                    res.status(400);
                    res.json({status: 400, msg: 'Document not found.'});
                }
            } catch (error) {
                res.status(500);
                res.json({msg: 'Internal server error'});
            }
        } else {
            res.status(400);
            res.json({
                status:400,
                message:'Bad request'
            });
        }
    },
    //USERS ADMINISTRATION

    async userGetList(req, res) {
        try {
            const data = await User.find({});

            res.send(data);
        } catch (error) {
            res.status(500);
            res.json({msg: 'Internal server error'});
        }
    },

    async userCreate(req, res) {
        if (req.body.username&&req.body.password&&req.body.userObj) {
            try {
                const data = await User.create({
                    username: req.body.username,
                    password: pwd.pwdgen(req.body.password),
                    userObj: {
                        role: req.body.userObj.role,
                        name: req.body.userObj.name}
                });

                res.send(data);
            } catch (error) {
                res.status(400);
                res.json({
                    status: 400,
                    message: 'Unable to create such user.'
                });
            }
        } else {
            res.status(400);
            res.json({
                status:400,
                message: 'Bad request'
            });
        }
    },

    async userDelete(req, res) {
        if(req.query.username) {
            try {
                const data = await User.deleteOne({username : req.query.username});

                res.send(data);
            } catch (error) {
                res.status(400);
                res.json({
                    status:400,
                    message: 'Can not delete user'
                });
            }
        }
    }

};

const uiReservator = async function(query) {
    try {
        const doc = await UiTran.findOne(query);

        if (doc) {
            const newDoc = JSON.parse(JSON.stringify(doc));

            delete newDoc._id;
            const data = await UiReservedTran.updateOne(query, newDoc, {upsert:true, overwrite:true});

            console.log(data);
        }
    } catch (error) {
        console.error('Error in uiReservator:', error);
        throw error;
    }
};

module.exports = api;


