var express    = require('express'),
    router     = express.Router(),
    Q          = require('q'),
    rest       = require('restler'),
    crypto     = require('crypto'),
    mongoose   = require('mongoose'),
    moment     = require('moment'),
    Schema     = mongoose.Schema;

router.get('/', function(req, res) {
  res.render('index', { title: '' });
});

router.get('/login', function(req, res) {
  res.render('login', { title: '' });
});

router.post('/login', function(req, res) {
  res.send('200');
});

router.get('/registration', function(req, res) {
  res.render('registration', { title: '' });
});

router.post('/registration', function(req, res) {
  res.send('200');
});

router.get('/dashboard', function(req, res) {
  res.render('dashboard', { title: '' });
});

router.get('/install', function(req, res) {
  res.send(200);
});

router.get('/uninstall', function(req, res) {
  res.send(200);
});

module.exports = router;

mongoose.connect('mongodb://mongodb.fr1.server.sovechkin.com/redhelper');

var UsersSchema = new Schema();

UsersSchema.add({
  login       : { type: String, unique: true },
  email       : { type: String, lowercase: true },
  licenses    : [LicensesSchema],
  created_at  : Date,
  updated_at  : Date,
  enabled     : Boolean
});

var Users = mongoose.model('Users', UsersSchema);