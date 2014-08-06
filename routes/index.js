var express    = require('express'),
    router     = express.Router(),
    Q          = require('q'),
    rest       = require('restler'),
    xml2js     = require('xml2js'),
    crypto     = require('crypto'),
    mongoose   = require('mongoose'),
    moment     = require('moment'),
    Schema     = mongoose.Schema,
    hat        = require('hat'),
    async      = require('async'),
    Agenda     = require('agenda'),
    status     = {};

status = {
  'accepted'  : 'счёт оплачен',
  'declined'  : 'счёт отклолён',
  'pending'   : 'оплатить'
};

// Главная страница приложения, проверяет сессии и откуда пришёл человек, чтобы либо показать ему сразу панель управления, либо отправить на регистрацию.
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
    var insid = req.session.insalesid || req.query.insales_id;
    console.log('Попытка входа магазина: ' + insid);
    if ((req.query.insales_id && (req.query.insales_id !== '')) || req.session.insalesid !== undefined) {
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
                    console.log('Пользователь отсутствует');
                    res.clearCookie('user', { path: '/' });
                    res.clearCookie('insalesid', { path: '/' });
                    res.send('Пользователь отсутствует, нужно удалить и снова поставить приложение', 403);
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
                res.redirect('http://' + a.url + '/admin/applications/' + process.env.insalesid + '/login?token=' + id + '&login=http://' + process.env.redurl);
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

// Сюда приходит запрос при нахождении в панели управления приложением. Отвечает json'ом в котором список лицензий пользователя от которого приходит запрос(оплаченные или нет).
router.get('/licenses', function(req, res) {
  if (req.session.user) {
    var result = [];
    var s = '', e = '', st= '';
    Users.findOne({login:req.session.user}, function(err, u) {
      Apps.findOne({insalesid:u.insalesid}, function(err, a) {
        var iteration = function(row, callbackDone) {
          if (row.start !== undefined) {
            s = moment(row.start).format('DD-MM-YYYY');
            e = moment(row.start).add('M', row.months).format('DD-MM-YYYY');
          } else {
            s = '', e = '';
          }
          if (row.status == 'pending') {
            st = "<a class='uk-text-warning' href='http://" + a.url + "/admin/application_charges/" + row.insalesid + "'>" + status[row.status] + "</a>";
          } else if (row.status == 'accepted') {
            st = "<span class='uk-text-success'>" + status[row.status] + "</span>";
          } else {
            st = "<span class='uk-text-danger'>" + status[row.status] + "</span>";
          }
          result.push({operators: row.operators, months: row.months, amount: row.amount, status: st, start: s, end: e});
          callbackDone();
        };
        async.eachSeries(u.licenses, iteration, function (err) {
          res.contentType('application/json');
          res.send(result);
        });
      });
    });
  }
});

// Сюда приходит post запрос на создание счёта, здесь же дублируется калькулятор лицензий и цена считается ещё раз.
router.post('/licenses', function(req, res) {
  if (req.session.user) {
    var id = hat();
    Apps.findOne({insalesid:req.session.insalesid}, function(err, a) {
      if ((req.param('months') == 1) || (req.param('months') == 3) || (req.param('months') == 6) || (req.param('months') == 12) || (req.param('months') == 24)) {
        if ((req.param('operators') >= 0) && (req.param('operators') <= 100)) {
          var s = (parseInt(req.param('months'), 10)*960)*parseInt(req.param('operators'), 10);
          var invoice = '<?xml version=\"1.0\" encoding=\"UTF-8\"?>'
                      + '<application-charge>'
                      + '<name>' + req.param('months') + ' ' + get_correct_str(req.param('months'), "месяц", "месяца", "месяцев") + ' и ' + req.param('operators') + ' ' + get_correct_str(req.param('operators'), "оператор", "оператора", "операторов") + '</name>'
                      + '<price type=\"decimal\">' + s + '</price>'
                      + '<test type=\"boolean\">false</test>'
                      + '<return-url>http://' + process.env.redurl + '/check/' + id + '</return-url>'
                      + '</application-charge>';
          Users.findOne({login:req.session.user}, function(err, u) {
            if (u) {
              rest.post('http://' + process.env.insalesid + ':' + a.password + '@' + a.url + '/admin/application_charges.xml', {
                data: invoice,
                headers: {'Content-Type': 'application/xml'}
              }).once('complete', function(o) {
                u.licenses.push({
                  insalesid    : o['application-charge'].id[0]._,
                  myid         : id,
                  amount       : s,
                  operators    : parseInt(req.param('operators'), 10),
                  months       : parseInt(req.param('months'), 10),
                  status       : 'pending',
                  enabled      : true
                });
                u.save(function (err) {
                  if (err) {
                    res.send(err, 500);
                  } else {
                    res.send('http://' + a.url + '/admin/application_charges/' + o['application-charge'].id[0]._);
                  }
                });
              });
            } else {
              res.send('Пользователь не найден', 500);
            }
          });
        } else {
          res.send('Превышение количества операторов', 403);
        }
      } else {
        res.send('Нет такого количество месяцев', 403);
      }
    });
  }
});

// Сюда приходит запрос от insales, если пользователь оплатил счёт. Приложения проверяет это делая запрос в insales и если там отмечено оплачено, то генерит и активирует лицензию через api mercury
router.get('/check/:invoiceid', function(req, res) {
  Users.findOne({'licenses.myid':req.param('invoiceid')}, function(err, u) {
    if (u) {
      console.log(u);
      Apps.findOne({insalesid:u.insalesid}, function(err, a) {
        if (a) {
          rest.get('http://' + process.env.insalesid + ':' + a.password + '@' + a.url + '/admin/application_charges/' + u.licenses[0].insalesid + '.xml').once('complete', function(response) {
            if (response['application-charge']) {
              console.log(response);
              var iteration = function(row, callbackDone) {
                if (row.myid == req.param('invoiceid')) {
                  row.created_at = moment(response['application-charge']['created-at'][0]._).format('ddd, DD MMM YYYY HH:mm:ss ZZ');
                  row.updated_at = moment(response['application-charge']['updated-at'][0]._).format('ddd, DD MMM YYYY HH:mm:ss ZZ')
                  row.status = response['application-charge'].status[0];
                  if (response['application-charge'].status[0] == 'accepted') {
                    rest.get('http://my.redhelper.ru/mercury/api/license/generate?key=' + process.env.redkey + '&months=' + row.months + '&operators=' + row.operators).once('complete', function(r) {
                      console.log(JSON.stringify(r));
                      if (r.guid) {
                        row.guid = r.guid;
                        rest.get('http://my.redhelper.ru/mercury/api/license/activate?key=' + process.env.redkey + '&name=' + u.login + '&guid=' + row.guid + '&start=' + moment().format('YYYY-MM-DD')).once('complete', function(c) {
                          console.log(c);
                          if (c.success) {
                            row.start = moment().format('ddd, DD MMM YYYY HH:mm:ss ZZ');
                            callbackDone();
                          } else {
                            callbackDone();
                          }
                        });
                      } else {
                        console.log('Error: ' + JSON.stringify(r));
                        res.send(response.error);
                        callbackDone();
                      }
                    });
                  } else {
                    callbackDone();
                  }
                } else {
                  callbackDone();
                }
              };
              async.eachSeries(u.licenses, iteration, function (err) {
                u.save(function (err) {
                  if (err) {
                    res.send(err, 500);
                  } else {
                    console.log('All done');
                    res.send(200);
                  }
                });
              });
            } else {
              console.log('Error: ' + JSON.stringify(response));
              res.send(200);
            }
          });
        } else {
          res.send('Магазин отсутствует');
        }
      });
    } else {
      res.send('Счёт отсутствует');
    }
  });
});

// Сюда приходит запрос от insales на установку приложения
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

// Сюда приходит запрос на удаления приложения из insales
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

// Основная функция, используется при регистрации или ввода существующего аккаунта. Создаёт пользователя в своей базе и размещает js код на сайте.
function addJSTag(req, res) {
  var username = req.param('login').toLowerCase() || req.session.user;
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
                console.log('Код установлен');
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
    }
  });
}

function get_correct_str(num, str1, str2, str3) {
    var val = num % 100;
    if (val > 10 && val < 20) return num +' '+ str3;
    else {
        val = num % 10;
        if (val == 1) return num +' '+ str1;
        else if (val > 1 && val < 5) return num +' '+ str2;
        else return num +' '+ str3;
    }
}

var agenda = new Agenda({db: { address: 'mongodb.fr1.server.sovechkin.com/redhelper'}});

//Схемы коллекций(таблиц) монги

mongoose.connect('mongodb://mongodb.fr1.server.sovechkin.com/redhelper');

var LicensesSchema = new Schema();

LicensesSchema.add({
  guid        : { type: String, index: true },
  insalesid   : { type: String, index: true },
  myid        : { type: String, index: true },
  amount      : Number,
  start       : Date,
  operators   : Number,
  months      : Number,
  status      : String,
  created_at  : Date,
  updated_at  : Date,
  enabled     : Boolean
});

var UsersSchema = new Schema();

UsersSchema.add({
  login       : { type: String, unique: true },
  licenses    : [LicensesSchema],
  insalesid   : Number,
  created_at  : Date,
  updated_at  : Date,
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

//это самый не понятный кусок, здесь происходит запуск в полночь по гринвичу. Проход по всей базе, и запрос состояния не оплаченных лицензий. Если вдруг insales отвечает что лицензия оплачена, то мы меняем её в своей базе на оплаченную, генерим и активируем её через api redhelper.
agenda.define('check licenses', function(job, done) {
  Users.find({'licenses.status':'pending'}, {}, {sort: {'updated_at':-1}}, function(err, u) {
    var iteration = function(row, callbackDone) {
      Apps.findOne({insalesid:row.insalesid}, function(err, a) {
        if (a.enabled && a.install) {
          for ( var i = 0, l = row.licenses.length; i < l; i++ ) {
            if (row.licenses[i].status == 'pending') {
              (function(index) {
                var now = new Date().getTime();
                while(new Date().getTime() < now + 1000) {};
                rest.get('http://' + process.env.insalesid + ':' + a.password + '@' + a.url + '/admin/application_charges/' + row.licenses[index].insalesid + '.xml').once('complete', function(response) {
                  if ((response['application-charge'])&&(response['application-charge'].status[0] == 'accepted')) {
                    rest.get('http://my.redhelper.ru/mercury/api/license/generate?key=' + process.env.redkey + '&months=' + row.licenses[index].months + '&operators=' + row.licenses[index].operators).once('complete', function(r) {
                      console.log(JSON.stringify(r));
                      if (r.guid) {
                        row.licenses[index].guid = r.guid;
                        row.licenses[index].status = 'accepted';
                        rest.get('http://my.redhelper.ru/mercury/api/license/activate?key=' + process.env.redkey + '&name=' + row.login + '&guid=' + row.licenses[index].guid + '&start=' + moment().format('YYYY-MM-DD')).once('complete', function(c) {
                          console.log(c);
                          if (c.success) {
                            row.licenses[index].start = moment().format('ddd, DD MMM YYYY HH:mm:ss ZZ');
                            row.save(function (err) {
                              if (err) {
                                if (l == index+1) {
                                  callbackDone();
                                }
                              } else {
                                if (l == index+1) {
                                  callbackDone();
                                }
                              }
                            });
                          } else {
                            if (l == index+1) {
                              callbackDone();
                            }
                          }
                        });
                      } else {
                        console.log('Error: ' + JSON.stringify(r));
                        if (l == index+1) {
                          callbackDone();
                        }
                      }
                    });
                  } else if ((response['application-charge'])&&(response['application-charge'].status[0] == 'declined')) {
                    row.licenses[index].status = 'declined';
                    row.save(function (err) {
                      if (err) {
                        if (l == index+1) {
                          callbackDone();
                        }
                      } else {
                        if (l == index+1) {
                          callbackDone();
                        }
                      }
                    });
                  } else {
                    if (l == index+1) {
                      callbackDone();
                    }
                  }
                });
              })(i);
            } else {
              if (l == i+1) {
                callbackDone();
              }
            }
          }
        } else {
          console.log('Проверка лицензий. Магазин не активирован');
          callbackDone();
        }
      });
    };
    async.eachSeries(u, iteration, function (err) {
      done();
    });
  });
});

agenda.every('00 00 * * *', 'check licenses');
agenda.start();