var config = {
    port: process.env.PORT || 1337,
    jwtSecret: process.env.JWT_SECRET || 'SECRET_SHHHHHH',
    mongouri: process.env.MONGO_URI || 'mongodb://localhost/lingvoman'
};

module.exports = config;
