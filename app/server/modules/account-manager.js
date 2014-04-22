/*
 * Derived work from Node.js login (http://bit.ly/LsODY8)
 * Under MIT License
 * @Copyright: 2013 Stephen Braitsch
 * @Copyright: 2014 Siro González Rodríguez
 */
var db			= require('./database');
var crypto		= require('crypto');
var moment		= require('moment');
var N			= require('./../../../nuve');

var users	= db.collection('users');

var roles = ['Medic', 'Patient', 'Admin', 'Familiar'];

var ObjectId = require('mongodb').ObjectID;

exports.roleList = roles;

exports.isAdmin = function(user){
	if(!user)
		return false;
	else
		return user.role === 'Admin';
};

/* if no admin user, create default */
setTimeout(function(){
	users.findOne({role:'Admin'}, function(e, o) {
		if (o){
			console.log('[OK]	Admin user found!');
		} else{
			console.log('[!!]	No admin user... creating');
			var newData = {
					user : 'admin',
					pass : 'admin',
					role : 'Admin',
					name : 'Admin'
			};
			saltAndHash(newData.pass, function(hash){
				newData.user = 'admin';
				newData.pass = hash;
				// append date stamp when record was created //
				newData.date = moment().format('MMMM Do YYYY, h:mm:ss a');
				users.insert(newData, {safe: true}, function(a){});
			});
		}
	});
}, 500);

/* login validation methods */

exports.autoLogin = function(user, pass, callback)
{
	users.findOne({user:user}, function(e, o) {
		if (o){
			o.pass == pass ? callback(o) : callback(null);
		}	else{
			callback(null);
		}
	});
};

exports.manualLogin = function(user, pass, callback)
{
	users.findOne({user:user}, function(e, o) {
		if (o === null){
			callback('Invalid user/password'); //User not found
		}	else{
			validatePassword(pass, o.pass, function(err, res) {
				if (res){
					callback(null, o);
				}	else{
					callback('Invalid user/password'); //Invalid password
				}
			});
		}
	});
};

/* record insertion, update & deletion methods */

exports.addNewUser = function(newData, callback)
{
	users.findOne({user:newData.user}, function(e, o) {
		if (o){
			callback('Username already exists');
		}	else{
			users.findOne({email:newData.email}, function(e, o) {
				if (o){
					callback('Email is already in use');
				}	else{
					saltAndHash(newData.pass, function(hash){
						newData.pass = hash;
					// append date stamp when record was created //
						//newData.date = moment().format('MMMM Do YYYY, h:mm:ss a');
						newData.creation = new Date();
						users.insert(newData, {safe: true}, callback);
					});
				}
			});
		}
	});
}

exports.updateUser = function(newData, callback)
{
	newData._id = ObjectId(newData._id);  //convert string into ObjectId
	users.findOne({user:newData.user}, function(e1, o1) {
		if(o1 && !o1._id.equals(newData._id) ){
			callback('Username already in use');
		} else {
			users.findOne({email:newData.email}, function(e2, o2){
				if(o2 && !o2._id.equals(newData._id) ){
					callback('Email already in use');
				} else {
					users.findOne({_id:ObjectId(newData._id)}, function(e, o){
						if(e !== null){
							callback(e, null);
							return;
						}
						if(newData.user !== undefined)
							o.user	= newData.user;
						o.name		= newData.name;
						o.email		= newData.email;
						o.role		= newData.role;
						if (newData.pass === ''){
							users.save(o, {safe: true}, function(err) {
								if (err) callback(err);
								else callback(null, o);
							});
						} else {
							saltAndHash(newData.pass, function(hash){
								o.pass = hash;
								users.save(o, {safe: true}, function(err) {
									if (err) callback(err);
									else callback(null, o);
								});
							});
						}
					});
				}
			});			
		}			
	});	
};

exports.updatePassword = function(email, newPass, callback)
{
	users.findOne({email:email}, function(e, o){
		if (e){
			callback(e, null);
		}	else{
			saltAndHash(newPass, function(hash){
		        o.pass = hash;
		        users.save(o, {safe: true}, callback);
			});
		}
	});
}

/* Rooms management methods */
exports.addRoom = function(medicId, callback) {
	medicId = ObjectId(medicId);
	assignRoom = function(user) {
		N.API.createRoom(
			user._id, 
			function(licodeRoom) {
				users.update({_id:user._id},{$set: {room:licodeRoom._id}}, function(e, count){
					if(e){
						console.log('[Error] account-manager.addRoom().assignRoom(): updating user.room, mongo says:', e);
						callback('Updating user: '+e);
					} else
						callback(null);
				});
			},
			function(e){
				console.log('[Error] account-manager.addRoom().assignRoom(): Nuve says: ', e);
				callback('Error creating room');
			});
	};
	
	users.findOne({_id:medicId}, function(e, medic){
		if (e) {
			callback('User not found');
			console.log('[Warning] account.manager.addRoom(): record not found, mongo says: ', e);
		} else if(medic.role != 'Medic') {
			callback('User is not medic: only medics can have a room');
		} else if(medic.room !== undefined) {
			N.API.getRoom(medic.room, function() {
				callback('Medic already have a room');
			}, function() {
				assignRoom(medic);
			});			
		} else {
			assignRoom(medic);
		}
	});
};
exports.removeRoom = function(medicId, callback) {
	medicId = ObjectId(medicId);
	users.findOne({_id:medicId}, function(e, medic){
		if (e) {
			callback('User not found');
			console.log('[Warning] account.manager.removeRoom(): record not found, mongo says: ', e);
		} else if(medic.room == null) {
			callback('The medic has no room to delete');
		} else {
			N.API.deleteRoom(medic.room,
				function() {
					users.update({_id:medic._id},{$unset: {room:''}}, function(e, count){
						if(e){
							console.log('[Error] account-manager.removeRoom(): unsetting user.room, mongo says:', e);
							callback('Updating user: '+e);
						} else
							callback(null);
					});
				},
				function(e) {						
						console.log('[Error] account-manager.removeRoom(): unsetting user.room, nuve says:', e);
						callback('Error removing room' + e);
				});
		}
	});
};

/* user lookup methods */

exports.deleteUser = function(id, callback)
{
	users.remove({_id: getObjectId(id)}, callback);
};

exports.getUserByEmail = function(email, callback)
{
	users.findOne({email:email}, function(e, o){ callback(o); });
}

exports.validateResetLink = function(email, passHash, callback)
{
	users.find({ $and: [{email:email, pass:passHash}] }, function(e, o){
		callback(o ? 'ok' : null);
	});
}

exports.getAllRecords = function(callback)
{
	users.find().toArray(
		function(e, res) {
		if (e) callback(e)
		else callback(null, res)
	});
};

exports.delAllRecords = function(callback)
{
	users.remove({}, callback); // reset users collection for testing //
};

exports.listUsers = function(callback, size, skip)
{
	var options = {};
	if(size != null)
		options['size'] = size;
	if(skip != null)
		options['skip'] = skip;
	var fields = {
			"_id":true,
			"user":true,
			"name":true,
			"email":true,
			'role':true,
			'room':true
	};
	users.find({},fields, options).toArray(callback);
};

exports.listUsersSmall = function(callback)
{
	var fields = {
			"_id":true,
			"user":true,
			"name":true,
			'role':true
	};
	users.find({},fields, {}).toArray(callback);
};

exports.findById = function(id, callback)
{
	users.findOne({_id: getObjectId(id)},
		function(e, res) {
		if (e) callback(e);
		else callback(null, res);
	});
};

exports.defaultUser = function() {
	return {
		'user' : '',
		'name' : '',
		'email': '',
		'role' : 'Patient',
	};
};

/* private encryption & validation methods */

var generateSalt = function()
{
	var set = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ';
	var salt = '';
	for (var i = 0; i < 10; i++) {
		var p = Math.floor(Math.random() * set.length);
		salt += set[p];
	}
	return salt;
};

var md5 = function(str) {
	return crypto.createHash('md5').update(str).digest('hex');
}

var saltAndHash = function(pass, callback)
{
	var salt = generateSalt();
	callback(salt + md5(pass + salt));
}

var validatePassword = function(plainPass, hashedPass, callback)
{
	var salt = hashedPass.substr(0, 10);
	var validHash = salt + md5(plainPass + salt);
	callback(null, hashedPass === validHash);
}

/* auxiliary methods */

var getObjectId = function(id)
{
	return users.db.bson_serializer.ObjectID.createFromHexString(id);
}


var findByMultipleFields = function(a, callback)
{
// this takes an array of name/val pairs to search against {fieldName : 'value'} //
	users.find( { $or : a } ).toArray(
		function(e, results) {
		if (e) callback(e)
		else callback(null, results)
	});
};