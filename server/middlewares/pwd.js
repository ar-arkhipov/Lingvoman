var crypto = require('crypto');

var pwd = {
    pwdgen : function(password) {
        var salt = makeSalt();
        var hashed = crypto.createHmac('sha1', salt)
                        .update(password)
                        .digest('hex');
        return hashed + ':' + salt;
    },

    pwdcheck : function(password, salt) {
        var hashed = crypto.createHmac('sha1', salt)
                        .update(password)
                        .digest('hex');
        return hashed;
    }
};

var makeSalt = function() {
    var salt = '';
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for( var i = 0; i < 5; i++) {
        salt += chars.charAt(Math.floor(Math.random()*chars.length));
    }
    return salt;
};

module.exports = pwd;
