var express    = require('express'),
    router     = express.Router(),
    Q          = require('q'),
    rest       = require('restler'),
    xml2js     = require('xml2js'),
    crypto     = require('crypto'),
    mongoose   = require('mongoose'),
    moment     = require('moment'),
    Schema     = mongoose.Schema,
    hat        = require('hat');

router.get('/', function(req, res) {
  if (req.query.token && (req.query.token !== '')) {
    Apps.findOne({token:req.query.token}, function(err, a) {
      if (a) {
        req.session.insalesid = a.insalesid;
        res.redirect('/');
      } else {
        res.send('Ошибка автологина', 403);
      }
    });
  } else {
    console.log('Попытка входа магазина: ' + req.query.insales_id);
    if ((req.query.insales_id && (req.query.insales_id !== '')) || req.session.insalesid) {
      var insid = req.session.insalesid || req.query.insales_id;
      Apps.findOne({insalesid:insid}, function(err, a) {
        if (a.enabled == true) {
          if (req.session.insalesid) {
            if (a.install == true) {
              Users.findOne({insalesid:insid}, {}, {sort: {'updated_at':-1}}, function(err, u) {
                if (u) {
                  console.log(u);
                  req.session.user = u.login;
                  res.render('dashboard', { title: '' });
                } else {
                  req.session.destroy(function() {
                    console.log(req.session.user);
                    console.log('Пользователь отсутствует');
                    res.clearCookie('user', { path: '/' });
                    res.clearCookie('insalesid', { path: '/' });
                    res.send('Пользователь отсутствует', 403);
                  });
                }
              });
            } else {
              res.render('index', { title: '' });
            }
          } else {
            console.log('авторизация');
            var id = hat();
            a.token = crypto.createHash('md5').update(id + a.password).digest('hex');
            a.save(function (err) {
              if (err) {
                res.send(err, 500);
              } else {
                res.redirect('http://' + a.url + '/admin/applications/' + process.env.insalesid + '/login?token=' + id + '&login=http://test3.sovechkin.com');
              }
            });
          }
        } else {
          res.send('Приложение не установлено для данного магазина', 403);
        }
      });
    } else {
      res.send('Вход возможен только из панели администратора insales -> приложения -> установленные -> войти', 403);
    }
  }
});

router.get('/login', function(req, res) {
  if (req.session.insalesid) {
    res.render('login', { title: '' });
  } else {
    res.send('Вход возможен только из панели администратора insales -> приложения -> установленные -> войти', 403);
  }
});

router.post('/login', function(req, res) {
  if (req.session.insalesid) {
    addJSTag(req, res);
  } else {
    res.send('Вход возможен только из панели администратора insales -> приложения -> установленные -> войти', 403);
  }
});

router.get('/registration', function(req, res) {
  if (req.session.insalesid) {
    res.render('registration', { title: '' });
  } else {
    res.send('Вход возможен только из панели администратора insales -> приложения -> установленные -> войти', 403);
  }
});

router.post('/registration', function(req, res) {
  if (req.session.insalesid) {
    addJSTag(req, res);
  } else {
    res.send('Вход возможен только из панели администратора insales -> приложения -> установленные -> войти', 403);
  }
});

router.post('/licenses', function(req, res) {
  if (req.session.user) {
    Apps.findOne({insalesid:req.session.insalesid}, function(err, a) {
      var invoice = '<?xml version=\"1.0\" encoding=\"UTF-8\"?>'
                  + '<application-charge>'
                  + '<name>' +  + '</name>'
                  + '<price type=\"decimal\">' +  + '</price>'
                  + '<test type=\"boolean\">true</test>'
                  + '<return-url>http://test3.sovechkin.com/check/12345</return-url>'
                  + '</application-charge>';
      rest.post('http://' + process.env.insalesid + ':' + a.password + '@' + a.url + '/admin/application_charges.xml', {
        data: invoice,
        headers: {'Content-Type': 'application/xml'}
      }).once('complete', function(o) {
        console.log(o);
        res.send(200);
      });
    });
  }
});

router.get('/check/:invoiceid', function(req, res) {
  req.param('invoiceid');
  res.send(200);
});

router.get('/install', function(req, res) {
  if ((req.query.shop !== '') && (req.query.token !== '') && (req.query.insales_id !== '') && req.query.shop && req.query.token && req.query.insales_id) {
    Apps.findOne({insalesid:req.query.insales_id}, function(err, a) {
      if (a == null) {
        var app = new Apps({
          insalesid  : req.query.insales_id,
          url        : req.query.shop,
          password   : crypto.createHash('md5').update(req.query.token + process.env.insalessecret).digest('hex'),
          created_at : moment().format('ddd, DD MMM YYYY HH:mm:ss ZZ'),
          updated_at : moment().format('ddd, DD MMM YYYY HH:mm:ss ZZ'),
          enabled    : true
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
          a.password = crypto.createHash('md5').update(req.query.token + process.env.insalessecret).digest('hex');
          a.updated_at = moment().format('ddd, DD MMM YYYY HH:mm:ss ZZ');
          a.enabled = true;
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
  if ((req.query.shop !== '') && (req.query.token !== '') && (req.query.insales_id !== '') && req.query.shop && req.query.token && req.query.insales_id) {
    Apps.findOne({insalesid:req.query.insales_id}, function(err, a) {
      if (a.password == req.query.token) {
        a.updated_at = moment().format('ddd, DD MMM YYYY HH:mm:ss ZZ');
        a.install = false;
        a.enabled = false;
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

function addJSTag(req, res) {
  var username = req.session.user || req.param('login').toLowerCase();
  Users.findOne({login:username}, function(err, u) {
    if (u) {
      u.insalesid = req.session.insalesid;
      u.updated_at = moment().format('ddd, DD MMM YYYY HH:mm:ss ZZ');
      u.save(function (err) {
        if (err) {
          res.send(err, 500);
        } else {
          Apps.findOne({insalesid:req.session.insalesid}, function(err, a) {
            var xml = '(function() {'
                    + 'var fileref = document.createElement(\"script\");'
                    + 'fileref.setAttribute(\"type\",\"text/javascript\");'
                    + 'fileref.id = \'rhlpscrtg\';'
                    + 'fileref.charset=\'utf-8\';'
                    + 'fileref.async = true;'
                    + 'fileref.setAttribute(\"src\", \"https://web.redhelper.ru/service/main.js?c=' + username + '\");'
                    + 'document.getElementsByTagName(\"head\")[0].appendChild(fileref);'
                    + '})();';
            var jstag = '<js-tag>'
                      + '<type type="string">JsTag::TextTag</type>'
                      + '<content>' + xml + '</content>'
                      + '</js-tag>';
            rest.post('http://' + process.env.insalesid + ':' + a.password + '@' + a.url + '/admin/js_tags.xml', {
              data: jstag,
              headers: {'Content-Type': 'application/xml'}
            }).once('complete', function(o) {
              if (o.errors) {
                console.log('Error: ' + JSON.stringify(o));
                res.send('Произошла ошибка установки js кода', 500);
              } else {
                console.log(o);
                a.install = true;
                a.save(function (err) {
                  if (err) {
                    res.send(err, 500);
                  } else {
                    req.session.user = username;
                    res.redirect('/');
                  }
                });
              }
            });
          });
        }
      });
    } else {
      if (req.param('login') && !req.param('pass') && !req.param('email') && !req.param('name') && !req.param('phone')) {
        var user = new Users({
          login      : username,
          insalesid  : req.session.insalesid,
          created_at : moment().format('ddd, DD MMM YYYY HH:mm:ss ZZ'),
          updated_at : moment().format('ddd, DD MMM YYYY HH:mm:ss ZZ'),
          enabled    : true
        });
        user.save(function (err) {
          if (err) {
            res.send(err, 500);
          } else {
            Apps.findOne({insalesid:req.session.insalesid}, function(err, a) {
              var xml = '(function() {'
                      + 'var fileref = document.createElement(\"script\");'
                      + 'fileref.setAttribute(\"type\",\"text/javascript\");'
                      + 'fileref.id = \'rhlpscrtg\';'
                      + 'fileref.charset=\'utf-8\';'
                      + 'fileref.async = true;'
                      + 'fileref.setAttribute(\"src\", \"https://web.redhelper.ru/service/main.js?c=' + username + '\");'
                      + 'document.getElementsByTagName(\"head\")[0].appendChild(fileref);'
                      + '})();';
              var jstag = '<js-tag>'
                        + '<type type="string">JsTag::TextTag</type>'
                        + '<content>' + xml + '</content>'
                        + '</js-tag>';
              rest.post('http://' + process.env.insalesid + ':' + a.password + '@' + a.url + '/admin/js_tags.xml', {
                data: jstag,
                headers: {'Content-Type': 'application/xml'}
              }).once('complete', function(o) {
                if (o.errors) {
                  console.log('Error: ' + JSON.stringify(o));
                  res.send('Произошла ошибка установки js кода', 500);
                } else {
                  console.log(o);
                  a.install = true;
                  a.save(function (err) {
                    if (err) {
                      res.send(err, 500);
                    } else {
                      req.session.user = username;
                      res.redirect('/');
                    }
                  });
                }
              });
            });
          }
        });
      } else {
        rest.get('http://my.redhelper.ru/mercury/api/client/register?key=' + process.env.redkey + '&name=' + req.param('login') + '&password=' + req.param('pass') + '&email=' + req.param('email') + '&contactfio=' + req.param('name') + '&contactphone=' + req.param('phone') + '&comment=distributor=InSales').once('complete', function(response) {
          console.log(JSON.stringify(response));
          if (response.error) {
            res.send(response.error);
          } else if (response.success) {
            var user = new Users({
              login      : username,
              insalesid  : req.session.insalesid,
              created_at : moment().format('ddd, DD MMM YYYY HH:mm:ss ZZ'),
              updated_at : moment().format('ddd, DD MMM YYYY HH:mm:ss ZZ'),
              enabled    : true
            });
            user.save(function (err) {
              if (err) {
                res.send(err, 500);
              } else {
                Apps.findOne({insalesid:req.session.insalesid}, function(err, a) {
                  var xml = '(function() {'
                          + 'var fileref = document.createElement(\"script\");'
                          + 'fileref.setAttribute(\"type\",\"text/javascript\");'
                          + 'fileref.id = \'rhlpscrtg\';'
                          + 'fileref.charset=\'utf-8\';'
                          + 'fileref.async = true;'
                          + 'fileref.setAttribute(\"src\", \"https://web.redhelper.ru/service/main.js?c=' + username + '\");'
                          + 'document.getElementsByTagName(\"head\")[0].appendChild(fileref);'
                          + '})();';
                  var jstag = '<js-tag>'
                            + '<type type="string">JsTag::TextTag</type>'
                            + '<content>' + xml + '</content>'
                            + '</js-tag>';
                  rest.post('http://' + process.env.insalesid + ':' + a.password + '@' + a.url + '/admin/js_tags.xml', {
                    data: jstag,
                    headers: {'Content-Type': 'application/xml'}
                  }).once('complete', function(o) {
                    if (o.errors) {
                      console.log('Error: ' + JSON.stringify(o));
                      res.send('Произошла ошибка установки js кода', 500);
                    } else {
                      console.log(o);
                      a.install = true;
                      a.save(function (err) {
                        if (err) {
                          res.send(err, 500);
                        } else {
                          req.session.user = username;
                          res.send(response.success);
                        }
                      });
                    }
                  });
                });
              }
            });
          }
        });
      }
    }
  });
}

mongoose.connect('mongodb://mongodb.fr1.server.sovechkin.com/redhelper');

var UsersSchema = new Schema();

UsersSchema.add({
  login       : { type: String, unique: true },
  licenses    : [LicensesSchema],
  insalesid   : Number,
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
  insalesid   : Number,
  password    : String,
  token       : String,
  created_at  : Date,
  updated_at  : Date,
  install     : Boolean,
  enabled     : Boolean
});

var Users = mongoose.model('Users', UsersSchema);
var Apps = mongoose.model('Apps', AppsSchema);