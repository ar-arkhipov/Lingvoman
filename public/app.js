angular.module('app', ['ngResource', 'ui.bootstrap', 'ui.router']);

angular.module('app').config(configure);
angular.module('app').run(runBlock);

configure.$inject = ['$httpProvider', '$stateProvider', '$urlRouterProvider'];
runBlock.$inject = ['$rootScope', '$state', 'Auth'];

function configure($httpProvider, $stateProvider, $urlRouterProvider) {
	$httpProvider.interceptors.push('TokenInterceptor');

	$urlRouterProvider.otherwise('/');
	$urlRouterProvider.when('','/');

	$stateProvider
		.state('default', {
			url:'/',
			templateUrl: '/views/default.html'
		})
		.state('login', {
			url: '/login',
			templateUrl: '/views/login.html'
		})
		.state('uitranslates', {
			url: '/uitranslates',
			templateUrl: '/views/uitranslates.html'
		})
		.state('users', {
			url: '/users',
			templateUrl: '/views/users.html'
		});
}

function runBlock($rootScope, $state, Auth) {
	$rootScope.$on('$stateChangeStart', function(e, toState, toParams, fromState, fromParams) {
		console.log('Going: ' + toState.name);
		if(!Auth.isLogged && toState.name != 'login') {
			e.preventDefault();
			$state.go('login');
		}
		if(Auth.isLogged && toState.name == 'login') {
			e.preventDefault();
			$state.go('default');
		}
	});
}

angular
	.module('app')
	.controller('ApplicationCtrl', ApplicationCtrl);

ApplicationCtrl.$inject = ['$window', '$rootScope'];

function ApplicationCtrl($window, $rootScope) {
	var vm = this;
	vm.role = $window.sessionStorage.role ? $window.sessionStorage.role : '';
}


angular.module('app').controller('UiTranslatesCtrl', UiTranslatesCtrl);

UiTranslatesCtrl.$inject = ['$resource', '$rootScope', '$window'];

function UiTranslatesCtrl ($resource, $rootScope, $window) {
	var vm = this;
	vm.id = '';
	vm.locale = '';
	vm.copiesList = [];

//resource list
	var initial = $resource('/api/uitranslate/list');
	var trans = $resource('/api/uitranslate/item', {}, {
		put : {method:'PUT'}
	});
	var restore = $resource('/api/uitranslate/backup');

//receiving information about available translations (id, locale)
	vm.init = function() {
		initial.query().$promise.then(function(data) {
			console.log(data);
			vm.initList = data;
		});
	};

//set id according to chosen project
	vm.chooseProject = function(project) {
		vm.id = project.projectID;
		vm.chosen = project;
	};

//get a definite translations json from main collection
	vm.getTrans = function() {
		if (vm.gettingForm.$valid) {
			trans.query({'projectID':vm.id, 'locale':vm.locale}).$promise.then(function(data){
				console.log(data);
				vm.data = data;
				for(var n=0; n < vm.data.length; n++) {
					if(!vm.data[n].translations) {
						vm.data[n].translations = {};
					}
				}
				if(vm.data.length) {
					$rootScope.$broadcast('growl', {type:'success', msg:'Переводы получены!'});
				} else {
					$rootScope.$broadcast('growl', {type:'danger', msg: 'Подходящих файлов не найдено. Проверьте данные.'});
				}
			});
			vm.copiesList = [];
		}
	};

//save changes
	vm.changeTranslation = function(item) {
		if(confirm('Вы уверены, что хотите сохранить?')) {
			delete item._id;
			console.log(item);
			trans.save(item).$promise.then(function(data){
				console.log(data);
				if(data.ok) {
					$rootScope.$broadcast('growl', {type:'success', msg: 'Документ ' + item.projectAlphaId +' '+item.locale+' сохранен!'});
					vm.copiesList = [];
				} 
			});
		}
	};

//creating a fully new document if such ID is not already used
	vm.makeNew = function() {
		if (vm.gettingForm.$valid) {
			var alphaId = prompt('Буквенное название проекта', 'project');
			if (vm.id && vm.locale && alphaId) {
				trans.put({"projectID":vm.id, "locale":vm.locale, "projectAlphaId":alphaId}).$promise.then(function(data){
					if(data.status == 400){
						$rootScope.$broadcast('growl', {type:'danger', msg: 'Этот проект уже имеет как минимум 1 файл переводов!'});
					}
				})
			}
		}
	};

// remove field from a group
	vm.deleteField = function(obj, key, def){
		delete obj[key][def];
	};
// add field
	vm.addField = function(obj, key, newField) {
		if(obj[key][newField.toUpperCase()]) {
			console.error('field already exists!');
		} else {
			obj[key][newField.toUpperCase()] = '';
		}
	};
// delete group from a document
	vm.deleteGroup = function(obj, key) {
		console.log('deleted');
		delete obj[key];
	};
// add group
	vm.addGroup = function(obj, newGroup) {
		if(obj[newGroup.toLowerCase()]) {
			console.error('field already exists!');
		} else {
			obj[newGroup.toLowerCase()] = {};
		}
	};
// creating a local copy of document with new locale, should be saved after being filled in
	vm.makeCopy = function(item) {
		var newLang = prompt('На какой язык переводим?: ');
		var newItem = (JSON.parse(JSON.stringify(item)));
		if (newLang){
			trans.query({'projectID':newItem.projectID, 'locale':newLang}).$promise.then(function(data){
				if (!data.length) {
					newItem.locale = newLang;
					vm.data.push(newItem);
					$rootScope.$broadcast('growl', {type:'warning', msg: 'Документ создан локально. Не забудьте сохранить изменения!'});
				} else {
					$rootScope.$broadcast('growl', {type:'danger', msg: 'Такой документ уже существует.'});
				}
			});
		}
	};
// removing document from the main collection
	vm.removeDoc = function(item) {
		if(confirm('Вы собираетесь ПОЛНОСТЬЮ удалить файл переводов ' + item.locale + ' для проекта '+item.projectID+'-'+item.projectAlphaId)) {
			trans.delete(item).$promise.then(function(data){
				console.log(data);
				if (data.ok) {
					var index = vm.data.indexOf(item);
					vm.data.splice(index, 1);
					$rootScope.$broadcast('growl', {type:'success', msg: 'Документ успешно удален.'});
				} else {
					$rootScope.$broadcast('growl', {type:'danger', msg: 'Произошла непредвиденная ошибка.'});
				}
			});
		}
	};
// get aggregated list of available documents in backup collection
	vm.checkCopies = function() {
		restore.query({}).$promise.then(function(data){
			console.log(data);
			vm.copiesList = data;
		})
	};
// restore definite document from backup collection to main
	vm.restore = function(id, locale)  {
		if(confirm('Вы хотите восстановить/заменить основной документ резервной копией?')) {
			restore.save({"projectID":id, "locale":locale}).$promise.then(function(data) {
				console.log(data);
				if (data.ok) {
					$rootScope.$broadcast('growl', {type:'success', msg: 'Документ успешно восстановлен!'});
					vm.copiesList = [];
				} else {
					$rootScope.$broadcast('growl', {type:'danger', msg: 'Произошла непредвиденная ошибка.'});
				}
			});
		}
	};

	vm.init();
	$rootScope.$on('authorized', vm.init);
}

//auth
angular
	.module('app')
	.factory('Auth', Auth);

Auth.$inject = ['$window'];

function Auth($window) {
	var auth = {
		isLogged: (function() {
			return !!$window.sessionStorage.token;
		}())
	};
	console.log(auth);
	return auth;
}

angular
	.module('app')
	.factory('UserAuthFactory', UserAuthFactory);

UserAuthFactory.$inject = ['$window', '$resource', 'Auth'];

function UserAuthFactory($window, $resource, Auth  ) {
	return {
		login : function(username, password) {
			var loginRes = $resource('/login');
			return loginRes.save({
				username : username,
				password : password
			});
		},

		logout : function() {
			if (Auth.isLogged) {
				delete $window.sessionStorage.token;
			}
		}
	}
}

angular
	.module('app')
	.factory('TokenInterceptor', TokenInterceptor);

TokenInterceptor.$inject = ['$window', '$rootScope'];

function TokenInterceptor($window, $rootScope) {
	return {
		request : function(req) {
			if ($window.sessionStorage.token) {
				req.headers['x-access-token'] = $window.sessionStorage.token;
			}
			return req;
		},

		responseError : function(resp) {
			if([400,401].indexOf(resp.status) !== -1 && resp.data.message) {
				$rootScope.$broadcast('growl', {type:'danger', msg:resp.data.message});
			} else {
				$rootScope.$broadcast('growl', {type:'danger', msg: 'Непредвиденная ошибка'});
			}
			return resp;
		}
	}
}

//loginCtrl

angular
	.module('app')
	.controller('LoginCtrl', LoginCtrl);

LoginCtrl.$inject = ['$window', 'Auth', 'UserAuthFactory', '$rootScope'];
function LoginCtrl($window, Auth, UserAuthFactory, $rootScope) {
	var vm = this;
	vm.user = {};

	vm.login = function() {
		var username = vm.user.username;
		var password = vm.user.password;

		if(username !== undefined && password !== undefined) {
			UserAuthFactory.login(username, password).$promise.then(function(data) {
				if (data.token) {
					$window.sessionStorage.token = data.token;
					$window.sessionStorage.role = data.user.role;
					Auth.isLogged = true;
					console.log('logged in', data.token);
					$window.location.reload();
				}
			});
		} else {
			console.log('EMPTY FIELD!');
		}
	}
}


//users administration

angular
	.module('app')
	.controller('UsersCtrl', UsersCtrl);

UsersCtrl.$inject = ['$resource', '$rootScope'];

function UsersCtrl($resource, $rootScope) {
	var vm = this;

	vm.newUser = {
		username: '',
		password: '',
		userObj: {
			name: '',
			role: ''
		}
	};

	vm.usersList = [];
	vm.rolesList = ['admin', 'translater'];

	var users = $resource('/api/users', {}, {
		put : {method:'PUT'}
	});

	vm.getUsers = function() {
		users.query().$promise.then(function(data) {
			console.log(data);
			vm.usersList = data;
		});
	};

	vm.createUser = function() {
		console.log(vm.newUser);
		users.put(vm.newUser).$promise.then(function(data) {
			vm.getUsers();
			console.log(data);
			$rootScope.$broadcast('growl', {
				type: "success",
				msg: "Пользователь создан"
			});
		});
	};

	vm.chooseRole = function(role) {
		vm.newUser.userObj.role = role;
	};

	vm.deleteUser = function(user, username) {
		if (confirm('Вы уверены, что хотите удалить пользователя ' + username + ' ?')) {
			users.delete({username: username}).$promise.then(function (data) {
				console.log(data);
				if (data.ok) {
					var index = vm.usersList.indexOf(user);
					vm.usersList.splice(index, 1);
					$rootScope.$broadcast('growl', {
						type: "success",
						msg: "Пользователь удален"
					});
				} else {
					$rootScope.$broadcast(('growl', {
						type: "danger",
						msg: "Не удалось удалить пользователя."
					}));
				}
			});
		}
	};

	vm.getUsers();
}



// some angular-bootstrap code for growls
angular.module('app').controller('GrowlCtrl', GrowlCtrl);

GrowlCtrl.$inject = ['$rootScope'];

function GrowlCtrl($rootScope) {
	var vm = this;

	vm.growls = [];

  	vm.closeGrowl = function(index) {
  		vm.growls.splice(index, 1);
  	};

  	$rootScope.$on('growl', function(event, data){
  		vm.growls.push(data);
  	});
}

