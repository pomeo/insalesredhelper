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
  console.log(req.param('login'));
  res.redirect('/success');
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

router.get('/success', function(req, res) {
  res.render('success', { title: '' });
});

router.get('/install', function(req, res) {
  if ((req.param('shop') !== '') && (req.param('token') !== '') && (req.param('insales_id') !== '') && req.param('shop') && req.param('token') && req.param('insales_id')) {
    Apps.findOne({insalesid:req.param('insales_id')}, function(err, a) {
      if (a == null) {
        var app = new Apps({
          insalesid  : req.param('insales_id'),
          url        : req.param('shop'),
          password   : crypto.createHash('md5').update(req.param('token') + process.env.insalessecret).digest('hex'),
          created_at : moment().format('ddd, DD MMM YYYY HH:mm:ss ZZ'),
          updated_at : moment().format('ddd, DD MMM YYYY HH:mm:ss ZZ'),
          enabled    : 1
        });
        app.save(function (err) {
          if (err) {
            res.send(err, 500);
          } else {
            res.send(200);
          }
        });
      } else {
        if (a.enabled == true) {
          res.send('Приложение уже установленно', 403);
        } else {
          a.password = crypto.createHash('md5').update(req.param('token') + process.env.insalessecret).digest('hex');
          a.updated_at = moment().format('ddd, DD MMM YYYY HH:mm:ss ZZ');
          a.enabled = 1;
          a.save(function (err) {
            if (err) {
              res.send(err, 500);
            } else {
              res.send(200);
            }
          });
        }
      }
    });
  } else {
    res.send('Ошибка установки приложения', 403);
  }
});

router.get('/uninstall', function(req, res) {
  if ((req.param('shop') !== '') && (req.param('token') !== '') && (req.param('insales_id') !== '') && req.param('shop') && req.param('token') && req.param('insales_id')) {
    Apps.findOne({insalesid:req.param('insales_id')}, function(err, a) {
      if (a.password == req.param('token')) {
        a.updated_at = moment().format('ddd, DD MMM YYYY HH:mm:ss ZZ');
        a.enabled = 0;
        a.save(function (err) {
          if (err) {
            res.send(err, 500);
          } else {
            res.send(200);
          }
        });
      } else {
        res.send('Ошибка удаления приложения', 403);
      }
    });
  } else {
    res.send('Ошибка удаления приложения', 403);
  }
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

var LicensesSchema = new Schema();

LicensesSchema.add({
  guid        : { type: Number, index: true },
  amount      : Number,
  currency    : String,
  quantity    : Number,
  enabled     : Boolean
});

var AppsSchema = new Schema();

AppsSchema.add({
  url         : { type: String, unique: true },
  insalesid   : String,
  password    : String,
  created_at  : Date,
  updated_at  : Date,
  enabled     : Boolean
});

var Users = mongoose.model('Users', UsersSchema);
var Apps = mongoose.model('Apps', AppsSchema);