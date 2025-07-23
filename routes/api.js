const { UiTran, UiReservedTran, User } = require('../libs/mongoose.js');
const pwd = require('../middlewares/pwd.js');
const TranslationSyncService = require('../libs/translationSync.js');
const flexibleTranslationSync = require('../libs/flexibleTranslationSync.js');
const languageService = require('../libs/languageService.js');
const progressTracker = require('../libs/progressTracker.js');

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

    async uiTranslationsSync(req, res) {
        if(req.body.projectID && req.body.projectAlphaId) {
            try {
                const syncService = new TranslationSyncService();
                const result = await syncService.syncJapaneseTranslations(
                    req.body.projectID, 
                    req.body.projectAlphaId
                );

                if (result.success) {
                    res.status(200);
                    res.json({
                        status: 'success',
                        message: result.message,
                        data: {
                            translatedSections: result.translatedSections,
                            skippedSections: result.skippedSections,
                            totalSections: result.totalSections,
                            newTranslations: result.newTranslations
                        }
                    });
                } else {
                    res.status(400);
                    res.json({
                        status: 'error',
                        message: result.message,
                        error: result.error
                    });
                }
            } catch (error) {
                console.error('Error in uiTranslationsSync:', error);
                res.status(500);
                res.json({
                    status: 'error',
                    message: 'Translation sync failed',
                    error: error.message
                });
            }
        } else {
            res.status(400);
            res.json({
                status: 'error',
                message: 'Bad request: projectID and projectAlphaId are required'
            });
        }
    },

    // NEW FLEXIBLE LANGUAGE-AGNOSTIC ENDPOINTS

    /**
     * Get available languages for a project
     * GET /api/uitranslate/languages/:projectID
     */
    async uiTranslationsGetLanguages(req, res) {
        try {
            const projectID = req.params.projectID;
            const languages = await languageService.getProjectLanguages(projectID);
            
            res.status(200);
            res.json({
                status: 'success',
                data: languages
            });
        } catch (error) {
            console.error('Error getting project languages:', error);
            res.status(500);
            res.json({
                status: 'error',
                message: 'Failed to get project languages',
                error: error.message
            });
        }
    },

    /**
     * Get unsynchronized translation info for a project
     * GET /api/uitranslate/unsync-info/:projectID?sourceLocale=en
     */
    async uiTranslationsGetUnsyncInfo(req, res) {
        try {
            const projectID = req.params.projectID;
            const sourceLocale = req.query.sourceLocale || 'en';
            const unsyncInfo = await languageService.getUnsyncInfo(projectID, sourceLocale);
            
            res.status(200);
            res.json({
                status: 'success',
                data: unsyncInfo
            });
        } catch (error) {
            console.error('Error getting unsync info:', error);
            res.status(500);
            res.json({
                status: 'error',
                message: 'Failed to get unsync info',
                error: error.message
            });
        }
    },

    /**
     * Start flexible translation sync to any target language
     * POST /api/uitranslate/sync-flexible
     * Body: { projectID, projectAlphaId, targetLocale, sourceLocale? }
     */
    async uiTranslationsFlexibleSync(req, res) {
        try {
            const { projectID, projectAlphaId, targetLocale, sourceLocale } = req.body;
            
            if (!projectID || !projectAlphaId || !targetLocale) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Bad request: projectID, projectAlphaId, and targetLocale are required'
                });
            }

            // Validate locale format
            if (!languageService.isValidLocaleFormat(targetLocale)) {
                return res.status(400).json({
                    status: 'error',
                    message: `Invalid target locale format: ${targetLocale}. Expected format: 'xx' or 'xx-XX'`
                });
            }

            const jobId = await flexibleTranslationSync.startTranslationSync(
                projectID, 
                projectAlphaId, 
                targetLocale,
                sourceLocale || 'en'
            );

            res.status(202); // Accepted - processing started
            res.json({
                status: 'success',
                message: `Translation sync to ${targetLocale} started`,
                jobId: jobId,
                pollUrl: `/api/uitranslate/sync-progress/${jobId}`
            });

        } catch (error) {
            console.error('Error starting flexible sync:', error);
            res.status(500);
            res.json({
                status: 'error',
                message: 'Failed to start translation sync',
                error: error.message
            });
        }
    },

    /**
     * Get translation sync progress (for long polling)
     * GET /api/uitranslate/sync-progress/:jobId
     */
    async uiTranslationsGetSyncProgress(req, res) {
        try {
            const jobId = req.params.jobId;
            const jobStatus = progressTracker.getJobStatus(jobId);

            if (!jobStatus) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Job not found or expired'
                });
            }

            res.status(200);
            res.json({
                status: 'success',
                data: jobStatus
            });

        } catch (error) {
            console.error('Error getting sync progress:', error);
            res.status(500);
            res.json({
                status: 'error',
                message: 'Failed to get sync progress',
                error: error.message
            });
        }
    },

    /**
     * Get sync status for a specific target locale
     * GET /api/uitranslate/sync-status/:projectID/:targetLocale?sourceLocale=en
     */
    async uiTranslationsGetSyncStatus(req, res) {
        try {
            const { projectID, targetLocale } = req.params;
            const sourceLocale = req.query.sourceLocale || 'en';

            const syncStatus = await flexibleTranslationSync.getSyncStatus(
                projectID,
                targetLocale,
                sourceLocale
            );

            res.status(200);
            res.json({
                status: 'success',
                data: syncStatus
            });

        } catch (error) {
            console.error('Error getting sync status:', error);
            res.status(500);
            res.json({
                status: 'error',
                message: 'Failed to get sync status',
                error: error.message
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


