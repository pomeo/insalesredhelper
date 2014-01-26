var express = require('express');
var router = express.Router();
var insales = require('insales');

router.get('/', function(req, res) {
  res.render('index', { title: 'Express' });
});

router.get('/install', function(req, res) {
  insales.install(req, function(id){
    (id) ? res.send(200, 'Приложение установлено') : res.send(500, 'Приложение не установлено');
  })
});

router.get('/uninstall', function(req, res) {
  insales.uninstall(req, function(del){
    (del === '1') ? res.send(200, 'Приложение удалено') : res.send(500, 'Приложение не удалено');
  })
});

module.exports = router;
