var User = require('./libs/mongoose.js').User;
var pwd = require('./middlewares/pwd.js');

User.create({
    username:'admin',
    password: pwd.pwdgen('yourpassword'),
    userObj: {role:"admin", name:'name'}
}, response);

function response(err, data) {
    if (err) {
        console.log(err);
        process.exit();
    } else {
        console.log(data);
        process.exit();
    }
}
