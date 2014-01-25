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

module.exports = router;
