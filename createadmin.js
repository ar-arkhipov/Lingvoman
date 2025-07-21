const User = require('./libs/mongoose.js').User;
const pwd = require('./middlewares/pwd.js');

async function createAdmin() {
    try {
        const data = await User.create({
            username:'admin',
            password: pwd.pwdgen(process.env.ADMIN_PASS || 'yourpassword'),
            userObj: {role:'admin', name:'name'}
        });

        console.log(data);
        process.exit();
    } catch (err) {
        console.log(err);
        process.exit();
    }
}

(async () => {
    await createAdmin();
    console.log('Admin user created successfully.');
})();
