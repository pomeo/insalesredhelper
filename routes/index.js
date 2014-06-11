var express    = require('express'),
    router     = express.Router(),
    mongoose   = require('mongoose'),
    Schema     = mongoose.Schema;

router.get('/', function(req, res) {
  res.render('index', { title: '' });
});

router.post('/', function(req, res) {
  res.redirect('/');
});


router.get('/install', function(req, res) {
  res.send(200);
});

router.get('/uninstall', function(req, res) {
  res.send(200);
});

module.exports = router;