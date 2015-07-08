var User = require('./libs/mongoose.js').User;
var pwd = require('./middlewares/pwd.js');

User.create({
    username:'admin',
    password: pwd.pwdgen('password1'),
    userObj: {role:"admin", name:'Епифантий'}
}, response);

function response(err, data) {
    if (err) {
        console.log(err);
    } else {
        console.log(data);
    }
}
