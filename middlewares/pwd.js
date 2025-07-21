const crypto = require('crypto');

const pwd = {
    pwdgen(password) {
        const salt = makeSalt();
        const hashed = crypto.createHmac('sha1', salt)
                        .update(password)
                        .digest('hex');

        return hashed + ':' + salt;
    },

    pwdcheck(password, salt) {
        const hashed = crypto.createHmac('sha1', salt)
                        .update(password)
                        .digest('hex');

        return hashed;
    }
};

const makeSalt = function() {
    let salt = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for( let i = 0; i < 5; i++) {
        salt += chars.charAt(Math.floor(Math.random()*chars.length));
    }

    return salt;
};

module.exports = pwd;
