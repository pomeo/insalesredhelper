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

// router.get('/js/install', function(req, res) {
//   var xml = '(function() {'
//           + 'var fileref = document.createElement(\"script\");'
//           + 'fileref.setAttribute(\"type\",\"text/javascript\");'
//           + 'fileref.id = \'rhlpscrtg\';'
//           + 'fileref.charset=\'utf-8\';'
//           + 'fileref.async = true;'
//           + 'fileref.setAttribute(\"src\", \"https://web.redhelper.ru/service/main.js?c=pomeotest1\");'
//           + 'document.getElementsByTagName(\"head\")[0].appendChild(fileref);'
//           + '})();';
// });

router.get('/install', function(req, res) {
  res.send(200);
});

router.get('/uninstall', function(req, res) {
  res.send(200);
});

module.exports = router;